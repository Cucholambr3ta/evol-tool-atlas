import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveWithin, isPathInside, ROOT } from './paths.mjs';

const VALID_EVIDENCE_RESULTS = new Set(['PASS', 'FAIL', 'BLOCKED', 'INCONCLUSIVE']);
const VALID_TEST_TYPES = new Set(['prueba_funcional', 'prueba_funcional_acotada', 'verificacion_de_version', 'prueba_integracion', 'prueba_rendimiento', 'prueba_seguridad', 'otro']);
/**
 * ATDS-12: test types that may accredit functional behaviour (L4). A version check
 * never does; `otro` only with a substantive `justificacion_tipo`.
 */
const L4_FUNCTIONAL_TYPES = new Set(['prueba_funcional', 'prueba_funcional_acotada', 'prueba_integracion', 'prueba_rendimiento', 'prueba_seguridad']);
const MIN_OTHER_TYPE_JUSTIFICATION = 40;
const SHA256_RE = /^[a-f0-9]{64}$/i;

/** ATDS-11: identifiers that are placeholders, not identities. */
const PROVISIONAL_ID_RE = /^(sin[_ -]?id|todo|tbd|pendiente|xxx+|n\/?a|none|null|undefined|id|ev|ev-?0*)$|\b(todo|tbd|pendiente|placeholder|xxx)\b/i;

/** Artifact verification statuses that count as demonstrated integrity. */
const VERIFIED_STATUSES = new Set(['VERIFIED', 'VERIFIED_VIA_PRIMARY', 'VERIFIED_BY_EXCEPTION']);

const UNSAFE_PATH_ERRORS = new Set(['ABSOLUTE_PATH', 'PATH_TRAVERSAL', 'PATH_ESCAPE', 'SYMLINK_ESCAPE', 'NULL_BYTE', 'REALPATH_ERROR']);

/** ATDS-14: documented exceptions for historical artifacts stored outside their sheet. */
const PROVENANCE_EXCEPTIONS_PATH = path.join(ROOT, 'scripts', 'atds-provenance-exceptions.json');

// ---------------------------------------------------------------------------
// ATDS-13: version / availability scope of a command, without executing it.
// ---------------------------------------------------------------------------

const VERSION_FLAGS = new Set(['--version', '-version', '-V', '-v', 'version', '--Version', '-ver']);
/** Wrappers that run another command; their own options are skipped. */
const WRAPPERS = {
  env: { flagsWithValue: new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']) },
  command: { flagsWithValue: new Set() },
  exec: { flagsWithValue: new Set(['-a']) },
  time: { flagsWithValue: new Set(['-f', '--format', '-o', '--output']) },
  nice: { flagsWithValue: new Set(['-n', '--adjustment']) },
  nohup: { flagsWithValue: new Set() },
  sudo: { flagsWithValue: new Set(['-u', '--user', '-g', '--group', '-C', '-D', '--chdir']) },
  doas: { flagsWithValue: new Set(['-u']) },
  stdbuf: { flagsWithValue: new Set() },
  timeout: { flagsWithValue: new Set(['-s', '--signal', '-k', '--kill-after']), positional: 1 },
  xvfb_run: { flagsWithValue: new Set() },
};
/** Commands that only check presence/location. */
const AVAILABILITY_COMMANDS = new Set(['which', 'whereis', 'type', 'hash']);
/** Output filters that do not change what a pipeline demonstrates. */
const FILTER_COMMANDS = new Set(['head', 'tail', 'grep', 'egrep', 'sed', 'awk', 'cut', 'tr', 'tee', 'sort', 'uniq', 'wc', 'cat', 'echo', 'true']);

function tokenize(segment) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment)) !== null) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

/**
 * Classify one simple command segment.
 *
 * @returns {'version'|'availability'|'filter'|'other'|'empty'}
 */
function classifySegment(segment) {
  const raw = tokenize(segment);
  // Drop redirections ("2>&1", ">out", "> out") and their file operands.
  let tokens = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (/^(\d*|&)(>>?|<)$/.test(t)) { i++; continue; }
    if (/^(\d*|&)(>>?|<)/.test(t)) continue;
    tokens.push(t);
  }
  // Leading environment assignments: FOO=bar tool --version
  while (tokens.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  // Unwrap wrappers (env, command, sudo, timeout 10, ...), possibly nested.
  for (let guard = 0; guard < 8 && tokens.length > 0; guard++) {
    const name = path.posix.basename(tokens[0]).replace(/-/g, '_');
    const wrapper = WRAPPERS[name];
    if (!wrapper) break;
    if (name === 'command' && (tokens[1] === '-v' || tokens[1] === '-V')) return 'availability';
    tokens = tokens.slice(1);
    while (tokens.length > 0) {
      const t = tokens[0];
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) { tokens.shift(); continue; }
      if (t === '--') { tokens.shift(); break; }
      if (t.startsWith('-') && t.length > 1) {
        tokens.shift();
        if (wrapper.flagsWithValue.has(t)) tokens.shift();
        continue;
      }
      break;
    }
    for (let p = 0; p < (wrapper.positional ?? 0) && tokens.length > 0; p++) tokens.shift();
  }
  if (tokens.length === 0) return 'empty';
  const cmd = path.posix.basename(tokens[0].replace(/\\/g, '/'));
  const args = tokens.slice(1);
  if (AVAILABILITY_COMMANDS.has(cmd)) return 'availability';
  if (FILTER_COMMANDS.has(cmd)) return 'filter';
  if (args.length > 0 && args.every((a) => VERSION_FLAGS.has(a))) return 'version';
  return 'other';
}

/**
 * Scope a command demonstrates on syntax alone. `version` means every meaningful
 * part only prints a version or checks availability; such a record can never
 * accredit functional behaviour. Flags like `--disable-version-check` are ordinary
 * arguments and do not make a command version-only. Nothing is executed.
 *
 * @param {unknown} comando
 * @returns {'version'|'other'|'none'}
 */
function commandScope(comando) {
  if (typeof comando !== 'string' || comando.trim() === '') return 'none';
  const segments = comando.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
  const kinds = segments.map(classifySegment).filter((k) => k !== 'empty' && k !== 'filter');
  if (kinds.length === 0) return 'other';
  return kinds.every((k) => k === 'version' || k === 'availability') ? 'version' : 'other';
}

function isVersionOnlyCommand(comando) {
  return commandScope(comando) === 'version';
}

// ---------------------------------------------------------------------------

function readJsonFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { ok: false, error: 'UNREADABLE' };
  }
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function nonEmpty(v, min) {
  return v !== null && v !== undefined && String(v).trim().length > min;
}

function normalizeIdentity(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function artifactPath(a) {
  if (!a || typeof a !== 'object') return null;
  for (const key of ['destRel', 'ruta', 'path']) {
    if (typeof a[key] === 'string' && a[key].trim() !== '') return a[key];
  }
  return null;
}

const exceptionsCache = new Map();
/**
 * Load the documented provenance exceptions (ATDS-14). A missing file means no
 * exceptions; a malformed file is an operational error, never a silent pass.
 *
 * @param {string} [filePath]
 */
function loadProvenanceExceptions(filePath = PROVENANCE_EXCEPTIONS_PATH) {
  if (exceptionsCache.has(filePath)) return exceptionsCache.get(filePath);
  let list = [];
  if (fs.existsSync(filePath)) {
    const parsed = readJsonFile(filePath);
    if (!parsed.ok || !parsed.data || !Array.isArray(parsed.data.exceptions)) {
      throw new Error(`Política de excepciones de procedencia inválida: ${filePath}`);
    }
    list = parsed.data.exceptions;
  }
  exceptionsCache.set(filePath, list);
  return list;
}

/**
 * An exception matches only an exact (tool, path, sha256) triple that is approved
 * and not expired. It never creates evidence; it only accepts a historical location.
 */
function findProvenanceException(exceptions, toolId, rel, sha, today) {
  return exceptions.find((e) =>
    e && e.herramienta === toolId && e.ruta === rel && typeof e.sha256 === 'string' && e.sha256.toLowerCase() === sha &&
    typeof e.aprobado_por === 'string' && e.aprobado_por.trim() !== '' &&
    typeof e.motivo === 'string' && e.motivo.trim().length > 20 &&
    typeof e.vence === 'string' && e.vence >= today,
  ) || null;
}

/**
 * Verify one declared artifact against `docRoot`, and (ATDS-14) that it belongs to
 * the sheet whose evidencias.json declares it.
 *
 * @param {{ nombre?: string, sha256?: string, destRel?: string, ruta?: string, path?: string }} art
 * @param {string} docRoot
 * @param {{ sha256: string, status: string } | null} primary verification of the record's primary artifact
 * @param {'primary'|'artifact'} role
 * @param {{ toolDirAbs?: string|null, toolId?: string|null, exceptions?: object[], today?: string }} [scope]
 */
function verifyArtifact(art, docRoot, primary, role, scope = {}) {
  const nombre = art && typeof art.nombre === 'string' && art.nombre.trim() !== '' ? art.nombre.trim() : null;
  const sha = art && typeof art.sha256 === 'string' ? art.sha256.trim().toLowerCase() : null;
  const rel = artifactPath(art);
  const out = { role, nombre, sha256: sha, path: rel, status: 'VERIFIED' };

  if (role !== 'primary' && !nombre) return { ...out, status: 'NO_IDENTITY' };
  if (!sha || !SHA256_RE.test(sha)) return { ...out, status: 'MALFORMED_HASH' };

  if (!rel) {
    // Historical schema: artifact declared without a path. Its integrity is
    // only demonstrated when it is the same content as a verified primary.
    if (primary && VERIFIED_STATUSES.has(primary.status) && primary.sha256 === sha) return { ...out, status: 'VERIFIED_VIA_PRIMARY' };
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

  // Provenance: confinement to docRoot is not enough; the file must live in the
  // declaring sheet's directory (or be covered by a documented exception).
  if (scope.toolDirAbs) {
    let realTool;
    let realFile;
    try {
      realTool = fs.realpathSync(scope.toolDirAbs);
      realFile = fs.realpathSync(resolved.path);
    } catch {
      return { ...out, status: 'MISSING' };
    }
    if (!isPathInside(realTool, realFile)) {
      const today = scope.today || new Date().toISOString().slice(0, 10);
      const exception = findProvenanceException(scope.exceptions || [], scope.toolId, rel, sha, today);
      if (exception) return { ...out, status: 'VERIFIED_BY_EXCEPTION', detail: exception.id || 'excepcion' };
      return { ...out, status: 'FOREIGN_ARTIFACT', detail: path.relative(docRoot, realFile) };
    }
  }
  return out;
}

const ARTIFACT_STATUS_CODE = {
  NO_IDENTITY: 'ARTIFACT_NO_IDENTITY',
  MALFORMED_HASH: 'ARTIFACT_MALFORMED_HASH',
  UNSAFE_PATH: 'ARTIFACT_UNSAFE_PATH',
  MISSING: 'ARTIFACT_MISSING',
  NOT_A_FILE: 'ARTIFACT_NOT_A_FILE',
  HASH_MISMATCH: 'ARTIFACT_HASH_MISMATCH',
  FOREIGN_ARTIFACT: 'ARTIFACT_FOREIGN',
};

function emptyStats() {
  return { passTotal: 0, passWithIntegrity: 0, blockedCount: 0, failCount: 0, inconclusiveCount: 0, versionOnlyCount: 0 };
}

function emptyResult(schemaStatus, issues) {
  return {
    valid: false,
    schemaStatus,
    issues,
    warnings: [],
    records: [],
    integrity: [],
    limitations: [],
    declaredEvidenceRefs: [],
    verifiedEvidenceRefs: [],
    stats: emptyStats(),
  };
}

/**
 * Validate `evidencias.json`. Every artifact a PASS record declares is verified;
 * a PASS only supports L4 when the record is complete, its identity matches the
 * sheet, its type can accredit functionality, its command is not a version check,
 * and every artifact demonstrates integrity and provenance.
 *
 * `schemaStatus` distinguishes MISSING_FILE, INVALID_JSON (syntax), INVALID_SCHEMA,
 * EMPTY (a legitimately empty `registros: []`) and OK.
 *
 * @param {string} evidencePath absolute path to evidencias.json
 * @param {string} _root repository root (kept for API compatibility)
 * @param {string} docRoot authorised root that artifact paths resolve against
 * @param {{ id?: string, nombre?: string, id_catalogo?: string|null, exceptionsPath?: string, today?: string } | null} [identity]
 *        identity of the sheet (from metadata.json). evaluateTool always passes it.
 */
function checkEvidenceContent(evidencePath, _root, docRoot, identity = null) {
  if (!evidencePath || !fs.existsSync(evidencePath)) return emptyResult('MISSING_FILE', ['MISSING_EVIDENCIAS']);
  const parsed = readJsonFile(evidencePath);
  if (!parsed.ok) return emptyResult('INVALID_JSON', ['INVALID_EVIDENCIAS_JSON']);
  const data = parsed.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return emptyResult('INVALID_SCHEMA', ['EVIDENCE_SCHEMA_ROOT_NOT_OBJECT']);
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'registros')) {
    return emptyResult('INVALID_SCHEMA', ['EVIDENCE_SCHEMA_MISSING_REGISTROS']);
  }
  if (!Array.isArray(data.registros)) {
    return emptyResult('INVALID_SCHEMA', ['EVIDENCE_SCHEMA_REGISTROS_NOT_ARRAY']);
  }

  const issues = [];
  const warnings = [];
  const limitations = [];
  const integrity = [];
  const declaredEvidenceRefs = [];
  const verifiedEvidenceRefs = [];
  const stats = emptyStats();
  const records = [];

  const scope = {
    toolDirAbs: path.dirname(evidencePath),
    toolId: identity && identity.id ? String(identity.id) : null,
    exceptions: loadProvenanceExceptions(identity && identity.exceptionsPath ? identity.exceptionsPath : undefined),
    today: identity && identity.today ? identity.today : undefined,
  };

  // File-level identity, when declared, must match the sheet too.
  if (identity && identity.id_catalogo && typeof data.id_catalogo === 'string' && data.id_catalogo !== identity.id_catalogo) {
    issues.push('EVIDENCE_FILE_ID_CATALOGO_MISMATCH');
  }

  const idCounts = new Map();
  for (const r of data.registros) {
    if (r && typeof r === 'object' && typeof r.id === 'string' && r.id.trim() !== '') {
      const id = r.id.trim();
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  }
  for (const [id, count] of idCounts) {
    if (count > 1) issues.push(`EVIDENCE_DUPLICATE_ID_${id}`);
  }

  data.registros.forEach((r, index) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      issues.push(`EVIDENCE_SCHEMA_RECORD_${index}_NOT_OBJECT`);
      return;
    }
    records.push(r);
    const hasId = typeof r.id === 'string' && r.id.trim() !== '';
    const rid = hasId ? r.id.trim() : `INDEX_${index}`;
    if (!VALID_EVIDENCE_RESULTS.has(r.resultado)) issues.push(`EVIDENCE_${rid}_INVALID_RESULT_${r.resultado}`);
    const knownType = VALID_TEST_TYPES.has(r.tipo);

    if (r.resultado !== 'PASS') {
      if (!knownType) warnings.push(`EVIDENCE_${rid}_UNKNOWN_TEST_TYPE_${r.tipo}`);
      const base = { id: rid, resultado: r.resultado, supportsL4: false, versionOnly: false, scope: 'none', identityOk: true, typeOk: false, complete: false, artifacts: [] };
      if (r.resultado === 'BLOCKED') {
        stats.blockedCount++;
        if (r.evidencia !== null && r.evidencia !== undefined) issues.push(`BLOCKED_${rid}_HAS_EVIDENCE`);
        if (Array.isArray(r.artefactos) && r.artefactos.length > 0) issues.push(`BLOCKED_${rid}_HAS_ARTIFACTS`);
        if (r.sha256 !== null && r.sha256 !== undefined) issues.push(`BLOCKED_${rid}_HAS_SHA256`);
        if (r.comando && String(r.comando).trim().length > 5) warnings.push(`BLOCKED_${rid}_HAS_COMMAND`);
        integrity.push(base);
      } else if (r.resultado === 'FAIL' || r.resultado === 'INCONCLUSIVE') {
        if (r.resultado === 'FAIL') stats.failCount++;
        else stats.inconclusiveCount++;
        integrity.push(base);
      }
      return;
    }

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
    const hasPrimary = Boolean(r.evidencia) && typeof r.evidencia === 'object';
    if (!hasPrimary) missing.push('EVIDENCE_OBJECT');
    const declared = Array.isArray(r.artefactos) ? r.artefactos : [];
    if (declared.length === 0) missing.push('ARTIFACTS');
    for (const f of missing) issues.push(`EVIDENCE_${rid}_MISSING_${f}`);

    // ATDS-11: an identity that is unambiguous and matches the sheet.
    const identityIssues = [];
    if (!hasId) identityIssues.push(`EVIDENCE_${rid}_MISSING_ID`);
    else if (PROVISIONAL_ID_RE.test(rid)) identityIssues.push(`EVIDENCE_${rid}_PROVISIONAL_ID`);
    if (hasId && idCounts.get(rid) > 1) identityIssues.push(`EVIDENCE_${rid}_AMBIGUOUS_ID`);
    if (!nonEmpty(r.herramienta, 0)) identityIssues.push(`EVIDENCE_${rid}_MISSING_TOOL_IDENTITY`);
    else if (identity) {
      const name = normalizeIdentity(r.herramienta);
      const accepted = [identity.id, identity.nombre].filter(Boolean).map(normalizeIdentity);
      if (!accepted.includes(name)) identityIssues.push(`EVIDENCE_${rid}_TOOL_MISMATCH`);
    }
    if (identity && identity.id_catalogo) {
      if (!nonEmpty(r.id_catalogo, 0)) identityIssues.push(`EVIDENCE_${rid}_MISSING_ID_CATALOGO`);
      else if (r.id_catalogo !== identity.id_catalogo) identityIssues.push(`EVIDENCE_${rid}_ID_CATALOGO_MISMATCH`);
    }
    issues.push(...identityIssues);

    // ATDS-12: only accepted types accredit L4; `otro` needs a justification.
    const typeIssues = [];
    if (!knownType) typeIssues.push(`EVIDENCE_${rid}_UNKNOWN_TEST_TYPE_${r.tipo}`);
    else if (r.tipo === 'otro' && !nonEmpty(r.justificacion_tipo, MIN_OTHER_TYPE_JUSTIFICATION - 1)) {
      typeIssues.push(`EVIDENCE_${rid}_OTHER_TYPE_WITHOUT_JUSTIFICATION`);
    }
    issues.push(...typeIssues);

    // Primary artifact
    const checksForRecord = [];
    let primary = null;
    if (hasPrimary) {
      primary = verifyArtifact(r.evidencia, docRoot, null, 'primary', scope);
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
      const check = verifyArtifact(art, docRoot, primary, 'artifact', scope);
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
      } else if (c.status === 'VERIFIED_BY_EXCEPTION') {
        warnings.push(`EVIDENCE_${rid}_ARTIFACT_HISTORICAL_LOCATION_${label}`);
        limitations.push(`${rid}: el artefacto "${c.nombre || c.path}" está fuera de la ficha y se acepta por la excepción documentada ${c.detail}.`);
      } else if (ARTIFACT_STATUS_CODE[c.status]) {
        issues.push(`EVIDENCE_${rid}_${ARTIFACT_STATUS_CODE[c.status]}_${label}`);
      }
    }

    const allVerified = checksForRecord.length > 0 && checksForRecord.every((c) => VERIFIED_STATUSES.has(c.status));

    // ATDS-13: scope demonstrated. A version/availability check never demonstrates
    // functional capability, whatever its declared type.
    const versionOnly = r.tipo === 'verificacion_de_version' || commandScope(r.comando) === 'version';
    if (versionOnly) {
      stats.versionOnlyCount++;
      if (r.tipo !== 'verificacion_de_version') issues.push(`EVIDENCE_${rid}_VERSION_CHECK_AS_FUNCTIONAL`);
      else warnings.push(`EVIDENCE_${rid}_VERSION_ONLY_NOT_FUNCTIONAL`);
    }
    const functionalType = L4_FUNCTIONAL_TYPES.has(r.tipo) || (r.tipo === 'otro' && typeIssues.length === 0);

    const supportsL4 = missing.length === 0 && identityIssues.length === 0 && typeIssues.length === 0 &&
      functionalType && allVerified && !versionOnly;
    if (supportsL4) stats.passWithIntegrity++;

    // ATDS-15: declared vs. verified references come from this same evaluation.
    if (hasPrimary) {
      const ref = { id: rid, sha256: primary ? primary.sha256 : null, destRel: primary ? primary.path : null };
      declaredEvidenceRefs.push({ ...ref, integrityVerified: supportsL4 });
      if (supportsL4) verifiedEvidenceRefs.push(ref);
    }
    integrity.push({
      id: rid,
      resultado: 'PASS',
      supportsL4,
      versionOnly,
      scope: versionOnly ? 'version' : 'functional',
      identityOk: identityIssues.length === 0,
      typeOk: typeIssues.length === 0 && functionalType,
      complete: missing.length === 0,
      artifacts: checksForRecord,
    });
  });

  if (stats.passTotal > 0 && stats.passWithIntegrity === 0) issues.push('EVIDENCE_NO_INTEGRITY_PASS');

  const schemaInvalid = issues.some((i) => i.startsWith('EVIDENCE_SCHEMA_'));
  const schemaStatus = schemaInvalid ? 'INVALID_SCHEMA' : (data.registros.length === 0 ? 'EMPTY' : 'OK');
  return { valid: issues.length === 0, schemaStatus, issues, warnings, records, integrity, limitations, declaredEvidenceRefs, verifiedEvidenceRefs, stats };
}

export {
  checkEvidenceContent,
  verifyArtifact,
  isVersionOnlyCommand,
  commandScope,
  normalizeIdentity,
  loadProvenanceExceptions,
  VALID_EVIDENCE_RESULTS,
  VALID_TEST_TYPES,
  L4_FUNCTIONAL_TYPES,
};
