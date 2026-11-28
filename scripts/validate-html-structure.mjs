#!/usr/bin/env node
/**
 * EVOL Tool Atlas — Structural HTML Validator (CLI)
 *
 * Three modes:
 *   advisory (default)   whole corpus, reports everything, never blocks on findings.
 *   strict               whole corpus, P1/security/expired allowlist; legacy P1 makes it
 *                        fail today, so it is NOT a release gate.
 *   certification        --targets-file: only the listed pages, against every mandatory
 *                        rule of their contract; the rest of the corpus stays advisory.
 *
 * Exit codes: 0 = OK / PASS, 1 = strict or certification FAIL, 2 = operational error
 * (unknown argument, bad selection, missing ATDS results, unreadable files, incomplete
 * corpus). Findings never produce exit 2; operational errors never produce exit 0.
 *
 * Read-only: it never rewrites `02-catalogo/`, never regenerates SHA-256 sums and never
 * disables `scripts/lib/html-scan.mjs` (the security scanner remains the gate in
 * `scripts/verify-atlas.mjs`; here it is also executed and reported).
 *
 * Usage:
 *   node scripts/validate-html-structure.mjs
 *   node scripts/validate-html-structure.mjs --compact            # committed aggregate artifact
 *   node scripts/validate-html-structure.mjs --output=$RUNNER_TEMP/html.json --summary-md=$GITHUB_STEP_SUMMARY
 *   node scripts/validate-html-structure.mjs --strict --fail-on-error
 *   node scripts/validate-html-structure.mjs --targets-file=scripts/html-pilot-targets.json
 *   node scripts/validate-html-structure.mjs --targets-file=<f> --atds-source=report [--atds-report=<file>]
 *   node scripts/validate-html-structure.mjs --root=<dir>         # alternate documentary root (tests)
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
import { HtmlOperationalError, certifyTargets, createAtdsLookup, loadTargets } from './lib/html-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(REPO, 'scripts', 'html-validation-results.json');

function parserVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO, 'node_modules', 'node-html-parser', 'package.json'), 'utf8'),
    );
    return `node-html-parser@${pkg.version}`;
  } catch {
    return 'node-html-parser@unknown';
  }
}

const FLAGS = new Set(['--strict', '--fail-on-error', '--no-security', '--compact', '--no-allowlist']);
const VALUED = ['--allowlist=', '--output=', '--root=', '--targets-file=', '--atds-source=', '--atds-report=', '--summary-md='];

function parseArgs(argv) {
  for (const a of argv) {
    if (!FLAGS.has(a) && !VALUED.some((p) => a.startsWith(p) && a.length > p.length)) {
      throw new HtmlOperationalError(`Unknown or incomplete argument: ${a}`);
    }
  }
  const has = (flag) => argv.includes(flag);
  const value = (prefix) => argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
  const root = path.resolve(value('--root=') ?? REPO);
  const opts = {
    root,
    mode: value('--targets-file=') ? 'certification' : has('--strict') ? 'strict' : 'advisory',
    failOnError: has('--fail-on-error'),
    runSecurity: !has('--no-security'),
    compact: has('--compact'),
    allowlistPath: has('--no-allowlist')
      ? null
      : value('--allowlist=') || path.join(root, 'scripts', 'html-validation-allowlist.json'),
    outputPath: value('--output=') ?? null,
    targetsFile: value('--targets-file=') ?? null,
    atdsSource: value('--atds-source=') ?? 'evaluate',
    atdsReport: value('--atds-report=') ?? null,
    summaryMd: value('--summary-md=') ?? null,
  };
  if (opts.mode === 'certification' && (has('--strict') || has('--fail-on-error') || opts.compact)) {
    throw new HtmlOperationalError('--targets-file is its own blocking mode; do not combine it with --strict, --fail-on-error or --compact');
  }
  if (opts.atdsReport && opts.atdsSource !== 'report') {
    throw new HtmlOperationalError('--atds-report requires --atds-source=report');
  }
  // Only --compact writes the committed artifact by default; full detail needs --output.
  if (!opts.outputPath && opts.compact) opts.outputPath = DEFAULT_OUTPUT;
  return opts;
}

function loadCatalog(root) {
  const file = path.join(root, 'catalogo.json');
  let catalogo;
  try {
    catalogo = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new HtmlOperationalError(`Cannot read ${file}: ${e.message}`);
  }
  if (!Array.isArray(catalogo?.herramientas) || !Array.isArray(catalogo?.categorias)) {
    throw new HtmlOperationalError(`${file} lacks herramientas[] or categorias[]`);
  }
  return catalogo;
}

/** Every catalogued ficha and category index must be among the analysed files. */
function assertCoverage(root, files, catalogo) {
  if (files.length === 0) throw new HtmlOperationalError(`No HTML files found under ${path.join(root, '02-catalogo')}`);
  const rels = new Set(files.map((f) => path.relative(root, f).split(path.sep).join('/')));
  const missing = [...catalogo.herramientas, ...catalogo.categorias].map((x) => x.href).filter((h) => !rels.has(h));
  if (missing.length > 0) {
    throw new HtmlOperationalError(
      `${missing.length} catalogued page(s) not found in 02-catalogo/ (e.g. ${missing.slice(0, 3).join(', ')})`,
    );
  }
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
  console.log(`  P1 normative HTML (error): ${summary.byPriority.P1}`);
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

function markdownSummary(report) {
  const { summary, corpus, security, mode } = report;
  const lines = [
    `## HTML structure validation (${mode})`,
    '',
    `Corpus: **${corpus.files}** pages (${corpus.fichas} fichas, ${corpus.indices} indices). Parser: ${report.parser}.`,
    security ? `Security scan (html-scan.mjs): ${security.blocking} blocking, ${security.advisoryTotal} advisory.` : 'Security scan: skipped.',
    '',
    '| Priority | Findings |',
    '|---|---:|',
    ...['P1', 'P2', 'P3'].map((p) => `| ${p} | ${summary.byPriority[p]} |`),
    `| **Total** | **${summary.total}** |`,
    '',
    '| Rule | Priority | Category | Findings |',
    '|---|---|---|---:|',
    ...Object.entries(summary.byRule)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => {
        const r = RULES.find((x) => x.id === id);
        return `| \`${id}\` | ${r?.priority ?? '?'} | ${r?.category ?? '?'} | ${n} |`;
      }),
    '',
  ];
  if (report.certification) {
    const c = report.certification;
    lines.push(
      `### Certification: ${c.failed === 0 ? 'PASS' : 'FAIL'} (${c.passed}/${c.certified})`,
      '',
      '| File | Contract | Status | Blocking |',
      '|---|---|---|---:|',
      ...c.results.map((r) => `| \`${r.file}\` | ${r.contract} | ${r.status} | ${r.blocking.length} |`),
      '',
      `Rest of the corpus (advisory, never blocks): ${c.rest.files} pages, ${c.rest.findings} findings.`,
      '',
    );
  } else {
    lines.push('Advisory: historical findings are reported and never fail this step; operational errors do.', '');
  }
  return `${lines.join('\n')}\n`;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root;
  const catalogo = loadCatalog(root);
  const catalogDir = path.join(root, '02-catalogo');
  const atdsLookup = createAtdsLookup({
    source: args.atdsSource,
    rootDir: root,
    reportPath: args.atdsReport ? path.resolve(args.atdsReport) : undefined,
  });
  const base = createContext({ rootDir: root, catalogo, atdsLookup });

  let allowlist = null;
  try {
    allowlist = args.mode === 'certification' ? null : loadAllowlist(args.allowlistPath, { rootDir: root });
  } catch (e) {
    throw new HtmlOperationalError(`Invalid allowlist: ${e.message}`);
  }
  const htmlFiles = walkHtmlFiles(catalogDir);
  assertCoverage(root, htmlFiles, catalogo);

  let certification = null;
  let targetSet = new Set();
  if (args.mode === 'certification') {
    const selection = loadTargets(path.resolve(args.targetsFile), { rootDir: root, catalogo });
    targetSet = new Set(selection.targets.map((t) => t.file));
    const certBase = {
      ...base,
      atdsLookup: createAtdsLookup({
        source: args.atdsSource,
        rootDir: root,
        reportPath: args.atdsReport ? path.resolve(args.atdsReport) : undefined,
        required: true,
      }),
    };
    certification = { targetsFile: path.relative(process.cwd(), path.resolve(args.targetsFile)), ...certifyTargets({ base: certBase, selection }) };
  }

  const findings = [];
  for (const file of htmlFiles) findings.push(...validateFile(file, base));
  const { findings: visible, suppressed } = allowlist
    ? applyAllowlist(findings, allowlist, args.mode)
    : { findings, suppressed: 0 };
  const summary = summarize(visible);

  if (certification) {
    const rest = visible.filter((f) => !targetSet.has(f.file));
    certification.rest = { files: htmlFiles.length - targetSet.size, findings: rest.length, blocks: false };
  }

  const fichas = htmlFiles.filter((f) => base.toolsByHref.has(path.relative(root, f).split(path.sep).join('/'))).length;
  const corpus = { files: htmlFiles.length, fichas, indices: htmlFiles.length - fichas };

  let security = null;
  if (args.runSecurity) {
    const r = scanStaticTree(catalogDir, root);
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
    schema: 'evol-tool-atlas/html-validation/3',
    // The committed --compact artifact carries no timestamp and no commit SHA: a file
    // cannot name the commit that contains it. Its reproducibility is checked by tests.
    ...(args.compact ? {} : { generatedAt: new Date().toISOString() }),
    mode: args.mode,
    parser: parserVersion(),
    atdsSource: args.atdsSource,
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
          suppressed,
          warnings: allowlist.warnings,
        }
      : null,
    summary,
    ...(certification ? { certification } : {}),
    ...(args.compact
      ? { note: 'Compact output: per-finding detail omitted. Re-run `npm run validate:html` without --compact for the complete list.' }
      : { violations: visible }),
  };

  if (args.outputPath) {
    fs.writeFileSync(args.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (args.summaryMd) fs.appendFileSync(args.summaryMd, markdownSummary(report));
  printTextReport(report);
  if (args.outputPath) console.log(`\nJSON output written to ${args.outputPath}`);

  if (certification) {
    console.log(`\n--- Certification (${certification.targetsFile}) ---`);
    for (const r of certification.results) {
      console.log(`  ${r.status} ${r.contract.padEnd(14)} ${r.file} (${r.blocking.length} blocking)`);
      for (const b of r.blocking.slice(0, 12)) console.log(`      - [${b.basis}] ${b.id}: ${b.message}`);
      if (r.blocking.length > 12) console.log(`      ... ${r.blocking.length - 12} more`);
    }
    console.log(`  Rest of corpus: ${certification.rest.files} pages stay advisory (${certification.rest.findings} findings, never block)`);
    const ok = certification.failed === 0 && (security?.blocking ?? 0) === 0;
    console.log(`\n[VALIDATE] certification: ${certification.passed}/${certification.certified} PASS, security blocking=${security?.blocking ?? 0} — ${ok ? 'PASS' : 'FAIL'}`);
    return ok ? 0 : 1;
  }

  const p1 = summary.byPriority.P1;
  const blockingSecurity = security?.blocking ?? 0;
  const expired = report.allowlist?.expired ?? 0;
  const blocking = p1 > 0 || blockingSecurity > 0 || expired > 0;

  if (args.mode === 'strict') {
    console.log(`\n[VALIDATE] strict gate: P1=${p1}, security blocking=${blockingSecurity}, expired allowlist=${expired}`);
    if (blocking && args.failOnError) {
      console.log('[VALIDATE] FAIL (strict + --fail-on-error)');
      return 1;
    }
    console.log(blocking ? '[VALIDATE] WOULD FAIL (strict without --fail-on-error; no exit code set)' : '[VALIDATE] PASS (strict gate clean)');
    return 0;
  }
  console.log(`\n[VALIDATE] advisory: ${corpus.files} pages, P1=${p1}, security blocking=${blockingSecurity}, expired allowlist=${expired} — findings never block`);
  return 0;
}

try {
  process.exitCode = run();
} catch (e) {
  if (e instanceof HtmlOperationalError) {
    console.error(`[VALIDATE] OPERATIONAL ERROR: ${e.message}`);
    process.exitCode = 2;
  } else {
    console.error(`[VALIDATE] OPERATIONAL ERROR (unexpected): ${e?.stack ?? e}`);
    process.exitCode = 2;
  }
}
