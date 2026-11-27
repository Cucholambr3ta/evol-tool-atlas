/**
 * Lightweight, typed ATDS summary per tool for the PWA (ATDS-UI-01..04).
 *
 * Built at build time from the authoritative validator result (evaluateTool), so
 * the browser never re-implements ATDS heuristics. Only what a sheet needs is kept;
 * the full >100k-line report is not published.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const ATDS_SUMMARY_SCHEMA = 'evol-tool-atlas/atds-summary/1';
const MAX_FINDINGS = 6;
const SAFE_REL_RE = /^[a-z0-9._/-]+$/i;

const RESOURCE_FILES = [
  ['metadata', 'metadata.json'],
  ['guide', 'GUIA.md'],
  ['skill', 'SKILL.md'],
  ['cases', 'casos-uso.json'],
  ['evidence', 'evidencias.json'],
];

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Deterministic revision of the documentary content that defines the ATDS state.
 *
 * @param {string} root
 * @param {string} toolDir
 */
export function contentRevision(root, toolDir) {
  const h = createHash('sha256');
  for (const [, file] of RESOURCE_FILES) {
    const p = path.join(root, toolDir, file);
    h.update(`${file}\0`);
    h.update(fs.existsSync(p) ? sha256(fs.readFileSync(p)) : 'absent');
    h.update('\n');
  }
  return h.digest('hex');
}

/** Check state of a resource as reported by the validator. */
function resourceCheck(kind, result) {
  const c = result.checks || {};
  switch (kind) {
    case 'metadata': return c.L1_METADATA === 'FAIL' ? 'FAIL' : (result.validatedLevel === 'NONE' ? 'FAIL' : 'PASS');
    case 'guide': return c.L2_GUIA || 'BLOCKED';
    case 'skill': return c.L3_SKILL || 'BLOCKED';
    case 'cases': return c.L3_CASOS || 'BLOCKED';
    case 'evidence': return c.L4_EVIDENCIA || 'BLOCKED';
    default: return 'BLOCKED';
  }
}

function isAuthorizedArtifactPath(rel, toolDir, root) {
  if (typeof rel !== 'string' || !SAFE_REL_RE.test(rel) || rel.includes('..')) return false;
  if (!rel.startsWith(`${toolDir}/`)) return false;
  return fs.existsSync(path.join(root, rel));
}

function str(v) {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/**
 * @param {{ id: string, href: string }} tool
 * @param {import('./evaluate.d.mts').ToolEvaluation} result
 * @param {string} root
 */
export function buildAtdsSummary(tool, result, root) {
  const toolDir = path.posix.dirname(tool.href);
  const resources = RESOURCE_FILES.map(([kind, file]) => {
    const state = (result.resources && result.resources[kind]) || { present: false, valid: false };
    const rel = `${toolDir}/${file}`;
    return {
      kind,
      file,
      href: state.present ? rel : null,
      present: Boolean(state.present),
      valid: Boolean(state.valid),
      check: resourceCheck(kind, result),
    };
  });

  // Evidence records: display fields from evidencias.json, status strictly from the
  // validator's integrity result for the same record.
  let evidence = null;
  const evPath = path.join(root, toolDir, 'evidencias.json');
  if (fs.existsSync(evPath)) {
    const raw = readJsonSafe(evPath);
    const rawRecords = raw && Array.isArray(raw.registros) ? raw.registros : [];
    const integrityById = new Map((result.evidenceIntegrity || []).map((i) => [i.id, i]));
    const records = rawRecords
      .map((r, index) => {
        if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
        const id = str(r.id) || `INDEX_${index}`;
        const integ = integrityById.get(id) || null;
        const accredited = Boolean(integ && integ.supportsL4);
        const artifacts = integ
          ? integ.artifacts.map((a) => ({
              nombre: a.nombre,
              path: a.path,
              role: a.role,
              status: a.status,
              href: isAuthorizedArtifactPath(a.path, toolDir, root) ? a.path : null,
            }))
          : [];
        const reasons = [];
        if (integ && integ.resultado === 'PASS' && !integ.supportsL4) {
          if (!integ.complete) reasons.push('REGISTRO_INCOMPLETO');
          if (!integ.identityOk) reasons.push('IDENTIDAD_NO_COINCIDE');
          if (!integ.typeOk) reasons.push('TIPO_NO_ACREDITA_FUNCIONALIDAD');
          if (integ.versionOnly) reasons.push('SOLO_VERSION_O_DISPONIBILIDAD');
          if (integ.artifacts.some((a) => !['VERIFIED', 'VERIFIED_VIA_PRIMARY', 'VERIFIED_BY_EXCEPTION'].includes(a.status))) {
            reasons.push('ARTEFACTOS_SIN_INTEGRIDAD_DEMOSTRADA');
          }
        }
        return {
          id,
          resultado: str(r.resultado) || 'SIN_RESULTADO',
          tipo: str(r.tipo),
          objetivo: str(r.objetivo) || str(r.caso_uso) || null,
          alcance: integ ? integ.scope : 'none',
          version: str(r.version),
          entorno: str(r.entorno),
          fecha: str(r.fecha),
          criterio: str(r.criterio_aceptacion),
          observado: str(r.resultado_observado),
          resumen: str(r.resumen),
          limitaciones: Array.isArray(r.limitaciones) ? r.limitaciones.map(String) : [],
          integrity: integ && integ.resultado === 'PASS' ? (accredited ? 'VERIFICADA' : 'NO_ACREDITADA') : 'NO_APLICA',
          reasons,
          artifacts,
        };
      })
      .filter(Boolean);
    evidence = {
      schemaStatus: result.evidenceSchemaStatus,
      records,
      pendientes: raw && Array.isArray(raw.pendientes) ? raw.pendientes.map(String) : [],
      verifiedCount: (result.verifiedEvidenceRefs || []).length,
      declaredCount: (result.declaredEvidenceRefs || []).length,
    };
  }

  const blocking = (result.findings || []).filter((f) => f.blocking);
  const warnings = (result.findings || []).filter((f) => f.severity === 'WARNING');
  return {
    schema: ATDS_SUMMARY_SCHEMA,
    candidateLevel: result.candidateLevel,
    validatedLevel: result.validatedLevel,
    status: result.status,
    reviewRequired: Boolean(result.reviewRequired),
    blockingCount: blocking.length,
    warningCount: warnings.length,
    findings: [...blocking, ...warnings].slice(0, MAX_FINDINGS).map((f) => ({
      code: f.code,
      doc: f.doc,
      level: f.level,
      severity: f.severity,
      blocking: Boolean(f.blocking),
    })),
    resources,
    evidence,
    contentRevision: contentRevision(root, toolDir),
  };
}
