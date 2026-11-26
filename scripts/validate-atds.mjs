import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function isHttpUrl(v) {
  return typeof v === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(v.trim());
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
  return [...new Set(urls)];
}

const VAGUE_PATTERNS = [
  /herramienta para seguridad/i,
  /sirve para analizar sistemas/i,
  /permite realizar pruebas/i,
  /software avanzado de auditoria/i,
  /herramienta avanzada/i,
  /utilidad de seguridad/i,
];

function level(meta, toolDir) {
  const hasGuide = fs.existsSync(path.join(ROOT, toolDir, 'GUIA.md'));
  const hasSkill = fs.existsSync(path.join(ROOT, toolDir, 'SKILL.md'));
  const hasCases = fs.existsSync(path.join(ROOT, toolDir, 'casos-uso.json'));
  const hasEvidence = fs.existsSync(path.join(ROOT, toolDir, 'evidencias.json'));
  let records = [];
  if (hasEvidence) {
    try { records = readJson(path.join(ROOT, toolDir, 'evidencias.json')).registros || []; } catch { /* ignore malformed evidence */ }
  }
  const realEvidence = records.some((r) => r.resultado === 'PASS' && r.evidencia);
  const l1 =
    meta.id && meta.nombre && meta.descripcion && meta.categoria &&
    (meta.estado_fuente || meta.estado) && (meta.fecha_verificacion || meta.verificacion_fecha) &&
    collectUrls(meta).length > 0;
  const l2 = l1 && meta.licencia && meta.sistema_operativo && meta.dependencias && meta.requisitos && hasGuide;
  const l3 = l2 && (hasSkill || hasCases);
  const l4 = l3 && realEvidence;
  return l4 ? 'L4' : l3 ? 'L3' : l2 ? 'L2' : l1 ? 'L1' : 'NONE';
}

const catalogo = readJson(path.join(ROOT, 'catalogo.json'));
const report = {
  generatedAt: new Date().toISOString(),
  totals: { tools: catalogo.herramientas.length, categories: catalogo.categorias.length },
  levels: {},
  issues: [],
  tools: [],
};

for (const t of catalogo.herramientas) {
  const toolDir = path.posix.dirname(t.href);
  const metaPath = path.join(ROOT, toolDir, 'metadata.json');
  const issues = [];
  let meta = {};
  try { meta = readJson(metaPath); } catch { issues.push('MISSING_METADATA'); }

  const required = ['id', 'nombre', 'descripcion', 'licencia', 'sistema_operativo', 'dependencias', 'requisitos', 'estado_mantenimiento'];
  for (const key of required) {
    if (meta[key] === undefined || meta[key] === null || String(meta[key]).trim() === '') {
      issues.push(`MISSING_${key.toUpperCase()}`);
    }
  }
  const date = meta.fecha_verificacion || meta.verificacion_fecha || meta.fecha_revision;
  if (!date) issues.push('MISSING_DATE');
  const urls = collectUrls(meta);
  if (urls.length === 0) issues.push('MISSING_SOURCE');
  if (VAGUE_PATTERNS.some((p) => p.test(String(meta.descripcion || '')))) issues.push('VAGUE_DESCRIPTION');
  if (!fs.existsSync(path.join(ROOT, toolDir, 'README.md'))) issues.push('MISSING_README');

  const lvl = level(meta, toolDir);
  report.levels[lvl] = (report.levels[lvl] || 0) + 1;
  const entry = { id: t.id, category: t.cat, level: lvl, issues };
  report.tools.push(entry);
  if (issues.length) report.issues.push(entry);
}

const summary = {
  totalTools: report.totals.tools,
  levels: report.levels,
  toolsWithIssues: report.issues.length,
  issueCounts: {},
};
for (const e of report.issues) for (const i of e.issues) summary.issueCounts[i] = (summary.issueCounts[i] || 0) + 1;

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'atds-validation.json'), JSON.stringify({ summary, report }, null, 2));
console.log('ATDS validation complete.');
console.log(JSON.stringify(summary, null, 2));
console.log(`Report: reports/atds-validation.json`);
