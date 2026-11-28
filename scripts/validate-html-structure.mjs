#!/usr/bin/env node
/**
 * EVOL Tool Atlas — Structural HTML Validator (CLI)
 *
 * Advisory by default; `--strict --fail-on-error` is the blocking mode.
 * Read-only: it never rewrites `02-catalogo/`, never regenerates SHA-256
 * sums and never disables `scripts/lib/html-scan.mjs` (the security scanner
 * remains the gate in `scripts/verify-atlas.mjs`; here it is also executed and
 * reported as a complementary security section).
 *
 * Usage:
 *   node scripts/validate-html-structure.mjs
 *   node scripts/validate-html-structure.mjs --strict --fail-on-error
 *   node scripts/validate-html-structure.mjs --strict --allowlist=scripts/html-validation-allowlist.json
 *   node scripts/validate-html-structure.mjs --output=/tmp/html.json --no-security
 *   node scripts/validate-html-structure.mjs --compact   # aggregates only (committed artifact)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanStaticTree } from './lib/html-scan.mjs';
import {
  RULES,
  applyAllowlist,
  createContext,
  loadAllowlist,
  ruleCatalog,
  summarize,
  validateFile,
  walkHtmlFiles,
} from './lib/html-structure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(ROOT, '02-catalogo');
const CATALOGO_JSON = path.join(ROOT, 'catalogo.json');
const ATDS_REPORT = path.join(ROOT, 'reports', 'atds-validation.json');
const DEFAULT_ALLOWLIST = path.join(ROOT, 'scripts', 'html-validation-allowlist.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'scripts', 'html-validation-results.json');

function parserVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'node_modules', 'node-html-parser', 'package.json'), 'utf8'),
    );
    return `node-html-parser@${pkg.version}`;
  } catch {
    return 'node-html-parser@unknown';
  }
}

function gitHead() {
  try {
    const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5);
      const refFile = path.join(ROOT, '.git', ref);
      if (fs.existsSync(refFile)) return fs.readFileSync(refFile, 'utf8').trim();
    }
    return head;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const has = (flag) => argv.includes(flag);
  const value = (prefix) => argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
  return {
    mode: has('--strict') ? 'strict' : 'advisory',
    failOnError: has('--fail-on-error'),
    runSecurity: !has('--no-security'),
    compact: has('--compact'),
    allowlistPath: has('--no-allowlist') ? null : value('--allowlist=') || DEFAULT_ALLOWLIST,
    outputPath: value('--output=') || DEFAULT_OUTPUT,
  };
}

function printTextReport(report) {
  const { summary, corpus, security, allowlist, mode } = report;
  console.log('\n=== HTML STRUCTURE VALIDATION ===');
  console.log(`Mode: ${mode}`);
  console.log(`Parser: ${report.parser}`);
  console.log(`Corpus: ${corpus.files} files (${corpus.fichas} fichas, ${corpus.indices} indices)`);
  if (security) {
    console.log(
      `Security scan (scripts/lib/html-scan.mjs): ${security.files} files, ${security.blocking} blocking, ${security.advisoryTotal} advisory`,
    );
  }
  console.log(`Total findings: ${summary.total}`);
  console.log(`  P1 normative HTML/WCAG (error): ${summary.byPriority.P1}`);
  console.log(`  P2 accessibility/navigation/contract (warn): ${summary.byPriority.P2}`);
  console.log(`  P3 visual/publication contract (warn): ${summary.byPriority.P3}`);
  console.log(`Files with findings: ${summary.filesWithFindings}`);

  console.log('\n--- By priority / category ---');
  for (const priority of ['P1', 'P2', 'P3']) {
    const rules = Object.entries(summary.byRule)
      .filter(([id]) => RULES.find((r) => r.id === id)?.priority === priority)
      .sort((a, b) => b[1] - a[1]);
    console.log(`  ${priority}: ${summary.byPriority[priority]} findings`);
    for (const [id, count] of rules) {
      const meta = RULES.find((r) => r.id === id);
      console.log(`    ${String(count).padStart(6)}  ${id} (${meta?.category ?? '?'})`);
    }
  }

  console.log('\n--- By rule ---');
  for (const [rule, count] of Object.entries(summary.byRule).sort((a, b) => b[1] - a[1])) {
    const meta = RULES.find((r) => r.id === rule);
    console.log(`  ${String(count).padStart(6)}  ${rule} [${meta?.priority ?? '?'} ${meta?.category ?? '?'}]`);
  }

  console.log('\n--- Top files ---');
  for (const [file, count] of Object.entries(summary.byFile).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(count).padStart(6)}  ${file}`);
  }

  console.log('\n--- Allowlist ---');
  if (!allowlist) {
    console.log('  disabled');
  } else {
    console.log(`  entries: ${allowlist.entries}, expired: ${allowlist.expired}, suppressed in strict: ${allowlist.suppressed}`);
    for (const warning of allowlist.warnings) console.log(`  WARN ${warning}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogo = JSON.parse(fs.readFileSync(CATALOGO_JSON, 'utf8'));
  const atdsReport = fs.existsSync(ATDS_REPORT)
    ? JSON.parse(fs.readFileSync(ATDS_REPORT, 'utf8'))
    : null;
  const base = createContext({ rootDir: ROOT, catalogo, atdsReport });

  const allowlist = loadAllowlist(args.allowlistPath, { rootDir: ROOT });
  const htmlFiles = walkHtmlFiles(CATALOG_DIR);
  const findings = [];
  for (const file of htmlFiles) findings.push(...validateFile(file, base));

  const { findings: visible, suppressed } = applyAllowlist(findings, allowlist, args.mode);
  const summary = summarize(visible);

  const fichas = htmlFiles.filter((f) =>
    base.toolsByHref.has(path.relative(ROOT, f).split(path.sep).join('/')),
  ).length;
  const corpus = {
    files: htmlFiles.length,
    fichas,
    indices: htmlFiles.length - fichas,
  };

  let security = null;
  if (args.runSecurity) {
    const r = scanStaticTree(CATALOG_DIR, ROOT);
    security = {
      files: r.files,
      blocking: r.blocking.length,
      blockingFindings: r.blocking,
      advisoryCounts: r.advisoryCounts,
      advisoryTotal: Object.values(r.advisoryCounts).reduce((a, b) => a + b, 0),
      stats: r.stats,
    };
  }

  const report = {
    schema: 'evol-tool-atlas/html-validation/2',
    generatedAt: new Date().toISOString(),
    head: gitHead(),
    mode: args.mode,
    parser: parserVersion(),
    corpus,
    rules: ruleCatalog(),
    security,
    allowlist: allowlist
      ? {
          schema: allowlist.schema,
          expiresAt: allowlist.expiresAt ?? null,
          owner: allowlist.owner ?? null,
          entries: allowlist.entries.length,
          expired: allowlist.entries.filter((e) => e.expired).length,
          suppressed: suppressed,
          warnings: allowlist.warnings,
        }
      : null,
    summary,
    violations: args.compact ? undefined : visible,
    ...(args.compact
      ? { note: 'Compact output: full per-finding detail omitted. Re-run without --compact for the complete list.' }
      : {}),
  };

  fs.writeFileSync(args.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  printTextReport(report);
  console.log(`\nJSON output written to ${args.outputPath}`);

  const p1 = summary.byPriority.P1;
  const blockingSecurity = security?.blocking ?? 0;
  const expired = report.allowlist?.expired ?? 0;
  const blocking = p1 > 0 || blockingSecurity > 0 || expired > 0;

  if (args.mode === 'strict') {
    console.log(
      `\n[VALIDATE] strict gate: P1=${p1}, security blocking=${blockingSecurity}, expired allowlist=${expired}`,
    );
    if (blocking && args.failOnError) {
      console.log('[VALIDATE] FAIL (strict + --fail-on-error)');
      process.exitCode = 1;
    } else if (blocking) {
      console.log('[VALIDATE] WOULD FAIL (strict without --fail-on-error; no exit code set)');
      process.exitCode = 0;
    } else {
      console.log('[VALIDATE] PASS (strict gate clean)');
      process.exitCode = 0;
    }
  } else {
    console.log(
      `\n[VALIDATE] advisory: P1=${p1}, security blocking=${blockingSecurity}, expired allowlist=${expired} — never blocks`,
    );
    process.exitCode = 0;
  }
}

main();
