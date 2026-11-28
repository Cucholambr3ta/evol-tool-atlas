/**
 * What `scripts/copy-static-catalog.mjs` publishes into dist/ next to the SPA build.
 *
 * Single source of truth shared by the copy step and by the HTML contract link checks
 * (`scripts/lib/html-contract.mjs`): a link in a static page is publishable only if its
 * target is inside one of these items (or is the SPA entry `index.html`).
 * DOC-01: docs/ is not copied wholesale; only documents the app links to are published.
 */
export const STATIC_CATALOG_ITEMS = Object.freeze([
  '02-catalogo',
  '05-referencias',
  'skills',
  'catalogo.json',
  'SHA256SUMS.txt',
  'docs/atds/ATDS-v1.md',
]);

/** The SPA entry produced by `vite build` at the root of dist/. */
export const SPA_ENTRY = 'index.html';

/**
 * Whether a repository-relative POSIX path is published in dist/.
 *
 * @param {string} rel
 * @returns {boolean}
 */
export function isPublishedPath(rel) {
  if (rel === SPA_ENTRY) return true;
  return STATIC_CATALOG_ITEMS.some((item) => rel === item || rel.startsWith(`${item}/`));
}
