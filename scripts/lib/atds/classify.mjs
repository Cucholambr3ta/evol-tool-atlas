import { isVerifiedValue, isPlaceholderUrl, isIsoDate } from './normalize.mjs';
import { isStructuralCode } from './diagnostics.mjs';

/** Ordered ATDS levels. */
const LEVELS = ['NONE', 'L1', 'L2', 'L3', 'L4'];
const LEVEL_RANK = { NONE: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

/**
 * L1 requirements. `field` is the metadata field (or alternatives) the
 * diagnostic points at; `check` receives the normalised metadata.
 */
const L1_FIELDS = {
  // Identity must be declared in metadata.json; a value inferred from the
  // directory name (normalizeMetadata fallback) does not count.
  id: { field: 'id', check: (m) => (m.raw ? isVerifiedValue(m.raw.id) || isVerifiedValue(m.raw.id_catalogo) : isVerifiedValue(m.id)) },
  nombre: { field: 'nombre', check: (m) => isVerifiedValue(m.raw ? m.raw.nombre : m.nombre) },
  descripcion: {
    field: 'descripcion',
    check: (m) => isVerifiedValue(m.descripcion) &&
      String(m.descripcion).trim().length > 20 &&
      !String(m.descripcion).includes('Herramienta de'),
  },
  categoria: { field: 'categoria', check: (m) => isVerifiedValue(m.categoria) },
  tipo: { field: 'tipo', check: (m) => isVerifiedValue(m.tipo) },
  problema: { field: 'problema_que_resuelve', check: (m) => isVerifiedValue(m.problema_que_resuelve) },
  funciones: { field: 'funciones_principales', check: (m) => isVerifiedValue(m.funciones_principales) },
  fuente: { field: 'fuentes_oficiales|referencias_oficiales|upstream|sitio_web', check: (m) => identifiedSources(m).length > 0 },
  plataformas: { field: 'sistema_operativo', check: (m) => isVerifiedValue(m.sistema_operativo) },
  limitaciones: { field: 'limites', check: (m) => Array.isArray(m.limites) && m.limites.some((l) => isVerifiedValue(l)) },
  estado: { field: 'estado_fuente', check: (m) => isVerifiedValue(m.estado_fuente) },
  fecha_verificacion: { field: 'fecha_verificacion', check: (m) => isVerifiedValue(m.fecha_verificacion) && isIsoDate(m.fecha_verificacion) },
  licencia: { field: 'licencia', check: (m) => isVerifiedValue(m.licencia) },
};

const L2_META_FIELDS = {
  licencia: { field: 'licencia' },
  sistema_operativo: { field: 'sistema_operativo' },
  dependencias: { field: 'dependencias' },
  requisitos: { field: 'requisitos' },
};

/** Source URLs that identify a real upstream (placeholder hosts excluded). */
function identifiedSources(m) {
  const urls = Array.isArray(m.urls) ? m.urls : [];
  return urls.filter((u) => typeof u === 'string' && !isPlaceholderUrl(u));
}

function hasValue(v) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

function evaluateL1(normalizedMeta) {
  const m = normalizedMeta || {};
  const issues = [];
  const warnings = [];
  const checks = {};
  let passed = 0;

  for (const [key, { check }] of Object.entries(L1_FIELDS)) {
    const ok = Boolean(check(m));
    const KEY = key.toUpperCase();
    checks[`L1_${KEY}`] = ok ? 'PASS' : 'FAIL';
    if (ok) {
      passed++;
      continue;
    }
    if (key === 'fuente') {
      const urls = Array.isArray(m.urls) ? m.urls : [];
      issues.push(urls.length > 0 ? 'L1_SOURCE_PLACEHOLDER_ONLY' : 'L1_MISSING_FUENTE');
    } else if (key === 'descripcion' && isVerifiedValue(m.descripcion)) {
      issues.push('L1_DESCRIPTION_GENERIC');
    } else if (key === 'fecha_verificacion' && isVerifiedValue(m.fecha_verificacion)) {
      issues.push('L1_INVALID_FECHA_VERIFICACION');
    } else if (key === 'limitaciones' ? (Array.isArray(m.limites) && m.limites.length > 0) : hasValue(m[L1_FIELDS[key].field])) {
      // A value exists but it is a provisional marker (PENDIENTE, N/A, ...).
      issues.push(`L1_UNVERIFIED_${KEY}`);
    } else {
      issues.push(`L1_MISSING_${KEY}`);
    }
  }

  // Source identified (real URL) is distinct from source contrasted
  // (state + verification date recorded). Links are never fetched here.
  checks.L1_FUENTE_IDENTIFICADA = checks.L1_FUENTE;
  checks.L1_FUENTE_CONTRASTADA =
    checks.L1_FUENTE === 'PASS' && checks.L1_ESTADO === 'PASS' && checks.L1_FECHA_VERIFICACION === 'PASS' ? 'PASS' : 'FAIL';

  if (m.descripcion && Array.isArray(m.VAGUE_PATTERNS)) {
    if (m.VAGUE_PATTERNS.some((p) => p.test(m.descripcion))) issues.push('L1_DESCRIPTION_VAGUE');
  }

  return { passed: issues.length === 0, issues, warnings, checks, score: passed };
}

function evaluateL2(l1Result, guideResult, normalizedMeta) {
  if (!l1Result.passed) {
    return { passed: false, issues: ['L2_BLOCKED_BY_L1'], warnings: [], checks: { L2_GUIA: 'BLOCKED' } };
  }
  const m = normalizedMeta || {};
  const issues = [...l1Result.issues];
  const warnings = [...l1Result.warnings];
  const checks = { ...l1Result.checks };

  checks.L2_GUIA = guideResult.valid ? 'PASS' : 'FAIL';
  issues.push(...guideResult.issues.map((i) => `L2_${i}`));
  warnings.push(...guideResult.warnings.map((w) => `L2_${w}`));

  for (const [key, { field }] of Object.entries(L2_META_FIELDS)) {
    const ok = isVerifiedValue(m[field]);
    const KEY = key.toUpperCase();
    checks[`L2_${KEY}`] = ok ? 'PASS' : 'FAIL';
    if (!ok) issues.push(hasValue(m[field]) ? `L2_UNVERIFIED_${KEY}` : `L2_MISSING_${KEY}`);
  }

  return { passed: !issues.some((i) => i.startsWith('L2_')), issues, warnings, checks };
}

function evaluateL3(l2Result, skillResult, casesResult) {
  if (!l2Result.passed) {
    return { passed: false, issues: ['L3_BLOCKED_BY_L2'], warnings: [], checks: { L3_SKILL: 'BLOCKED', L3_CASOS: 'BLOCKED' } };
  }
  const issues = [...l2Result.issues];
  const warnings = [...l2Result.warnings];
  const checks = { ...l2Result.checks };

  checks.L3_SKILL = skillResult.valid ? 'PASS' : 'FAIL';
  checks.L3_CASOS = casesResult.valid ? 'PASS' : 'FAIL';

  const hasValidSkill = skillResult.valid;
  const hasValidCases = casesResult.valid && casesResult.stats.substantive > 0;

  if (hasValidCases) {
    issues.push(...casesResult.issues.map((i) => `L3_${i}`));
    warnings.push(...casesResult.warnings.map((w) => `L3_${w}`));
    warnings.push(...skillResult.issues.map((i) => `L3_SKILL_${i}`));
    warnings.push(...skillResult.warnings.map((w) => `L3_SKILL_${w}`));
  } else if (hasValidSkill) {
    issues.push(...skillResult.issues.map((i) => `L3_${i}`));
    warnings.push(...skillResult.warnings.map((w) => `L3_${w}`));
    warnings.push(...casesResult.issues.map((i) => `L3_CASOS_${i}`));
    warnings.push(...casesResult.warnings.map((w) => `L3_CASOS_${w}`));
  } else {
    issues.push(...skillResult.issues.map((i) => `L3_${i}`));
    warnings.push(...skillResult.warnings.map((w) => `L3_${w}`));
    issues.push(...casesResult.issues.map((i) => `L3_${i}`));
    warnings.push(...casesResult.warnings.map((w) => `L3_${w}`));
    issues.push('L3_NO_SKILL_OR_CASOS');
  }

  return { passed: !issues.some((i) => i.startsWith('L3_')), issues, warnings, checks };
}

function evaluateL4(l3Result, evidenceResult, normalizedMeta) {
  if (!l3Result.passed) {
    return { passed: false, issues: ['L4_BLOCKED_BY_L3'], warnings: [], checks: { L4_EVIDENCIA: 'BLOCKED' }, evidenceRefs: [] };
  }
  const m = normalizedMeta || {};
  const issues = [...l3Result.issues];
  const warnings = [...l3Result.warnings];
  const checks = { ...l3Result.checks };

  const l4EvidenceOk = evidenceResult.valid && evidenceResult.stats.passWithIntegrity > 0;
  checks.L4_EVIDENCIA = l4EvidenceOk ? 'PASS' : 'FAIL';

  issues.push(...evidenceResult.issues.map((i) => `L4_${i}`));
  warnings.push(...evidenceResult.warnings.map((w) => `L4_${w}`));
  if (!l4EvidenceOk) issues.push('L4_INSUFFICIENT_EVIDENCE');

  const records = Array.isArray(evidenceResult.records) ? evidenceResult.records : [];
  for (const r of records) {
    if (r.resultado !== 'PASS') continue;
    if (m.id_catalogo && r.id_catalogo !== m.id_catalogo) issues.push(`L4_EVIDENCE_ID_MISMATCH_${r.id}`);
    const name = String(r.herramienta || '').toLowerCase();
    if (name && name !== String(m.id || '').toLowerCase() && name !== String(m.nombre || '').toLowerCase()) {
      warnings.push(`L4_EVIDENCE_NAME_MISMATCH_${r.id}`);
    }
  }

  const evidenceRefs = records
    .filter((r) => r.resultado === 'PASS' && r.evidencia)
    .map((r) => ({ id: r.id, sha256: r.evidencia.sha256, destRel: r.evidencia.destRel }));

  return { passed: !issues.some((i) => i.startsWith('L4_')), issues, warnings, checks, evidenceRefs };
}

/**
 * Candidate level: the highest level whose documentary resources are present,
 * cumulatively. It describes potential maturity, never a certification.
 *
 * @param {{ metadata?: boolean, guide?: boolean, skillOrCases?: boolean, evidencePass?: boolean } | undefined} resources
 * @returns {'NONE'|'L1'|'L2'|'L3'|'L4'}
 */
function computeCandidateLevel(resources) {
  const r = resources || {};
  if (!r.metadata) return 'NONE';
  if (!r.guide) return 'L1';
  if (!r.skillOrCases) return 'L2';
  if (!r.evidencePass) return 'L3';
  return 'L4';
}

/**
 * Validated level: the highest level whose controls (and all lower levels'
 * controls) pass. Candidate level comes from resource presence only.
 */
function computeLevels(l1Result, l2Result, l3Result, l4Result, resources) {
  let validatedLevel = 'NONE';
  if (l1Result.passed) {
    validatedLevel = 'L1';
    if (l2Result.passed) {
      validatedLevel = 'L2';
      if (l3Result.passed) {
        validatedLevel = 'L3';
        if (l4Result.passed) validatedLevel = 'L4';
      }
    }
  }
  return { candidateLevel: computeCandidateLevel(resources), validatedLevel };
}

/**
 * Overall status against the full ATDS contract (up to L4).
 * ERROR: structural problem; FAIL: blocking issue at some level;
 * REVIEW_REQUIRED: only non-level issues or warnings; PASS: nothing pending.
 */
function computeStatus(issues, warnings = []) {
  if (issues.some((i) => isStructuralCode(i))) return 'ERROR';
  if (issues.some((i) => /^L[1-4]_/.test(i))) return 'FAIL';
  if (issues.length > 0 || warnings.length > 0) return 'REVIEW_REQUIRED';
  return 'PASS';
}

/**
 * Parse a level name. Returns null when the value is not a valid ATDS level.
 *
 * @param {unknown} value
 * @returns {'NONE'|'L1'|'L2'|'L3'|'L4'|null}
 */
function parseLevel(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(LEVEL_RANK, v) ? v : null;
}

function levelRank(level) {
  return LEVEL_RANK[level] ?? 0;
}

export {
  LEVELS,
  L1_FIELDS,
  evaluateL1,
  evaluateL2,
  evaluateL3,
  evaluateL4,
  computeCandidateLevel,
  computeLevels,
  computeStatus,
  parseLevel,
  levelRank,
};
