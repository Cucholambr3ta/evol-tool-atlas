/**
 * HTTP security headers for the real hosting of the Atlas (SEC-WEB-01).
 *
 * The app is served by `vite preview` (systemd user service, scripts/install-local.sh),
 * which lets us attach headers to every response. Two policies apply:
 *
 * - APP: the SPA shell, its assets, data and the service worker. Same rules as the
 *   meta CSP in dist/index.html, plus `frame-ancestors`, which only works as a header.
 * - DOCUMENT: the historical static pages (02-catalogo/, 05-referencias/, skills/,
 *   docs/). They carry no scripts and use inline <style> blocks, so scripts are fully
 *   disabled and only inline styles are allowed. This is narrower than the APP policy
 *   in every directive except style-src, and it does not touch the SPA.
 */

export const APP_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/** frame-ancestors is ignored inside <meta>; it is only sent as a header. */
export const APP_CSP_HEADER = [...APP_CSP_DIRECTIVES, "frame-ancestors 'none'"].join('; ');
export const APP_CSP_META = APP_CSP_DIRECTIVES.join('; ');

export const DOCUMENT_CSP_HEADER = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const COMMON_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

const DOCUMENT_PREFIXES = ['02-catalogo/', '05-referencias/', 'skills/', 'docs/'];

/**
 * Pick the CSP for a request path.
 *
 * @param {string} urlPath request path (no query)
 * @param {string} basePath e.g. "/evol-tool-atlas/"
 * @returns {'APP' | 'DOCUMENT'}
 */
export function policyForPath(urlPath, basePath) {
  const p = String(urlPath ?? '').split(/[?#]/)[0];
  const rel = p.startsWith(basePath) ? p.slice(basePath.length) : p.replace(/^\/+/, '');
  return DOCUMENT_PREFIXES.some((prefix) => rel.startsWith(prefix)) ? 'DOCUMENT' : 'APP';
}

/**
 * Headers for a request path.
 *
 * @param {string} urlPath
 * @param {string} basePath
 * @returns {Record<string, string>}
 */
export function securityHeadersFor(urlPath, basePath) {
  const csp = policyForPath(urlPath, basePath) === 'DOCUMENT' ? DOCUMENT_CSP_HEADER : APP_CSP_HEADER;
  return { 'Content-Security-Policy': csp, ...COMMON_SECURITY_HEADERS };
}

/**
 * Connect-style middleware that sets the headers before the static handler runs.
 *
 * @param {string} basePath
 * @param {{ documentsOnly?: boolean }} [options] dev server: leave the SPA (HMR client) untouched
 */
export function createSecurityHeadersMiddleware(basePath, options = {}) {
  return (req, res, next) => {
    if (options.documentsOnly && policyForPath(req.url ?? '', basePath) !== 'DOCUMENT') {
      next();
      return;
    }
    for (const [name, value] of Object.entries(securityHeadersFor(req.url ?? '', basePath))) {
      res.setHeader(name, value);
    }
    next();
  };
}
