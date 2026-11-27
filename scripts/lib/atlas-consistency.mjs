/**
 * Exact consistency checks between catalogo.json, the global index and the
 * category shards (DATA-02), and between the offline manifest and the published
 * build (OFF-VERIFY-01). Pure functions: they return a list of errors and never
 * modify the sheets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * @param {{ catalog: { categorias: Array<{ numero: number|string, slug: string }>, herramientas: Array<{ id: string, cat: number|string, href: string }> },
 *           index: { categories: Array<{ number: number, slug: string, admitted: number }>, tools: Array<{ id: string, name: string, categorySlug: string, htmlHref: string }> },
 *           shards: Map<string, { category: { slug: string }, tools: Array<{ id: string, name: string, categorySlug: string, htmlHref: string }> }> }} input
 * @returns {string[]} errors
 */
export function compareCatalogIndexShards({ catalog, index, shards }) {
  const errors = [];
  const slugByNumber = new Map(index.categories.map((c) => [Number(c.number), c.slug]));
  const indexSlugs = new Set(index.categories.map((c) => c.slug));

  // catalogo.json ↔ index: same ids, category and href.
  const indexById = new Map();
  for (const t of index.tools) {
    if (indexById.has(t.id)) errors.push(`ID duplicado en el índice: ${t.id}`);
    indexById.set(t.id, t);
  }
  const catalogIds = new Set();
  for (const t of catalog.herramientas) {
    const id = String(t.id);
    if (catalogIds.has(id)) errors.push(`ID duplicado en catalogo.json: ${id}`);
    catalogIds.add(id);
    const it = indexById.get(id);
    if (!it) {
      errors.push(`Herramienta de catalogo.json ausente del índice: ${id}`);
      continue;
    }
    const expectedSlug = slugByNumber.get(Number(t.cat));
    if (it.categorySlug !== expectedSlug) errors.push(`Categoría distinta para ${id}: índice ${it.categorySlug}, catálogo ${expectedSlug}`);
    if (it.htmlHref !== String(t.href)) errors.push(`Ruta distinta para ${id}: índice ${it.htmlHref}, catálogo ${t.href}`);
  }
  for (const id of indexById.keys()) {
    if (!catalogIds.has(id)) errors.push(`Herramienta del índice ausente de catalogo.json: ${id}`);
  }

  // index ↔ shards: every tool exactly once, in the shard of its category.
  const seenInShards = new Map();
  for (const [slug, shard] of shards) {
    if (!indexSlugs.has(slug)) errors.push(`Fragmento sin categoría en el índice: ${slug}`);
    if (shard.category.slug !== slug) errors.push(`El fragmento ${slug}.json declara la categoría ${shard.category.slug}`);
    for (const t of shard.tools) {
      const where = seenInShards.get(t.id);
      if (where) errors.push(`Herramienta repetida en fragmentos: ${t.id} (${where} y ${slug})`);
      else seenInShards.set(t.id, slug);
      const it = indexById.get(t.id);
      if (!it) {
        errors.push(`Herramienta del fragmento ${slug} ausente del índice: ${t.id}`);
        continue;
      }
      if (it.categorySlug !== slug) errors.push(`${t.id} está en el fragmento ${slug} pero el índice la asigna a ${it.categorySlug}`);
      if (t.categorySlug !== slug) errors.push(`${t.id} declara categorySlug ${t.categorySlug} dentro del fragmento ${slug}`);
      if (t.name !== it.name) errors.push(`Nombre distinto para ${t.id}: fragmento "${t.name}", índice "${it.name}"`);
      if (t.htmlHref !== it.htmlHref) errors.push(`Ruta distinta para ${t.id} entre fragmento e índice`);
    }
  }
  for (const cat of index.categories) {
    if (!shards.has(cat.slug)) errors.push(`Falta el fragmento de la categoría ${cat.slug}`);
    else if (shards.get(cat.slug).tools.length !== cat.admitted) {
      errors.push(`La categoría ${cat.slug} declara ${cat.admitted} herramientas y su fragmento tiene ${shards.get(cat.slug).tools.length}`);
    }
  }
  for (const id of indexById.keys()) {
    if (!seenInShards.has(id)) errors.push(`Herramienta del índice ausente de todos los fragmentos: ${id}`);
  }
  return errors;
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * Every manifest URL must be a file inside dist/ with the declared SHA-256, so it is
 * servable under the base path (dist/ is the base-path root of `vite preview`).
 *
 * @param {{ manifest: { items: Array<{ url: string, sha256: string }> }, distDir: string }} input
 * @returns {string[]} errors
 */
export function verifyManifestAgainstDist({ manifest, distDir }) {
  const errors = [];
  const realDist = fs.realpathSync(distDir);
  for (const item of manifest.items) {
    const file = path.join(distDir, item.url);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      errors.push(`URL del manifiesto offline ausente en dist/: ${item.url}`);
      continue;
    }
    const real = fs.realpathSync(file);
    if (!isInside(realDist, real)) {
      errors.push(`URL del manifiesto offline fuera de dist/: ${item.url}`);
      continue;
    }
    const sha = createHash('sha256').update(fs.readFileSync(real)).digest('hex');
    if (sha !== item.sha256) errors.push(`SHA-256 distinto en dist/ para ${item.url}`);
  }
  return errors;
}
