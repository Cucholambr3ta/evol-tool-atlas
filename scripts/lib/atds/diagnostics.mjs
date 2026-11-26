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
  if (code === 'L1_DESCRIPTION_VAGUE' || code === 'L1_DESCRIPTION_GENERIC') return 'DOC-01';
  if (code.startsWith('L1_MISSING_FUENTE') || code.startsWith('L1_SOURCE_')) return 'DOC-03';
  if (code.startsWith('L1_MISSING_PLATAFORMAS') || code.startsWith('L2_GUIDE_MISSING_SECTION_PLATAFORMAS')) return 'DOC-05';
  if (code.includes('VERSION') || code.includes('VERSI')) return 'DOC-04';
  if (code.includes('INSTALACION') || code.includes('INSTALL') || code.startsWith('L2_GUIDE_MISSING_SECTION_INSTALACI')) return 'DOC-06';
  if (code.includes('COMANDOS') || code.includes('COMMAND') || code.startsWith('L2_GUIDE_MISSING_SECTION_COMANDOS')) return 'DOC-07';
  if (code.startsWith('L3_CASOS') || code.startsWith('CASO_') || code === 'CASOS_NO_SUBSTANTIVE' || code === 'CASOS_EMPTY') return 'DOC-08';
  if (code.startsWith('L3_SKILL') || code.startsWith('SKILL_')) return 'DOC-09';
  if (code.startsWith('BLOCKED_')) return 'DOC-10';
  if (code.startsWith('EVIDENCE_') || code.startsWith('L4_')) return 'DOC-10';
  if (code.startsWith('L2_GUIDE')) return 'DOC-02';
  if (code.startsWith('L1_')) return 'DOC-02';
  if (code.startsWith('L3_')) return 'DOC-02';
  return 'DOC-02';
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
