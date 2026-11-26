import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');

const UNVERIFIED_VALUES = new Set([
  'NO_VERIFICADA', 'NO_VERIFICADO', 'PENDIENTE', 'NO_DETERMINADO',
  'DESCONOCIDO', 'N/A', 'NA', 'TBD', 'POR_DEFINIR'
]);

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

function isVerifiedValue(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (s === '') return false;
  if (UNVERIFIED_VALUES.has(s.toUpperCase())) return false;
  return true;
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
  VAGUE_PATTERNS,
  isHttpUrl, 
  isVerifiedValue, 
  collectUrls,
  extractTypeFromMeta,
  extractToolIdentity,
  normalizeMetadata,
};