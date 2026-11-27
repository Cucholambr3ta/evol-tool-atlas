import type { FavoriteEntry } from '../types/catalog';

export const FAVORITES_STORAGE_KEY = 'evol-tool-atlas:favorites:v1';

/**
 * FAV-01: where favorites actually live.
 * - persistent: the last read/write to localStorage succeeded.
 * - session-only: storage is blocked, unavailable or a write failed (e.g. quota);
 *   favorites are kept in memory for this session and the UI says so.
 */
export type FavoritesPersistence = 'persistent' | 'session-only';

type FavListener = (favorites: FavoriteEntry[], persistence: FavoritesPersistence) => void;

const listeners = new Set<FavListener>();
let cache: FavoriteEntry[] | null = null;
let persistence: FavoritesPersistence = 'persistent';
let lastError: string | null = null;

/** Accessing window.localStorage itself throws (SecurityError) when storage is blocked. */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readFromStorage(): FavoriteEntry[] {
  const storage = getStorage();
  if (!storage) {
    persistence = 'session-only';
    lastError = 'El navegador no permite el almacenamiento local en este contexto.';
    return [];
  }
  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FavoriteEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as FavoriteEntry).id === 'string' &&
        typeof (item as FavoriteEntry).name === 'string' &&
        typeof (item as FavoriteEntry).categorySlug === 'string' &&
        typeof (item as FavoriteEntry).categoryName === 'string',
    );
  } catch (err) {
    if (err instanceof DOMException) {
      persistence = 'session-only';
      lastError = 'No se pudo leer el almacenamiento local.';
    }
    return [];
  }
}

function writeToStorage(items: FavoriteEntry[]): FavoritesPersistence {
  cache = items;
  const storage = getStorage();
  if (!storage) {
    persistence = 'session-only';
    lastError = 'El navegador no permite el almacenamiento local en este contexto.';
  } else {
    try {
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
      persistence = 'persistent';
      lastError = null;
    } catch (err) {
      persistence = 'session-only';
      lastError =
        err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)
          ? 'El almacenamiento local está lleno.'
          : 'El navegador rechazó guardar en el almacenamiento local.';
    }
  }
  const snapshot = [...items];
  for (const listener of listeners) {
    listener(snapshot, persistence);
  }
  return persistence;
}

export function resetFavoritesCacheForTests(): void {
  cache = null;
  persistence = 'persistent';
  lastError = null;
}

export function getFavorites(): FavoriteEntry[] {
  if (!cache) {
    cache = readFromStorage();
  }
  return [...cache];
}

export function getFavoritesPersistence(): { status: FavoritesPersistence; reason: string | null } {
  getFavorites();
  return { status: persistence, reason: lastError };
}

export function getFavoriteIds(): Set<string> {
  return new Set(getFavorites().map((f) => f.id));
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((f) => f.id === id);
}

export function toggleFavorite(entry: Omit<FavoriteEntry, 'addedAt'>): boolean {
  const current = getFavorites();
  const exists = current.some((f) => f.id === entry.id);
  if (exists) {
    writeToStorage(current.filter((f) => f.id !== entry.id));
    return false;
  }
  const next: FavoriteEntry[] = [
    { ...entry, addedAt: new Date().toISOString() },
    ...current,
  ];
  writeToStorage(next);
  return true;
}

export function removeFavorite(id: string): void {
  const current = getFavorites();
  writeToStorage(current.filter((f) => f.id !== id));
}

export function clearFavorites(): void {
  writeToStorage([]);
}

export function subscribeFavorites(listener: FavListener): () => void {
  listeners.add(listener);
  listener(getFavorites(), persistence);
  return () => {
    listeners.delete(listener);
  };
}
