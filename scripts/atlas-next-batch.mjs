#!/usr/bin/env node
/**
 * Read-only planner for the next incremental enrichment batch (methodology §1–§2).
 *
 *   node scripts/atlas-next-batch.mjs [--json] [--max-tools 6]
 *
 * Progress is tracked per tool ID (scripts/lib/next-batch.mjs): a category stays
 * pending until all its admitted tools appear in approved lot policies
 * (scripts/atds-lote-<lote>-policy.json). Categories larger than --max-tools are
 * split into consecutive sub-lots E3-NNa, E3-NNb, … without repeating or skipping IDs.
 *
 * Exit codes: 0 = plan produced; 1 = admitidas/efectivas discrepancy (§1.2, stop);
 * 2 = invalid arguments or inconsistent lot policies.
 *
 * It only reads files. Opening the batch is a separate, human-authorised step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planNextBatch } from './lib/next-batch.mjs';

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
// Approved lots: scripts/atds-lote-<lote>-policy.json (the E2 policy is not a lot).
const lots = fs
  .readdirSync(path.join(ROOT, 'scripts'))
  .filter((f) => /^atds-lote-.+-policy\.json$/.test(f))
  .sort()
  .map((f) => {
    const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8'));
    const raw = f.replace(/^atds-lote-(.+)-policy\.json$/, '$1');
    const id = raw.replace(/^e3-/i, 'E3-');
    return { id, file: `scripts/${f}`, targets: policy.targets ?? {} };
  });

const plan = planNextBatch({ catalog, lots, maxTools: MAX_TOOLS });
const output = {
  lote: plan.propuesta ? plan.propuesta.lote : null,
  modo: 'PLAN — solo lectura; no se ha modificado ningún archivo',
  criterio: `efectivas ascendente; empate por numero; progreso por ID; lote ≤ ${MAX_TOOLS} herramientas; categorías mayores en sublotes E3-NNa, E3-NNb…`,
  lotes_aprobados: plan.lotes_aprobados,
  herramientas_completadas: plan.herramientas_completadas,
  herramientas_pendientes: plan.herramientas_pendientes,
  discrepancias_admitidas_efectivas: plan.discrepancies,
  errores_politicas: plan.errors,
  categorias_completadas: plan.categorias_completadas,
  categorias_pendientes_en_orden: plan.categorias_pendientes_en_orden.slice(0, 15),
  propuesta: plan.propuesta,
  siguiente_paso: 'Requiere autorización humana para abrir la rama del lote. Ver skills/atlas-catalog-curator/SKILL.md §3.',
};

if (plan.errors.length > 0) {
  console.error(`[PLAN] Políticas de lote inconsistentes: ${plan.errors.join('; ')}`);
  if (asJson) console.log(JSON.stringify(output, null, 2));
  process.exit(2);
}
if (plan.discrepancies.length > 0) {
  console.error(`[PLAN] Discrepancias admitidas/efectivas: ${plan.discrepancies.join('; ')}. Detenerse y registrarlas antes de abrir un lote.`);
  if (asJson) console.log(JSON.stringify(output, null, 2));
  process.exit(1);
}

if (asJson) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`[PLAN] ${output.modo}`);
  console.log(`[PLAN] Lotes aprobados: ${plan.lotes_aprobados.map((l) => `${l.lote} (${l.herramientas.join(', ')})`).join(' · ') || 'ninguno'}`);
  console.log(`[PLAN] Herramientas completadas ${plan.herramientas_completadas} · pendientes ${plan.herramientas_pendientes}`);
  console.table(output.categorias_pendientes_en_orden);
  const p = plan.propuesta;
  if (!p) console.log('[PLAN] No quedan herramientas pendientes.');
  else if (p.tipo === 'sublote') {
    console.log(`[PLAN] ${p.lote}: sublote de ${p.categoria.slug} (${p.total} de ${p.categoria.herramientas}; quedarán ${p.restantes_en_categoria}): ${p.herramientas.map((h) => h.id).join(', ')}`);
  } else {
    console.log(`[PLAN] ${p.lote}: ${p.categorias.map((c) => `${c.slug} (${c.herramientas})`).join(', ')} → ${p.total} herramientas: ${p.herramientas.map((h) => h.id).join(', ')}`);
  }
  console.log(`[PLAN] ${output.siguiente_paso}`);
}
