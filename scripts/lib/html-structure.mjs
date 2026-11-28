/**
 * Structural HTML validator for the historical Atlas pages.
 *
 * This module is deliberately read-only: it parses the published sheets and
 * reports findings. It never rewrites `02-catalogo/`, never regenerates hashes
 * and never replaces the security scanner in `scripts/lib/html-scan.mjs`
 * (which remains the blocking gate called by `scripts/verify-atlas.mjs`).
 *
 * Classification (see `scripts/html-contracts.md`):
 *   P1 — normative HTML conformance or WCAG Level A failure.
 *   P2 — accessibility / navigation / contract-integrity recommendation.
 *   P3 — visual or publication contract convention.
 *
 * The three navigation questions are reported separately:
 *   - `category-link`  : the ficha does not link to its category index.
 *   - `nav-present`    : the page has no semantic <nav> element.
 *   - `nav-named`      : a <nav> exists but has no accessible name.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';

export const DEFAULT_BASE_PATH = '/evol-tool-atlas/';

export const PRIORITY_SEVERITY = Object.freeze({
  P1: 'error',
  P2: 'warn',
  P3: 'warn',
});

export const CATEGORY_LABELS = Object.freeze({
  'normative-html': 'HTML conformance (WHATWG)',
  'wcag-a': 'WCAG 2.2 Level A',
  'wcag-candidate': 'WCAG candidate requiring manual verification',
  recommendation: 'Accessibility / usability recommendation',
  'contract-integrity': 'ATDS / data contract consistency',
  'visual-contract': 'Visual / publication contract',
});

const RESOURCE_FILES = Object.freeze([
  { file: 'README.md', label: 'README' },
  { file: 'metadata.json', label: 'metadata' },
  { file: 'SHA256SUMS.txt', label: 'SHA256' },
  { file: 'GUIA.md', label: 'Guía técnica' },
  { file: 'SKILL.md', label: 'Skill' },
  { file: 'casos-uso.json', label: 'Casos de uso' },
  { file: 'evidencias.json', label: 'Evidencias' },
]);

const EXTERNAL_RE = /^(https?:|mailto:|tel:|data:|javascript:)/i;

function finding(message, element, context = '') {
  return { message, element, context: String(context).slice(0, 160) };
}

function isInsideTag(node, tagName) {
  let parent = node?.parentNode;
  while (parent) {
    if (parent.tagName === tagName) return true;
    parent = parent.parentNode;
  }
  return false;
}

/**
 * Resolve a document href to a repository-relative POSIX path.
 * Returns null for external, fragment-only or empty links.
 *
 * @param {string} fromDir repository-relative directory of the document
 * @param {string | null | undefined} href
 * @param {string} basePath deployment base path (e.g. /evol-tool-atlas/)
 * @returns {string | null}
 */
export function resolveLocalHref(fromDir, href, basePath = DEFAULT_BASE_PATH) {
  if (!href) return null;
  const raw = String(href).trim();
  if (!raw || raw.startsWith('#') || EXTERNAL_RE.test(raw)) return null;
  let clean = raw.split('#')[0].split('?')[0];
  if (!clean) return null;
  // Repository-relative paths (as stored in catalogo.json) are accepted as-is.
  if (/^(02-catalogo|05-referencias|skills|docs)\//.test(clean)) {
    return path.posix.normalize(clean);
  }
  if (clean.startsWith('/')) {
    if (basePath && clean.startsWith(basePath)) clean = clean.slice(basePath.length);
    else clean = clean.replace(/^\/+/, '');
    return path.posix.normalize(clean);
  }
  return path.posix.normalize(path.posix.join(fromDir, clean));
}

function textOf(el) {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function navName(nav) {
  return nav.getAttribute('aria-label') || nav.getAttribute('aria-labelledby') || '';
}

// ============================================================
// Rule catalogue
// ============================================================

export const RULES = [
  {
    id: 'dl-valid',
    name: 'dt/dd must be inside dl',
    priority: 'P1',
    severity: PRIORITY_SEVERITY.P1,
    category: 'normative-html',
    description:
      'WHATWG HTML: <dt> and <dd> are only valid inside a <dl> group (directly or inside a <div> wrapper).',
    check({ root }) {
      const out = [];
      for (const el of [...root.querySelectorAll('dt'), ...root.querySelectorAll('dd')]) {
        if (isInsideTag(el, 'DL')) continue;
        out.push(finding(`<${el.tagName}> outside <dl>`, el.tagName, el.toString()));
      }
      return out;
    },
  },
  {
    id: 'skip-link',
    name: 'Bypass block: skip link to main content (manual verification)',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'wcag-candidate',
    description:
      'WCAG 2.2 2.4.1 (A) requires some mechanism to bypass repeated blocks. Absence of a skip link is not, by itself, proof of failure: headings, landmarks or another documented mechanism may satisfy it. Reported as a recommendation for manual verification, never as an automatic normative error.',
    wcag: '2.4.1',
    check({ root }) {
      const out = [];
      const skip = root.querySelector('a[href="#main-content"], a.skip-link');
      const target = root.querySelector('main#main-content, [id="main-content"]');
      if (!skip) {
        out.push(
          finding(
            'No skip link detected; verify an alternative bypass mechanism before declaring WCAG 2.4.1 failure',
            'body',
          ),
        );
      } else if (!target) {
        out.push(
          finding('Skip link present but target #main-content does not exist (broken bypass mechanism)', 'a'),
        );
      }
      return out;
    },
  },
  {
    id: 'link-text',
    name: 'Link purpose: avoid a raw URL as the only link text',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'WCAG 2.2 2.4.4 (A) can be satisfied by context; a raw URL is reported as a recommendation, not as a normative P1 failure.',
    wcag: '2.4.4',
    check({ root }) {
      const out = [];
      for (const a of root.querySelectorAll('a[href^="http"]')) {
        const text = textOf(a);
        const href = a.getAttribute('href') ?? '';
        if (!text) continue;
        if (text === href || (text.startsWith('http') && text.includes(href))) {
          out.push(finding('Link text is the raw URL; add a descriptive label or surrounding context', 'a', a.toString()));
        }
      }
      return out;
    },
  },
  {
    id: 'nav-present',
    name: 'Semantic navigation: page should contain a <nav> landmark',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'Absence of semantic navigation is distinct from a missing category link and from a <nav> without an accessible name.',
    check({ root }) {
      if (root.querySelectorAll('nav').length > 0) return [];
      return [finding('Page has no <nav> element (semantic navigation absent)', 'body')];
    },
  },
  {
    id: 'nav-named',
    name: 'Accessible name for every <nav> landmark',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'WAI-ARIA landmark best practice: when a page has one or more <nav> elements, each should have aria-label or aria-labelledby.',
    check({ root }) {
      const out = [];
      for (const nav of root.querySelectorAll('nav')) {
        if (navName(nav)) continue;
        out.push(finding('<nav> lacks aria-label or aria-labelledby', 'nav', nav.toString()));
      }
      return out;
    },
  },
  {
    id: 'main-id',
    name: 'Main landmark should expose id="main-content"',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      '<main> without an id is valid HTML; the id is a recommendation so the skip link has a stable target.',
    check({ root }) {
      const main = root.querySelector('main');
      if (!main) return [finding('No <main> element found', 'body')];
      if (main.getAttribute('id') !== 'main-content') {
        return [finding('<main> missing id="main-content"', 'main', main.toString())];
      }
      return [];
    },
  },
  {
    id: 'header-footer-landmarks',
    name: 'Header/footer inside main lose their implicit landmark role',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      '<header> and <footer> inside <main> are valid HTML, but they no longer map to banner/contentinfo. Reported as a landmark recommendation, never as P1.',
    check({ root }) {
      const out = [];
      for (const h of root.querySelectorAll('header')) {
        if (h.getAttribute('role') === 'banner') continue;
        if (isInsideTag(h, 'MAIN')) {
          out.push(finding('<header> inside <main> without role="banner"', 'header', h.toString()));
        }
      }
      for (const f of root.querySelectorAll('footer')) {
        if (f.getAttribute('role') === 'contentinfo') continue;
        if (isInsideTag(f, 'MAIN')) {
          out.push(finding('<footer> inside <main> without role="contentinfo"', 'footer', f.toString()));
        }
      }
      return out;
    },
  },
  {
    id: 'internal-link',
    name: 'Ficha should contain at least one valid internal link',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'A ficha with only external links is a dead end for the offline atlas. This is a navigation recommendation, not an HTML error.',
    check({ root, rel, tool, rootDir, basePath }) {
      if (!tool) return [];
      const dir = path.posix.dirname(rel);
      for (const a of root.querySelectorAll('a[href]')) {
        const resolved = resolveLocalHref(dir, a.getAttribute('href'), basePath);
        if (!resolved) continue;
        if (fs.existsSync(path.join(rootDir, resolved))) return [];
      }
      return [finding('Ficha has no valid internal links (dead end)', 'body')];
    },
  },
  {
    id: 'category-link',
    name: 'Ficha must link to its category index',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'The expected target is derived from catalogo.json (tool.cat -> categorias[numero].href), then resolved relative to the ficha directory.',
    check({ root, rel, tool, category, basePath }) {
      if (!tool || !category) return [];
      const dir = path.posix.dirname(rel);
      for (const a of root.querySelectorAll('a[href]')) {
        const resolved = resolveLocalHref(dir, a.getAttribute('href'), basePath);
        if (resolved === category.href) return [];
      }
      return [
        finding(
          `Ficha missing link to category index (expected ${category.href})`,
          'body',
        ),
      ];
    },
  },
  {
    id: 'resource-links',
    name: 'Ficha should link to existing technical resources',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'Existing README/metadata/SHA256/GUIA/SKILL/casos/evidencias files that are not linked are reported as completeness recommendations.',
    check({ root, rel, tool, rootDir }) {
      if (!tool) return [];
      const dir = path.posix.dirname(rel);
      const linked = new Set();
      for (const a of root.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') ?? '';
        for (const r of RESOURCE_FILES) {
          if (href === r.file || href.endsWith(`/${r.file}`)) linked.add(r.file);
        }
      }
      const out = [];
      for (const r of RESOURCE_FILES) {
        if (!fs.existsSync(path.join(rootDir, dir, r.file))) continue;
        if (!linked.has(r.file)) {
          out.push(finding(`Existing resource not linked: ${r.file} (${r.label})`, 'body'));
        }
      }
      return out;
    },
  },
  {
    id: 'section-heading',
    name: 'Section should have a heading or accessible name',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'A <section> without a heading is valid HTML; the recommendation improves document structure and screen-reader navigation.',
    check({ root }) {
      const out = [];
      for (const s of root.querySelectorAll('section')) {
        if (s.querySelector('h1, h2, h3, h4, h5, h6')) continue;
        if (navName(s)) continue;
        out.push(finding('<section> without heading or aria-label/labelledby', 'section', s.toString()));
      }
      return out;
    },
  },
  {
    id: 'focus-visible',
    name: 'Stylesheet should define :focus-visible',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'recommendation',
    description:
      'WCAG 2.2 2.4.7 (AA) requires a visible focus indicator; the browser default already provides one. :focus-visible is a recommendation for the visual contract.',
    wcag: '2.4.7',
    check({ root }) {
      const styles = root.querySelectorAll('style');
      if (styles.some((s) => (s.textContent ?? '').includes('focus-visible'))) return [];
      return [finding('Missing :focus-visible in the document stylesheet', 'style')];
    },
  },
  {
    id: 'atds-badge',
    name: 'ATDS badge must match the official validation report',
    priority: 'P2',
    severity: PRIORITY_SEVERITY.P2,
    category: 'contract-integrity',
    description:
      'Reads reports/atds-validation.json (the official result). Only checks badges that are present; legacy sheets without a badge are not penalised.',
    check({ root, tool, atdsReport }) {
      if (!tool || !atdsReport?.report?.tools) return [];
      const official = atdsReport.report.tools.find((t) => t.id === tool.id);
      if (!official) return [];
      const badges = root.querySelectorAll(
        '[data-atds-validated], [data-atds-candidate], .atds-badge, [class*="atds-badge"]',
      );
      if (badges.length === 0) return [];
      const out = [];
      for (const badge of badges) {
        const text = textOf(badge);
        const validated =
          badge.getAttribute('data-atds-validated') ||
          text.match(/validado[:\s]*(L[1-4]|NONE)/i)?.[1]?.toUpperCase() ||
          null;
        const candidate =
          badge.getAttribute('data-atds-candidate') ||
          text.match(/candidato[:\s]*(L[1-4]|NONE)/i)?.[1]?.toUpperCase() ||
          null;
        if (!validated && !candidate) {
          out.push(finding('ATDS badge present but no validated/candidate level declared', 'badge', badge.toString()));
          continue;
        }
        if (validated && validated !== official.level) {
          out.push(
            finding(
              `Badge validated level (${validated}) != official ATDS report (${official.level})`,
              'badge',
              badge.toString(),
            ),
          );
        }
        if (candidate && candidate !== official.candidateLevel) {
          out.push(
            finding(
              `Badge candidate level (${candidate}) != official ATDS report (${official.candidateLevel})`,
              'badge',
              badge.toString(),
            ),
          );
        }
      }
      return out;
    },
  },
  {
    id: 'meta-description',
    name: 'Page should have a non-empty meta description',
    priority: 'P3',
    severity: PRIORITY_SEVERITY.P3,
    category: 'visual-contract',
    description:
      'Publication/SEO convention; it is not an HTML conformance error and not a WCAG failure.',
    check({ root }) {
      const meta = root.querySelector('meta[name="description"]');
      if (meta && (meta.getAttribute('content') ?? '').trim()) return [];
      return [finding('Missing or empty meta description', 'head')];
    },
  },
  {
    id: 'no-inline-style',
    name: 'Prefer shared CSS over inline style attributes',
    priority: 'P3',
    severity: PRIORITY_SEVERITY.P3,
    category: 'visual-contract',
    description:
      'The DOCUMENT CSP allows style-src \'unsafe-inline\' for historical pages, so this is a visual-contract convention (P3), never an HTML or WCAG error.',
    check({ root }) {
      const out = [];
      for (const el of root.querySelectorAll('[style]')) {
        out.push(finding(`Inline style attribute on <${el.tagName}>`, el.tagName, el.toString()));
      }
      return out;
    },
  },
];

// ============================================================
// Context and validation
// ============================================================

/**
 * @param {{ rootDir: string, catalogo: any, atdsReport?: any, basePath?: string }} input
 */
export function createContext({ rootDir, catalogo, atdsReport = null, basePath = DEFAULT_BASE_PATH }) {
  const toolsByHref = new Map(catalogo.herramientas.map((t) => [t.href, t]));
  const categoriesByNumber = new Map(catalogo.categorias.map((c) => [Number(c.numero), c]));
  return { rootDir, catalogo, atdsReport, basePath, toolsByHref, categoriesByNumber };
}

/**
 * @param {ReturnType<typeof createContext>} base
 * @param {string} filePath absolute path
 */
export function fileContext(base, filePath) {
  const rel = path.relative(base.rootDir, filePath).split(path.sep).join('/');
  const tool = base.toolsByHref.get(rel) ?? null;
  const category = tool ? base.categoriesByNumber.get(Number(tool.cat)) ?? null : null;
  return { ...base, filePath, rel, tool, category };
}

/**
 * Validate an HTML string against all rules.
 *
 * @param {string} html
 * @param {object} ctx
 * @returns {Array<object>}
 */
export function validateHtml(html, ctx) {
  const root = parse(html, { lowerCaseTagName: true, comment: false });
  const findings = [];
  for (const rule of RULES) {
    const ruleFindings = rule.check({ ...ctx, root }) ?? [];
    for (const f of ruleFindings) {
      findings.push({
        rule: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        severity: rule.severity,
        category: rule.category,
        wcag: rule.wcag ?? null,
        file: ctx.rel,
        message: f.message,
        element: f.element,
        context: f.context ?? '',
        allowed: false,
      });
    }
  }
  return findings;
}

/**
 * Validate one file from disk.
 *
 * @param {string} filePath absolute path
 * @param {object} ctx result of createContext()
 */
export function validateFile(filePath, ctx) {
  const html = fs.readFileSync(filePath, 'utf8');
  return validateHtml(html, fileContext(ctx, filePath));
}

// ============================================================
// Allowlist
// ============================================================

/**
 * Load and validate the allowlist. P1 rules can never be allowlisted.
 *
 * @param {string | null | undefined} allowlistPath
 * @param {{ rootDir: string, now?: Date, rules?: typeof RULES }} options
 */
export function loadAllowlist(allowlistPath, { rootDir, now = new Date(), rules = RULES } = {}) {
  if (!allowlistPath || !fs.existsSync(allowlistPath)) {
    return { schema: null, entries: [], byKey: new Map(), warnings: [] };
  }
  const raw = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const entries = Array.isArray(raw) ? raw : raw.entries;
  if (!Array.isArray(entries)) {
    throw new Error('Allowlist must be an array or an object with an entries array');
  }
  const warnings = [];
  const byKey = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.file !== 'string' || typeof entry.rule !== 'string') {
      throw new Error(`Invalid allowlist entry: ${JSON.stringify(entry)}`);
    }
    const rule = rules.find((r) => r.id === entry.rule);
    if (!rule) throw new Error(`Allowlist references unknown rule: ${entry.rule}`);
    if (rule.priority === 'P1') {
      throw new Error(`P1 rule cannot be allowlisted: ${entry.rule} (${entry.file})`);
    }
    if (rootDir && !fs.existsSync(path.join(rootDir, entry.file))) {
      throw new Error(`Allowlist references a missing file: ${entry.file}`);
    }
    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
      throw new Error(`Allowlist entry needs a valid expiresAt date: ${entry.file}:${entry.rule}`);
    }
    if (expiresAt.getTime() < now.getTime()) {
      warnings.push(`Expired allowlist entry: ${entry.file}:${entry.rule} (expired ${entry.expiresAt})`);
    }
    const key = `${entry.file}:${entry.rule}`;
    if (byKey.has(key)) throw new Error(`Duplicate allowlist entry: ${key}`);
    byKey.set(key, { ...entry, expired: expiresAt.getTime() < now.getTime() });
  }
  return { schema: raw.schema ?? null, expiresAt: raw.expiresAt ?? null, owner: raw.owner ?? null, entries, byKey, warnings };
}

/**
 * Mark findings as allowed and, in strict mode, suppress them.
 * Expired entries never suppress anything.
 *
 * @param {Array<object>} findings
 * @param {ReturnType<typeof loadAllowlist>} allowlist
 * @param {'advisory'|'strict'} mode
 */
export function applyAllowlist(findings, allowlist, mode) {
  const kept = [];
  let suppressed = 0;
  for (const f of findings) {
    const entry = allowlist.byKey.get(`${f.file}:${f.rule}`);
    const allowed = Boolean(entry) && !entry.expired;
    if (allowed) {
      f.allowed = true;
      if (mode === 'strict') {
        suppressed++;
        continue;
      }
    }
    kept.push(f);
  }
  return { findings: kept, suppressed };
}

// ============================================================
// Summaries
// ============================================================

export function summarize(findings) {
  const byPriority = { P1: 0, P2: 0, P3: 0 };
  const byCategory = {};
  const byRule = {};
  const byFile = {};
  for (const f of findings) {
    byPriority[f.priority] = (byPriority[f.priority] ?? 0) + 1;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
    byFile[f.file] = (byFile[f.file] ?? 0) + 1;
  }
  return {
    total: findings.length,
    byPriority,
    byCategory,
    byRule,
    byFile,
    filesWithFindings: Object.keys(byFile).length,
  };
}

export function ruleCatalog() {
  return RULES.map((r) => ({
    id: r.id,
    name: r.name,
    priority: r.priority,
    severity: r.severity,
    category: r.category,
    wcag: r.wcag ?? null,
    description: r.description,
  }));
}

export function walkHtmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtmlFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
