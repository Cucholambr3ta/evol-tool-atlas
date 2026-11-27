/**
 * Single source of truth for the deployment base path (QA-03).
 *
 * Vite, Playwright, the verifier and the E2E suite all read VITE_BASE_PATH through
 * this function. The default keeps the historical sub-path deployment.
 */
export const DEFAULT_BASE_PATH = '/evol-tool-atlas/';

/**
 * Normalise a base path to "/" or "/segment/.../".
 *
 * @param {string | undefined | null} raw
 * @returns {string}
 */
export function normalizeBasePath(raw) {
  const value = raw === undefined || raw === null || String(raw).trim() === '' ? DEFAULT_BASE_PATH : String(raw).trim();
  if (/[?#\\\s]/.test(value) || value.includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new Error(`VITE_BASE_PATH inválido: ${JSON.stringify(value)} (use "/" o "/subruta/")`);
  }
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  const collapsed = withLeading.replace(/\/{2,}/g, '/');
  return collapsed.endsWith('/') ? collapsed : `${collapsed}/`;
}

/**
 * Base path from the environment.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveBasePath(env = process.env) {
  return normalizeBasePath(env.VITE_BASE_PATH);
}
