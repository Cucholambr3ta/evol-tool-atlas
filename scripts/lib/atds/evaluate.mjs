import fs from 'node:fs';
import path from 'node:path';
import { readJsonWithin, resolveWithin, toolDirFromHref, ROOT } from './paths.mjs';
import { normalizeMetadata, VAGUE_PATTERNS } from './normalize.mjs';
import { checkGuideContent } from './guide.mjs';
import { checkSkillContent } from './skill.mjs';
import { checkCasesContent } from './cases.mjs';
import { checkEvidenceContent } from './evidence.mjs';
import {
  evaluateL1, evaluateL2, evaluateL3, evaluateL4,
  computeLevels, computeStatus, parseLevel, levelRank,
} from './classify.mjs';
import { findingFromCode, makeFinding, isStructuralCode } from './diagnostics.mjs';

/** Raised for operational problems (bad arguments, unknown targets...). */
class OperationalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OperationalError';
  }
}

function safeFile(root, toolDir, name) {
  const resolved = resolveWithin(root, path.posix.join(toolDir, name), { allowMissing: true });
  return resolved.ok ? resolved.path : null;
}

function exists(p) {
  return Boolean(p) && fs.existsSync(p);
}

/** Cascade markers (`L3_BLOCKED_BY_L2`) restate a lower-level failure; they stay in `issues` only. */
const CASCADE_RE = /^L[2-4]_BLOCKED_BY_L[1-3]$/;

function buildFindings(issues, warnings, toolId, toolDir) {
  return [
    ...issues.filter((code) => !CASCADE_RE.test(code)).map((code) => findingFromCode(code, { severity: 'ERROR', toolId, toolDir })),
    ...warnings.map((code) => findingFromCode(code, { severity: 'WARNING', toolId, toolDir })),
  ];
}

function emptyResult(tool, toolDir, code) {
  return {
    toolId: tool.id,
    toolDir,
    catalogId: null,
    validatedLevel: 'NONE',
    candidateLevel: 'NONE',
    status: 'ERROR',
    reviewRequired: true,
    checks: { L1_METADATA: 'FAIL' },
    issues: [code],
    warnings: [],
    findings: buildFindings([code], [], tool.id, toolDir),
    evidenceRefs: [],
    declaredEvidenceRefs: [],
    verifiedEvidenceRefs: [],
    evidenceIntegrity: [],
    evidenceSchemaStatus: 'NOT_EVALUATED',
    resources: emptyResources(),
    checkedFiles: [],
    limitations: [],
  };
}

function emptyResources() {
  return {
    metadata: { present: false, valid: false },
    guide: { present: false, valid: false },
    skill: { present: false, valid: false },
    cases: { present: false, valid: false },
    evidence: { present: false, valid: false },
  };
}

/**
 * A result for a tool whose evaluation raised an unexpected exception. The error
 * is reported as a structural finding with its location; other tools continue.
 */
function evaluationErrorResult(tool, err) {
  const toolDir = toolDirFromHref(tool && tool.href);
  const result = emptyResult(tool || { id: 'SIN_ID' }, toolDir, 'EVALUATION_ERROR');
  result.limitations = [`Evaluación interrumpida: ${err && err.message ? err.message : String(err)}`];
  return result;
}

/**
 * Evaluate one catalogue entry against ATDS v1.
 *
 * @param {{ id: string, href: string, cat?: number }} tool
 * @param {{ root?: string }} [options] documentary root (defaults to the repository)
 */
function evaluateTool(tool, options = {}) {
  const root = options.root || ROOT;
  const toolDir = toolDirFromHref(tool.href);

  const metaResult = readJsonWithin(root, path.posix.join(toolDir, 'metadata.json'));
  if (!metaResult.ok) {
    const code = metaResult.error === 'INVALID_JSON' ? 'INVALID_METADATA_JSON'
      : metaResult.error === 'MISSING' ? 'MISSING_METADATA'
        : (isStructuralCode(metaResult.error) ? metaResult.error : 'MISSING_METADATA');
    return emptyResult(tool, toolDir, code);
  }

  const normalizedMeta = normalizeMetadata(metaResult.data, toolDir);
  normalizedMeta.VAGUE_PATTERNS = VAGUE_PATTERNS;

  const guidePath = safeFile(root, toolDir, 'GUIA.md');
  const skillPath = safeFile(root, toolDir, 'SKILL.md');
  const casesPath = safeFile(root, toolDir, 'casos-uso.json');
  const evidencePath = safeFile(root, toolDir, 'evidencias.json');

  const issues = [];
  const warnings = [];
  const checks = {};

  const l1Result = evaluateL1(normalizedMeta);
  issues.push(...l1Result.issues);
  warnings.push(...l1Result.warnings);
  Object.assign(checks, l1Result.checks);

  const guideResult = guidePath ? checkGuideContent(guidePath, normalizedMeta.toolType) : { valid: false, issues: ['MISSING_GUIDA'], warnings: [], sections: [], stats: {} };
  const l2Result = evaluateL2(l1Result, guideResult, normalizedMeta);
  issues.push(...l2Result.issues.filter((i) => i.startsWith('L2_')));
  warnings.push(...l2Result.warnings.filter((w) => w.startsWith('L2_')));
  Object.assign(checks, l2Result.checks);

  const skillResult = checkSkillContent(skillPath || '');
  const casesResult = checkCasesContent(casesPath || '');
  const l3Result = evaluateL3(l2Result, skillResult, casesResult);
  issues.push(...l3Result.issues.filter((i) => i.startsWith('L3_')));
  warnings.push(...l3Result.warnings.filter((w) => w.startsWith('L3_')));
  Object.assign(checks, l3Result.checks);

  const rawMeta = metaResult.data && typeof metaResult.data === 'object' ? metaResult.data : {};
  const identity = {
    id: typeof rawMeta.id === 'string' && rawMeta.id.trim() ? rawMeta.id.trim() : tool.id,
    nombre: typeof rawMeta.nombre === 'string' ? rawMeta.nombre : normalizedMeta.nombre,
    id_catalogo: typeof rawMeta.id_catalogo === 'string' && rawMeta.id_catalogo.trim() ? rawMeta.id_catalogo.trim() : null,
    exceptionsPath: options.provenanceExceptionsPath,
    today: options.today,
  };
  const evidenceResult = checkEvidenceContent(evidencePath || '', root, root, identity);
  const l4Result = evaluateL4(l3Result, evidenceResult);
  issues.push(...l4Result.issues.filter((i) => i.startsWith('L4_')));
  warnings.push(...l4Result.warnings.filter((w) => w.startsWith('L4_')));
  Object.assign(checks, l4Result.checks);
  // ATDS-ROB-02: a malformed evidence schema is always diagnosed, even when L4 is
  // not evaluated because a lower level fails (then it does not block).
  if (!l3Result.passed && evidenceResult.schemaStatus === 'INVALID_SCHEMA') {
    warnings.push(...evidenceResult.issues.filter((i) => i.startsWith('EVIDENCE_SCHEMA_')).map((i) => `L4_${i}`));
  }

  // Structural JSON corruption is reported regardless of the level reached.
  if (casesResult.issues.includes('INVALID_CASOS_USO_JSON') && !issues.includes('INVALID_CASOS_USO_JSON')) issues.push('INVALID_CASOS_USO_JSON');
  if (evidenceResult.issues.includes('INVALID_EVIDENCIAS_JSON') && !issues.includes('INVALID_EVIDENCIAS_JSON')) issues.push('INVALID_EVIDENCIAS_JSON');

  const resourceStates = {
    metadata: { present: true, valid: l1Result.passed },
    guide: { present: exists(guidePath), valid: Boolean(guideResult.valid) },
    skill: { present: exists(skillPath), valid: Boolean(skillResult.valid) },
    cases: { present: exists(casesPath), valid: Boolean(casesResult.valid && casesResult.stats.substantive > 0) },
    evidence: { present: exists(evidencePath), valid: evidenceResult.schemaStatus === 'OK' || evidenceResult.schemaStatus === 'EMPTY' },
  };
  const resources = {
    metadata: true,
    guide: exists(guidePath),
    skillOrCases: exists(skillPath) || (casesResult.stats.total > 0),
    evidencePass: evidenceResult.stats.passTotal > 0,
  };
  const { candidateLevel, validatedLevel } = computeLevels(l1Result, l2Result, l3Result, l4Result, resources);
  const status = computeStatus(issues, warnings);

  const findings = buildFindings(issues, warnings, tool.id, toolDir);
  const limitations = [...evidenceResult.limitations];
  if (normalizedMeta.urls.length > 0) {
    // DOC-12: no network verification is performed; links are only identified.
    findings.push(makeFinding({
      code: 'DOC12_LINKS_NOT_CHECKED',
      doc: 'DOC-12',
      level: 'L1',
      severity: 'INFO',
      blocking: false,
      toolId: tool.id,
      file: `${toolDir}/metadata.json`,
      field: 'urls',
      message: `${normalizedMeta.urls.length} enlace(s) identificados sin comprobación de red; no se afirma que estén vigentes ni rotos.`,
      evidence: normalizedMeta.urls,
    }));
    limitations.push('Enlaces externos no comprobados por red (DOC-12).');
  }

  return {
    toolId: tool.id,
    toolDir,
    catalogId: normalizedMeta.id_catalogo || null,
    validatedLevel,
    candidateLevel,
    status,
    reviewRequired: findings.some((f) => f.severity === 'WARNING'),
    checks,
    issues,
    warnings,
    findings,
    evidenceRefs: l4Result.evidenceRefs || [],
    declaredEvidenceRefs: evidenceResult.declaredEvidenceRefs,
    verifiedEvidenceRefs: evidenceResult.verifiedEvidenceRefs,
    evidenceIntegrity: evidenceResult.integrity,
    evidenceSchemaStatus: evidenceResult.schemaStatus,
    resources: resourceStates,
    checkedFiles: [guidePath, skillPath, casesPath, evidencePath].filter(exists).map((p) => path.relative(root, p)),
    limitations,
  };
}

/**
 * STRICT policy: the tool must reach `minLevel`, and no blocking finding of a
 * level up to `minLevel` (or a structural one) may remain. Findings that only
 * concern higher levels never block.
 *
 * @param {{ validatedLevel: string, findings: Array<{ level: string, blocking: boolean, code: string }> }} result
 * @param {string|null|undefined} minLevel defaults to L1
 */
function evaluateStrict(result, minLevel) {
  const required = minLevel === undefined || minLevel === null ? 'L1' : parseLevel(minLevel);
  if (!required) throw new OperationalError(`Nivel mínimo inválido: ${String(minLevel)} (use NONE, L1, L2, L3 o L4)`);
  const requiredRank = levelRank(required);
  const current = parseLevel(result.validatedLevel) || 'NONE';
  const belowMinimum = levelRank(current) < requiredRank;

  const relevant = [];
  const excluded = [];
  for (const f of result.findings || []) {
    if (!f.blocking) continue;
    const inPolicy = f.level === 'STRUCT' || levelRank(f.level) <= requiredRank;
    (inPolicy ? relevant : excluded).push(f.code);
  }

  const passed = !belowMinimum && relevant.length === 0;
  let explanation;
  if (passed) explanation = `Nivel validado ${current} cumple el mínimo ${required}; ${excluded.length} hallazgo(s) de niveles superiores no bloquean esta política.`;
  else if (belowMinimum) explanation = `Nivel validado ${current} inferior al mínimo ${required}.`;
  else explanation = `Existen ${relevant.length} hallazgo(s) bloqueante(s) dentro de la política ${required}.`;

  return {
    inScope: true,
    passed,
    currentLevel: current,
    requiredLevel: required,
    belowMinimum,
    blockingIssues: relevant.length,
    issues: relevant,
    excludedHigherLevelIssues: excluded.length,
    explanation,
  };
}

/**
 * Resolve STRICT targets against a catalogue. Each target may be a tool id,
 * a tool directory, or a catalogue id (id_catalogo from metadata). Unknown
 * targets are an operational error.
 *
 * @param {Array<{ id: string, href: string }>} tools
 * @param {string[]} targets
 * @param {string} [root]
 * @returns {Array<{ target: string, tool: { id: string, href: string } }>}
 */
function resolveTargets(tools, targets, root = ROOT) {
  const byKey = new Map();
  for (const t of tools) {
    byKey.set(t.id, t);
    byKey.set(toolDirFromHref(t.href), t);
  }
  const unmatched = targets.filter((target) => !byKey.has(target));
  if (unmatched.length > 0) {
    for (const t of tools) {
      const meta = readJsonWithin(root, path.posix.join(toolDirFromHref(t.href), 'metadata.json'));
      if (meta.ok && meta.data && typeof meta.data === 'object' && typeof meta.data.id_catalogo === 'string') {
        byKey.set(meta.data.id_catalogo, t);
      }
    }
  }
  const missing = targets.filter((target) => !byKey.has(target));
  if (missing.length > 0) throw new OperationalError(`Target(s) inexistente(s) en el catálogo: ${missing.join(', ')}`);
  return targets.map((target) => ({ target, tool: byKey.get(target) }));
}

/**
 * evaluateTool that never throws for a single tool (ATDS-ROB-01): an unexpected
 * exception becomes a structural EVALUATION_ERROR result for that tool only.
 */
function evaluateToolSafe(tool, options = {}) {
  try {
    return evaluateTool(tool, options);
  } catch (err) {
    if (err instanceof OperationalError) throw err;
    return evaluationErrorResult(tool, err);
  }
}

export { evaluateTool, evaluateToolSafe, evaluateStrict, resolveTargets, OperationalError };
