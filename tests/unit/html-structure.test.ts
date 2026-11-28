import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  RULES,
  applyAllowlist,
  createContext,
  fileContext,
  loadAllowlist,
  resolveLocalHref,
  summarize,
  validateFile,
  validateHtml,
  walkHtmlFiles,
} from '../../scripts/lib/html-structure.mjs';
import type {
  Allowlist,
  BaseContext,
  CategoryRecord,
  Finding,
  ToolRecord,
} from '../../scripts/lib/html-structure.mjs';
import { scanHtml, scanStaticTree } from '../../scripts/lib/html-scan.mjs';

const ROOT = path.resolve(__dirname, '..', '..');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8'));
const ATDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'atds-validation.json'), 'utf8'));
const BASE = createContext({ rootDir: ROOT, catalogo: CATALOGO, atdsReport: ATDS });

const TOOL_0TRACE = CATALOGO.herramientas.find((t: ToolRecord) => t.id === '0trace') as ToolRecord;
const CAT_SCANNER = CATALOGO.categorias.find((c: CategoryRecord) => c.numero === TOOL_0TRACE.cat) as CategoryRecord;

function ctx(
  rel = 'test.html',
  tool: ToolRecord | null = null,
  category: CategoryRecord | null = null,
  base: BaseContext = BASE,
): ReturnType<typeof fileContext> {
  return { ...base, filePath: path.join(ROOT, rel), rel, tool, category };
}

function doc(body: string, head = ''): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="description" content="x"><title>t</title>${head}</head><body>${body}</body></html>`;
}

function findings(html: string, opts: { rel?: string; tool?: ToolRecord | null; category?: CategoryRecord | null; base?: BaseContext } = {}): Finding[] {
  return validateHtml(html, ctx(opts.rel, opts.tool ?? null, opts.category ?? null, opts.base ?? BASE));
}

function rulesOf(list: Finding[]): string[] {
  return list.map((f) => f.rule);
}

function syntheticAllowlist(entries: Array<{ file: string; rule: string; expired?: boolean }>): Allowlist {
  const full = entries.map((e) => ({
    file: e.file,
    rule: e.rule,
    reason: 'test',
    expiresAt: '2027-03-31',
    expired: e.expired ?? false,
  }));
  return {
    schema: 'test',
    entries: full,
    byKey: new Map(full.map((e) => [`${e.file}:${e.rule}`, e])),
    warnings: [],
  };
}

// ============================================================
// Rule catalogue invariants
// ============================================================

describe('rule catalogue', () => {
  it('has stable, unique rule ids', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'dl-valid',
        'skip-link',
        'link-text',
        'nav-present',
        'nav-named',
        'main-id',
        'header-footer-landmarks',
        'internal-link',
        'category-link',
        'resource-links',
        'section-heading',
        'focus-visible',
        'atds-badge',
        'meta-description',
        'no-inline-style',
      ]),
    );
  });

  it('only P1 rules are normative HTML or WCAG A', () => {
    const p1 = RULES.filter((r) => r.priority === 'P1').map((r) => r.id).sort();
    expect(p1).toEqual(['dl-valid', 'skip-link']);
    for (const rule of RULES.filter((r) => r.priority === 'P1')) {
      expect(['normative-html', 'wcag-a']).toContain(rule.category);
      expect(rule.severity).toBe('error');
    }
  });

  it('spec-valid constructs are never P1', () => {
    const p1 = new Set(RULES.filter((r) => r.priority === 'P1').map((r) => r.id));
    for (const id of ['header-footer-landmarks', 'nav-named', 'nav-present', 'main-id', 'section-heading', 'focus-visible', 'meta-description', 'no-inline-style']) {
      expect(p1.has(id)).toBe(false);
    }
  });
});

// ============================================================
// P1 rules
// ============================================================

describe('dl-valid (P1, normative HTML)', () => {
  it('accepts dt/dd inside dl with div wrappers', () => {
    expect(rulesOf(findings(doc('<dl><div><dt>a</dt><dd>b</dd></div></dl>')))).not.toContain('dl-valid');
  });

  it('accepts direct dt/dd children of dl', () => {
    expect(rulesOf(findings(doc('<dl><dt>a</dt><dd>b</dd></dl>')))).not.toContain('dl-valid');
  });

  it('flags dt/dd outside dl', () => {
    const list = findings(doc('<section><div><dt>a</dt><dd>b</dd></div></section>'));
    expect(list.filter((f) => f.rule === 'dl-valid')).toHaveLength(2);
    expect(list.find((f) => f.rule === 'dl-valid')?.priority).toBe('P1');
  });
});

describe('skip-link (P1, WCAG 2.4.1)', () => {
  it('accepts a skip link whose target exists', () => {
    expect(rulesOf(findings(doc('<a href="#main-content">Saltar</a><main id="main-content"></main>')))).not.toContain('skip-link');
  });

  it('flags a missing skip link', () => {
    expect(rulesOf(findings(doc('<main id="main-content"></main>')))).toContain('skip-link');
  });

  it('flags a skip link with a missing target', () => {
    expect(rulesOf(findings(doc('<a href="#main-content">Saltar</a><main></main>')))).toContain('skip-link');
  });
});

// ============================================================
// P2 recommendations
// ============================================================

describe('link-text (P2, WCAG 2.4.4 candidate)', () => {
  it('accepts descriptive text', () => {
    expect(rulesOf(findings(doc('<a href="https://example.org">Repositorio oficial</a>')))).not.toContain('link-text');
  });

  it('flags a raw URL as link text', () => {
    const f = findings(doc('<a href="https://example.org">https://example.org</a>'));
    expect(f.find((x) => x.rule === 'link-text')?.priority).toBe('P2');
  });
});

describe('nav-present / nav-named (P2, distinct findings)', () => {
  it('flags a page without <nav> only as nav-present', () => {
    const f = findings(doc('<main id="main-content"></main>'));
    expect(rulesOf(f)).toContain('nav-present');
    expect(rulesOf(f)).not.toContain('nav-named');
  });

  it('flags an unnamed <nav> only as nav-named', () => {
    const f = findings(doc('<nav><a href="/">Inicio</a></nav>'));
    expect(rulesOf(f)).toContain('nav-named');
    expect(rulesOf(f)).not.toContain('nav-present');
  });

  it('accepts aria-label and aria-labelledby', () => {
    expect(rulesOf(findings(doc('<nav aria-label="Principal"><a href="/">Inicio</a></nav>')))).not.toContain('nav-named');
    expect(rulesOf(findings(doc('<h2 id="h">Menú</h2><nav aria-labelledby="h"><a href="/">Inicio</a></nav>')))).not.toContain('nav-named');
  });
});

describe('main-id (P2, valid HTML)', () => {
  it('flags a main without id="main-content"', () => {
    expect(rulesOf(findings(doc('<main></main>')))).toContain('main-id');
  });

  it('accepts main#main-content', () => {
    expect(rulesOf(findings(doc('<main id="main-content"></main>')))).not.toContain('main-id');
  });

  it('flags a missing main', () => {
    expect(rulesOf(findings(doc('<div></div>')))).toContain('main-id');
  });
});

describe('header-footer-landmarks (P2, valid HTML)', () => {
  it('flags header/footer inside main without roles', () => {
    const f = findings(doc('<main id="main-content"><header></header><footer></footer></main>'));
    expect(f.filter((x) => x.rule === 'header-footer-landmarks')).toHaveLength(2);
    expect(f.find((x) => x.rule === 'header-footer-landmarks')?.priority).toBe('P2');
  });

  it('accepts header/footer outside main', () => {
    expect(rulesOf(findings(doc('<header role="banner"></header><main id="main-content"></main><footer role="contentinfo"></footer>')))).not.toContain('header-footer-landmarks');
  });
});

describe('internal-link (P2, navigation)', () => {
  it('accepts a ficha with an existing internal link', () => {
    const f = findings(doc('<a href="README.md">README</a>'), { rel: TOOL_0TRACE.href, tool: TOOL_0TRACE, category: CAT_SCANNER });
    expect(rulesOf(f)).not.toContain('internal-link');
  });

  it('flags a ficha with only external links', () => {
    const f = findings(doc('<a href="https://example.org">externo</a>'), { rel: TOOL_0TRACE.href, tool: TOOL_0TRACE, category: CAT_SCANNER });
    expect(rulesOf(f)).toContain('internal-link');
  });
});

describe('category-link (P2, navigation)', () => {
  it('accepts the real threat-dragon ficha (it links to ../modelado-amenazas/index.html)', () => {
    const tool = CATALOGO.herramientas.find((t: ToolRecord) => t.id === 'threat-dragon') as ToolRecord;
    const category = CATALOGO.categorias.find((c: CategoryRecord) => c.numero === tool.cat) as CategoryRecord;
    const file = path.join(ROOT, tool.href);
    const list = validateFile(file, BASE);
    expect(list.some((f) => f.rule === 'category-link')).toBe(false);
    expect(category.href).toBe('02-catalogo/seguridad/catalogo/modelado-amenazas/index.html');
    expect(resolveLocalHref(path.posix.dirname(tool.href), '../modelado-amenazas/index.html')).toBe(category.href);
  });

  it('flags the real 3proxy ficha (no category link)', () => {
    const tool = CATALOGO.herramientas.find((t: ToolRecord) => t.id === '3proxy') as ToolRecord;
    const category = CATALOGO.categorias.find((c: CategoryRecord) => c.numero === tool.cat) as CategoryRecord;
    const list = validateFile(path.join(ROOT, tool.href), BASE);
    expect(list.some((f) => f.rule === 'category-link')).toBe(true);
    expect(tool.href).toBe('02-catalogo/seguridad/catalogo/3proxy/index.html');
    expect(category).toBeDefined();
  });

  it('accepts an absolute repository href and a relative href', () => {
    const absolute = findings(doc(`<a href="${CAT_SCANNER.href}">cat</a>`), { rel: TOOL_0TRACE.href, tool: TOOL_0TRACE, category: CAT_SCANNER });
    const relative = findings(doc('<a href="../scanner/index.html">cat</a>'), { rel: TOOL_0TRACE.href, tool: TOOL_0TRACE, category: CAT_SCANNER });
    expect(rulesOf(absolute)).not.toContain('category-link');
    expect(rulesOf(relative)).not.toContain('category-link');
  });

  it('flags a ficha that links to a different category', () => {
    const f = findings(doc('<a href="../modelado-amenazas/index.html">otra</a>'), { rel: TOOL_0TRACE.href, tool: TOOL_0TRACE, category: CAT_SCANNER });
    expect(rulesOf(f)).toContain('category-link');
  });
});

describe('resource-links (P2, completeness)', () => {
  it('reports existing resources that are not linked', () => {
    const f = findings(doc('<a href="README.md">README</a>'), { rel: TOOL_0TRACE.href, tool: TOOL_0TRACE, category: CAT_SCANNER });
    const missing = f.filter((x) => x.rule === 'resource-links');
    // 0trace has README.md, metadata.json and SHA256SUMS.txt; only README is linked.
    expect(missing).toHaveLength(2);
  });
});

describe('section-heading (P2)', () => {
  it('flags a section without heading or accessible name', () => {
    expect(rulesOf(findings(doc('<section><p>x</p></section>')))).toContain('section-heading');
  });

  it('accepts a heading or aria-label', () => {
    expect(rulesOf(findings(doc('<section><h2>x</h2></section>')))).not.toContain('section-heading');
    expect(rulesOf(findings(doc('<section aria-label="x"></section>')))).not.toContain('section-heading');
  });
});

describe('focus-visible (P2)', () => {
  it('accepts a stylesheet with :focus-visible', () => {
    expect(rulesOf(findings(doc('<main id="main-content"></main>', '<style>:focus-visible{outline:2px}</style>')))).not.toContain('focus-visible');
  });

  it('flags a stylesheet without :focus-visible', () => {
    expect(rulesOf(findings(doc('<main id="main-content"></main>', '<style>a{color:blue}</style>')))).toContain('focus-visible');
  });
});

// ============================================================
// Contract integrity: ATDS badge
// ============================================================

describe('atds-badge (P2, official report)', () => {
  const tool: ToolRecord = { id: 'x', href: 'x/index.html', cat: 1, slug: 'c' };
  const category: CategoryRecord = { numero: 1, slug: 'c', href: 'x/c/index.html' };
  const base = createContext({
    rootDir: ROOT,
    catalogo: { herramientas: [tool], categorias: [category] },
    atdsReport: { report: { tools: [{ id: 'x', level: 'L3', candidateLevel: 'L3' }] } },
  });
  const opts = { rel: 'x/index.html', tool, category, base };

  it('accepts a badge that matches level/candidateLevel', () => {
    const html = doc('<span class="atds-badge" data-atds-validated="L3" data-atds-candidate="L3">ATDS</span>');
    expect(rulesOf(findings(html, opts))).not.toContain('atds-badge');
  });

  it('flags a badge that disagrees with the official report', () => {
    const html = doc('<span class="atds-badge" data-atds-validated="L1" data-atds-candidate="L1">ATDS</span>');
    expect(findings(html, opts).filter((f) => f.rule === 'atds-badge')).toHaveLength(2);
  });

  it('does not penalise legacy fichas without a badge', () => {
    expect(rulesOf(findings(doc('<main id="main-content"></main>'), opts))).not.toContain('atds-badge');
  });

  it('reads validated/candidate from the badge text as a fallback', () => {
    const html = doc('<span class="atds-badge">Validado: L3 · Candidato: L3</span>');
    expect(rulesOf(findings(html, opts))).not.toContain('atds-badge');
  });
});

// ============================================================
// P3 visual/publication contract
// ============================================================

describe('meta-description (P3)', () => {
  it('accepts a non-empty description', () => {
    expect(rulesOf(findings(doc('<main id="main-content"></main>')))).not.toContain('meta-description');
  });

  it('flags a missing or empty description', () => {
    const html = '<!doctype html><html lang="es"><head><title>t</title></head><body><main id="main-content"></main></body></html>';
    expect(rulesOf(findings(html))).toContain('meta-description');
    const empty = '<!doctype html><html lang="es"><head><meta name="description" content=""><title>t</title></head><body><main id="main-content"></main></body></html>';
    expect(rulesOf(findings(empty))).toContain('meta-description');
  });
});

describe('no-inline-style (P3, visual contract)', () => {
  it('flags style attributes', () => {
    const f = findings(doc('<p style="color:red">x</p>'));
    expect(f.find((x) => x.rule === 'no-inline-style')?.priority).toBe('P3');
  });

  it('accepts a style block without style attributes', () => {
    expect(rulesOf(findings(doc('<p>x</p>', '<style>p{color:red}</style>')))).not.toContain('no-inline-style');
  });
});

// ============================================================
// Allowlist: justification, expiration and anti-regression
// ============================================================

describe('allowlist', () => {
  const allowlistPath = path.join(ROOT, 'scripts', 'html-validation-allowlist.json');
  const now = new Date('2026-11-27T00:00:00Z');

  it('has 9 entries, all P2 focus-visible, with a future expiry', () => {
    const allowlist = loadAllowlist(allowlistPath, { rootDir: ROOT, now });
    expect(allowlist.entries).toHaveLength(9);
    expect(allowlist.warnings).toEqual([]);
    for (const entry of allowlist.entries) {
      expect(entry.rule).toBe('focus-visible');
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(entry.ticket).toBe('PR #6');
      expect(new Date(entry.expiresAt).getTime()).toBeGreaterThan(now.getTime());
      expect(fs.existsSync(path.join(ROOT, entry.file))).toBe(true);
      const rule = RULES.find((r) => r.id === entry.rule);
      expect(rule?.priority).not.toBe('P1');
    }
  });

  it('every allowlisted file still triggers its rule (stale entries fail the test)', () => {
    const allowlist = loadAllowlist(allowlistPath, { rootDir: ROOT, now });
    for (const entry of allowlist.entries) {
      const list = validateFile(path.join(ROOT, entry.file), BASE);
      expect(list.some((f) => f.rule === entry.rule), `${entry.file} no longer triggers ${entry.rule}`).toBe(true);
    }
  });

  it('advisory reports all 228 focus-visible findings; strict suppresses exactly the 9 allowed ones', () => {
    const files = walkHtmlFiles(path.join(ROOT, '02-catalogo'));
    const all: Finding[] = [];
    for (const file of files) all.push(...validateFile(file, BASE));
    const focus = all.filter((f) => f.rule === 'focus-visible');
    expect(focus).toHaveLength(228);

    const allowlist = loadAllowlist(allowlistPath, { rootDir: ROOT, now });
    const advisory = applyAllowlist(all, allowlist, 'advisory');
    expect(advisory.suppressed).toBe(0);
    expect(advisory.findings.filter((f) => f.rule === 'focus-visible' && f.allowed)).toHaveLength(9);

    const strict = applyAllowlist(all, allowlist, 'strict');
    expect(strict.suppressed).toBe(9);
    expect(strict.findings.filter((f) => f.rule === 'focus-visible')).toHaveLength(219);
  });

  it('never suppresses a non-allowlisted finding in strict mode', () => {
    const fake: Finding = {
      rule: 'focus-visible',
      ruleName: 'x',
      priority: 'P2',
      severity: 'warn',
      category: 'recommendation',
      wcag: null,
      file: '02-catalogo/no-allowlisted/index.html',
      message: 'x',
      element: 'style',
      context: '',
      allowed: false,
    };
    const result = applyAllowlist([fake], syntheticAllowlist([{ file: '02-catalogo/otro/index.html', rule: 'focus-visible' }]), 'strict');
    expect(result.suppressed).toBe(0);
    expect(result.findings).toHaveLength(1);
  });

  it('an expired entry suppresses nothing', () => {
    const fake: Finding = {
      rule: 'focus-visible',
      ruleName: 'x',
      priority: 'P2',
      severity: 'warn',
      category: 'recommendation',
      wcag: null,
      file: '02-catalogo/pruebas-tecnicas/cargo-audit/index.html',
      message: 'x',
      element: 'style',
      context: '',
      allowed: false,
    };
    const result = applyAllowlist([fake], syntheticAllowlist([{ file: fake.file, rule: fake.rule, expired: true }]), 'strict');
    expect(result.suppressed).toBe(0);
    expect(result.findings).toHaveLength(1);
  });

  it('rejects P1, unknown rules, missing files and missing expiry', () => {
    const tmp = path.join('/tmp/opencode', 'html-allowlist-test.json');
    const write = (obj: unknown) => fs.writeFileSync(tmp, JSON.stringify(obj));

    write([{ file: '02-catalogo/seguridad/catalogo/0trace/index.html', rule: 'dl-valid', expiresAt: '2027-01-01' }]);
    expect(() => loadAllowlist(tmp, { rootDir: ROOT, now })).toThrow(/P1/);

    write([{ file: '02-catalogo/seguridad/catalogo/0trace/index.html', rule: 'not-a-rule', expiresAt: '2027-01-01' }]);
    expect(() => loadAllowlist(tmp, { rootDir: ROOT, now })).toThrow(/unknown rule/);

    write([{ file: '02-catalogo/no-existe/index.html', rule: 'focus-visible', expiresAt: '2027-01-01' }]);
    expect(() => loadAllowlist(tmp, { rootDir: ROOT, now })).toThrow(/missing file/);

    write([{ file: '02-catalogo/seguridad/catalogo/0trace/index.html', rule: 'focus-visible' }]);
    expect(() => loadAllowlist(tmp, { rootDir: ROOT, now })).toThrow(/expiresAt/);
  });
});

// ============================================================
// Security complementarity (html-scan.mjs is not disabled)
// ============================================================

describe('security scanner remains active', () => {
  it('verify-atlas.mjs still imports and calls scanStaticTree', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-atlas.mjs'), 'utf8');
    expect(source).toContain("from './lib/html-scan.mjs'");
    expect(source).toContain('scanStaticTree(');
  });

  it('html-scan still blocks scripts, event handlers and remote embeds', () => {
    const scan = (body: string) => scanHtml(`<!doctype html><html lang="es"><head><title>t</title></head><body>${body}</body></html>`, {
      file: 'x.html',
      resolveLocal: () => true,
    });
    expect(scan('<script>alert(1)</script>').blocking.join()).toContain('<script>');
    expect(scan('<img src=x onerror=alert(1)>').blocking.join()).toContain('onerror');
    expect(scan('<img src="https://tracker.example/x.png">').blocking.join()).toContain('recurso remoto');
  });

  it('the historical corpus still has 0 blocking security findings', () => {
    const r = scanStaticTree(path.join(ROOT, '02-catalogo'), ROOT);
    expect(r.files).toBe(2186);
    expect(r.blocking).toEqual([]);
  });
});

// ============================================================
// Full corpus regression (frozen by PR #5)
// ============================================================

describe('full corpus (2,186 pages)', () => {
  const files = walkHtmlFiles(path.join(ROOT, '02-catalogo'));
  const all: Finding[] = [];
  for (const file of files) all.push(...validateFile(file, BASE));
  const summary = summarize(all);

  it('covers 2,186 pages and classifies P1 only as HTML/WCAG', () => {
    expect(files).toHaveLength(2186);
    expect(summary.byPriority.P1).toBe(8342);
    const p1Rules = [...new Set(all.filter((f) => f.priority === 'P1').map((f) => f.rule))].sort();
    expect(p1Rules).toEqual(['dl-valid', 'skip-link']);
  });

  it('keeps the three navigation questions separate', () => {
    expect(summary.byRule['category-link']).toBe(604);
    expect(summary.byRule['nav-present']).toBe(918);
    expect(summary.byRule['nav-named']).toBe(1268);
  });

  it('threat-dragon has a category link, no <nav>, and therefore no nav-named finding', () => {
    const tool = CATALOGO.herramientas.find((t: ToolRecord) => t.id === 'threat-dragon') as ToolRecord;
    const list = validateFile(path.join(ROOT, tool.href), BASE);
    expect(list.some((f) => f.rule === 'category-link')).toBe(false);
    expect(list.some((f) => f.rule === 'nav-present')).toBe(true);
    expect(list.some((f) => f.rule === 'nav-named')).toBe(false);
  });

  it('0trace has a category link, a nav, and an unnamed nav', () => {
    const list = validateFile(path.join(ROOT, TOOL_0TRACE.href), BASE);
    expect(list.some((f) => f.rule === 'category-link')).toBe(false);
    expect(list.some((f) => f.rule === 'nav-present')).toBe(false);
    expect(list.some((f) => f.rule === 'nav-named')).toBe(true);
  });
});
