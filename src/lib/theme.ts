import type { ThemePreference } from '../types/catalog';

const THEME_STORAGE_KEY = 'evol-tool-atlas:theme:v1';

// Official 14-minimal-line-art theme-color values
const LIGHT_THEME_COLOR = '#365568';
const DARK_THEME_COLOR = '#191b1e';

type ThemeListener = (pref: ThemePreference, resolved: 'light' | 'dark') => void;

const listeners = new Set<ThemeListener>();
let currentPreference: ThemePreference = 'system';

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyThemeToDocument(pref: ThemePreference): void {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  if (pref === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = pref;
  }
  root.dataset.resolvedTheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (meta) {
    meta.content = resolved === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  }
  for (const listener of listeners) {
    listener(pref, resolved);
  }
}

export function initTheme(): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      currentPreference = saved;
    }
  } catch {
    currentPreference = 'system';
  }
  applyThemeToDocument(currentPreference);

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (currentPreference === 'system') {
        applyThemeToDocument(currentPreference);
      }
    });
  }
}

export function getThemePreference(): ThemePreference {
  return currentPreference;
}

export function cycleThemePreference(): ThemePreference {
  const order: ThemePreference[] = ['system', 'light', 'dark'];
  const idx = order.indexOf(currentPreference);
  const next = order[(idx + 1) % order.length] ?? 'system';
  setThemePreference(next);
  return next;
}

export function setThemePreference(pref: ThemePreference): void {
  currentPreference = pref;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Ignore storage error
  }
  applyThemeToDocument(pref);
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  listener(currentPreference, resolveTheme(currentPreference));
  return () => {
    listeners.delete(listener);
  };
}
