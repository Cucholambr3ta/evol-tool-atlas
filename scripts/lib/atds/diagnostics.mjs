/**
 * DOC-01..DOC-12 diagnostics for ATDS v1.
 *
 * The standard defines twelve documentary defect classes. Internal rule codes
 * remain specific, but every finding carries its DOC family so that reports can
 * be audited against the published contract.
 */

export const DOC_DEFINITIONS = {
  'DOC-01': { title: 'Descripción vaga', action: 'Sustituir la descripción por una explicación específica y verificable.' },
  'DOC-02': { title: 'Información técnica insuficiente', action: 'Completar la sección con requisitos, procedimiento y datos técnicos concretos.' },
  'DOC-03': { title: 'Ausencia de fuente verificable', action: 'Añadir una fuente primaria oficial y comprobable; no usar URLs de ejemplo.' },
  'DOC-04': { title: 'Versión ambigua o histórica presentada como actual', action: 'Distinguir versión histórica, declarada, consultada, instalada y probada.' },
  'DOC-05': { title: 'Compatibilidad no demostrada', action: 'Documentar plataformas y condiciones de compatibilidad con fuente.' },
  'DOC-06': { title: 'Instalación incompleta o incorrecta', action: 'Documentar instalación o acceso real, dependencias y verificación.' },
  'DOC-07': { title: 'Comandos sin explicación', action: 'Explicar cada comando, parámetro, entrada y salida esperada.' },
  'DOC-08': { title: 'Casos de uso genéricos', action: 'Redactar casos con objetivo, prerrequisitos, pasos y resultado verificables.' },
  'DOC-09': { title: 'Skill ausente o insuficiente', action: 'Aportar una skill operativa o casos técnicos sustantivos equivalentes.' },
  'DOC-10': { title: 'Evidencia mal clasificada', action: 'Separar PASS, FAIL, BLOCKED e INCONCLUSIVE y ajustar el alcance demostrado.' },
  'DOC-11': { title: 'Información duplicada o contradictoria', action: 'Corregir identificadores, hashes y referencias contradictorias.' },
  'DOC-12': { title: 'Enlaces rotos o referencias obsoletas', action: 'Verificar enlaces externos y actualizar referencias obsoletas.' },
};

const STRUCTURAL_CODES = new Set([
  'MISSING_METADATA',
  'INVALID_METADATA_JSON',
  'MISSING_TOOL_DIR',
  'PATH_ESCAPE',
  'PATH_TRAVERSAL',
  'ABSOLUTE_PATH',
  'NULL_BYTE',
  'SYMLINK_ESCAPE',
  'L1_ID_MISMATCH',
  'INVALID_CASOS_USO_JSON',
  'INVALID_EVIDENCIAS_JSON',
  'EVALUATION_ERROR',
]);

/**
 * Map an internal rule code to its DOC family.
 *
 * @param {string} code
 * @returns {string}
 */
export function mapCodeToDoc(code) {
  if (!code) return 'DOC-02';
  if (STRUCTURAL_CODES.has(code)) return 'DOC-11';
  if (code === 'DOC12_LINKS_NOT_CHECKED') return 'DOC-12';
  if (code === 'L1_DESCRIPTION_VAGUE' || code === 'L1_DESCRIPTION_GENERIC' || code === 'L1_UNVERIFIED_DESCRIPCION') return 'DOC-01';
  if (code.includes('_FUENTE') || code.startsWith('L1_SOURCE_') || code === 'L1_MISSING_ESTADO' || code === 'L1_UNVERIFIED_ESTADO') return 'DOC-03';
  // Evidence codes first: "VERSION_CHECK_AS_FUNCTIONAL" is misclassified evidence, not an ambiguous version.
  if (code.includes('_ID_MISMATCH') || code.includes('ID_CATALOGO_MISMATCH') || code.includes('_TOOL_MISMATCH') || code.includes('DUPLICATE_ID') || code.includes('AMBIGUOUS_ID') || code.includes('SHA_INCONSISTENT') || code.includes('ARTIFACT_DUPLICATE') || code.includes('CASOS_DUPLICATE_ID')) return 'DOC-11';
  if (code.startsWith('BLOCKED_') || code.startsWith('EVIDENCE_') || code.startsWith('L4_')) return 'DOC-10';
  if (code.includes('PLATAFORMAS') || code.includes('SISTEMA_OPERATIVO')) return 'DOC-05';
  if (code.includes('VERSION') || code.includes('VERSI')) return 'DOC-04';
  if (code.includes('INSTALACI') || code.includes('INSTALL') || code.includes('DEPENDENCIAS')) return 'DOC-06';
  if (code.includes('COMANDOS') || code.includes('COMMAND') || code.includes('EXECUTABLE_PROCEDURE')) return 'DOC-07';
  if (code.startsWith('L3_CASOS') || code.startsWith('L3_CASO_') || code.startsWith('CASO_') || code.startsWith('CASOS_') || code === 'L3_MISSING_CASOS_USO') return 'DOC-08';
  if (code.startsWith('L3_SKILL') || code.startsWith('SKILL_') || code === 'L3_MISSING_SKILL' || code === 'L3_NO_SKILL_OR_CASOS') return 'DOC-09';
  return 'DOC-02';
}

/**
 * Infer the ATDS level a code belongs to.
 *
 * @param {string} code
 * @returns {'L1'|'L2'|'L3'|'L4'|'STRUCT'|'INFO'}
 */
export function levelOfCode(code) {
  if (STRUCTURAL_CODES.has(code)) return 'STRUCT';
  const m = /^L([1-4])_/.exec(code);
  if (m) return /** @type {'L1'|'L2'|'L3'|'L4'} */ (`L${m[1]}`);
  return 'INFO';
}

const FILE_BY_PREFIX = [
  [/^L1_/, 'metadata.json'],
  [/^L2_(MISSING|UNVERIFIED)_/, 'metadata.json'],
  [/^L2_/, 'GUIA.md'],
  [/^L3_(SKILL_|MISSING_SKILL)/, 'SKILL.md'],
  [/^L3_(CASO|MISSING_CASOS|INVALID_CASOS)/, 'casos-uso.json'],
  [/^L4_/, 'evidencias.json'],
];

function fileForCode(code) {
  if (code === 'MISSING_METADATA' || code === 'INVALID_METADATA_JSON') return 'metadata.json';
  if (code === 'INVALID_CASOS_USO_JSON') return 'casos-uso.json';
  if (code === 'INVALID_EVIDENCIAS_JSON') return 'evidencias.json';
  if (code === 'EVALUATION_ERROR') return null;
  if (code === 'L3_NO_SKILL_OR_CASOS') return 'SKILL.md|casos-uso.json';
  for (const [re, file] of FILE_BY_PREFIX) if (re.test(code)) return file;
  return null;
}

const L1_FIELD_BY_KEY = {
  ID: 'id', NOMBRE: 'nombre', DESCRIPCION: 'descripcion', CATEGORIA: 'categoria', TIPO: 'tipo',
  PROBLEMA: 'problema_que_resuelve', FUNCIONES: 'funciones_principales',
  FUENTE: 'fuentes_oficiales|referencias_oficiales|upstream|sitio_web',
  PLATAFORMAS: 'sistema_operativo', LIMITACIONES: 'limites', ESTADO: 'estado_fuente',
  FECHA_VERIFICACION: 'fecha_verificacion', LICENCIA: 'licencia',
  SISTEMA_OPERATIVO: 'sistema_operativo', DEPENDENCIAS: 'dependencias', REQUISITOS: 'requisitos',
};

function fieldForCode(code) {
  let m = /^L[12]_(?:MISSING|UNVERIFIED|INVALID)_(.+)$/.exec(code);
  if (m) return L1_FIELD_BY_KEY[m[1]] || m[1].toLowerCase();
  if (code === 'L1_SOURCE_PLACEHOLDER_ONLY') return L1_FIELD_BY_KEY.FUENTE;
  if (code === 'L1_DESCRIPTION_VAGUE') return 'descripcion';
  m = /^L2_GUIDE_(?:MISSING_SECTION|SECTION_GENERIC)_(.+)$/.exec(code);
  if (m) return `## ${m[1]}`;
  m = /^L3_(?:SKILL_)?(?:SKILL_MISSING_SECTION|SKILL_SECTION_GENERIC)_(.+)$/.exec(code);
  if (m) return `## ${m[1]}`;
  m = /^L3_(?:CASOS_)?CASO_([^_]+(?:-[^_]+)*)_/.exec(code);
  if (m) return `casos[id=${m[1]}]`;
  m = /^L4_(?:EVIDENCE|BLOCKED)_([A-Z0-9-]+)_/.exec(code);
  if (m) return `registros[id=${m[1]}]`;
  return null;
}

/** Cascade markers: a level is not evaluated because a lower one failed. */
function isCascadeCode(code) {
  return /^L[2-4]_BLOCKED_BY_L[1-3]$/.test(code);
}

/**
 * Build a structured finding from an internal code produced by the evaluators.
 *
 * @param {string} code
 * @param {{ severity: 'ERROR'|'WARNING'|'INFO', toolId?: string|null, toolDir?: string|null }} ctx
 * @returns {Finding}
 */
export function findingFromCode(code, ctx) {
  const level = levelOfCode(code);
  const cascade = isCascadeCode(code);
  const severity = cascade ? 'INFO' : ctx.severity;
  const doc = mapCodeToDoc(code);
  const file = fileForCode(code);
  const title = (DOC_DEFINITIONS[doc] || DOC_DEFINITIONS['DOC-02']).title;
  const message = cascade
    ? `Nivel ${level} no evaluado: el nivel inferior no se cumple (${code}).`
    : `${title}: ${code}`;
  return makeFinding({
    code,
    doc,
    level: level === 'INFO' ? 'STRUCT' : level,
    severity,
    toolId: ctx.toolId ?? null,
    file: file && ctx.toolDir ? `${ctx.toolDir}/${file}` : file,
    field: fieldForCode(code),
    message,
    // Blocks its own level (or every level, for structural defects).
    blocking: severity === 'ERROR' && !cascade,
  });
}

/**
 * @typedef {object} Finding
 * @property {string} doc
 * @property {string} code
 * @property {'ERROR'|'WARNING'|'INFO'} severity
 * @property {'L1'|'L2'|'L3'|'L4'|'STRUCT'} level
 * @property {string|null} toolId
 * @property {string|null} file
 * @property {string|null} field
 * @property {string} message
 * @property {string} action
 * @property {boolean} blocking
 * @property {unknown} [evidence]
 */

/**
 * Build a normalised diagnostic.
 *
 * @param {{
 *   code: string,
 *   level?: 'L1'|'L2'|'L3'|'L4'|'STRUCT',
 *   toolId?: string|null,
 *   file?: string|null,
 *   field?: string|null,
 *   message?: string,
 *   action?: string,
 *   severity?: 'ERROR'|'WARNING'|'INFO',
 *   blocking?: boolean,
 *   doc?: string,
 *   evidence?: unknown,
 * }} input
 * @returns {Finding}
 */
export function makeFinding(input) {
  const doc = input.doc || mapCodeToDoc(input.code);
  const definition = DOC_DEFINITIONS[doc] || DOC_DEFINITIONS['DOC-02'];
  return {
    doc,
    code: input.code,
    severity: input.severity || 'ERROR',
    level: input.level || 'L2',
    toolId: input.toolId ?? null,
    file: input.file ?? null,
    field: input.field ?? null,
    message: input.message || input.code,
    action: input.action || definition.action,
    blocking: input.blocking ?? true,
    ...(input.evidence === undefined ? {} : { evidence: input.evidence }),
  };
}

/**
 * Count findings by DOC family and severity.
 *
 * @param {Finding[]} findings
 * @returns {{ byDoc: Record<string, number>, bySeverity: Record<string, number>, total: number, blocking: number }}
 */
export function summarizeFindings(findings) {
  const byDoc = {};
  const bySeverity = { ERROR: 0, WARNING: 0, INFO: 0 };
  let blocking = 0;
  for (const f of findings) {
    byDoc[f.doc] = (byDoc[f.doc] || 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    if (f.blocking) blocking++;
  }
  return { byDoc, bySeverity, total: findings.length, blocking };
}

export function isStructuralCode(code) {
  return STRUCTURAL_CODES.has(code);
}
