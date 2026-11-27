import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveWithin } from './paths.mjs';

const VALID_EVIDENCE_RESULTS = new Set(['PASS', 'FAIL', 'BLOCKED', 'INCONCLUSIVE']);
const VALID_TEST_TYPES = new Set(['prueba_funcional', 'prueba_funcional_acotada', 'verificacion_de_version', 'prueba_integracion', 'prueba_rendimiento', 'prueba_seguridad', 'otro']);
const SHA256_RE = /^[a-f0-9]{64}$/i;

/**
 * A command whose only arguments are version flags (e.g. `promptfoo --version`).
 * Flags such as `--disable-version-check` do not make a command version-only.
 */
const VERSION_ONLY_COMMAND_RE = /^\s*\S+(?:\s+(?:--version|-V|-v|version))+\s*$/;

/** Artifact verification statuses that count as demonstrated integrity. */
const VERIFIED_STATUSES = new Set(['VERIFIED', 'VERIFIED_VIA_PRIMARY']);

const UNSAFE_PATH_ERRORS = new Set(['ABSOLUTE_PATH', 'PATH_TRAVERSAL', 'PATH_ESCAPE', 'SYMLINK_ESCAPE', 'NULL_BYTE', 'REALPATH_ERROR']);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function nonEmpty(v, min) {
  return v !== null && v !== undefined && String(v).trim().length > min;
}

function isVersionOnlyCommand(comando) {
  return typeof comando === 'string' && VERSION_ONLY_COMMAND_RE.test(comando);
}

function artifactPath(a) {
  if (!a || typeof a !== 'object') return null;
  for (const key of ['destRel', 'ruta', 'path']) {
    if (typeof a[key] === 'string' && a[key].trim() !== '') return a[key];
  }
  return null;
}

/**
 * Verify one declared artifact against `docRoot`.
 *
 * @param {{ nombre?: string, sha256?: string, destRel?: string, ruta?: string, path?: string }} art
 * @param {string} docRoot
 * @param {{ sha256: string, status: string } | null} primary verification of the record's primary artifact
 * @returns {{ role: string, nombre: string|null, sha256: string|null, path: string|null, status: string, detail?: string }}
 */
function verifyArtifact(art, docRoot, primary, role) {
  const nombre = art && typeof art.nombre === 'string' && art.nombre.trim() !== '' ? art.nombre.trim() : null;
  const sha = art && typeof art.sha256 === 'string' ? art.sha256.trim().toLowerCase() : null;
  const rel = artifactPath(art);
  const out = { role, nombre, sha256: sha, path: rel, status: 'VERIFIED' };

  if (role !== 'primary' && !nombre) return { ...out, status: 'NO_IDENTITY' };
  if (!sha || !SHA256_RE.test(sha)) return { ...out, status: 'MALFORMED_HASH' };

  if (!rel) {
    // Historical schema: artifact declared without a path. Its integrity is
    // only demonstrated when it is the same content as a verified primary.
    if (primary && primary.status === 'VERIFIED' && primary.sha256 === sha) return { ...out, status: 'VERIFIED_VIA_PRIMARY' };
    return { ...out, status: 'UNVERIFIABLE_NO_PATH' };
  }

  const resolved = resolveWithin(docRoot, rel, { allowMissing: true });
  if (!resolved.ok) {
    return { ...out, status: UNSAFE_PATH_ERRORS.has(resolved.error) ? 'UNSAFE_PATH' : 'MISSING', detail: resolved.error };
  }
  if (!fs.existsSync(resolved.path)) return { ...out, status: 'MISSING' };
  let stat;
  try {
    stat = fs.statSync(resolved.path);
  } catch {
    return { ...out, status: 'MISSING' };
  }
  if (!stat.isFile()) return { ...out, status: 'NOT_A_FILE' };
  const actual = sha256File(resolved.path);
  if (actual !== sha) return { ...out, status: 'HASH_MISMATCH', detail: actual };
  return out;
}

const ARTIFACT_STATUS_CODE = {
  NO_IDENTITY: 'ARTIFACT_NO_IDENTITY',
  MALFORMED_HASH: 'ARTIFACT_MALFORMED_HASH',
  UNSAFE_PATH: 'ARTIFACT_UNSAFE_PATH',
  MISSING: 'ARTIFACT_MISSING',
  NOT_A_FILE: 'ARTIFACT_NOT_A_FILE',
  HASH_MISMATCH: 'ARTIFACT_HASH_MISMATCH',
};

/**
 * Validate `evidencias.json`. Every artifact a PASS record declares is
 * verified; a PASS only supports L4 when all of them demonstrate integrity and
 * the record is complete (acceptance criterion, observed result, ...).
 *
 * @param {string} evidencePath absolute path to evidencias.json
 * @param {string} _root repository root (kept for API compatibility)
 * @param {string} docRoot authorised root that artifact paths resolve against
 */
function checkEvidenceContent(evidencePath, _root, docRoot) {
  const emptyStats = { passTotal: 0, passWithIntegrity: 0, blockedCount: 0, failCount: 0, inconclusiveCount: 0, versionOnlyCount: 0 };
  if (!fs.existsSync(evidencePath)) {
    return { valid: false, issues: ['MISSING_EVIDENCIAS'], warnings: [], records: [], integrity: [], limitations: [], stats: emptyStats };
  }
  const data = readJson(evidencePath);
  if (!data || typeof data !== 'object') {
    return { valid: false, issues: ['INVALID_EVIDENCIAS_JSON'], warnings: [], records: [], integrity: [], limitations: [], stats: emptyStats };
  }
  const issues = [];
  const warnings = [];
  const limitations = [];
  const integrity = [];
  const records = Array.isArray(data.registros) ? data.registros : [];
  const stats = { ...emptyStats };

  for (const r of records) {
    const rid = r && r.id ? String(r.id) : 'SIN_ID';
    if (!VALID_EVIDENCE_RESULTS.has(r.resultado)) issues.push(`EVIDENCE_${rid}_INVALID_RESULT_${r.resultado}`);
    if (!VALID_TEST_TYPES.has(r.tipo)) warnings.push(`EVIDENCE_${rid}_UNKNOWN_TEST_TYPE_${r.tipo}`);

    if (r.resultado === 'PASS') {
      stats.passTotal++;
      const missing = [];
      if (!(r.procedencia && (r.procedencia.repositorio || r.procedencia.origen || r.procedencia.archivo_original))) missing.push('PROCEDENCIA');
      if (!nonEmpty(r.comando, 10)) missing.push('COMMAND');
      if (!nonEmpty(r.entorno, 5)) missing.push('ENV');
      if (!nonEmpty(r.version, 0)) missing.push('VERSION');
      if (!nonEmpty(r.fecha, 5)) missing.push('FECHA');
      if (!nonEmpty(r.tipo, 3)) missing.push('TIPO');
      if (!nonEmpty(r.resumen, 20)) missing.push('RESUMEN');
      if (!(Array.isArray(r.limitaciones) && r.limitaciones.length > 0)) missing.push('LIMITACIONES');
      if (!nonEmpty(r.criterio_aceptacion, 10)) missing.push('CRITERIO_ACEPTACION');
      if (!nonEmpty(r.resultado_observado, 10)) missing.push('RESULTADO_OBSERVADO');
      const hasPrimary = r.evidencia && typeof r.evidencia === 'object';
      if (!hasPrimary) missing.push('EVIDENCE_OBJECT');
      const declared = Array.isArray(r.artefactos) ? r.artefactos : [];
      if (declared.length === 0) missing.push('ARTIFACTS');
      for (const f of missing) issues.push(`EVIDENCE_${rid}_MISSING_${f}`);

      // Primary artifact
      const checksForRecord = [];
      let primary = null;
      if (hasPrimary) {
        primary = verifyArtifact(r.evidencia, docRoot, null, 'primary');
        checksForRecord.push(primary);
        if (r.sha256 && primary.sha256 && String(r.sha256).toLowerCase() !== primary.sha256) {
          issues.push(`EVIDENCE_${rid}_SHA_INCONSISTENT`);
        }
      }

      // Declared artifacts
      const seenNames = new Set();
      const seenPaths = new Set();
      const seenHashes = new Set();
      for (const art of declared) {
        const check = verifyArtifact(art, docRoot, primary, 'artifact');
        const dupKeys = [
          check.nombre && seenNames.has(check.nombre.toLowerCase()),
          check.path && seenPaths.has(check.path),
          check.sha256 && seenHashes.has(check.sha256),
        ];
        if (dupKeys.some(Boolean)) check.status = 'DUPLICATE';
        if (check.nombre) seenNames.add(check.nombre.toLowerCase());
        if (check.path) seenPaths.add(check.path);
        if (check.sha256) seenHashes.add(check.sha256);
        checksForRecord.push(check);
      }

      for (const c of checksForRecord) {
        const label = c.role === 'primary' ? 'PRIMARY' : (c.nombre || 'SIN_NOMBRE').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        if (c.status === 'DUPLICATE') issues.push(`EVIDENCE_${rid}_ARTIFACT_DUPLICATE_${label}`);
        else if (c.status === 'UNVERIFIABLE_NO_PATH') {
          warnings.push(`EVIDENCE_${rid}_ARTIFACT_UNVERIFIABLE_${label}`);
          limitations.push(`${rid}: el artefacto "${c.nombre}" se declara sin ruta; su integridad no puede demostrarse y no se atribuye.`);
        } else if (ARTIFACT_STATUS_CODE[c.status]) {
          issues.push(`EVIDENCE_${rid}_${ARTIFACT_STATUS_CODE[c.status]}_${label}`);
        }
      }

      const allVerified = checksForRecord.length > 0 && checksForRecord.every((c) => VERIFIED_STATUSES.has(c.status));

      // Scope: a version check never demonstrates functional capability.
      const versionOnly = r.tipo === 'verificacion_de_version' || isVersionOnlyCommand(r.comando);
      if (versionOnly) {
        stats.versionOnlyCount++;
        if (r.tipo !== 'verificacion_de_version') issues.push(`EVIDENCE_${rid}_VERSION_CHECK_AS_FUNCTIONAL`);
        else warnings.push(`EVIDENCE_${rid}_VERSION_ONLY_NOT_FUNCTIONAL`);
      }

      const supportsL4 = missing.length === 0 && allVerified && !versionOnly;
      if (supportsL4) stats.passWithIntegrity++;
      integrity.push({ id: rid, resultado: 'PASS', supportsL4, versionOnly, artifacts: checksForRecord });
    } else if (r.resultado === 'BLOCKED') {
      stats.blockedCount++;
      if (r.evidencia !== null && r.evidencia !== undefined) issues.push(`BLOCKED_${rid}_HAS_EVIDENCE`);
      if (r.artefactos && r.artefactos.length > 0) issues.push(`BLOCKED_${rid}_HAS_ARTIFACTS`);
      if (r.sha256 !== null && r.sha256 !== undefined) issues.push(`BLOCKED_${rid}_HAS_SHA256`);
      if (r.comando && String(r.comando).trim().length > 5) warnings.push(`BLOCKED_${rid}_HAS_COMMAND`);
      integrity.push({ id: rid, resultado: 'BLOCKED', supportsL4: false, versionOnly: false, artifacts: [] });
    } else if (r.resultado === 'FAIL' || r.resultado === 'INCONCLUSIVE') {
      if (r.resultado === 'FAIL') stats.failCount++;
      else stats.inconclusiveCount++;
      integrity.push({ id: rid, resultado: r.resultado, supportsL4: false, versionOnly: false, artifacts: [] });
    }
  }

  if (stats.passTotal > 0 && stats.passWithIntegrity === 0) issues.push('EVIDENCE_NO_INTEGRITY_PASS');

  return { valid: issues.length === 0, issues, warnings, records, integrity, limitations, stats };
}

export { checkEvidenceContent, verifyArtifact, isVersionOnlyCommand, VALID_EVIDENCE_RESULTS, VALID_TEST_TYPES };
