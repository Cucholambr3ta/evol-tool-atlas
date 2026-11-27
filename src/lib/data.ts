import type { CatalogIndex, CategoryShard, ToolDetail } from '../types/catalog';
import { DataContractError, validateCatalogIndex, validateCategoryShard } from './contracts';
import { withBase } from './dom';

export { DataContractError };

/** Parse a JSON body; malformed JSON is a contract error, not a network error. */
async function readJson(res: Response, resource: string): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DataContractError(resource, 'JSON malformado');
  }
}

export class OfflineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineUnavailableError';
  }
}

let catalogIndexPromise: Promise<CatalogIndex> | null = null;
const shardPromises = new Map<string, Promise<CategoryShard>>();

export async function loadCatalogIndex(): Promise<CatalogIndex> {
  if (!catalogIndexPromise) {
    catalogIndexPromise = (async () => {
      try {
        const res = await fetch(withBase('data/catalog-index.json'));
        if (res.status === 503) {
          throw new OfflineUnavailableError('El índice del catálogo no está disponible sin conexión.');
        }
        if (!res.ok) {
          throw new Error(`No se pudo cargar el índice del catálogo (HTTP ${res.status}).`);
        }
        return validateCatalogIndex(await readJson(res, 'el índice del catálogo'));
      } catch (err) {
        catalogIndexPromise = null;
        if (err instanceof OfflineUnavailableError || err instanceof DataContractError) throw err;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new OfflineUnavailableError('Sin conexión y sin índice en caché local.');
        }
        throw err;
      }
    })();
  }
  return catalogIndexPromise;
}

export async function loadCategoryShard(slug: string): Promise<CategoryShard> {
  const existing = shardPromises.get(slug);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(withBase(`data/categories/${encodeURIComponent(slug)}.json`));
      if (res.status === 503) {
        throw new OfflineUnavailableError(
          `La categoría "${slug}" todavía no se ha guardado para uso sin conexión.`,
        );
      }
      if (!res.ok) {
        throw new Error(`No se pudo cargar la categoría "${slug}" (HTTP ${res.status}).`);
      }
      const raw = await readJson(res, `la categoría "${slug}"`);
      const index = await loadCatalogIndex().catch(() => null);
      return validateCategoryShard(raw, slug, index);
    } catch (err) {
      shardPromises.delete(slug);
      if (err instanceof OfflineUnavailableError || err instanceof DataContractError) throw err;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new OfflineUnavailableError(
          `No hay conexión para descargar la categoría "${slug}".`,
        );
      }
      throw err;
    }
  })();

  shardPromises.set(slug, promise);
  return promise;
}

/** Test hook: forget cached promises. */
export function resetDataCacheForTests(): void {
  catalogIndexPromise = null;
  shardPromises.clear();
}

export async function loadToolDetail(toolId: string): Promise<ToolDetail | null> {
  const index = await loadCatalogIndex();
  const summary = index.tools.find((t) => t.id === toolId);
  if (!summary) return null;
  const shard = await loadCategoryShard(summary.categorySlug);
  return shard.tools.find((t) => t.id === toolId) ?? null;
}
