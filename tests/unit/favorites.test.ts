import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFavorites,
  FAVORITES_STORAGE_KEY,
  getFavorites,
  isFavorite,
  removeFavorite,
  resetFavoritesCacheForTests,
  toggleFavorite,
} from '../../src/lib/favorites';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('favorites persistence', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage },
      configurable: true,
    });
    resetFavoritesCacheForTests();
  });

  it('toggles, persists, removes, and clears favorites', () => {
    expect(getFavorites()).toEqual([]);

    const added = toggleFavorite({
      id: 'semgrep',
      name: 'Semgrep',
      categorySlug: 'auditoria-codigo',
      categoryName: 'Auditoría de código',
    });
    expect(added).toBe(true);
    expect(isFavorite('semgrep')).toBe(true);

    // Simulate page reload by resetting in-memory cache
    resetFavoritesCacheForTests();
    expect(getFavorites().map((f) => f.id)).toEqual(['semgrep']);

    removeFavorite('semgrep');
    expect(isFavorite('semgrep')).toBe(false);

    toggleFavorite({
      id: 'nmap',
      name: 'nmap',
      categorySlug: 'reconocimiento',
      categoryName: 'Reconocimiento',
    });
    clearFavorites();
    expect(getFavorites()).toEqual([]);
  });

  it('recovers safely from corrupted JSON in localStorage', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, '{not-valid-json');
    resetFavoritesCacheForTests();
    expect(getFavorites()).toEqual([]);
  });
});
