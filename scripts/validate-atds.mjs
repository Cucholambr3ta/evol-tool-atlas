#!/usr/bin/env node
/**
 * EVOL Tool Atlas — ATDS v1 validator CLI.
 *
 * Exit codes: 0 = success / all PASS, 1 = STRICT policy failure,
 * 2 = operational error (bad arguments, unknown targets, unreadable catalogue).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/atds/paths.mjs';
import { parseLevel } from './lib/atds/classify.mjs';
import { evaluateToolSafe, evaluateStrict, resolveTargets, OperationalError } from './lib/atds/evaluate.mjs';
import { buildToolReport, buildSummary, writeReport } from './lib/atds/report.mjs';

function loadCatalog(root) {
  const catalogPath = path.join(root, 'catalogo.json');
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (e) {
    throw new OperationalError(`No se pudo leer ${catalogPath}: ${e.message}`);
  }
  if (!catalog || !Array.isArray(catalog.herramientas)) throw new OperationalError(`${catalogPath} no contiene "herramientas"`);
  return catalog;
}

function runReportMode(root, { quiet = false } = {}) {
  const catalog = loadCatalog(root);
  const tools = catalog.herramientas;
  const report = {
    generatedAt: new Date().toISOString(),
    totals: { tools: tools.length, categories: Array.isArray(catalog.categorias) ? catalog.categorias.length : 0 },
    tools: [],
  };
  for (const t of tools) {
    report.tools.push(buildToolReport(t, evaluateToolSafe(t, { root })));
  }
  if (report.tools.length !== tools.length) throw new OperationalError('El reporte no cubre todas las herramientas del catálogo');
  report.summary = buildSummary(report);
  const target = writeReport(root, report);
  if (!quiet) {
    console.log(`[REPORT] ${report.tools.length} herramientas evaluadas → ${path.relative(process.cwd(), target) || target}`);
    const { levels, candidateLevels, statusCounts, findings, reviewRequired } = report.summary;
    console.log(JSON.stringify({ levels, candidateLevels, statusCounts, findings, reviewRequired }, null, 2));
  }
  return 0;
}

function runStrictMode(root, selection) {
  const catalog = loadCatalog(root);
  const resolved = resolveTargets(catalog.herramientas, selection.map((s) => s.target), root);
  const results = [];
  let failed = 0;
  for (let i = 0; i < resolved.length; i++) {
    const { target, tool } = resolved[i];
    const minLevel = selection[i].minLevel;
    const result = evaluateToolSafe(tool, { root });
    const strict = evaluateStrict(result, minLevel);
    results.push({ target, toolId: tool.id, validatedLevel: result.validatedLevel, candidateLevel: result.candidateLevel, strict });
    if (strict.passed) {
      console.log(`[STRICT] PASS ${tool.id} (validado ${strict.currentLevel}, mínimo ${strict.requiredLevel}) — ${strict.explanation}`);
    } else {
      failed++;
      console.error(`[STRICT] FAIL ${tool.id} (validado ${strict.currentLevel}, mínimo ${strict.requiredLevel}) — ${strict.explanation}`);
      for (const code of strict.issues) console.error(`  - ${code}`);
    }
  }
  console.log(`[STRICT] ${resolved.length} evaluada(s): ${resolved.length - failed} PASS, ${failed} FAIL`);
  return { exitCode: failed > 0 ? 1 : 0, results };
}

function parseArgs(argv) {
  const opts = { strict: false, report: false, targets: [], targetsFile: null, minLevel: null, policy: null, root: ROOT, output: null };
  const needValue = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new OperationalError(`${flag} requiere un valor`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--strict': opts.strict = true; break;
      case '--report': opts.report = true; break;
      case '--targets': opts.targets = needValue(i, a).split(',').map((s) => s.trim()).filter(Boolean); i++; break;
      case '--targets-file': opts.targetsFile = needValue(i, a); i++; break;
      case '--min-level': opts.minLevel = needValue(i, a); i++; break;
      case '--policy': opts.policy = needValue(i, a); i++; break;
      case '--root': opts.root = path.resolve(needValue(i, a)); i++; break;
      case '--output': opts.output = needValue(i, a); i++; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new OperationalError(`Argumento desconocido: ${a}`);
    }
  }
  if (opts.strict && opts.report) throw new OperationalError('--strict y --report son excluyentes');
  return opts;
}

/**
 * Build the STRICT selection: [{ target, minLevel }].
 * A policy file is `{ "targets": { "<id>": "L1", ... } }`.
 */
function buildSelection(opts) {
  if (opts.policy && (opts.targets.length > 0 || opts.targetsFile || opts.minLevel)) {
    throw new OperationalError('--policy no se combina con --targets, --targets-file ni --min-level');
  }
  if (opts.policy) {
    let policy;
    try {
      policy = JSON.parse(fs.readFileSync(opts.policy, 'utf8'));
    } catch (e) {
      throw new OperationalError(`No se pudo leer la política ${opts.policy}: ${e.message}`);
    }
    const entries = policy && typeof policy.targets === 'object' && policy.targets ? Object.entries(policy.targets) : [];
    if (entries.length === 0) throw new OperationalError('La política no define "targets"');
    return entries.map(([target, level]) => {
      if (!parseLevel(level)) throw new OperationalError(`Nivel inválido en la política para ${target}: ${String(level)}`);
      return { target, minLevel: parseLevel(level) };
    });
  }
  let targets = opts.targets;
  if (opts.targetsFile) {
    try {
      targets = JSON.parse(fs.readFileSync(opts.targetsFile, 'utf8'));
    } catch (e) {
      throw new OperationalError(`No se pudo leer el archivo de targets: ${e.message}`);
    }
    if (!Array.isArray(targets) || !targets.every((t) => typeof t === 'string')) throw new OperationalError('El archivo de targets debe ser un array de cadenas');
  }
  if (targets.length === 0) throw new OperationalError('No se indicaron targets (use --targets, --targets-file o --policy)');
  const minLevel = opts.minLevel === null ? 'L1' : parseLevel(opts.minLevel);
  if (!minLevel) throw new OperationalError(`Nivel mínimo inválido: ${opts.minLevel} (use NONE, L1, L2, L3 o L4)`);
  return targets.map((target) => ({ target, minLevel }));
}

function printUsage() {
  console.log(`
EVOL Tool Atlas — ATDS v1 Validator

  node scripts/validate-atds.mjs [--report] [--root <dir>]
  node scripts/validate-atds.mjs --strict --targets <id,...> [--min-level <NONE|L1|L2|L3|L4>] [--root <dir>] [--output <file>]
  node scripts/validate-atds.mjs --strict --targets-file <file.json> [--min-level <level>]
  node scripts/validate-atds.mjs --strict --policy <policy.json>

REPORT: evaluates every tool in <root>/catalogo.json and writes <root>/reports/atds-validation.json
        (generated file, not versioned). Exit 0, or 2 on operational error.
STRICT: evaluates the selected tools against the requested minimum level only;
        findings of higher levels do not block. Exit 0 = PASS, 1 = FAIL, 2 = operational error
        (invalid level, unknown target, unreadable files).
`);
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      printUsage();
      return 0;
    }
    if (!opts.strict) return runReportMode(opts.root);
    const selection = buildSelection(opts);
    const { exitCode, results } = runStrictMode(opts.root, selection);
    if (opts.output) fs.writeFileSync(opts.output, JSON.stringify({ results }, null, 2));
    return exitCode;
  } catch (err) {
    if (err instanceof OperationalError) {
      console.error(`[ATDS] ERROR operacional: ${err.message}`);
      return 2;
    }
    console.error('[ATDS] FATAL', err);
    return 2;
  }
}

process.exitCode = main();
