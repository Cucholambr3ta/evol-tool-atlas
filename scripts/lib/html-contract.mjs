/**
 * HTML contract certification for migrated pages (pilot of PR #6).
 *
 * The advisory validator (`html-structure.mjs`) reports every rule on the whole corpus
 * and never blocks. Certification is different: it takes an explicit, validated list
 * of target files, applies **every mandatory rule of the selected contract** (not only
 * P1) plus contract-only checks, and blocks on any failure. Pages outside the list stay
 * advisory.
 *
 * Exit semantics used by the CLI: 0 = PASS, 1 = certification FAIL, 2 = operational
 * error (bad selection, missing ATDS results, unreadable files). An operational error
 * never turns into a PASS.
 *
 * Read-only: it never writes to `02-catalogo/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { evaluateToolSafe } from './atds/evaluate.mjs';
import { ATDS_BADGE_SELECTOR, atdsLookupFromReport, fileContext, validateHtml } from './html-structure.mjs';
import { isPublishedPath } from './static-publish.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONTRACT_TEMPLATE_DIR = path.resolve(__dirname, '..', 'contracts');

/** Deployment bases every contract link must work under. */
export const CONTRACT_BASE_PATHS = Object.freeze(['/', '/evol-tool-atlas/']);

export const TARGETS_SCHEMA = 'evol-tool-atlas/html-certification-targets/1';

export class HtmlOperationalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HtmlOperationalError';
    this.exitCode = 2;
  }
}

// ============================================================
// ATDS source
// ============================================================

/**
 * Create the ATDS lookup used for badges.
 *
 * - `evaluate` (default): computes the official result in-process with the same
 *   `evaluateToolSafe()` the build uses for `tool.atds` (build-catalog-index.mjs). It
 *   needs no generated artifact, so it works on a clean checkout.
 * - `report`: reads `reports/atds-validation.json` (gitignored, produced by
 *   `npm run validate:atds`). A missing or unreadable report is an operational error.
 *
 * With `required: true` (certification), a tool without an official result, or whose
 * evaluation failed, raises an operational error instead of returning null.
 *
 * @param {{ source?: 'evaluate' | 'report', rootDir: string, reportPath?: string, required?: boolean }} options
 */
export function createAtdsLookup({ source = 'evaluate', rootDir, reportPath, required = false }) {
  let base;
  if (source === 'evaluate') {
    const cache = new Map();
    base = (tool) => {
      if (!cache.has(tool.id)) {
        const r = evaluateToolSafe(tool, { root: rootDir });
        cache.set(tool.id, {
          level: r.validatedLevel,
          candidateLevel: r.candidateLevel,
          status: r.status,
          // evaluateToolSafe() turns an exception into status ERROR + issue EVALUATION_ERROR.
          // A plain ERROR (e.g. MISSING_METADATA -> NONE) is a legitimate official result.
          evaluationError: Array.isArray(r.issues) && r.issues.includes('EVALUATION_ERROR'),
          limitations: r.limitations ?? [],
        });
      }
      return cache.get(tool.id);
    };
  } else if (source === 'report') {
    const file = reportPath ?? path.join(rootDir, 'reports', 'atds-validation.json');
    if (!fs.existsSync(file)) {
      throw new HtmlOperationalError(
        `ATDS results not found: ${file}. Run \`npm run validate:atds\` first or use --atds-source=evaluate.`,
      );
    }
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw new HtmlOperationalError(`ATDS results unreadable: ${file}: ${e.message}`);
    }
    base = atdsLookupFromReport(doc);
    if (!base) throw new HtmlOperationalError(`ATDS results have no tools[] list: ${file}`);
  } else {
    throw new HtmlOperationalError(`Unknown ATDS source: ${String(source)} (use evaluate or report)`);
  }
  if (!required) return base;
  return (tool) => {
    const official = base(tool);
    if (!official) {
      throw new HtmlOperationalError(`No official ATDS result for ${tool.id} (${source}); certification cannot decide the badge`);
    }
    if (official.evaluationError) {
      throw new HtmlOperationalError(
        `ATDS evaluation failed for ${tool.id}: ${(official.limitations ?? []).join('; ') || 'unknown error'}`,
      );
    }
    return official;
  };
}

// ============================================================
// Contracts
// ============================================================

const COMMON_REQUIRED = Object.freeze([
  'dl-valid',
  'skip-link',
  'main-id',
  'header-footer-landmarks',
  'nav-present',
  'nav-named',
  'section-heading',
  'focus-visible',
  'link-text',
  'meta-description',
  'no-inline-style',
]);

/**
 * Every validator rule is classified for every contract: either mandatory or not
 * applicable (with the reason). A test enforces that a new rule cannot be left out.
 * `skip-link` is mandatory **as a contract obligation** of the migrated template; in the
 * advisory corpus it stays a P2 WCAG candidate.
 */
export const CONTRACTS = Object.freeze({
  ficha: Object.freeze({
    id: 'ficha',
    title: 'Contrato A — Ficha de herramienta',
    template: 'ficha.template.html',
    requiredRules: Object.freeze([...COMMON_REQUIRED, 'internal-link', 'category-link', 'resource-links', 'atds-badge']),
    notApplicable: Object.freeze({}),
    checks: Object.freeze([
      'single-h1',
      'h1-matches-catalog',
      'atds-badge-required',
      'no-external-stylesheet',
      'no-web-fonts',
      'external-link-rel',
      'local-links-resolve',
    ]),
  }),
  'category-index': Object.freeze({
    id: 'category-index',
    title: 'Contrato B — Índice de categoría',
    template: 'category-index.template.html',
    requiredRules: COMMON_REQUIRED,
    notApplicable: Object.freeze({
      'internal-link': 'ficha-only rule',
      'category-link': 'ficha-only rule',
      'resource-links': 'ficha-only rule',
      'atds-badge': 'ficha-only rule; card badges are checked by card-badges-match-atds',
    }),
    checks: Object.freeze([
      'single-h1',
      'h1-matches-catalog',
      'no-external-stylesheet',
      'no-web-fonts',
      'external-link-rel',
      'local-links-resolve',
      'tool-grid-list',
      'links-every-tool',
      'card-badges-match-atds',
    ]),
  }),
});

function check(id, message, context = '') {
  return { check: id, message, context: String(context).slice(0, 160) };
}

function textOf(el) {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const EXTERNAL_RE = /^(https?:|mailto:|tel:|data:|javascript:)/i;

/**
 * Resolve an href the way a browser does, for a page served at `basePath + rel`.
 * Returns the repository-relative target, or an error string.
 *
 * @param {string} rel repository-relative page path
 * @param {string} href
 * @param {string} basePath '/' or '/sub/'
 * @returns {{ target: string } | { error: string } | null} null for external/fragment links
 */
export function resolveBrowserHref(rel, href, basePath) {
  const raw = String(href ?? '').trim();
  if (!raw || raw.startsWith('#') || EXTERNAL_RE.test(raw)) return null;
  if (raw.startsWith('/')) return { error: `root-absolute href breaks under another base path: ${raw}` };
  const origin = 'https://atlas.invalid';
  const page = new URL(`${basePath}${rel}`, origin);
  const url = new URL(raw, page);
  if (url.origin !== origin) return { error: `href leaves the site: ${raw}` };
  if (!url.pathname.startsWith(basePath)) {
    return { error: `href escapes the base path ${basePath}: ${raw} -> ${url.pathname}` };
  }
  let target = decodeURIComponent(url.pathname.slice(basePath.length));
  if (target === '' || target.endsWith('/')) target += 'index.html';
  return { target };
}

const CONTRACT_CHECKS = {
  'single-h1'({ root }) {
    const n = root.querySelectorAll('h1').length;
    return n === 1 ? [] : [check('single-h1', `Expected exactly one <h1>, found ${n}`)];
  },
  'h1-matches-catalog'({ root, tool, categoryRecord }) {
    const expected = tool ? tool.name : categoryRecord?.nombre;
    const actual = textOf(root.querySelector('h1'));
    if (!expected || actual === String(expected)) return [];
    return [check('h1-matches-catalog', `<h1> "${actual}" does not match catalogo.json "${expected}"`)];
  },
  'atds-badge-required'({ root, tool, atdsLookup }) {
    const badge = root
      .querySelectorAll(ATDS_BADGE_SELECTOR)
      .find((b) => b.getAttribute('data-atds-validated') && b.getAttribute('data-atds-candidate'));
    if (!badge) {
      return [check('atds-badge-required', 'Migrated ficha must carry an ATDS badge with data-atds-validated and data-atds-candidate')];
    }
    atdsLookup(tool); // operational error if the official result is missing
    return [];
  },
  'no-external-stylesheet'({ root }) {
    const out = [];
    for (const link of root.querySelectorAll('link')) {
      if (/\bstylesheet\b/i.test(link.getAttribute('rel') ?? '')) {
        out.push(check('no-external-stylesheet', 'External stylesheet is blocked by the DOCUMENT CSP (style-src has no \'self\'); embed it in <style>', link.toString()));
      }
    }
    for (const style of root.querySelectorAll('style')) {
      if (/@import\b/i.test(style.textContent ?? '')) {
        out.push(check('no-external-stylesheet', '@import is blocked by the DOCUMENT CSP', '@import'));
      }
    }
    return out;
  },
  'no-web-fonts'({ root }) {
    return root.querySelectorAll('style').some((s) => /@font-face\b/i.test(s.textContent ?? ''))
      ? [check('no-web-fonts', '@font-face is blocked by the DOCUMENT CSP (default-src \'none\', no font-src)')]
      : [];
  },
  'external-link-rel'({ root }) {
    const out = [];
    for (const a of root.querySelectorAll('a[target]')) {
      if ((a.getAttribute('target') ?? '').toLowerCase() !== '_blank') continue;
      const rel = (a.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
      if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
        out.push(check('external-link-rel', 'target="_blank" requires rel="noopener noreferrer"', a.toString()));
      }
    }
    return out;
  },
  'local-links-resolve'({ root, rel, rootDir }) {
    const out = [];
    for (const a of root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      for (const base of CONTRACT_BASE_PATHS) {
        const r = resolveBrowserHref(rel, href, base);
        if (!r) continue;
        if ('error' in r) {
          out.push(check('local-links-resolve', `[base ${base}] ${r.error}`, href));
        } else if (!fs.existsSync(path.join(rootDir, r.target))) {
          out.push(check('local-links-resolve', `[base ${base}] ${href} -> ${r.target} does not exist`, href));
        } else if (!isPublishedPath(r.target)) {
          out.push(check('local-links-resolve', `[base ${base}] ${href} -> ${r.target} is not copied to dist/`, href));
        }
      }
    }
    return out;
  },
  'tool-grid-list'({ root }) {
    return root.querySelector('ul.tool-grid[role="list"]')
      ? []
      : [check('tool-grid-list', 'Category index needs <ul class="tool-grid" role="list">')];
  },
  'links-every-tool'({ root, rel, categoryRecord, catalogo }) {
    const linked = new Set();
    for (const a of root.querySelectorAll('a[href]')) {
      const r = resolveBrowserHref(rel, a.getAttribute('href'), '/');
      if (r && 'target' in r) linked.add(r.target);
    }
    return catalogo.herramientas
      .filter((t) => Number(t.cat) === Number(categoryRecord.numero) && !linked.has(t.href))
      .map((t) => check('links-every-tool', `Category index does not link ${t.id} (${t.href})`));
  },
  'card-badges-match-atds'({ root, rel, toolsByHref, atdsLookup }) {
    const out = [];
    for (const card of root.querySelectorAll('.tool-card')) {
      const a = card.querySelector('a[href]');
      const r = a ? resolveBrowserHref(rel, a.getAttribute('href'), '/') : null;
      const tool = r && 'target' in r ? toolsByHref.get(r.target) : null;
      if (!tool) {
        out.push(check('card-badges-match-atds', 'Tool card does not link a catalogued ficha', card.toString()));
        continue;
      }
      const badge = card.querySelector(ATDS_BADGE_SELECTOR);
      const official = atdsLookup(tool);
      if (!badge) {
        out.push(check('card-badges-match-atds', `Card for ${tool.id} has no ATDS badge`));
        continue;
      }
      const v = badge.getAttribute('data-atds-validated');
      const c = badge.getAttribute('data-atds-candidate');
      if (v !== official.level || c !== official.candidateLevel) {
        out.push(
          check(
            'card-badges-match-atds',
            `Card badge for ${tool.id} (${v}/${c}) != official ATDS (${official.level}/${official.candidateLevel})`,
          ),
        );
      }
    }
    return out;
  },
};

export const CONTRACT_CHECK_IDS = Object.freeze(Object.keys(CONTRACT_CHECKS));

// ============================================================
// Targets
// ============================================================

const TOP_KEYS = new Set(['schema', 'description', 'expectedCount', 'targets']);
const TARGET_KEYS = new Set(['file', 'contract', 'note']);

/**
 * Load and validate a certification targets file. Every problem is an operational
 * error: no target is ever skipped silently.
 *
 * Format:
 *   { "schema": TARGETS_SCHEMA, "expectedCount": N,
 *     "targets": [ { "file": "02-catalogo/.../index.html", "contract": "ficha" | "category-index" } ] }
 *
 * @param {string} targetsPath
 * @param {{ rootDir: string, catalogo: any }} ctx
 */
export function loadTargets(targetsPath, { rootDir, catalogo }) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
  } catch (e) {
    throw new HtmlOperationalError(`Targets file unreadable: ${targetsPath}: ${e.message}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HtmlOperationalError('Targets file must be an object');
  }
  for (const key of Object.keys(raw)) {
    if (!TOP_KEYS.has(key)) throw new HtmlOperationalError(`Targets file has unknown key: ${key}`);
  }
  if (raw.schema !== TARGETS_SCHEMA) {
    throw new HtmlOperationalError(`Targets file schema must be ${TARGETS_SCHEMA}, got ${JSON.stringify(raw.schema)}`);
  }
  if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
    throw new HtmlOperationalError('Targets file must declare a non-empty targets array');
  }
  if (!Number.isInteger(raw.expectedCount) || raw.expectedCount !== raw.targets.length) {
    throw new HtmlOperationalError(
      `expectedCount (${JSON.stringify(raw.expectedCount)}) must equal the number of targets (${raw.targets.length})`,
    );
  }
  const tools = new Map(catalogo.herramientas.map((t) => [t.href, t]));
  const categories = new Map(catalogo.categorias.map((c) => [c.href, c]));
  const seen = new Set();
  const targets = raw.targets.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new HtmlOperationalError(`Target #${i} must be an object { file, contract }`);
    }
    for (const key of Object.keys(entry)) {
      if (!TARGET_KEYS.has(key)) throw new HtmlOperationalError(`Target #${i} has unknown key: ${key}`);
    }
    const file = entry.file;
    if (typeof file !== 'string' || !file) throw new HtmlOperationalError(`Target #${i} has no file`);
    if (path.posix.isAbsolute(file) || file.includes('\\') || path.posix.normalize(file) !== file || file.split('/').includes('..')) {
      throw new HtmlOperationalError(`Target #${i} must be a normalized repository-relative path: ${file}`);
    }
    if (!file.startsWith('02-catalogo/') || !file.endsWith('.html')) {
      throw new HtmlOperationalError(`Target #${i} is not a catalogue HTML page: ${file}`);
    }
    if (seen.has(file)) throw new HtmlOperationalError(`Duplicate target: ${file}`);
    seen.add(file);
    const abs = path.join(rootDir, file);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new HtmlOperationalError(`Target does not exist: ${file}`);
    }
    const kind = tools.has(file) ? 'ficha' : categories.has(file) ? 'category-index' : null;
    if (!kind) throw new HtmlOperationalError(`Target is not a ficha or category index in catalogo.json: ${file}`);
    if (!Object.hasOwn(CONTRACTS, entry.contract)) {
      throw new HtmlOperationalError(`Target ${file} has unknown contract: ${JSON.stringify(entry.contract)}`);
    }
    if (entry.contract !== kind) {
      throw new HtmlOperationalError(`Target ${file} is a ${kind} in catalogo.json but declares contract ${entry.contract}`);
    }
    return { file, contract: entry.contract };
  });
  return { schema: raw.schema, description: raw.description ?? null, expectedCount: raw.expectedCount, targets };
}

// ============================================================
// Certification
// ============================================================

/**
 * Certify one HTML document against a contract.
 *
 * @param {string} html
 * @param {object} ctx a fileContext() whose atdsLookup is a *required* lookup
 * @param {keyof typeof CONTRACTS} contractId
 */
export function certifyHtml(html, ctx, contractId) {
  const contract = CONTRACTS[contractId];
  if (!contract) throw new HtmlOperationalError(`Unknown contract: ${contractId}`);
  const required = new Set(contract.requiredRules);
  const blocking = [];
  const advisory = [];
  for (const f of validateHtml(html, ctx)) {
    if (required.has(f.rule)) {
      // P1 is a normative HTML failure; anything else blocks as a contract obligation.
      const message =
        f.rule === 'skip-link'
          ? `The contract template requires the skip link (contract obligation, not an automatic WCAG 2.4.1 verdict): ${f.message}`
          : f.message;
      blocking.push({ source: 'rule', id: f.rule, basis: f.priority === 'P1' ? 'normative-html' : 'contract', message, context: f.context });
    } else {
      advisory.push({ source: 'rule', id: f.rule, message: f.message });
    }
  }
  const root = parse(html, { lowerCaseTagName: true, comment: false });
  const categoryRecord = ctx.categoriesByHref.get(ctx.rel) ?? null;
  for (const id of contract.checks) {
    for (const c of CONTRACT_CHECKS[id]({ ...ctx, root, categoryRecord })) {
      blocking.push({ source: 'contract-check', id: c.check, basis: 'contract', message: c.message, context: c.context });
    }
  }
  return { contract: contractId, status: blocking.length === 0 ? 'PASS' : 'FAIL', blocking, advisory };
}

/**
 * Certify a validated target selection. Files outside the selection are not certified
 * (they stay advisory); the caller reports them separately.
 *
 * @param {{ base: object, selection: ReturnType<typeof loadTargets> }} input
 */
export function certifyTargets({ base, selection }) {
  const results = [];
  for (const t of selection.targets) {
    const abs = path.join(base.rootDir, t.file);
    let html;
    try {
      html = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      throw new HtmlOperationalError(`Cannot read target ${t.file}: ${e.message}`);
    }
    results.push({ file: t.file, ...certifyHtml(html, fileContext(base, abs), t.contract) });
  }
  if (results.length !== selection.expectedCount) {
    throw new HtmlOperationalError(`Certified ${results.length} files but the selection declares ${selection.expectedCount}`);
  }
  const failed = results.filter((r) => r.status === 'FAIL').length;
  return { certified: results.length, passed: results.length - failed, failed, results };
}

// ============================================================
// Templates (canonical, publishable contracts)
// ============================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a contract template. Keys ending in `_HTML` are inserted verbatim (already
 * built from escaped parts); every other value is HTML-escaped. A placeholder without a
 * value, or a value without a placeholder, is an error.
 *
 * @param {keyof typeof CONTRACTS} contractId
 * @param {Record<string, string | number>} vars
 */
export function renderContract(contractId, vars) {
  const contract = CONTRACTS[contractId];
  if (!contract) throw new HtmlOperationalError(`Unknown contract: ${contractId}`);
  const template = fs.readFileSync(path.join(CONTRACT_TEMPLATE_DIR, contract.template), 'utf8');
  const used = new Set();
  const out = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(vars, key)) throw new Error(`Template ${contract.template}: no value for {{${key}}}`);
    used.add(key);
    return key.endsWith('_HTML') ? String(vars[key]) : escapeHtml(vars[key]);
  });
  for (const key of Object.keys(vars)) {
    if (!used.has(key)) throw new Error(`Template ${contract.template}: unused value ${key}`);
  }
  return out;
}

/** `../` repeated once per directory level of a repository-relative page path. */
export function rootPrefix(rel) {
  return '../'.repeat(path.posix.dirname(rel).split('/').length);
}

/** Relative href from one repository-relative page to another file. */
export function relativeHref(fromRel, toRel) {
  return path.posix.relative(path.posix.dirname(fromRel), toRel);
}

const RESOURCE_LINKS = Object.freeze([
  ['README.md', 'README'],
  ['metadata.json', 'Metadatos JSON'],
  ['SHA256SUMS.txt', 'SHA-256'],
  ['GUIA.md', 'Guía técnica'],
  ['casos-uso.json', 'Casos de uso'],
  ['SKILL.md', 'Skill reutilizable'],
  ['evidencias.json', 'Registro de evidencias'],
]);

/**
 * Template values for a ficha at its real path. Resource links are emitted only for
 * files that exist; the ATDS badge comes from the official lookup, never from
 * catalogo.json.evidence.
 *
 * @param {string} rel
 * @param {object} base createContext() result
 * @param {(tool: any) => { level: string, candidateLevel: string }} atdsLookup
 * @param {{ date: string, contentSectionsHtml?: string, description?: string }} options
 */
export function fichaContractVars(rel, base, atdsLookup, { date, contentSectionsHtml = '', description }) {
  const tool = base.toolsByHref.get(rel);
  if (!tool) throw new HtmlOperationalError(`Not a catalogued ficha: ${rel}`);
  const text = String(description ?? tool.description ?? '').trim();
  if (!text) {
    throw new HtmlOperationalError(`Ficha ${tool.id} has no description in catalogo.json; the contract needs one (pass options.description)`);
  }
  const category = base.categoriesByNumber.get(Number(tool.cat));
  if (!category) throw new HtmlOperationalError(`Ficha ${tool.id} has no category ${tool.cat}`);
  const official = atdsLookup(tool);
  const dir = path.posix.dirname(rel);
  const links = RESOURCE_LINKS.filter(([file]) => fs.existsSync(path.join(base.rootDir, dir, file))).map(
    ([file, label]) => `          <a href="${escapeHtml(file)}">${escapeHtml(label)}</a>`,
  );
  return {
    DESCRIPTION: text,
    TOOL_NAME: tool.name,
    TOOL_ID: tool.id,
    ROOT: rootPrefix(rel),
    CATEGORY_HREF: relativeHref(rel, category.href),
    CATEGORY_NAME: category.nombre,
    ATDS_VALIDATED: official.level,
    ATDS_CANDIDATE: official.candidateLevel,
    DATE: date,
    CONTENT_SECTIONS_HTML: contentSectionsHtml,
    RESOURCE_LINKS_HTML: links.join('\n'),
  };
}

/**
 * Template values for a category index at its real path.
 *
 * @param {string} rel
 * @param {object} base createContext() result
 * @param {(tool: any) => { level: string, candidateLevel: string }} atdsLookup
 * @param {{ date: string }} options
 */
export function categoryContractVars(rel, base, atdsLookup, { date }) {
  const category = base.categoriesByHref.get(rel);
  if (!category) throw new HtmlOperationalError(`Not a catalogued category index: ${rel}`);
  const tools = base.catalogo.herramientas.filter((t) => Number(t.cat) === Number(category.numero));
  const cards = tools.map((t) => {
    const o = atdsLookup(t);
    return [
      '        <li>',
      '          <article class="tool-card">',
      `            <h3><a href="${escapeHtml(relativeHref(rel, t.href))}">${escapeHtml(t.name)}</a></h3>`,
      `            <p class="muted">${escapeHtml(t.description ?? '')}</p>`,
      `            <span class="atds-badge" data-atds-validated="${escapeHtml(o.level)}" data-atds-candidate="${escapeHtml(o.candidateLevel)}">ATDS: ${escapeHtml(o.level)}</span>`,
      '          </article>',
      '        </li>',
    ].join('\n');
  });
  const readme = fs.existsSync(path.join(base.rootDir, path.posix.dirname(rel), 'README.md'))
    ? '      <a href="README.md">Criterios de la categoría</a>'
    : '';
  return {
    TOOL_COUNT: tools.length,
    CATEGORY_NAME: category.nombre,
    CATEGORY_NUMBER: category.numero,
    CATEGORY_SLUG: category.slug,
    ROOT: rootPrefix(rel),
    DATE: date,
    CATEGORY_README_LINK_HTML: readme,
    TOOL_CARDS_HTML: cards.join('\n'),
  };
}
