#!/usr/bin/env node
/**
 * Read-only planner for the next incremental enrichment batch (methodology §1–§2).
 *
 *   node scripts/atlas-next-batch.mjs [--json] [--max-tools 6]
 *
 * - Effective tools per category = entries of catalogo.json herramientas[] with that cat.
 *   A mismatch with categorias[].admitidas stops the plan (exit 1), as §1.2 requires.
 * - Categories already enriched = categories of the tools listed in the approved lot
 *   policies scripts/atds-lote-*-policy.json.
 * - Order: effective tools ascending, ties by numero ascending.
 * - Proposed batch: consecutive pending categories while the total stays ≤ max-tools;
 *   if the first pending category alone exceeds it, a sub-batch of its first tools.
 *
 * It only reads files. It does not create branches, policies or sheets: opening the
 * batch is a separate, human-authorised step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const maxIdx = args.indexOf('--max-tools');
const MAX_TOOLS = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 6;
if (!Number.isInteger(MAX_TOOLS) || MAX_TOOLS < 1) {
  console.error('--max-tools debe ser un entero positivo');
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8'));
const toolsByCat = new Map();
for (const t of catalog.herramientas) {
  const k = Number(t.cat);
  if (!toolsByCat.has(k)) toolsByCat.set(k, []);
  toolsByCat.get(k).push(t);
}

const discrepancies = [];
const categories = catalog.categorias.map((c) => {
  const numero = Number(c.numero);
  const efectivas = (toolsByCat.get(numero) ?? []).length;
  if (efectivas !== Number(c.admitidas)) discrepancies.push(`${c.slug}: admitidas ${c.admitidas}, efectivas ${efectivas}`);
  return { numero, slug: String(c.slug), nombre: String(c.nombre), admitidas: Number(c.admitidas), efectivas };
});

// Approved lots: scripts/atds-lote-<lote>-policy.json (the E2 policy is not a lot).
const lotFiles = fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => /^atds-lote-.+-policy\.json$/.test(f)).sort();
const lots = lotFiles.map((f) => {
  const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8'));
  const id = f.replace(/^atds-lote-(.+)-policy\.json$/, '$1').toUpperCase();
  return { id, file: `scripts/${f}`, targets: policy.targets ?? {} };
});
const enrichedToolIds = new Set(lots.flatMap((l) => Object.keys(l.targets)));
const toolById = new Map(catalog.herramientas.map((t) => [String(t.id), t]));
const enrichedCats = new Set([...enrichedToolIds].map((id) => Number(toolById.get(id)?.cat)).filter(Number.isFinite));

const ordered = [...categories].sort((a, b) => a.efectivas - b.efectivas || a.numero - b.numero);
const pending = ordered.filter((c) => !enrichedCats.has(c.numero) && c.efectivas > 0);

// Next lot id: E3-<NN> after the highest approved E3 lot.
const e3 = lots.map((l) => /^E3-(\d+)/.exec(l.id)?.[1]).filter(Boolean).map(Number);
const nextLot = `E3-${String((e3.length ? Math.max(...e3) : 0) + 1).padStart(2, '0')}`;

const batch = [];
let total = 0;
for (const c of pending) {
  if (total + c.efectivas > MAX_TOOLS) break;
  batch.push(c);
  total += c.efectivas;
}
let subBatch = null;
if (batch.length === 0 && pending[0]) {
  const first = pending[0];
  subBatch = { categoria: first.slug, herramientas: (toolsByCat.get(first.numero) ?? []).slice(0, MAX_TOOLS).map((t) => t.id) };
}

const proposal = {
  lote: nextLot,
  modo: 'PLAN — solo lectura; no se ha modificado ningún archivo',
  criterio: `efectivas ascendente; empate por numero; lote ≤ ${MAX_TOOLS} herramientas`,
  lotes_aprobados: lots.map((l) => ({ lote: l.id, politica: l.file, herramientas: Object.keys(l.targets) })),
  discrepancias_admitidas_efectivas: discrepancies,
  categorias_pendientes_en_orden: pending.slice(0, 15),
  propuesta: subBatch
    ? { tipo: 'sublote', ...subBatch }
    : {
        tipo: 'lote',
        categorias: batch.map((c) => ({ numero: c.numero, slug: c.slug, nombre: c.nombre, herramientas: c.efectivas })),
        herramientas: batch.flatMap((c) => (toolsByCat.get(c.numero) ?? []).map((t) => ({ id: t.id, ruta: path.posix.dirname(t.href) }))),
        total,
      },
  siguiente_paso: 'Requiere autorización humana para abrir la rama del lote. Ver skills/atlas-catalog-curator/SKILL.md §3.',
};

if (discrepancies.length > 0) {
  console.error(`[PLAN] Discrepancias admitidas/efectivas: ${discrepancies.join('; ')}. Detenerse y registrarlas antes de abrir un lote.`);
  if (asJson) console.log(JSON.stringify(proposal, null, 2));
  process.exit(1);
}

if (asJson) {
  console.log(JSON.stringify(proposal, null, 2));
} else {
  console.log(`[PLAN] ${proposal.modo}`);
  console.log(`[PLAN] Lotes aprobados: ${lots.map((l) => `${l.id} (${Object.keys(l.targets).join(', ')})`).join(' · ') || 'ninguno'}`);
  console.table(pending.slice(0, 15).map(({ numero, slug, nombre, efectivas }) => ({ numero, slug, nombre, efectivas })));
  if (subBatch) console.log(`[PLAN] ${nextLot}: sublote de ${subBatch.categoria}: ${subBatch.herramientas.join(', ')}`);
  else console.log(`[PLAN] ${nextLot}: ${batch.map((c) => `${c.slug} (${c.efectivas})`).join(', ')} → ${total} herramientas: ${proposal.propuesta.herramientas.map((h) => h.id).join(', ')}`);
  console.log(`[PLAN] ${proposal.siguiente_paso}`);
}
