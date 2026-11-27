/**
 * Readable labels for internal codes (ATDS-UI-02..06, UX-03). The code itself is
 * always kept available next to the label (title attribute or detail cell).
 */
import type { AtdsLevel } from '../types/catalog';

export function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

/** "2026-11-22" → "22-11-2026"; anything else is returned unchanged. */
export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value;
}

export type SourceKind = 'primaria-contrastada' | 'publicacion-verificada' | 'expediente' | 'identificada' | 'historica';

export interface EvidenceStatusLabel {
  label: string;
  kind: SourceKind;
  date: string | null;
}

/**
 * Status codes describe how a sheet's *source* was handled. None of them means a
 * link was checked over the network by the Atlas, and none certifies the tool.
 */
const STATUS_BASES: Array<[RegExp, string, SourceKind]> = [
  [/^FUENTE_Y_RELEASE(_OFICIALES)?_VERIFICADOS$/, 'Fuente y publicación oficial verificadas según el registro', 'publicacion-verificada'],
  [/^RELEASE_OFICIAL_VERIFICADA$/, 'Publicación oficial verificada según el registro', 'publicacion-verificada'],
  [/^DISTRIBUCION_PYPI_VERIFICADA$/, 'Distribución en PyPI verificada según el registro', 'publicacion-verificada'],
  [/^FUENTE_OFICIAL_VERIFICADA$/, 'Fuente oficial contrastada según el registro', 'primaria-contrastada'],
  [/^(REVALIDADA_WEB|FUENTE_REVALIDADA_WEB)$/, 'Fuente revalidada en web según el registro', 'primaria-contrastada'],
  [/^FUENTE_(WEB|PUBLICA)_CONTRASTADA$/, 'Fuente pública contrastada según el registro', 'primaria-contrastada'],
  [/^FUENTE_CONTRASTADA_EN_ESTA_ENTREGA$/, 'Fuente contrastada en la entrega documental', 'primaria-contrastada'],
  [/^FUENTE_EXTERNA_COMPROBADA$/, 'Fuente externa comprobada según el registro', 'primaria-contrastada'],
  [/^FUENTE_COMPROBADA_EN_EXPEDIENTE$/, 'Fuente comprobada en el expediente de origen', 'expediente'],
  [/^FUENTE_COMPROBADA_SOLO_EN_EXPEDIENTE$/, 'Fuente comprobada solo en el expediente de origen', 'expediente'],
  [/^EXPEDIENTE_URL_VERIFICADA$/, 'URL registrada en el expediente (no comprobada por el Atlas)', 'expediente'],
  [/^PROYECTO_O_DISTRIBUCION_ACCESIBLE$/, 'Proyecto o distribución identificado como accesible en el registro', 'identificada'],
  [/^FUENTE_DOCUMENTAL_IDENTIFICADA$/, 'Fuente documental identificada', 'identificada'],
  [/^DOCUMENTAL_PREVIA$/, 'Documentación previa sin contraste nuevo', 'identificada'],
  [/^DOCUMENTAL$/, 'Documental', 'identificada'],
  [/^REPOSITORIO_HISTORICO_ACCESIBLE$/, 'Repositorio histórico accesible', 'historica'],
  [/^REFERENCIA_HISTORICA_NO_APROBADA$/, 'Referencia histórica no aprobada', 'historica'],
];

export function evidenceStatusLabel(code: string): EvidenceStatusLabel {
  const m = /^(.*?)_(\d{4}-\d{2}-\d{2})$/.exec(code);
  const base = m ? (m[1] ?? code) : code;
  const date = m ? (m[2] ?? null) : null;
  for (const [re, label, kind] of STATUS_BASES) {
    if (re.test(base)) return { label: date ? `${label} (${formatIsoDate(date)})` : label, kind, date };
  }
  return { label: code.replace(/_/g, ' ').toLowerCase(), kind: 'identificada', date };
}

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  'primaria-contrastada': 'Fuente primaria contrastada',
  'publicacion-verificada': 'Publicación verificada',
  expediente: 'Comprobación de expediente',
  identificada: 'Fuente identificada',
  historica: 'Referencia histórica',
};

export const ATDS_LEVEL_LABELS: Record<AtdsLevel, string> = {
  NONE: 'Sin nivel ATDS',
  L1: 'L1 · Identificación verificable',
  L2: 'L2 · Guía técnica',
  L3: 'L3 · Conocimiento aplicado',
  L4: 'L4 · Evidencia experimental',
};

export const RESOURCE_LABELS: Record<string, string> = {
  metadata: 'Metadatos',
  guide: 'Guía técnica',
  skill: 'Skill reutilizable',
  cases: 'Casos de uso',
  evidence: 'Evidencias',
};

/** Presence, validity and pending state of a resource, without implying certification. */
export function resourceStateLabel(present: boolean, valid: boolean, check: string): string {
  if (check === 'BLOCKED') return present ? 'Presente · no evaluado (nivel inferior pendiente)' : 'Ausente · no evaluado (nivel inferior pendiente)';
  if (check === 'ABSENT_OPTIONAL') return 'Ausente · opcional (el otro recurso L3 es válido)';
  if (!present) return 'Ausente · pendiente';
  return valid ? 'Presente · controles superados' : 'Presente · controles no superados';
}

export const USE_CASE_STATE_LABELS: Record<string, string> = {
  propuesto_no_ejecutado: 'Propuesto · no ejecutado',
  ejecutado: 'Ejecutado',
  ejecutado_con_evidencia: 'Ejecutado con evidencia',
  bloqueado: 'Bloqueado',
  descartado: 'Descartado',
};

export function useCaseStateLabel(estado: string | null): string {
  if (estado === null) return 'Sin estado registrado (dato no verificado)';
  return USE_CASE_STATE_LABELS[estado] ?? estado.replace(/_/g, ' ');
}

export const EVIDENCE_RESULT_LABELS: Record<string, string> = {
  PASS: 'Superada',
  FAIL: 'Fallida',
  BLOCKED: 'Bloqueada',
  INCONCLUSIVE: 'No concluyente',
};

export const INTEGRITY_LABELS: Record<string, string> = {
  VERIFICADA: 'Integridad verificada por el validador ATDS',
  NO_ACREDITADA: 'Declarada · no acreditada',
  NO_APLICA: 'Sin acreditación (resultado no PASS)',
};

export const REASON_LABELS: Record<string, string> = {
  REGISTRO_INCOMPLETO: 'faltan campos obligatorios del registro',
  IDENTIDAD_NO_COINCIDE: 'la identidad del registro no coincide con la ficha',
  TIPO_NO_ACREDITA_FUNCIONALIDAD: 'el tipo de prueba no acredita funcionalidad',
  SOLO_VERSION_O_DISPONIBILIDAD: 'solo demuestra versión o disponibilidad',
  ARTEFACTOS_SIN_INTEGRIDAD_DEMOSTRADA: 'algún artefacto no tiene integridad demostrada',
};

export const ARTIFACT_STATUS_LABELS: Record<string, string> = {
  VERIFIED: 'hash comprobado',
  VERIFIED_VIA_PRIMARY: 'mismo contenido que el artefacto principal',
  VERIFIED_BY_EXCEPTION: 'ubicación histórica aceptada por excepción documentada',
  UNVERIFIABLE_NO_PATH: 'histórico sin ruta · no verificable',
  NO_IDENTITY: 'sin nombre',
  MALFORMED_HASH: 'hash malformado',
  UNSAFE_PATH: 'ruta no autorizada',
  MISSING: 'archivo ausente',
  NOT_A_FILE: 'no es un archivo',
  HASH_MISMATCH: 'hash no coincide',
  DUPLICATE: 'duplicado',
  FOREIGN_ARTIFACT: 'pertenece a otra ficha',
};

export const SCOPE_LABELS: Record<string, string> = {
  functional: 'funcional declarado',
  version: 'solo versión o disponibilidad',
  none: 'no aplica',
};
