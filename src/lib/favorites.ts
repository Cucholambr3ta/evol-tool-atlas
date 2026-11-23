import type { FavoriteEntry } from '../types/catalog';

export const FAVORITES_STORAGE_KEY = 'evol-tool-atlas:favorites:v1';

type FavListener = (favorites: FavoriteEntry[]) => void;

const listeners = new Set<FavListener>();
let cache: FavoriteEntry[] | null = null;

function readFromStorage(): FavoriteEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
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
  } catch {
    return [];
  }
}

function writeToStorage(items: FavoriteEntry[]): void {
  cache = items;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }
  const snapshot = [...items];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function resetFavoritesCacheForTests(): void {
  cache = null;
}

export function getFavorites(): FavoriteEntry[] {
  if (!cache) {
    cache = readFromStorage();
  }
  return [...cache];
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
  listener(getFavorites());
  return () => {
    listeners.delete(listener);
  };
}
