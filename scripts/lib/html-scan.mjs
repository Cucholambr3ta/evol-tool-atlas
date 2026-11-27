/**
 * Structural scan of the historical static HTML (SEC-STATIC-01).
 *
 * A small tokenizer (no dependency) walks tags and attributes honouring quotes,
 * comments, raw-text elements (<style>, <script>, <textarea>) and entity-encoded
 * URL schemes, which regexes over the raw text get wrong. It only reads files:
 * blocking findings fail verify:catalog; advisory findings are recorded for the
 * separate template audit and never trigger edits to the sheets.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
const FORBIDDEN_ELEMENTS = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'form', 'portal']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'data', 'background', 'cite', 'srcset']);
const EMBED_ATTRS = new Set(['src', 'srcset', 'poster', 'data', 'background']);

function decodeEntities(v) {
  return v
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&amp;/gi, '&');
}

/** Scheme of a URL after entity decoding and removal of control/space characters. */
function urlScheme(value) {
  // eslint-disable-next-line no-control-regex
  const cleaned = decodeEntities(value).replace(/[\u0000- \u007f]+/g, '').toLowerCase();
  const m = /^([a-z][a-z0-9+.-]*):/.exec(cleaned);
  return m ? m[1] : null;
}

/**
 * Tokenize HTML into start tags with attributes.
 *
 * @param {string} html
 * @returns {Array<{ name: string, attrs: Array<{ name: string, value: string|null }>, offset: number }>}
 */
export function tokenizeTags(html) {
  const tags = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (html[lt + 1] === '/') {
      const end = html.indexOf('>', lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt, lt + 64));
    if (!nameMatch) {
      i = lt + 1;
      continue;
    }
    const name = nameMatch[1].toLowerCase();
    let j = lt + nameMatch[0].length;
    const attrs = [];
    while (j < n) {
      while (j < n && /\s|\//.test(html[j])) j++;
      if (j >= n || html[j] === '>') break;
      const an = /^[^\s/>=]+/.exec(html.slice(j, j + 256));
      if (!an) {
        j++;
        continue;
      }
      const attrName = an[0].toLowerCase();
      j += an[0].length;
      while (j < n && /\s/.test(html[j])) j++;
      let value = null;
      if (html[j] === '=') {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, j + 1);
          value = html.slice(j + 1, end === -1 ? n : end);
          j = end === -1 ? n : end + 1;
        } else {
          const v = /^[^\s>]*/.exec(html.slice(j))[0];
          value = v;
          j += v.length;
        }
      }
      attrs.push({ name: attrName, value });
    }
    tags.push({ name, attrs, offset: lt });
    i = j + 1;
    if (RAW_TEXT.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, i);
      i = close === -1 ? n : close;
    }
  }
  return tags;
}

/**
 * Scan one document.
 *
 * @param {string} html
 * @param {{ file: string, resolveLocal: (href: string) => boolean }} ctx
 * @returns {{ blocking: string[], advisory: string[], stats: { inlineStyleBlocks: number, styleAttributes: number, externalLinks: number } }}
 */
export function scanHtml(html, ctx) {
  const blocking = [];
  const advisory = [];
  const stats = { inlineStyleBlocks: 0, styleAttributes: 0, externalLinks: 0 };
  const tags = tokenizeTags(html);
  let hasLang = false;
  let hasCharset = false;
  let hasTitle = false;
  for (const tag of tags) {
    if (tag.name === 'html' && tag.attrs.some((a) => a.name === 'lang' && a.value)) hasLang = true;
    if (tag.name === 'meta' && tag.attrs.some((a) => a.name === 'charset')) hasCharset = true;
    if (tag.name === 'title') hasTitle = true;
    if (tag.name === 'style') stats.inlineStyleBlocks++;
    if (FORBIDDEN_ELEMENTS.has(tag.name)) blocking.push(`elemento <${tag.name}> no permitido`);
    if (tag.name === 'meta' && tag.attrs.some((a) => a.name === 'http-equiv' && /refresh/i.test(a.value ?? ''))) {
      blocking.push('<meta http-equiv="refresh"> no permitido');
    }
    if (tag.name === 'link') {
      const href = tag.attrs.find((a) => a.name === 'href')?.value ?? '';
      if (urlScheme(href)) blocking.push(`<link> remoto o con esquema: ${href}`);
    }
    const isBlankTarget = tag.attrs.some((a) => a.name === 'target' && a.value === '_blank');
    for (const a of tag.attrs) {
      if (/^on/.test(a.name)) blocking.push(`atributo de evento ${a.name} en <${tag.name}>`);
      if (a.name === 'style') {
        stats.styleAttributes++;
        if (/url\s*\(|expression\s*\(/i.test(a.value ?? '')) blocking.push(`style con url()/expression en <${tag.name}>`);
      }
      if (!URL_ATTRS.has(a.name) || a.value === null) continue;
      const scheme = urlScheme(a.value);
      if (scheme && !['http', 'https', 'mailto'].includes(scheme)) blocking.push(`esquema ${scheme}: en ${a.name} de <${tag.name}>`);
      if (EMBED_ATTRS.has(a.name) && (scheme === 'http' || scheme === 'https' || /^\/\//.test(a.value.trim()))) {
        blocking.push(`recurso remoto incrustado en <${tag.name} ${a.name}>`);
      }
      if (tag.name === 'a' && a.name === 'href') {
        if (scheme === 'http' || scheme === 'https') {
          stats.externalLinks++;
          const rel = tag.attrs.find((x) => x.name === 'rel')?.value ?? '';
          if (isBlankTarget && !/noopener/.test(rel)) advisory.push(`enlace externo con target=_blank sin rel=noopener: ${a.value}`);
        } else if (!scheme && !a.value.startsWith('#')) {
          const clean = decodeEntities(a.value).split('#')[0].split('?')[0];
          if (clean && !ctx.resolveLocal(clean)) blocking.push(`enlace interno roto: ${a.value}`);
        }
      }
    }
  }
  if (!hasLang) advisory.push('falta <html lang>');
  if (!hasCharset) advisory.push('falta <meta charset>');
  if (!hasTitle) advisory.push('falta <title>');
  if (stats.inlineStyleBlocks > 0 || stats.styleAttributes > 0) advisory.push('estilos en línea: requieren style-src \'unsafe-inline\' en la CSP de documentos');
  return { blocking, advisory, stats };
}

/**
 * Scan every .html file under `dir`.
 *
 * @param {string} dir
 * @param {string} root repository root (for relative paths in the report)
 */
export function scanStaticTree(dir, root) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.html')) files.push(p);
    }
  };
  walk(dir);
  const report = { files: files.length, blocking: [], advisoryCounts: {}, stats: { inlineStyleBlocks: 0, styleAttributes: 0, externalLinks: 0 } };
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const r = scanHtml(html, { file, resolveLocal: (href) => fs.existsSync(path.resolve(path.dirname(file), href)) });
    for (const b of r.blocking) report.blocking.push(`${path.relative(root, file)}: ${b}`);
    for (const a of r.advisory) {
      const key = a.replace(/:.*$/, '');
      report.advisoryCounts[key] = (report.advisoryCounts[key] ?? 0) + 1;
    }
    for (const k of Object.keys(report.stats)) report.stats[k] += r.stats[k];
  }
  return report;
}
