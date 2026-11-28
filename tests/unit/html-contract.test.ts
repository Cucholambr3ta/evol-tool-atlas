/**
 * HTML contract certification (HTML5-01), publishable contracts (HTML5-02) and the
 * advisory CLI behaviour used by CI (HTML5-03).
 *
 * Nothing here writes to the repository: fixture trees live in os.tmpdir(), and the
 * real pilot pages are only rendered in memory.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RULES, createContext, fileContext, validateFile, walkHtmlFiles, summarize } from '../../scripts/lib/html-structure.mjs';
import type { BaseContext, ToolRecord, CategoryRecord } from '../../scripts/lib/html-structure.mjs';
import {
  CONTRACTS,
  CONTRACT_BASE_PATHS,
  CONTRACT_CHECK_IDS,
  HtmlOperationalError,
  TARGETS_SCHEMA,
  categoryContractVars,
  certifyHtml,
  createAtdsLookup,
  fichaContractVars,
  loadTargets,
  renderContract,
  resolveBrowserHref,
  rootPrefix,
} from '../../scripts/lib/html-contract.mjs';
import type { ContractId } from '../../scripts/lib/html-contract.mjs';
import { scanHtml } from '../../scripts/lib/html-scan.mjs';
import { DOCUMENT_CSP_HEADER } from '../../scripts/lib/security-headers.mjs';
import { STATIC_CATALOG_ITEMS, isPublishedPath } from '../../scripts/lib/static-publish.mjs';

const ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'validate-html-structure.mjs');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8'));
const LOOKUP = createAtdsLookup({ rootDir: ROOT, required: true });
const BASE: BaseContext = createContext({ rootDir: ROOT, catalogo: CATALOGO, atdsLookup: LOOKUP });
const PILOT_FILE = path.join(ROOT, 'scripts', 'html-pilot-targets.json');
const DATE = '2026-11-28';
const SAMPLE_SECTION = [
  '      <section aria-labelledby="problema-h">',
  '        <h2 id="problema-h">Problema que resuelve</h2>',
  '        <p>Contenido ATDS L1 verificado.</p>',
  '      </section>',
].join('\n');

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});
function tmpDir(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

function render(base: BaseContext, rel: string, contract: ContractId, lookup = LOOKUP): string {
  const vars =
    contract === 'ficha'
      ? fichaContractVars(rel, base, lookup, { date: DATE, description: 'Descripción ATDS L1 verificada.', contentSectionsHtml: SAMPLE_SECTION })
      : categoryContractVars(rel, base, lookup, { date: DATE });
  return renderContract(contract, vars);
}

function certify(html: string, rel: string, contract: ContractId, base: BaseContext = BASE) {
  return certifyHtml(html, fileContext(base, path.join(base.rootDir, rel)), contract);
}

const ids = (r: { blocking: Array<{ id: string }> }) => r.blocking.map((b) => b.id);

const THREAT_DRAGON = '02-catalogo/seguridad/catalogo/threat-dragon/index.html';
const SEMGREP = '02-catalogo/testing-y-auditoria/semgrep/index.html';
const CARGO_FUZZ = '02-catalogo/pruebas-tecnicas/cargo-fuzz/index.html';
const SCANNER_INDEX = '02-catalogo/seguridad/catalogo/scanner/index.html';
const PRUEBAS_INDEX = '02-catalogo/pruebas-tecnicas/index.html';

// ============================================================
// Contract catalogue
// ============================================================

describe('contract catalogue', () => {
  it('classifies every validator rule in every contract (required xor not applicable)', () => {
    for (const contract of Object.values(CONTRACTS)) {
      const required = new Set(contract.requiredRules);
      const na = new Set(Object.keys(contract.notApplicable));
      for (const rule of RULES) {
        expect(required.has(rule.id) !== na.has(rule.id), `${contract.id}:${rule.id}`).toBe(true);
      }
      for (const id of [...required, ...na]) expect(RULES.some((r) => r.id === id)).toBe(true);
      for (const id of contract.checks) expect(CONTRACT_CHECK_IDS).toContain(id);
    }
  });

  it('requires more than P1: every mandatory rule of the contract blocks', () => {
    expect(CONTRACTS.ficha.requiredRules).toEqual(
      expect.arrayContaining(['dl-valid', 'skip-link', 'nav-named', 'category-link', 'resource-links', 'atds-badge', 'no-inline-style']),
    );
    expect(CONTRACTS.ficha.checks).toEqual(expect.arrayContaining(['atds-badge-required', 'local-links-resolve']));
    expect(CONTRACTS['category-index'].checks).toEqual(expect.arrayContaining(['card-badges-match-atds', 'links-every-tool']));
  });
});

// ============================================================
// Targets selection
// ============================================================

describe('targets selection', () => {
  const write = (obj: unknown) => {
    const f = path.join(tmpDir('atlas-targets-'), 'targets.json');
    fs.writeFileSync(f, JSON.stringify(obj));
    return f;
  };
  const spec = (targets: unknown[], extra: Record<string, unknown> = {}) => ({
    schema: TARGETS_SCHEMA,
    expectedCount: targets.length,
    targets,
    ...extra,
  });
  const load = (obj: unknown) => loadTargets(write(obj), { rootDir: ROOT, catalogo: CATALOGO });

  it('loads the committed pilot selection: 10 fichas + 1 category index', () => {
    const sel = loadTargets(PILOT_FILE, { rootDir: ROOT, catalogo: CATALOGO });
    expect(sel.expectedCount).toBe(11);
    expect(sel.targets.filter((t) => t.contract === 'ficha')).toHaveLength(10);
    expect(sel.targets.filter((t) => t.contract === 'category-index').map((t) => t.file)).toEqual([SCANNER_INDEX]);
  });

  it('the committed pilot selection matches the pilot table of html-contracts.md §8', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'scripts', 'html-contracts.md'), 'utf8');
    const start = doc.indexOf('## 8. Piloto');
    expect(start).toBeGreaterThan(0);
    const section = doc.slice(start, doc.indexOf('## 9.', start));
    const documented = [...section.matchAll(/`(02-catalogo\/[^`]+\/index\.html)`/g)].map((m) => m[1]);
    const sel = loadTargets(PILOT_FILE, { rootDir: ROOT, catalogo: CATALOGO });
    expect(new Set(documented)).toEqual(new Set(sel.targets.map((t) => t.file)));
    expect(documented).toHaveLength(sel.expectedCount);
  });

  it('accepts a valid ficha + category index selection', () => {
    const sel = load(spec([{ file: THREAT_DRAGON, contract: 'ficha' }, { file: PRUEBAS_INDEX, contract: 'category-index' }]));
    expect(sel.targets).toHaveLength(2);
  });

  const cases: Array<[string, unknown, RegExp]> = [
    ['missing file', spec([{ file: '02-catalogo/seguridad/catalogo/no-existe/index.html', contract: 'ficha' }]), /does not exist/],
    ['path traversal', spec([{ file: '02-catalogo/../catalogo.json', contract: 'ficha' }]), /normalized/],
    ['absolute path', spec([{ file: `/${THREAT_DRAGON}`, contract: 'ficha' }]), /normalized/],
    ['outside the catalogue', spec([{ file: 'index.html', contract: 'ficha' }]), /not a catalogue HTML page/],
    ['contract mismatch', spec([{ file: THREAT_DRAGON, contract: 'category-index' }]), /declares contract/],
    ['unknown contract', spec([{ file: THREAT_DRAGON, contract: 'landing' }]), /unknown contract/],
    ['duplicate target', spec([{ file: THREAT_DRAGON, contract: 'ficha' }, { file: THREAT_DRAGON, contract: 'ficha' }]), /Duplicate/],
    ['expectedCount mismatch', { schema: TARGETS_SCHEMA, expectedCount: 11, targets: [{ file: THREAT_DRAGON, contract: 'ficha' }] }, /expectedCount/],
    ['missing expectedCount', { schema: TARGETS_SCHEMA, targets: [{ file: THREAT_DRAGON, contract: 'ficha' }] }, /expectedCount/],
    ['empty selection', spec([]), /non-empty/],
    ['wrong schema', spec([{ file: THREAT_DRAGON, contract: 'ficha' }], { schema: 'x' }), /schema/],
    ['typo in a target key', spec([{ file: THREAT_DRAGON, contrato: 'ficha' }]), /unknown key/],
    ['typo in a top-level key', spec([{ file: THREAT_DRAGON, contract: 'ficha' }], { exclude: [SEMGREP] }), /unknown key/],
    ['plain string target', spec([THREAT_DRAGON]), /must be an object/],
  ];
  for (const [name, obj, re] of cases) {
    it(`rejects ${name} as an operational error (never skipped silently)`, () => {
      let err: unknown;
      try {
        load(obj);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(HtmlOperationalError);
      expect(String((err as Error).message)).toMatch(re);
    });
  }
});

// ============================================================
// Publishable contracts: real paths, both base paths, CSP
// ============================================================

describe('canonical contracts rendered at real pilot paths', () => {
  const pilot = loadTargets(PILOT_FILE, { rootDir: ROOT, catalogo: CATALOGO });
  const rendered = pilot.targets.map((t) => ({ ...t, html: render(BASE, t.file, t.contract) }));

  it('every pilot page rendered from its contract passes certification', () => {
    for (const r of rendered) {
      const result = certify(r.html, r.file, r.contract);
      expect(result.blocking, r.file).toEqual([]);
      expect(result.status).toBe('PASS');
    }
  });

  it('every local link resolves to a published file under / and /evol-tool-atlas/', () => {
    expect(CONTRACT_BASE_PATHS).toEqual(['/', '/evol-tool-atlas/']);
    let checked = 0;
    for (const r of rendered) {
      const hrefs = [...r.html.matchAll(/href="([^"]+)"/g)].map((m) => String(m[1]).replace(/&amp;/g, '&'));
      for (const href of hrefs) {
        for (const base of CONTRACT_BASE_PATHS) {
          const res = resolveBrowserHref(r.file, href, base);
          if (!res) continue;
          expect('target' in res, `${r.file} ${href} @ ${base}`).toBe(true);
          if (!('target' in res)) continue;
          expect(fs.existsSync(path.join(ROOT, res.target)), `${res.target}`).toBe(true);
          expect(isPublishedPath(res.target), `${res.target} not copied to dist/`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('computes depth-correct prefixes for fichas at depth 4 and 3 and the depth-2 index', () => {
    expect(rootPrefix(THREAT_DRAGON)).toBe('../../../../');
    expect(rootPrefix(SEMGREP)).toBe('../../../');
    expect(rootPrefix(PRUEBAS_INDEX)).toBe('../../');
    const semgrep = render(BASE, SEMGREP, 'ficha');
    // semgrep lives in testing-y-auditoria/ but its category index is under seguridad/catalogo/.
    expect(semgrep).toContain('href="../../seguridad/catalogo/auditoria-codigo/index.html"');
    expect(semgrep).toContain('href="../../../docs/atds/ATDS-v1.md"');
    const td = render(BASE, THREAT_DRAGON, 'ficha');
    expect(td).toContain('href="../modelado-amenazas/index.html"');
    expect(td).toContain('href="../../../../index.html"');
  });

  it('embeds CSS compatible with the unchanged DOCUMENT CSP (Option A)', () => {
    // The contract must not be made green by weakening the CSP.
    expect(DOCUMENT_CSP_HEADER).toBe(
      "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    for (const r of rendered) {
      expect(r.html).toMatch(/<style>[\s\S]*:focus-visible[\s\S]*<\/style>/);
      expect(r.html).not.toMatch(/<link[^>]+stylesheet/i);
      expect(r.html).not.toMatch(/@font-face|@import/i);
      expect(r.html).not.toMatch(/\sstyle="/i);
      expect(r.html).not.toMatch(/<script|\son[a-z]+=|javascript:/i);
      const abs = path.join(ROOT, r.file);
      const scan = scanHtml(r.html, { file: abs, resolveLocal: (h: string) => fs.existsSync(path.resolve(path.dirname(abs), h)) });
      expect(scan.blocking, r.file).toEqual([]);
    }
  });

  it('only uses official Fine Line Premium palette colours', () => {
    const verify = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-atlas.mjs'), 'utf8');
    const official = new Set([...verify.matchAll(/'(#[0-9a-f]{6})'/gi)].map((m) => String(m[1]).toLowerCase()));
    expect(official.size).toBeGreaterThanOrEqual(12);
    for (const r of rendered) {
      for (const [hex] of r.html.matchAll(/#[0-9a-f]{6}\b/gi)) expect(official.has(hex.toLowerCase()), hex).toBe(true);
    }
  });

  it('the ATDS badge comes from the in-process evaluation, not from a generated artifact', () => {
    const tool = CATALOGO.herramientas.find((t: ToolRecord) => t.href === THREAT_DRAGON);
    const official = LOOKUP(tool);
    const td = render(BASE, THREAT_DRAGON, 'ficha');
    expect(td).toContain(`data-atds-validated="${official.level}" data-atds-candidate="${official.candidateLevel}"`);
  });

  it('copy-static-catalog.mjs publishes exactly the shared list used by the link check', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'copy-static-catalog.mjs'), 'utf8');
    expect(src).toContain("from './lib/static-publish.mjs'");
    expect(src).toContain('const ITEMS_TO_COPY = STATIC_CATALOG_ITEMS;');
    expect(STATIC_CATALOG_ITEMS).toContain('docs/atds/ATDS-v1.md');
    expect(isPublishedPath('docs/atds/POLITICA-PUBLICACION.md')).toBe(false);
  });

  it('refuses to render a ficha without a description instead of emitting an empty meta', () => {
    const noDesc = CATALOGO.herramientas.find((t: ToolRecord) => !String(t.description ?? '').trim());
    expect(noDesc).toBeTruthy();
    expect(() => fichaContractVars(noDesc.href, BASE, LOOKUP, { date: DATE })).toThrow(HtmlOperationalError);
  });
});

// ============================================================
// Certification: negative cases on one ficha and one index
// ============================================================

describe('certification blocks contract violations', () => {
  const good = render(BASE, THREAT_DRAGON, 'ficha');
  const td = CATALOGO.herramientas.find((t: ToolRecord) => t.href === THREAT_DRAGON);
  const official = LOOKUP(td);
  const other = (lvl: string) => (lvl === 'L1' ? 'L2' : 'L1');

  it('baseline: the rendered ficha passes', () => {
    expect(certify(good, THREAT_DRAGON, 'ficha').status).toBe('PASS');
  });

  it('an ATDS badge that disagrees with the official result blocks the ficha', () => {
    const bad = good.replace(`data-atds-validated="${official.level}"`, `data-atds-validated="${other(official.level)}"`);
    const r = certify(bad, THREAT_DRAGON, 'ficha');
    expect(r.status).toBe('FAIL');
    expect(ids(r)).toContain('atds-badge');
  });

  it('a missing ATDS badge blocks a migrated ficha', () => {
    const bad = good.replace(/<span class="atds-badge"[^>]*>[^<]*<\/span>/, 'sin badge');
    const r = certify(bad, THREAT_DRAGON, 'ficha');
    expect(ids(r)).toContain('atds-badge-required');
  });

  it('a missing skip link blocks as a contract obligation, not as a WCAG verdict', () => {
    const bad = good.replace(/<a href="#main-content" class="skip-link">[^<]*<\/a>/, '');
    const r = certify(bad, THREAT_DRAGON, 'ficha');
    const skip = r.blocking.find((b) => b.id === 'skip-link');
    expect(skip?.basis).toBe('contract');
    expect(skip?.message).toMatch(/contract obligation, not an automatic WCAG 2\.4\.1 verdict/);
  });

  it('a P2 rule blocks too (certification is not P1-only)', () => {
    const bad = good.replace('<nav aria-label="Ruta de navegación">', '<nav>');
    expect(ids(certify(bad, THREAT_DRAGON, 'ficha'))).toContain('nav-named');
  });

  it('dt outside dl blocks with normative-html basis', () => {
    const bad = good.replace(SAMPLE_SECTION, `${SAMPLE_SECTION}\n<dt>suelto</dt>`);
    const b = certify(bad, THREAT_DRAGON, 'ficha').blocking.find((x) => x.id === 'dl-valid');
    expect(b?.basis).toBe('normative-html');
  });

  it('an external stylesheet or a web font is blocked (DOCUMENT CSP)', () => {
    const css = good.replace('</head>', '<link rel="stylesheet" href="../../../../shared/ficha.css"></head>');
    expect(ids(certify(css, THREAT_DRAGON, 'ficha'))).toContain('no-external-stylesheet');
    const font = good.replace('</style>', '@font-face { font-family: X; src: url(x.ttf); }\n  </style>');
    expect(ids(certify(font, THREAT_DRAGON, 'ficha'))).toContain('no-web-fonts');
  });

  it('root-absolute, base-escaping, missing and unpublished links are blocked', () => {
    const cases: Array<[string, RegExp]> = [
      ['/evol-tool-atlas/02-catalogo/seguridad/catalogo/modelado-amenazas/index.html', /root-absolute/],
      ['../../../../../index.html', /escapes the base path \/evol-tool-atlas\//],
      ['../no-existe/index.html', /does not exist/],
      ['../../../../docs/atds/POLITICA-PUBLICACION.md', /not copied to dist/],
      ['02-catalogo/seguridad/catalogo/modelado-amenazas/index.html', /does not exist/],
    ];
    for (const [href, re] of cases) {
      const bad = good.replace(SAMPLE_SECTION, `${SAMPLE_SECTION}\n<p><a href="${href}">enlace</a></p>`);
      const msgs = certify(bad, THREAT_DRAGON, 'ficha').blocking.filter((b) => b.id === 'local-links-resolve').map((b) => b.message);
      expect(msgs.join('\n'), href).toMatch(re);
    }
  });

  it('target=_blank without rel="noopener noreferrer" is blocked', () => {
    const bad = good.replace(SAMPLE_SECTION, `${SAMPLE_SECTION}\n<p><a href="https://example.org/" target="_blank">Sitio oficial</a></p>`);
    expect(ids(certify(bad, THREAT_DRAGON, 'ficha'))).toContain('external-link-rel');
  });

  it('a wrong <h1> is blocked', () => {
    const bad = good.replace(/<h1>[^<]*<\/h1>/, '<h1>Otra herramienta</h1>');
    expect(ids(certify(bad, THREAT_DRAGON, 'ficha'))).toContain('h1-matches-catalog');
  });

  it('a category index with a wrong card badge or a missing tool is blocked', () => {
    const index = render(BASE, PRUEBAS_INDEX, 'category-index');
    expect(certify(index, PRUEBAS_INDEX, 'category-index').status).toBe('PASS');
    const cf = CATALOGO.herramientas.find((t: ToolRecord) => t.href === CARGO_FUZZ);
    const o = LOOKUP(cf);
    const cardRe = new RegExp(`(<a href="cargo-fuzz/index.html">[\\s\\S]*?data-atds-validated=")${o.level}"`);
    const badBadge = index.replace(cardRe, `$1${other(o.level)}"`);
    expect(ids(certify(badBadge, PRUEBAS_INDEX, 'category-index'))).toContain('card-badges-match-atds');
    const missing = index.replace(/<li>\s*<article class="tool-card">\s*<h3><a href="cargo-fuzz\/index.html">[\s\S]*?<\/li>/, '');
    expect(ids(certify(missing, PRUEBAS_INDEX, 'category-index'))).toContain('links-every-tool');
  });

  it('the legacy pilot pages fail certification today (none is migrated in PR #5)', () => {
    const sel = loadTargets(PILOT_FILE, { rootDir: ROOT, catalogo: CATALOGO });
    for (const t of sel.targets) {
      const r = certify(fs.readFileSync(path.join(ROOT, t.file), 'utf8'), t.file, t.contract);
      expect(r.status, t.file).toBe('FAIL');
    }
  });
});

// ============================================================
// ATDS results required by certification
// ============================================================

describe('ATDS results for certification', () => {
  const td = CATALOGO.herramientas.find((t: ToolRecord) => t.href === THREAT_DRAGON);

  it('a missing ATDS report is an operational error, never a silent pass', () => {
    expect(() =>
      createAtdsLookup({ source: 'report', rootDir: ROOT, reportPath: path.join(tmpDir('atlas-atds-'), 'none.json'), required: true }),
    ).toThrow(HtmlOperationalError);
  });

  it('a report without the target tool is an operational error during certification', () => {
    const f = path.join(tmpDir('atlas-atds-'), 'report.json');
    fs.writeFileSync(f, JSON.stringify({ report: { tools: [{ id: 'otra', level: 'L1', candidateLevel: 'L1' }] } }));
    const lookup = createAtdsLookup({ source: 'report', rootDir: ROOT, reportPath: f, required: true });
    expect(() => lookup(td)).toThrow(/No official ATDS result for threat-dragon/);
    const base = createContext({ rootDir: ROOT, catalogo: CATALOGO, atdsLookup: lookup });
    expect(() => certify(render(BASE, THREAT_DRAGON, 'ficha'), THREAT_DRAGON, 'ficha', base)).toThrow(HtmlOperationalError);
  });

  it('a report with the official result is accepted and must agree with the badge', () => {
    const f = path.join(tmpDir('atlas-atds-'), 'report.json');
    const o = LOOKUP(td);
    fs.writeFileSync(f, JSON.stringify({ report: { tools: [{ id: td.id, level: o.level, candidateLevel: o.candidateLevel }] } }));
    const lookup = createAtdsLookup({ source: 'report', rootDir: ROOT, reportPath: f, required: true });
    const base = createContext({ rootDir: ROOT, catalogo: CATALOGO, atdsLookup: lookup });
    expect(certify(render(BASE, THREAT_DRAGON, 'ficha'), THREAT_DRAGON, 'ficha', base).status).toBe('PASS');
  });

  it('an unknown ATDS source is an operational error', () => {
    // @ts-expect-error deliberate invalid source
    expect(() => createAtdsLookup({ source: 'cache', rootDir: ROOT })).toThrow(HtmlOperationalError);
  });
});

// ============================================================
// CLI: isolation, exit codes and CI summary (fixture tree)
// ============================================================

interface Fixture {
  root: string;
  targets: (list: Array<{ file: string; contract: ContractId }>) => string;
}

/**
 * Fixture documentary root: a reduced catalogo.json with three real tools and their
 * three categories. Two fichas and one index are rendered from the contracts; the legacy
 * `sagan` ficha and the other two indices are copied unchanged (and fail the contract).
 */
function makeFixture(): Fixture {
  const root = tmpDir('atlas-cert-fixture-');
  const toolIds = ['threat-dragon', 'cargo-fuzz', 'sagan'];
  const tools: ToolRecord[] = toolIds.map((id) => CATALOGO.herramientas.find((t: ToolRecord) => t.id === id));
  const cats: CategoryRecord[] = [...new Set(tools.map((t) => Number(t.cat)))].map((n) =>
    CATALOGO.categorias.find((c: CategoryRecord) => Number(c.numero) === n),
  );
  const catalogo = { ...CATALOGO, herramientas: tools, categorias: cats };
  fs.writeFileSync(path.join(root, 'catalogo.json'), JSON.stringify(catalogo));
  const copy = (rel: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.cpSync(path.join(ROOT, rel), path.join(root, rel), { recursive: true });
  };
  for (const t of tools) copy(path.posix.dirname(t.href));
  for (const c of cats) copy(c.href);
  copy('index.html');
  copy('docs/atds/ATDS-v1.md');
  const base = createContext({ rootDir: root, catalogo, atdsLookup: createAtdsLookup({ rootDir: root, required: true }) });
  const lookup = createAtdsLookup({ rootDir: root, required: true });
  const write = (rel: string, contract: ContractId) => fs.writeFileSync(path.join(root, rel), render(base, rel, contract, lookup));
  write(THREAT_DRAGON, 'ficha');
  write(CARGO_FUZZ, 'ficha');
  write(PRUEBAS_INDEX, 'category-index');
  let n = 0;
  return {
    root,
    targets: (list) => {
      const f = path.join(root, `targets-${n++}.json`);
      fs.writeFileSync(f, JSON.stringify({ schema: TARGETS_SCHEMA, expectedCount: list.length, targets: list }));
      return f;
    },
  };
}

function cli(args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

describe('CLI certification on a fixture tree', () => {
  const fx = makeFixture();
  const migrated = [
    { file: THREAT_DRAGON, contract: 'ficha' as const },
    { file: CARGO_FUZZ, contract: 'ficha' as const },
    { file: PRUEBAS_INDEX, contract: 'category-index' as const },
  ];
  const SAGAN = '02-catalogo/seguridad/catalogo/sagan/index.html';

  it('positive: migrated targets PASS (exit 0) while legacy pages stay advisory', () => {
    const out = path.join(fx.root, 'cert.json');
    const r = cli([`--root=${fx.root}`, `--targets-file=${fx.targets(migrated)}`, `--output=${out}`]);
    expect(r.code, r.out).toBe(0);
    const report = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(report.certification.passed).toBe(3);
    // Isolation: the untargeted legacy pages have findings, yet they do not block.
    expect(report.certification.rest.files).toBe(3);
    expect(report.certification.rest.findings).toBeGreaterThan(0);
    expect(report.certification.rest.blocks).toBe(false);
  });

  it('negative: adding a legacy page to the selection fails (exit 1) without affecting the others', () => {
    const out = path.join(fx.root, 'cert-fail.json');
    const r = cli([`--root=${fx.root}`, `--targets-file=${fx.targets([...migrated, { file: SAGAN, contract: 'ficha' }])}`, `--output=${out}`]);
    expect(r.code, r.out).toBe(1);
    const results = JSON.parse(fs.readFileSync(out, 'utf8')).certification.results;
    expect(results.filter((x: { status: string }) => x.status === 'PASS')).toHaveLength(3);
    expect(results.find((x: { file: string }) => x.file === SAGAN).status).toBe('FAIL');
  });

  it('isolation: breaking an untargeted page never changes the certification result', () => {
    const fx2 = makeFixture();
    const idsIndex = CATALOGO.categorias.find((c: CategoryRecord) => c.slug === 'ids').href;
    fs.appendFileSync(path.join(fx2.root, idsIndex), '<dt>suelto</dt>');
    const r = cli([`--root=${fx2.root}`, `--targets-file=${fx2.targets(migrated)}`]);
    expect(r.code, r.out).toBe(0);
  });

  it('negative: an ATDS badge mismatch in a migrated ficha fails (exit 1)', () => {
    const fx2 = makeFixture();
    const file = path.join(fx2.root, THREAT_DRAGON);
    const html = fs.readFileSync(file, 'utf8');
    const current = /data-atds-validated="([A-Z0-9]+)"/.exec(html)?.[1];
    fs.writeFileSync(file, html.replace(`data-atds-validated="${current}"`, `data-atds-validated="${current === 'L1' ? 'L2' : 'L1'}"`));
    const r = cli([`--root=${fx2.root}`, `--targets-file=${fx2.targets(migrated)}`]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/atds-badge/);
  });

  it('operational: missing ATDS results with --atds-source=report exit 2', () => {
    const r = cli([`--root=${fx.root}`, `--targets-file=${fx.targets(migrated)}`, '--atds-source=report']);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/ATDS results not found/);
  });

  it('operational: an invalid selection, an unknown argument or a bad combination exit 2', () => {
    expect(cli([`--root=${fx.root}`, `--targets-file=${path.join(fx.root, 'nope.json')}`]).code).toBe(2);
    expect(cli([`--root=${fx.root}`, `--targets-file=${fx.targets([{ file: SAGAN, contract: 'category-index' }])}`]).code).toBe(2);
    expect(cli([`--root=${fx.root}`, '--target-file=x.json']).code).toBe(2);
    expect(cli([`--root=${fx.root}`, `--targets-file=${fx.targets(migrated)}`, '--strict']).code).toBe(2);
  });
});

describe('CLI advisory mode (as run by CI)', () => {
  it('reports historical findings with exit 0 and writes a readable summary', () => {
    const fx = makeFixture();
    const md = path.join(fx.root, 'summary.md');
    const out = path.join(fx.root, 'advisory.json');
    const r = cli([`--root=${fx.root}`, `--summary-md=${md}`, `--output=${out}`]);
    expect(r.code, r.out).toBe(0);
    const summary = fs.readFileSync(md, 'utf8');
    expect(summary).toMatch(/## HTML structure validation \(advisory\)/);
    expect(summary).toMatch(/\| P1 \| \d+ \|/);
    expect(summary).toMatch(/never fail this step/);
    expect(JSON.parse(fs.readFileSync(out, 'utf8')).summary.total).toBeGreaterThan(0);
  });

  it('fails with exit 2 when a catalogued page is missing (incomplete corpus)', () => {
    const fx = makeFixture();
    fs.rmSync(path.join(fx.root, '02-catalogo/seguridad/catalogo/sagan/index.html'));
    const r = cli([`--root=${fx.root}`, '--no-security']);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/catalogued page\(s\) not found/);
  });

  it('fails with exit 2 on an unreadable catalogue', () => {
    const fx = makeFixture();
    fs.writeFileSync(path.join(fx.root, 'catalogo.json'), '{');
    expect(cli([`--root=${fx.root}`]).code).toBe(2);
  });

  it('the CI workflow runs the advisory validator on the corpus without masking failures', () => {
    const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
    const step = ci.slice(ci.indexOf('HTML structure validation'), ci.indexOf('- name:', ci.indexOf('HTML structure validation')));
    expect(step).toMatch(/npm run validate:html --/);
    expect(step).toMatch(/--summary-md="\$GITHUB_STEP_SUMMARY"/);
    expect(step).not.toMatch(/\|\|\s*true|continue-on-error/);
  });
});

// ============================================================
// Committed artifact and contract document
// ============================================================

describe('committed evidence', () => {
  it('html-validation-results.json is reproducible and names no commit', () => {
    const committed = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'html-validation-results.json'), 'utf8'));
    expect(committed).not.toHaveProperty('head');
    expect(committed).not.toHaveProperty('generatedAt');
    expect(committed.mode).toBe('advisory');
    const base = createContext({ rootDir: ROOT, catalogo: CATALOGO, atdsLookup: createAtdsLookup({ rootDir: ROOT }) });
    const all = walkHtmlFiles(path.join(ROOT, '02-catalogo')).flatMap((f) => validateFile(f, base));
    expect(committed.summary).toEqual(summarize(all));
  });

  it('html-contracts.md references only files that exist (or are documented as generated)', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'scripts', 'html-contracts.md'), 'utf8');
    const generated = new Set(['reports/atds-validation.json', 'public/data/offline-manifest.json']);
    const refs = [...doc.matchAll(/`((?:scripts|docs|reports|public|tests|src|02-catalogo|\.github)\/[A-Za-z0-9._/-]+\.[a-z]+)`/g)].map((m) => String(m[1]));
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) {
      if (generated.has(ref)) continue;
      expect(fs.existsSync(path.join(ROOT, ref)), ref).toBe(true);
    }
    expect(doc).not.toMatch(/shared\/(ficha|index)\.css/);
  });
});
