#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonWithin, toolDirFromHref, ROOT } from './lib/atds/paths.mjs';
import { normalizeMetadata, VAGUE_PATTERNS } from './lib/atds/normalize.mjs';
import { checkGuideContent } from './lib/atds/guide.mjs';
import { checkSkillContent } from './lib/atds/skill.mjs';
import { checkCasesContent } from './lib/atds/cases.mjs';
import { checkEvidenceContent } from './lib/atds/evidence.mjs';
import { 
  evaluateL1, evaluateL2, evaluateL3, evaluateL4, 
  computeLevels, computeStatus 
} from './lib/atds/classify.mjs';
import { buildToolReport, buildSummary, writeReport } from './lib/atds/report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname available for ESM module resolution if needed

async function evaluateTool(tool, options = {}) {
  const { strict = false, strictTargets = [], strictMinLevel = null } = options;
  const toolDir = toolDirFromHref(tool.href);
  
  const issues = [];
  const warnings = [];
  const checks = {};
  const checkedFiles = [];
  
  // Read metadata with safe path resolution
  const metaResult = readJsonWithin(ROOT, path.posix.join(toolDir, 'metadata.json'));
  if (!metaResult.ok) {
    issues.push('MISSING_METADATA');
    return buildEmptyResult(tool, toolDir, issues, warnings, checks, checkedFiles);
  }
  
  const normalizedMeta = normalizeMetadata(metaResult.data, toolDir);
  normalizedMeta.VAGUE_PATTERNS = VAGUE_PATTERNS;
  normalizedMeta.id_catalogo = metaResult.data.id_catalogo || '';
  
  // Resolve document paths
  const guidePath = path.join(ROOT, toolDir, 'GUIA.md');
  const skillPath = path.join(ROOT, toolDir, 'SKILL.md');
  const casesPath = path.join(ROOT, toolDir, 'casos-uso.json');
  const evidencePath = path.join(ROOT, toolDir, 'evidencias.json');
  
  checkedFiles.push(guidePath, skillPath, casesPath, evidencePath);
  
  // Evaluate each level
  const l1Result = evaluateL1(normalizedMeta);
  issues.push(...l1Result.issues);
  warnings.push(...l1Result.warnings);
  Object.assign(checks, l1Result.checks);
  
  const guideResult = checkGuideContent(guidePath, normalizedMeta.toolType);
  const l2Result = evaluateL2(l1Result, guideResult, normalizedMeta);
  issues.push(...l2Result.issues.filter(i => i.startsWith('L2_')));
  warnings.push(...l2Result.warnings.filter(w => w.startsWith('L2_')));
  Object.assign(checks, l2Result.checks);
  
  const skillResult = checkSkillContent(skillPath);
  const casesResult = checkCasesContent(casesPath);
  const l3Result = evaluateL3(l2Result, skillResult, casesResult, normalizedMeta);
  issues.push(...l3Result.issues.filter(i => i.startsWith('L3_')));
  warnings.push(...l3Result.warnings.filter(w => w.startsWith('L3_')));
  Object.assign(checks, l3Result.checks);
  
  const evidenceResult = checkEvidenceContent(evidencePath, ROOT, ROOT);
  const l4Result = evaluateL4(l3Result, evidenceResult, normalizedMeta);
  issues.push(...l4Result.issues.filter(i => i.startsWith('L4_')));
  warnings.push(...l4Result.warnings.filter(w => w.startsWith('L4_')));
  Object.assign(checks, l4Result.checks);
  
  const { candidateLevel, validatedLevel } = computeLevels(l1Result, l2Result, l3Result, l4Result);
  const status = computeStatus(issues, l1Result, l2Result, l3Result, l4Result);
  
  const result = {
    toolId: tool.id,
    catalogId: normalizedMeta.id_catalogo || null,
    validatedLevel,
    candidateLevel,
    status,
    checks,
    issues,
    warnings,
    evidenceRefs: l4Result.evidenceRefs || [],
    checkedFiles: checkedFiles.filter(f => fs.existsSync(f)),
    limitations: [],
  };
  
  // STRICT mode evaluation
  if (strict) {
    const inScope = strictTargets.length === 0 || 
      strictTargets.some(t => 
        t === tool.id || 
        t === toolDir ||
        t === normalizedMeta.id_catalogo ||
        (normalizedMeta.id && t === normalizedMeta.id)
      );
    
    if (inScope) {
      result.strictResult = evaluateStrict(result, strictMinLevel);
    }
  }
  
  return result;
}

function buildEmptyResult(tool, toolDir, issues, warnings, checks, checkedFiles) {
  return {
    toolId: tool.id,
    catalogId: null,
    validatedLevel: 'NONE',
    candidateLevel: 'NONE',
    status: 'ERROR',
    checks: { ...checks, L1_METADATA: 'FAIL' },
    issues,
    warnings,
    evidenceRefs: [],
    checkedFiles: checkedFiles.filter(f => fs.existsSync(f)),
    limitations: [],
  };
}

function evaluateStrict(result, minLevel) {
  const levels = { NONE: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
  const current = levels[result.validatedLevel] || 0;
  const required = minLevel ? (levels[minLevel] || 0) : 1; // Default L1 minimum
  
  const blockingIssues = result.issues.filter(i => 
    i.startsWith('L1_') || i.startsWith('L2_') || i.startsWith('L3_') || i.startsWith('L4_')
  );
  
  const belowMinimum = current < required;
  const hasBlocking = blockingIssues.length > 0;
  
  return {
    inScope: true,
    passed: !belowMinimum && !hasBlocking,
    currentLevel: result.validatedLevel,
    requiredLevel: minLevel || 'L1',
    belowMinimum,
    blockingIssues: blockingIssues.length,
    issues: blockingIssues,
  };
}

async function runReportMode(catalogo) {
  console.log('[REPORT] Starting full catalog evaluation...');
  const report = {
    generatedAt: new Date().toISOString(),
    totals: { tools: catalogo.herramientas.length, categories: catalogo.categorias.length },
    levels: {},
    issues: [],
    tools: [],
  };
  
  for (let i = 0; i < catalogo.herramientas.length; i++) {
    const t = catalogo.herramientas[i];
    const result = await evaluateTool(t);
    const lvl = result.validatedLevel;
    report.levels[lvl] = (report.levels[lvl] || 0) + 1;
    
    const entry = buildToolReport(t, result, path.posix.dirname(t.href));
    report.tools.push(entry);
    if (result.issues.length > 0 || result.warnings.length > 0) {
      report.issues.push(entry);
    }
    
    if ((i + 1) % 200 === 0) {
      console.log(`[REPORT] Progress: ${i + 1}/${catalogo.herramientas.length}`);
    }
  }
  
  report.summary = buildSummary(report);
  writeReport(ROOT, report);
  console.log('[REPORT] Complete.');
  console.log(JSON.stringify(report.summary, null, 2));
  
  // REPORT mode returns 0 if no operational errors
  return { exitCode: 0, report };
}

async function runStrictMode(catalogo, targets, minLevel) {
  console.log(`[STRICT] Evaluating ${targets.length} target(s) with minLevel=${minLevel || 'L1'}...`);
  
  const results = [];
  let hasFailure = false;
  let hasError = false;
  let matchedCount = 0;
  
  for (const t of catalogo.herramientas) {
    const toolDir = path.posix.dirname(t.href);
    const inScope = targets.some(target => 
      target === t.id || 
      target === toolDir ||
      (t.id_catalogo && target === t.id_catalogo)
    );
    
    if (!inScope) continue;
    
    matchedCount++;
    const result = await evaluateTool(t, { strict: true, strictTargets: targets, strictMinLevel: minLevel });
    results.push(result);
    
    if (result.strictResult) {
      if (result.strictResult.passed) {
        console.log(`[STRICT] PASS ${t.id} (${result.validatedLevel})`);
      } else {
        hasFailure = true;
        console.error(`[STRICT] FAIL ${t.id} (${result.validatedLevel}) - ${result.strictResult.blockingIssues} blocking issues`);
        if (result.strictResult.belowMinimum) {
          console.error(`  Below minimum: ${result.validatedLevel} < ${result.strictResult.requiredLevel}`);
        }
        for (const issue of result.strictResult.issues) {
          console.error(`  - ${issue}`);
        }
      }
    }
  }
  
  if (matchedCount === 0) {
    console.error('[STRICT] ERROR: No tools matched the selection criteria');
    hasError = true;
  }
  
  console.log(`[STRICT] Evaluated ${matchedCount} tools, ${hasFailure ? 'FAIL' : 'PASS'}`);
  
  return { exitCode: hasError ? 2 : hasFailure ? 1 : 0, results, matchedCount };
}

function printUsage() {
  console.log(`
EVOL Tool Atlas — ATDS v1 Validator

Usage:
  npm run validate:atds              # REPORT mode (full catalog)
  node scripts/validate-atds.mjs --report          # Same as above
  node scripts/validate-atds.mjs --strict [options]  # STRICT mode

REPORT mode:
  Evaluates all 2137 tools, generates full report at reports/atds-validation.json
  Exit code: 0 on success, non-zero on operational error

STRICT mode:
  Evaluates only selected tools against a minimum level policy
  Exit code: 0 = all PASS, 1 = some FAIL, 2 = operational error

STRICT options:
  --targets <id|path>[,...]    Comma-separated tool IDs or catalog paths
  --min-level <NONE|L1|L2|L3|L4>  Minimum required level (default: L1)
  --targets-file <path>        JSON file with array of target IDs/paths
  --output <path>              Write strict results to file

Examples:
  node scripts/validate-atds.mjs --strict --targets semgrep,promptfoo --min-level L2
  node scripts/validate-atds.mjs --strict --targets-file targets.json --min-level L3
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const catalogoPath = path.join(ROOT, 'catalogo.json');
  const catalogo = JSON.parse(fs.readFileSync(catalogoPath, 'utf8'));
  
  const isStrict = args.includes('--strict');
  const isReport = args.includes('--report') || !isStrict;
  
  if (isReport && !isStrict) {
    const { exitCode } = await runReportMode(catalogo);
    process.exit(exitCode);
  }
  
  if (isStrict) {
    let targets = [];
    let minLevel = null;
    let targetsFile = null;
    let outputFile = null;
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--targets') targets = args[++i].split(',').map(s => s.trim()).filter(Boolean);
      else if (args[i] === '--min-level') minLevel = args[++i];
      else if (args[i] === '--targets-file') targetsFile = args[++i];
      else if (args[i] === '--output') outputFile = args[++i];
    }
    
    if (targetsFile) {
      try {
        targets = JSON.parse(fs.readFileSync(targetsFile, 'utf8'));
      } catch (e) {
        console.error(`[STRICT] ERROR: Failed to read targets file: ${e.message}`);
        process.exit(2);
      }
    }
    
    if (targets.length === 0) {
      console.error('[STRICT] ERROR: No targets specified (use --targets or --targets-file)');
      process.exit(2);
    }
    
    const { exitCode, results, matchedCount } = await runStrictMode(catalogo, targets, minLevel);
    
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify({ results, matchedCount }, null, 2));
    }
    
    process.exit(exitCode);
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(2);
});