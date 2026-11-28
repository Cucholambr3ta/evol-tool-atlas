#!/usr/bin/env node
/**
 * EVOL Tool Atlas — Structural HTML Audit
 * Uses node-html-parser for proper DOM parsing (not regex).
 * Outputs JSON with per-file and aggregate metrics.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { DEFAULT_BASE_PATH, resolveLocalHref } from './lib/html-structure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(ROOT, '02-catalogo');
const CATALOGO_JSON = path.join(ROOT, 'catalogo.json');
const BASE_PATH = process.env.VITE_BASE_PATH || DEFAULT_BASE_PATH;

function walkHtmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function getRelativePath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function parseHtml(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  return { root: parse(html, { lowerCaseTagName: true, comment: false }), raw: html };
}

function auditFile(filePath, catalogoToolsByHref, categoriesByNumber) {
  const rel = getRelativePath(filePath);
  const tool = catalogoToolsByHref.get(rel) ?? null;
  const isToolFicha = Boolean(tool);
  const kind = isToolFicha ? 'ficha' : 'indice';
  const category = tool ? categoriesByNumber.get(Number(tool.cat)) ?? null : null;
  
  const { root, raw } = parseHtml(filePath);
  
  const result = {
    file: rel,
    kind,
    toolId: tool?.id ?? null,
    category: '',
    subcategory: '',
    categorySlug: category?.slug ?? null,
    categoryIndexHref: category?.href ?? null,
    // Structure
    doctype: /^<!doctype html>/i.test(raw.trimStart()),
    htmlLang: getHtmlLang(root),
    viewport: hasViewport(root),
    charset: hasCharset(root),
    title: getTitle(root),
    h1Count: countH1(root),
    mainCount: countMain(root),
    mainHasId: mainHasId(root),
    mainHasMainContentId: mainHasMainContentId(root),
    // Landmarks
    navCount: countNav(root),
    hasNav: countNav(root) > 0,
    navNamed: navHaveAccessibleName(root),
    navNamedAll: navHaveAccessibleNameAll(root),
    headerCount: countHeader(root),
    headerInMain: headerInsideMain(root),
    footerCount: countFooter(root),
    footerInMain: footerInsideMain(root),
    skipLink: hasSkipLink(root),
    // Sections
    sectionCount: countSections(root),
    sectionWithoutHeading: countSectionsWithoutHeading(root),
    // Definition lists
    dlCount: countDl(root),
    dlWithDivWrappers: countDlWithDivWrappers(root),
    looseDt: countLooseDt(root),
    looseDd: countLooseDd(root),
    looseDtDdParents: getLooseDtDdParents(root),
    // Links
    internalLinks: countInternalLinks(root, filePath),
    externalLinks: countExternalLinks(root),
    externalLinksBlank: countExternalLinksBlank(root),
    externalLinksNoopener: countExternalLinksNoopener(root),
    rawUrlLinkText: countRawUrlLinkText(root),
    emptyLinkText: countEmptyLinkText(root),
    linksToCategoryIndex: category ? countLinksToCategoryIndex(root, rel, category) : 0,
    // Resources
    resourcesLinked: getResourcesLinked(root),
    // ATDS / State labels
    atdsBadges: getAtdsBadges(root),
    statusLabels: getStatusLabels(root),
    evidenceTokens: getEvidenceTokens(root),
    // Accessibility
    focusVisible: hasFocusVisible(root),
    ariaCurrent: hasAriaCurrent(root),
    roleAttributes: getRoleAttributes(root),
    ariaAttributes: getAriaAttributes(root),
    // Inline styles
    inlineStyleCount: countInlineStyles(root),
    // Meta
    metaDescription: getMetaDescription(root),
    // CSP
    hasCspMeta: hasCspMetaTag(root),
  };
  
  // Extract category/subcategory from path
  const parts = rel.split('/');
  if (parts.length >= 3) {
    result.category = parts[1];
    result.subcategory = parts[2];
  }
  
  return result;
}

function getHtmlLang(root) {
  const html = root.querySelector('html');
  return html?.getAttribute('lang') ?? '';
}

function hasViewport(root) {
  return !!root.querySelector('meta[name="viewport"]');
}

function hasCharset(root) {
  return !!root.querySelector('meta[charset]');
}

function getTitle(root) {
  const title = root.querySelector('title');
  return title?.textContent?.trim() ?? '';
}

function countH1(root) {
  return root.querySelectorAll('h1').length;
}

function countMain(root) {
  return root.querySelectorAll('main').length;
}

function mainHasId(root) {
  const main = root.querySelector('main');
  return main?.hasAttribute('id') ?? false;
}

function mainHasMainContentId(root) {
  const main = root.querySelector('main');
  return main?.getAttribute('id') === 'main-content';
}

function countNav(root) {
  return root.querySelectorAll('nav').length;
}

function navHaveAccessibleName(root) {
  const navs = root.querySelectorAll('nav');
  for (const nav of navs) {
    if (nav.hasAttribute('aria-label') || nav.hasAttribute('aria-labelledby')) {
      return true;
    }
  }
  return navs.length === 0; // vacuously true if no navs
}

function navHaveAccessibleNameAll(root) {
  const navs = root.querySelectorAll('nav');
  return navs.length > 0 && navs.every((nav) => nav.hasAttribute('aria-label') || nav.hasAttribute('aria-labelledby'));
}

function countHeader(root) {
  return root.querySelectorAll('header').length;
}

function headerInsideMain(root) {
  const headers = root.querySelectorAll('header');
  for (const h of headers) {
    let parent = h.parentNode;
    while (parent && parent.tagName !== 'MAIN') {
      parent = parent.parentNode;
    }
    if (parent && parent.tagName === 'MAIN') return true;
  }
  return false;
}

function countFooter(root) {
  return root.querySelectorAll('footer').length;
}

function footerInsideMain(root) {
  const footers = root.querySelectorAll('footer');
  for (const f of footers) {
    let parent = f.parentNode;
    while (parent && parent.tagName !== 'MAIN') {
      parent = parent.parentNode;
    }
    if (parent && parent.tagName === 'MAIN') return true;
  }
  return false;
}

function hasSkipLink(root) {
  const links = root.querySelectorAll('a[href="#main-content"], a.skip-link');
  return links.length > 0;
}

function countSections(root) {
  return root.querySelectorAll('section').length;
}

function countSectionsWithoutHeading(root) {
  const sections = root.querySelectorAll('section');
  let count = 0;
  for (const s of sections) {
    const hasHeading = s.querySelector('h1, h2, h3, h4, h5, h6') !== null;
    const hasAriaLabel = s.hasAttribute('aria-label') || s.hasAttribute('aria-labelledby');
    if (!hasHeading && !hasAriaLabel) count++;
  }
  return count;
}

function countDl(root) {
  return root.querySelectorAll('dl').length;
}

function countDlWithDivWrappers(root) {
  const dls = root.querySelectorAll('dl');
  let count = 0;
  for (const dl of dls) {
    const children = dl.childNodes.filter(n => n.nodeType === 1);
    let allDivWrappers = true;
    for (const child of children) {
      if (child.tagName !== 'DIV') {
        allDivWrappers = false;
        break;
      }
      const divsChildren = child.childNodes.filter(n => n.nodeType === 1);
      const hasDt = divsChildren.some(c => c.tagName === 'DT');
      const hasDd = divsChildren.some(c => c.tagName === 'DD');
      if (!(hasDt || hasDd)) {
        allDivWrappers = false;
        break;
      }
    }
    if (allDivWrappers && children.length > 0) count++;
  }
  return count;
}

function countLooseDt(root) {
  const dts = root.querySelectorAll('dt');
  let loose = 0;
  for (const dt of dts) {
    let parent = dt.parentNode;
    let inDl = false;
    while (parent) {
      if (parent.tagName === 'DL') { inDl = true; break; }
      parent = parent.parentNode;
    }
    if (!inDl) loose++;
  }
  return loose;
}

function countLooseDd(root) {
  const dds = root.querySelectorAll('dd');
  let loose = 0;
  for (const dd of dds) {
    let parent = dd.parentNode;
    let inDl = false;
    while (parent) {
      if (parent.tagName === 'DL') { inDl = true; break; }
      parent = parent.parentNode;
    }
    if (!inDl) loose++;
  }
  return loose;
}

function getLooseDtDdParents(root) {
  const counts = {};
  const dts = root.querySelectorAll('dt');
  const dds = root.querySelectorAll('dd');
  for (const el of [...dts, ...dds]) {
    let parent = el.parentNode;
    let inDl = false;
    while (parent) {
      if (parent.tagName === 'DL') { inDl = true; break; }
      parent = parent.parentNode;
    }
    if (!inDl && parent) {
      const tag = parent.tagName;
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return counts;
}

function countInternalLinks(root, filePath) {
  const links = root.querySelectorAll('a[href]');
  let count = 0;
  const dir = path.dirname(filePath);
  for (const a of links) {
    const href = a.getAttribute('href');
    if (!href) continue;
    if (href.startsWith('#')) continue;
    if (href.startsWith('http')) continue;
    if (href.startsWith('mailto:')) continue;
    // Resolve relative to file
    const resolved = path.resolve(dir, href.split('#')[0].split('?')[0]);
    if (fs.existsSync(resolved)) count++;
  }
  return count;
}

function countExternalLinks(root) {
  const links = root.querySelectorAll('a[href^="http"]');
  return links.length;
}

function countExternalLinksBlank(root) {
  const links = root.querySelectorAll('a[href^="http"][target="_blank"]');
  return links.length;
}

function countExternalLinksNoopener(root) {
  const links = root.querySelectorAll('a[href^="http"]');
  let count = 0;
  for (const a of links) {
    const rel = a.getAttribute('rel') || '';
    if (rel.includes('noopener')) count++;
  }
  return count;
}

function countRawUrlLinkText(root) {
  const links = root.querySelectorAll('a[href^="http"]');
  let count = 0;
  for (const a of links) {
    const text = a.textContent?.trim() ?? '';
    const href = a.getAttribute('href') ?? '';
    if (text === href || (text.startsWith('http') && text.includes(href))) {
      count++;
    }
  }
  return count;
}

function countEmptyLinkText(root) {
  const links = root.querySelectorAll('a[href]');
  let count = 0;
  for (const a of links) {
    const text = a.textContent?.trim() ?? '';
    if (!text) count++;
  }
  return count;
}

function countLinksToCategoryIndex(root, fileRel, category) {
  if (!category) return 0;
  const dir = path.posix.dirname(fileRel);
  for (const a of root.querySelectorAll('a[href]')) {
    const resolved = resolveLocalHref(dir, a.getAttribute('href'), BASE_PATH);
    if (resolved === category.href) return 1;
  }
  return 0;
}

function getResourcesLinked(root) {
  const resources = ['README.md', 'metadata.json', 'SHA256SUMS.txt', 'GUIA.md', 'SKILL.md', 'casos-uso.json', 'evidencias.json'];
  const linked = [];
  const links = root.querySelectorAll('a[href]');
  for (const a of links) {
    const href = a.getAttribute('href') || '';
    for (const r of resources) {
      if (href.endsWith(r) || href.includes('/' + r)) {
        linked.push(r);
        break;
      }
    }
  }
  return [...new Set(linked)];
}

function getAtdsBadges(root) {
  // Same selector as the `atds-badge` validator rule. Legacy pages without a
  // badge are not counted; textual mentions of a level are not badges.
  return root
    .querySelectorAll('[data-atds-validated], [data-atds-candidate], .atds-badge, [class*="atds-badge"]')
    .map((el) => ({
      text: el.textContent?.trim() ?? '',
      class: el.getAttribute('class') || '',
      tag: el.tagName,
    }));
}

function getStatusLabels(root) {
  const labels = [];
  const statusSpans = root.querySelectorAll('span.status, span.badge, p.value, code');
  for (const el of statusSpans) {
    const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (text && /VERIFICAD|APROBAD|EVIDENCIA|EXPEDIENTE|FUENTE|HISTORIC|NO PROBADA|DOCUMENTADA|OFICIAL|CONTRASTADA|DISTRIBUCION|PRIMARIA|RESTRIGIDA|PUBLICA|DIRECTA|REVALIDADA|RELEASE|PUBLICACION|HEREDADA|LIMITACION|KERNEL|DISTRIBUTION/.test(text)) {
      labels.push(text);
    }
  }
  return [...new Set(labels)];
}

function getEvidenceTokens(root) {
  const tokens = [];
  const codes = root.querySelectorAll('code');
  for (const c of codes) {
    const text = c.textContent?.trim() ?? '';
    if (/^[A-Z][A-Z0-9_]{4,}$/.test(text)) {
      tokens.push(text);
    }
  }
  return [...new Set(tokens)];
}

function hasFocusVisible(root) {
  const style = root.querySelector('style');
  if (!style) return false;
  const css = style.textContent || '';
  return css.includes('focus-visible');
}

function hasAriaCurrent(root) {
  return root.querySelectorAll('[aria-current]').length > 0;
}

function getRoleAttributes(root) {
  const roles = [];
  const elements = root.querySelectorAll('[role]');
  for (const el of elements) {
    roles.push({ tag: el.tagName, role: el.getAttribute('role') });
  }
  return roles;
}

function getAriaAttributes(root) {
  const attrs = [];
  const elements = root.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [aria-hidden], [aria-controls], [aria-expanded], [aria-pressed]');
  for (const el of elements) {
    const obj = { tag: el.tagName };
    for (const attr of ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden', 'aria-controls', 'aria-expanded', 'aria-pressed']) {
      if (el.hasAttribute(attr)) obj[attr] = el.getAttribute(attr);
    }
    attrs.push(obj);
  }
  return attrs;
}

function countInlineStyles(root) {
  return root.querySelectorAll('[style]').length;
}

function getMetaDescription(root) {
  const meta = root.querySelector('meta[name="description"]');
  return meta?.getAttribute('content') ?? '';
}

function hasCspMetaTag(root) {
  return !!root.querySelector('meta[http-equiv="Content-Security-Policy"]');
}

function main() {
  console.log('[AUDIT] Loading catalogo.json...');
  const catalogo = JSON.parse(fs.readFileSync(CATALOGO_JSON, 'utf8'));
  const catalogoToolsByHref = new Map(catalogo.herramientas.map(t => [t.href, t]));
  const categoriesByNumber = new Map(catalogo.categorias.map(c => [Number(c.numero), c]));
  
  console.log('[AUDIT] Walking HTML files...');
  const htmlFiles = walkHtmlFiles(CATALOG_DIR);
  console.log(`[AUDIT] Found ${htmlFiles.length} HTML files`);
  
  const results = [];
  for (let i = 0; i < htmlFiles.length; i++) {
    if (i % 200 === 0) console.log(`[AUDIT] Processing ${i}/${htmlFiles.length}...`);
    try {
      const r = auditFile(htmlFiles[i], catalogoToolsByHref, categoriesByNumber);
      results.push(r);
    } catch (e) {
      console.error(`[AUDIT] Error processing ${htmlFiles[i]}:`, e.message);
      results.push({ file: getRelativePath(htmlFiles[i]), error: e.message });
    }
  }
  
  console.log('[AUDIT] Writing results...');
  const outPath = path.join(ROOT, 'scripts', 'html-audit-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`[AUDIT] Results written to ${outPath}`);
  
  // Print summary
  printSummary(results);
}

function printSummary(results) {
  const valid = results.filter(r => !r.error);
  const fichas = valid.filter(r => r.kind === 'ficha');
  const indices = valid.filter(r => r.kind === 'indice');
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total files: ${results.length}`);
  console.log(`  Fichas: ${fichas.length}`);
  console.log(`  Indices: ${indices.length}`);
  console.log(`  Errors: ${results.filter(r => r.error).length}`);
  
  // P1 metrics
  const looseDt = valid.reduce((sum, r) => sum + r.looseDt, 0);
  const looseDd = valid.reduce((sum, r) => sum + r.looseDd, 0);
  const filesWithLooseDt = valid.filter(r => r.looseDt > 0).length;
  const navWithoutName = valid.filter(r => r.navCount > 0 && !r.navNamed).length;
  const noNav = valid.filter(r => r.navCount === 0).length;
  const noSkipLink = valid.filter(r => !r.skipLink).length;
  const noMainId = valid.filter(r => r.mainCount > 0 && !r.mainHasId).length;
  const headerInMain = valid.filter(r => r.headerInMain).length;
  const footerInMain = valid.filter(r => r.footerInMain).length;
  const noInternalLinks = fichas.filter(r => r.internalLinks === 0).length;
  const noCategoryLink = fichas.filter(r => r.linksToCategoryIndex === 0).length;
  const deadEnds = fichas.filter(r => r.internalLinks === 0 && r.externalLinks > 0).length;
  
  console.log('\n=== P1 NORMATIVE HTML ===');
  console.log(`Loose dt/dd pairs: ${looseDt}/${looseDd} across ${filesWithLooseDt} files (HTML conformance)`);

  console.log('\n=== P2 ACCESSIBILITY / NAVIGATION RECOMMENDATIONS ===');
  console.log(`Pages without skip link: ${noSkipLink} (WCAG 2.4.1 candidate; verify alternative bypass)`);
  console.log(`Pages without <nav>: ${noNav} (semantic navigation absent)`);
  console.log(`Pages with <nav> but no accessible name: ${navWithoutName} / ${valid.filter(r => r.navCount > 0).length}`);
  console.log(`<main> without id="main-content": ${noMainId}`);
  console.log(`<header> inside <main>: ${headerInMain}`);
  console.log(`<footer> inside <main>: ${footerInMain}`);
  console.log(`Fichas without internal links: ${noInternalLinks}`);
  console.log(`Fichas without category index link: ${noCategoryLink}`);
  console.log(`Fichas dead-end (external only): ${deadEnds}`);

  console.log('\n=== NAVIGATION DISTINCTIONS (do not merge) ===');
  console.log(`1. Absence of category link: ${noCategoryLink} fichas`);
  console.log(`2. Absence of semantic navigation: ${noNav} pages without <nav>`);
  console.log(`3. Missing accessible name: ${navWithoutName} pages with unnamed <nav>`);

  // P2 metrics
  const rawUrlLinks = valid.reduce((sum, r) => sum + r.rawUrlLinkText, 0);
  const filesWithRawUrls = valid.filter(r => r.rawUrlLinkText > 0).length;
  const emptyLinks = valid.reduce((sum, r) => sum + r.emptyLinkText, 0);
  const filesWithEmptyLinks = valid.filter(r => r.emptyLinkText > 0).length;
  const sectionsNoHeading = valid.reduce((sum, r) => sum + r.sectionWithoutHeading, 0);
  const filesWithSectionsNoHeading = valid.filter(r => r.sectionWithoutHeading > 0).length;
  const noFocusVisible = valid.filter(r => !r.focusVisible).length;
  
  console.log('\n=== P2 USABILITY (continued) ===');
  console.log(`Raw URL link text: ${rawUrlLinks} across ${filesWithRawUrls} files`);
  console.log(`Empty link text: ${emptyLinks} across ${filesWithEmptyLinks} files`);
  console.log(`Sections without heading/aria-label: ${sectionsNoHeading} across ${filesWithSectionsNoHeading} files`);
  console.log(`Missing focus-visible CSS: ${noFocusVisible} files`);
  
  // Resources
  const resourceTypes = ['README.md', 'metadata.json', 'SHA256SUMS.txt', 'GUIA.md', 'SKILL.md', 'casos-uso.json', 'evidencias.json'];
  console.log('\n=== RESOURCES LINKED ===');
  for (const rt of resourceTypes) {
    const count = valid.filter(r => r.resourcesLinked.includes(rt)).length;
    console.log(`  ${rt}: ${count} files`);
  }
  
  // ATDS badges
  const atdsBadgesTotal = valid.reduce((sum, r) => sum + r.atdsBadges.length, 0);
  const filesWithAtdsBadges = valid.filter(r => r.atdsBadges.length > 0).length;
  console.log('\n=== ATDS BADGES ===');
  console.log(`Files with real ATDS badge markup: ${filesWithAtdsBadges}`);
  console.log(`Total badge elements: ${atdsBadgesTotal}`);
  
  // Status labels
  const statusLabelsAll = {};
  for (const r of valid) {
    for (const label of r.statusLabels) {
      statusLabelsAll[label] = (statusLabelsAll[label] || 0) + 1;
    }
  }
  console.log('\n=== STATUS LABELS (top 20) ===');
  Object.entries(statusLabelsAll).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log(`  ${v}\t${k}`));
  
  // Evidence tokens
  const tokensAll = {};
  for (const r of valid) {
    for (const t of r.evidenceTokens) {
      tokensAll[t] = (tokensAll[t] || 0) + 1;
    }
  }
  console.log('\n=== EVIDENCE TOKENS (top 20) ===');
  Object.entries(tokensAll).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log(`  ${v}\t${k}`));
  
  // Inline styles
  const inlineStyles = valid.reduce((sum, r) => sum + r.inlineStyleCount, 0);
  const filesWithInlineStyles = valid.filter(r => r.inlineStyleCount > 0).length;
  const withMetaDesc = valid.filter(r => r.metaDescription).length;
  const withCsp = valid.filter(r => r.hasCspMeta).length;
  console.log('\n=== P3 VISUAL / PUBLICATION CONTRACT ===');
  console.log(`Total style attributes: ${inlineStyles} across ${filesWithInlineStyles} files`);
  console.log(`Pages with meta description: ${withMetaDesc}`);
  console.log(`Pages with CSP meta tag: ${withCsp}`);
}

main();