import type { OfflineManifest } from '../types/catalog';
import { withBase } from './dom';

export const CATALOG_CACHE_NAME = 'evol-atlas-catalog-v1';

export interface OfflineStatus {
  supported: boolean;
  cachedCount: number;
  totalCount: number;
  isComplete: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export interface OfflineProgress {
  completed: number;
  total: number;
  skipped: number;
  failedUrls: string[];
  currentPhase: 'preparing' | 'downloading' | 'complete' | 'cancelled' | 'error';
  quotaExceeded: boolean;
  errorMessage: string | null;
}

let cachedManifest: OfflineManifest | null = null;

export async function loadOfflineManifest(): Promise<OfflineManifest> {
  if (cachedManifest) return cachedManifest;
  const res = await fetch(withBase('data/offline-manifest.json'));
  if (!res.ok) {
    throw new Error(`No se pudo cargar el manifiesto offline (HTTP ${res.status}).`);
  }
  const parsed = (await res.json()) as OfflineManifest;
  cachedManifest = parsed;
  return parsed;
}

export async function getOfflineStatus(): Promise<OfflineStatus> {
  const supported = typeof caches !== 'undefined';
  if (!supported) {
    return {
      supported: false,
      cachedCount: 0,
      totalCount: 0,
      isComplete: false,
      usageBytes: null,
      quotaBytes: null,
    };
  }

  let totalCount = 0;
  let manifestUrls: Set<string> | null = null;
  try {
    const manifest = await loadOfflineManifest();
    totalCount = manifest.items.length;
    manifestUrls = new Set(
      manifest.items.map((item) => new URL(withBase(item.url), window.location.origin).href),
    );
  } catch {
    totalCount = 0;
  }

  const cache = await caches.open(CATALOG_CACHE_NAME);
  const requests = await cache.keys();
  let cachedCount = 0;
  if (manifestUrls) {
    for (const req of requests) {
      if (manifestUrls.has(req.url)) {
        cachedCount += 1;
      }
    }
  } else {
    cachedCount = requests.length;
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      usageBytes = typeof est.usage === 'number' ? est.usage : null;
      quotaBytes = typeof est.quota === 'number' ? est.quota : null;
    } catch {
      // Ignore storage estimate failure on restricted environments
    }
  }

  return {
    supported: true,
    cachedCount,
    totalCount,
    isComplete: totalCount > 0 && cachedCount >= totalCount,
    usageBytes,
    quotaBytes,
  };
}

export async function downloadCatalogOffline(
  onProgress: (progress: OfflineProgress) => void,
  signal: AbortSignal,
  onlyUrls?: string[],
): Promise<OfflineProgress> {
  if (typeof caches === 'undefined') {
    const state: OfflineProgress = {
      completed: 0,
      total: 0,
      skipped: 0,
      failedUrls: [],
      currentPhase: 'error',
      quotaExceeded: false,
      errorMessage: 'Cache Storage no está disponible en este contexto de navegador.',
    };
    onProgress(state);
    return state;
  }

  onProgress({
    completed: 0,
    total: onlyUrls ? onlyUrls.length : 0,
    skipped: 0,
    failedUrls: [],
    currentPhase: 'preparing',
    quotaExceeded: false,
    errorMessage: null,
  });

  let targets: string[];
  try {
    if (onlyUrls && onlyUrls.length > 0) {
      targets = [...onlyUrls];
    } else {
      const manifest = await loadOfflineManifest();
      targets = manifest.items.map((item) => item.url);
    }
  } catch (err) {
    const state: OfflineProgress = {
      completed: 0,
      total: 0,
      skipped: 0,
      failedUrls: [],
      currentPhase: 'error',
      quotaExceeded: false,
      errorMessage: err instanceof Error ? err.message : 'Error al preparar la lista offline.',
    };
    onProgress(state);
    return state;
  }

  const total = targets.length;
  const cache = await caches.open(CATALOG_CACHE_NAME);
  const existingKeys = await cache.keys();
  const cachedSet = new Set(existingKeys.map((r) => r.url));

  const pending: string[] = [];
  let skipped = 0;
  for (const rel of targets) {
    const absUrl = new URL(withBase(rel), window.location.origin).href;
    if (cachedSet.has(absUrl)) {
      skipped += 1;
    } else {
      pending.push(rel);
    }
  }

  let completed = skipped;
  const failedUrls: string[] = [];
  let quotaExceeded = false;
  let lastEmit = 0;

  const emit = (force = false, phase: OfflineProgress['currentPhase'] = 'downloading', errorMessage: string | null = null) => {
    const now = performance.now();
    if (!force && now - lastEmit < 60) return;
    lastEmit = now;
    onProgress({
      completed,
      total,
      skipped,
      failedUrls: [...failedUrls],
      currentPhase: phase,
      quotaExceeded,
      errorMessage,
    });
  };

  emit(true, 'downloading');

  let cursor = 0;
  const concurrency = 12;

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      if (signal.aborted || quotaExceeded) return;
      const idx = cursor;
      cursor += 1;
      const rel = pending[idx];
      if (!rel) continue;
      const resolvedUrl = withBase(rel);
      try {
        const response = await fetch(resolvedUrl, { signal, cache: 'no-cache' });
        if (!response.ok) {
          failedUrls.push(rel);
        } else {
          try {
            await cache.put(resolvedUrl, response);
          } catch (putErr) {
            if (putErr instanceof DOMException && putErr.name === 'QuotaExceededError') {
              quotaExceeded = true;
              failedUrls.push(rel);
              return;
            }
            failedUrls.push(rel);
          }
        }
      } catch (fetchErr) {
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          return;
        }
        failedUrls.push(rel);
      } finally {
        completed += 1;
        emit(false, 'downloading');
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, () =>
    worker(),
  );
  await Promise.all(workers);

  if (signal.aborted) {
    const finalState: OfflineProgress = {
      completed,
      total,
      skipped,
      failedUrls,
      currentPhase: 'cancelled',
      quotaExceeded,
      errorMessage: 'Descarga cancelada por el usuario. Los archivos ya guardados se conservan.',
    };
    onProgress(finalState);
    return finalState;
  }

  if (quotaExceeded) {
    const finalState: OfflineProgress = {
      completed,
      total,
      skipped,
      failedUrls,
      currentPhase: 'error',
      quotaExceeded: true,
      errorMessage: 'Se alcanzó el límite de almacenamiento del navegador antes de completar el paquete.',
    };
    onProgress(finalState);
    return finalState;
  }

  const finalState: OfflineProgress = {
    completed,
    total,
    skipped,
    failedUrls,
    currentPhase: failedUrls.length > 0 ? 'error' : 'complete',
    quotaExceeded: false,
    errorMessage:
      failedUrls.length > 0
        ? `No se pudieron descargar ${failedUrls.length} recursos. Puedes reintentar los fallidos.`
        : null,
  };
  onProgress(finalState);
  return finalState;
}

export async function clearOfflineCatalog(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(CATALOG_CACHE_NAME);
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return 'No disponible';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
