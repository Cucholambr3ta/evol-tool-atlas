#!/usr/bin/env node
/**
 * ATDS STRICT gate for CI.
 *
 * Runs the real validator CLI as a subprocess and asserts the exact exit code
 * of every case: positive controls must exit 0, negative controls must exit 1
 * and operational errors must exit 2. Any other code fails the gate, so an
 * unexpected STRICT failure (or an unexpected PASS) can never become success.
 *
 * Fixtures and regression copies are written to a private temporary directory
 * (fs.mkdtemp in the OS temp dir) and removed afterwards. The real catalogue
 * is only read.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildFixtureRoot } from './atds-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(__dirname, 'validate-atds.mjs');
const POLICY = path.join(__dirname, 'atds-strict-policy.json');
const LOT_E3_01_POLICY = path.join(__dirname, 'atds-lote-e3-01-policy.json');

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Copy a real catalogue entry (read-only) into `dest` as a one-tool root. */
function copyRealTool(dest, toolId) {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8'));
  const tool = catalog.herramientas.find((t) => t.id === toolId);
  if (!tool) throw new Error(`Herramienta ${toolId} no encontrada en el catálogo`);
  const dir = path.posix.dirname(tool.href);
  fs.cpSync(path.join(ROOT, dir), path.join(dest, dir), { recursive: true });
  fs.writeFileSync(path.join(dest, 'catalogo.json'), JSON.stringify({ categorias: catalog.categorias, herramientas: [tool] }));
  return path.join(dest, dir);
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atds-gate-'));
  const fx = path.join(tmp, 'fixtures-root');
  const regOk = path.join(tmp, 'regression-unchanged');
  const regBad = path.join(tmp, 'regression-degraded');
  try {
    fs.mkdirSync(fx);
    buildFixtureRoot(fx);

    // Regression control: the same real entry, unchanged vs. degraded copy.
    copyRealTool(regOk, 'semgrep');
    const degradedDir = copyRealTool(regBad, 'semgrep');
    const metaPath = path.join(degradedDir, 'metadata.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    for (const k of ['upstream', 'sitio_web', 'fuentes_oficiales', 'fuentes_consultadas', 'referencias_oficiales', 'repositorio', 'sitio_oficial']) delete meta[k];
    fs.writeFileSync(metaPath, JSON.stringify(meta));
    const regPolicy = path.join(tmp, 'regression-policy.json');
    fs.writeFileSync(regPolicy, JSON.stringify({ targets: { semgrep: 'L1' } }));
    // Lot E3-01 regression: a copy of threat-dragon without its guide must fall below L3.
    const lotOk = path.join(tmp, 'lot-e3-01-unchanged');
    const lotBad = path.join(tmp, 'lot-e3-01-degraded');
    copyRealTool(lotOk, 'threat-dragon');
    fs.rmSync(path.join(copyRealTool(lotBad, 'threat-dragon'), 'GUIA.md'));
    const lotPolicy = path.join(tmp, 'lot-e3-01-policy.json');
    fs.writeFileSync(lotPolicy, JSON.stringify({ targets: { 'threat-dragon': 'L3' } }));
    const badPolicy = path.join(tmp, 'bad-policy.json');
    fs.writeFileSync(badPolicy, JSON.stringify({ targets: { semgrep: 'L7' } }));

    const cases = [
      // Positive controls → 0
      { name: 'REPORT catálogo completo', expect: 0, args: ['--report', '--root', fx] },
      { name: 'Política de no regresión (12 prioritarias)', expect: 0, args: ['--strict', '--policy', POLICY] },
      { name: 'Semgrep L1 / mínimo L1', expect: 0, args: ['--strict', '--targets', 'semgrep', '--min-level', 'L1'] },
      { name: 'Fixture L1 / mínimo L1', expect: 0, args: ['--strict', '--root', fx, '--targets', 'fx-l1', '--min-level', 'L1'] },
      { name: 'Fixture L1 con L2 incompleto / mínimo L1', expect: 0, args: ['--strict', '--root', fx, '--targets', 'fx-l1-l2-incompleto', '--min-level', 'L1'] },
      { name: 'Fixtures L2 CLI/GUI/API / mínimo L2', expect: 0, args: ['--strict', '--root', fx, '--targets', 'fx-l2-cli,fx-l2-gui,fx-l2-api', '--min-level', 'L2'] },
      { name: 'Fixture L3 / mínimo L3', expect: 0, args: ['--strict', '--root', fx, '--targets', 'fx-l3', '--min-level', 'L3'] },
      { name: 'Fixture L4 / mínimo L4', expect: 0, args: ['--strict', '--root', fx, '--targets', 'fx-l4', '--min-level', 'L4'] },
      { name: 'Regresión: copia intacta de semgrep / política L1', expect: 0, args: ['--strict', '--root', regOk, '--policy', regPolicy] },
      { name: 'Lote E3-01: política de no regresión (4 fichas)', expect: 0, args: ['--strict', '--policy', LOT_E3_01_POLICY] },
      { name: 'Lote E3-01: copia intacta de threat-dragon / L3', expect: 0, args: ['--strict', '--root', lotOk, '--policy', lotPolicy] },
      // Negative controls → 1
      { name: 'Semgrep L1 / mínimo L2', expect: 1, args: ['--strict', '--targets', 'semgrep', '--min-level', 'L2'] },
      { name: 'promptfoo NONE / mínimo L1', expect: 1, args: ['--strict', '--targets', 'promptfoo', '--min-level', 'L1'] },
      { name: 'Fixture NONE / mínimo L1', expect: 1, args: ['--strict', '--root', fx, '--targets', 'fx-none', '--min-level', 'L1'] },
      { name: 'Fixture L1 / mínimo L2', expect: 1, args: ['--strict', '--root', fx, '--targets', 'fx-l1', '--min-level', 'L2'] },
      { name: 'Fixture L4 con artefacto secundario corrupto / mínimo L4', expect: 1, args: ['--strict', '--root', fx, '--targets', 'fx-l4-artefacto-corrupto', '--min-level', 'L4'] },
      { name: 'Regresión: semgrep sin fuentes / política L1', expect: 1, args: ['--strict', '--root', regBad, '--policy', regPolicy] },
      { name: 'Lote E3-01: threat-dragon sin GUIA.md / L3', expect: 1, args: ['--strict', '--root', lotBad, '--policy', lotPolicy] },
      // Operational errors → 2
      { name: 'Nivel inválido', expect: 2, args: ['--strict', '--targets', 'semgrep', '--min-level', 'L9'] },
      { name: 'Target inexistente', expect: 2, args: ['--strict', '--targets', 'semgrep,herramienta-inexistente', '--min-level', 'L1'] },
      { name: 'Política con nivel inválido', expect: 2, args: ['--strict', '--policy', badPolicy] },
      { name: 'Argumento desconocido', expect: 2, args: ['--strict', '--targets', 'semgrep', '--min-lvl', 'L1'] },
    ];

    let failures = 0;
    for (const c of cases) {
      const r = run(c.args);
      const ok = r.code === c.expect;
      if (!ok) failures++;
      console.log(`${ok ? 'OK  ' : 'FAIL'} [esperado ${c.expect}, obtenido ${r.code}] ${c.name}`);
      if (!ok) console.log(r.out.split('\n').map((l) => `      ${l}`).join('\n'));
    }
    console.log(`\n[ATDS-GATE] ${cases.length - failures}/${cases.length} controles con el código de salida esperado.`);
    return failures === 0 ? 0 : 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

process.exitCode = main();
