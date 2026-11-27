import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Markers that denote missing or provisional information. Values are compared
 * after canonicalisation (upper case, accents removed, spaces/hyphens/dots
 * collapsed to "_"), so "No verificada", "no-verificado" or " tbd " are all
 * rejected.
 */
const UNVERIFIED_VALUES = new Set([
  'NO_VERIFICADA', 'NO_VERIFICADO', 'NO_VERIFICADAS', 'NO_VERIFICADOS',
  'PENDIENTE', 'PENDIENTES', 'NO_DETERMINADO', 'NO_DETERMINADA',
  'DESCONOCIDO', 'DESCONOCIDA', 'N/A', 'NA', 'N_A', 'NO_APLICA',
  'TBD', 'TBC', 'TODO', 'POR_DEFINIR', 'POR_DETERMINAR', 'SIN_DATOS', 'SIN_INFORMACION',
  'NO_DISPONIBLE', 'UNKNOWN', 'NONE', 'NULL', 'UNDEFINED', '-', '--', '?', '...',
]);

/**
 * Prefixes that mark a value as provisional even when followed by a qualifier,
 * e.g. "NO_VERIFICADA_EN_HOST" or "PENDIENTE_DE_REVISION".
 */
const UNVERIFIED_PREFIXES = ['NO_VERIFICAD', 'PENDIENTE_', 'NO_DETERMINAD', 'DESCONOCID', 'POR_DEFINIR', 'TBD_'];

/**
 * Hosts reserved for documentation/testing (RFC 2606/6761) or local machines.
 * A URL on these hosts identifies no real upstream source.
 */
const PLACEHOLDER_HOST_RE = /^(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net)|example|test|invalid|localhost)$|^127\.|^0\.0\.0\.0$|^\[?::1\]?$/i;

function canonicalMarker(v) {
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const VAGUE_PATTERNS = [
  /herramienta para seguridad/i,
  /sirve para analizar sistemas/i,
  /permite realizar pruebas/i,
  /software avanzado de auditoria/i,
  /herramienta avanzada/i,
  /utilidad de seguridad/i,
];

function isHttpUrl(v) {
  return typeof v === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(v.trim());
}

/**
 * True when `v` carries real information: not null/empty and not a provisional
 * marker. Arrays are verified when at least one element is verified; plain
 * objects are never accepted as a scalar value.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
function isVerifiedValue(v) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.some((item) => isVerifiedValue(item));
  if (typeof v === 'object') return false;
  const raw = String(v).trim();
  if (raw === '') return false;
  if (UNVERIFIED_VALUES.has(raw.toUpperCase())) return false;
  const canon = canonicalMarker(raw);
  if (canon === '' || UNVERIFIED_VALUES.has(canon)) return false;
  if (UNVERIFIED_PREFIXES.some((p) => canon.startsWith(p))) return false;
  return true;
}

/**
 * True when the URL points at a documentation/test placeholder host
 * (example.com, *.test, localhost...). Such URLs never prove an official source.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
function isPlaceholderUrl(v) {
  if (!isHttpUrl(v)) return false;
  try {
    return PLACEHOLDER_HOST_RE.test(new URL(String(v).trim()).hostname);
  } catch {
    return true;
  }
}

/**
 * True when `v` is a real calendar date in ISO form (YYYY-MM-DD...).
 *
 * @param {unknown} v
 * @returns {boolean}
 */
function isIsoDate(v) {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function collectUrls(meta) {
  const urls = [];
  if (meta.fuentes_oficiales && typeof meta.fuentes_oficiales === 'object') {
    for (const v of Object.values(meta.fuentes_oficiales)) if (isHttpUrl(v)) urls.push(v);
  }
  if (Array.isArray(meta.fuentes_consultadas)) for (const v of meta.fuentes_consultadas) if (isHttpUrl(v)) urls.push(v);
  if (Array.isArray(meta.referencias_oficiales)) for (const r of meta.referencias_oficiales) if (r && isHttpUrl(r.url)) urls.push(r.url);
  if (isHttpUrl(meta.sitio_oficial)) urls.push(meta.sitio_oficial);
  if (isHttpUrl(meta.repositorio)) urls.push(meta.repositorio);
  if (isHttpUrl(meta.upstream)) urls.push(meta.upstream);
  if (isHttpUrl(meta.sitio_web)) urls.push(meta.sitio_web);
  if (isHttpUrl(meta.fuente_proyecto)) urls.push(meta.fuente_proyecto);
  if (isHttpUrl(meta.fuente_historica)) urls.push(meta.fuente_historica);
  if (isHttpUrl(meta.fuente_repositorio)) urls.push(meta.fuente_repositorio);
  return [...new Set(urls)];
}

function extractTypeFromMeta(meta) {
  const tipo = (meta.tipo || meta.subtipo || meta.categoria_atlas || meta.categoria_origen || '').toLowerCase();
  if (/gui|gr[aá]fica|escritorio|desktop|interfaz|navegador|web ui/.test(tipo)) return 'gui';
  if (/api|sdk|librer|library|framework|paquete|m[oó]dulo|biblioteca/.test(tipo)) return 'api/sdk';
  if (/cli|terminal|comando|l[ií]nea de comandos/.test(tipo)) return 'cli';
  if (/servicio|service|plataforma|saas|infra|contenedor|nube/.test(tipo)) return 'service/infra';
  return 'other';
}

function extractToolIdentity(meta, toolDir) {
  return {
    id: meta.id || meta.id_catalogo || path.posix.basename(toolDir),
    nombre: meta.nombre || meta.id || meta.id_catalogo || path.posix.basename(toolDir),
    descripcion: meta.descripcion || meta.caso_uso_evol || meta.uso_evol_propuesto || '',
    categoria: meta.categoria || meta.categoria_atlas || meta.subtipo || meta.categoria_origen || '',
    tipo: meta.tipo || meta.subtipo || '',
    problema_que_resuelve: meta.problema_que_resuelve || meta.caso_uso_evol || meta.uso_evol_propuesto || '',
    funciones_principales: meta.funciones_principales || meta.descripcion || '',
    fuentes_oficiales: meta.fuentes_oficiales || {},
    fuentes_consultadas: meta.fuentes_consultadas || [],
    referencias_oficiales: meta.referencias_oficiales || [],
    sitio_oficial: meta.sitio_oficial || '',
    repositorio: meta.repositorio || '',
    upstream: meta.upstream || '',
    sitio_web: meta.sitio_web || '',
    licencia: meta.licencia || '',
    sistema_operativo: meta.sistema_operativo || meta.plataformas || meta.sistemas_operativos || '',
    dependencias: meta.dependencias || '',
    requisitos: meta.requisitos || '',
    fecha_verificacion: meta.fecha_verificacion || meta.verificacion_fecha || meta.fecha_revision || '',
    estado_fuente: meta.estado_fuente || meta.estado_mantenimiento || meta.estado || '',
    limites: meta.limites || meta.limitaciones || meta.limitaciones_conocidas || [],
    id_catalogo: meta.id_catalogo || '',
    toolDir,
    rawTipo: meta.tipo || '',
  };
}

function normalizeMetadata(rawMeta, toolDir) {
  const identity = extractToolIdentity(rawMeta || {}, toolDir);
  const urls = collectUrls(rawMeta || {});
  const toolType = extractTypeFromMeta(rawMeta || {});
  
  return {
    ...identity,
    urls,
    toolType,
    raw: rawMeta,
  };
}

export { 
  ROOT, 
  UNVERIFIED_VALUES,
  UNVERIFIED_PREFIXES,
  VAGUE_PATTERNS,
  isHttpUrl,
  isVerifiedValue,
  isPlaceholderUrl,
  isIsoDate,
  collectUrls,
  extractTypeFromMeta,
  extractToolIdentity,
  normalizeMetadata,
};