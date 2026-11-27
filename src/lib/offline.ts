/**
 * Offline catalogue storage (OFF-01..05).
 *
 * - Each manifest revision is stored in its own cache (`evol-atlas-offline-<version>`).
 * - A pointer in `evol-atlas-offline-meta` names the revision that is complete and
 *   usable. It only moves after every item of a new revision was downloaded and its
 *   SHA-256 matched the manifest (two-phase update); the previous usable revision is
 *   deleted only after that.
 * - Completeness means: pointer == current manifest revision AND every manifest URL is
 *   present in that cache. Counting URLs alone is never enough.
 * - Hashes are checked when downloading (cost proportional to what is fetched) and on
 *   explicit request (verifyOfflineIntegrity), never on every render.
 */
import type { OfflineManifest, OfflineManifestItem } from '../types/catalog';
import { withBase } from './dom';

/** Runtime cache filled by the service worker while browsing online. */
export const CATALOG_CACHE_NAME = 'evol-atlas-catalog-v1';
export const OFFLINE_CACHE_PREFIX = 'evol-atlas-offline-';
export const OFFLINE_META_CACHE = 'evol-atlas-offline-meta';
export const OFFLINE_STATE_URL = '/__evol-atlas/offline-state.json';
/** Marks downloader requests so the service worker does not store a second copy. */
export const OFFLINE_DOWNLOAD_HEADER = 'X-Atlas-Offline-Download';

export interface OfflineState {
  activeRevision: string;
  activeVersion: string;
  completedAt: string;
  totalFiles: number;
}

export type OfflineAvailability = 'unsupported' | 'none' | 'partial' | 'complete' | 'stale';

export interface OfflineStatus {
  supported: boolean;
  availability: OfflineAvailability;
  /** Revision of the manifest published with this build. */
  revision: string | null;
  /** Revision of the last complete, verified download (may be older). */
  activeRevision: string | null;
  cachedCount: number;
  totalCount: number;
  isComplete: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export interface OfflineProgress {
  total: number;
  /** processed = succeeded + alreadyCached + failed */
  processed: number;
  succeeded: number;
  alreadyCached: number;
  failed: number;
  /** Items not attempted because the download was cancelled or stopped. */
  cancelled: number;
  failedUrls: string[];
  integrityFailures: string[];
  currentPhase: 'preparing' | 'downloading' | 'complete' | 'cancelled' | 'error';
  quotaExceeded: boolean;
  errorMessage: string | null;
}

export function cacheNameForVersion(version: string): string {
  return `${OFFLINE_CACHE_PREFIX}${version}`;
}

let cachedManifest: OfflineManifest | null = null;

export function resetOfflineManifestForTests(): void {
  cachedManifest = null;
}

function isManifest(v: unknown): v is OfflineManifest {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.revision === 'string' &&
    typeof m.version === 'string' &&
    Array.isArray(m.items) &&
    m.items.every(
      (i) =>
        Boolean(i) && typeof i === 'object' &&
        typeof (i as OfflineManifestItem).url === 'string' &&
        typeof (i as OfflineManifestItem).sha256 === 'string' &&
        /^[a-f0-9]{64}$/.test((i as OfflineManifestItem).sha256),
    )
  );
}

export async function loadOfflineManifest(): Promise<OfflineManifest> {
  if (cachedManifest) return cachedManifest;
  const res = await fetch(withBase('data/offline-manifest.json'));
  if (!res.ok) {
    throw new Error(`No se pudo cargar el manifiesto offline (HTTP ${res.status}).`);
  }
  const parsed: unknown = await res.json().catch(() => null);
  if (!isManifest(parsed)) throw new Error('El manifiesto offline no cumple el contrato esperado.');
  cachedManifest = parsed;
  return parsed;
}

function absUrl(rel: string): string {
  return new URL(withBase(rel), self.location.origin).href;
}

export async function readOfflineState(): Promise<OfflineState | null> {
  if (typeof caches === 'undefined') return null;
  const meta = await caches.open(OFFLINE_META_CACHE);
  const res = await meta.match(OFFLINE_STATE_URL);
  if (!res) return null;
  try {
    const v = (await res.json()) as OfflineState;
    return typeof v.activeRevision === 'string' && typeof v.activeVersion === 'string' ? v : null;
  } catch {
    return null;
  }
}

async function writeOfflineState(state: OfflineState | null): Promise<void> {
  const meta = await caches.open(OFFLINE_META_CACHE);
  if (state === null) {
    await meta.delete(OFFLINE_STATE_URL);
    return;
  }
  await meta.put(
    OFFLINE_STATE_URL,
    new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } }),
  );
}

async function storageEstimate(): Promise<{ usageBytes: number | null; quotaBytes: number | null }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return { usageBytes: null, quotaBytes: null };
  try {
    const est = await navigator.storage.estimate();
    return {
      usageBytes: typeof est.usage === 'number' ? est.usage : null,
      quotaBytes: typeof est.quota === 'number' ? est.quota : null,
    };
  } catch {
    return { usageBytes: null, quotaBytes: null };
  }
}

/** Number of manifest URLs present in a cache. */
async function countPresent(cacheName: string, manifest: OfflineManifest): Promise<number> {
  if (!(await caches.has(cacheName))) return 0;
  const cache = await caches.open(cacheName);
  const keys = new Set((await cache.keys()).map((r) => r.url));
  let n = 0;
  for (const item of manifest.items) if (keys.has(absUrl(item.url))) n += 1;
  return n;
}

export async function getOfflineStatus(): Promise<OfflineStatus> {
  if (typeof caches === 'undefined') {
    return {
      supported: false,
      availability: 'unsupported',
      revision: null,
      activeRevision: null,
      cachedCount: 0,
      totalCount: 0,
      isComplete: false,
      usageBytes: null,
      quotaBytes: null,
    };
  }
  const { usageBytes, quotaBytes } = await storageEstimate();
  const state = await readOfflineState();
  let manifest: OfflineManifest | null = null;
  try {
    manifest = await loadOfflineManifest();
  } catch {
    manifest = null;
  }
  if (!manifest) {
    return {
      supported: true,
      availability: state ? 'stale' : 'none',
      revision: null,
      activeRevision: state?.activeRevision ?? null,
      cachedCount: 0,
      totalCount: 0,
      isComplete: false,
      usageBytes,
      quotaBytes,
    };
  }
  const totalCount = manifest.items.length;
  const cachedCount = await countPresent(cacheNameForVersion(manifest.version), manifest);
  const pointerCurrent = state?.activeRevision === manifest.revision;
  const isComplete = pointerCurrent && cachedCount === totalCount;
  let availability: OfflineAvailability;
  if (isComplete) availability = 'complete';
  else if (state && !pointerCurrent && (await caches.has(cacheNameForVersion(state.activeVersion)))) availability = 'stale';
  else availability = cachedCount > 0 ? 'partial' : 'none';
  return {
    supported: true,
    availability,
    revision: manifest.revision,
    activeRevision: state?.activeRevision ?? null,
    cachedCount,
    totalCount,
    isComplete,
    usageBytes,
    quotaBytes,
  };
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
}

/**
 * Download (or resume) the current manifest revision into its own cache.
 * With `onlyUrls`, only those manifest items are retried.
 */
export async function downloadCatalogOffline(
  onProgress: (progress: OfflineProgress) => void,
  signal: AbortSignal,
  onlyUrls?: string[],
): Promise<OfflineProgress> {
  const base: OfflineProgress = {
    total: 0,
    processed: 0,
    succeeded: 0,
    alreadyCached: 0,
    failed: 0,
    cancelled: 0,
    failedUrls: [],
    integrityFailures: [],
    currentPhase: 'preparing',
    quotaExceeded: false,
    errorMessage: null,
  };
  if (typeof caches === 'undefined') {
    const state: OfflineProgress = { ...base, currentPhase: 'error', errorMessage: 'Cache Storage no está disponible en este contexto de navegador.' };
    onProgress(state);
    return state;
  }
  onProgress(base);

  let manifest: OfflineManifest;
  try {
    manifest = await loadOfflineManifest();
  } catch (err) {
    const state: OfflineProgress = { ...base, currentPhase: 'error', errorMessage: err instanceof Error ? err.message : 'Error al preparar la lista offline.' };
    onProgress(state);
    return state;
  }

  const wanted = onlyUrls && onlyUrls.length > 0 ? new Set(onlyUrls) : null;
  const targets = wanted ? manifest.items.filter((i) => wanted.has(i.url)) : manifest.items;
  const cacheName = cacheNameForVersion(manifest.version);
  const cache = await caches.open(cacheName);
  const existing = new Set((await cache.keys()).map((r) => r.url));

  const p: OfflineProgress = { ...base, total: targets.length, currentPhase: 'downloading' };
  const pending: OfflineManifestItem[] = [];
  for (const item of targets) {
    if (existing.has(absUrl(item.url))) {
      p.alreadyCached += 1;
      p.processed += 1;
    } else {
      pending.push(item);
    }
  }

  let lastEmit = 0;
  const snapshot = (): OfflineProgress => ({ ...p, failedUrls: [...p.failedUrls], integrityFailures: [...p.integrityFailures] });
  const emit = (force = false) => {
    const now = performance.now();
    if (!force && now - lastEmit < 60) return;
    lastEmit = now;
    onProgress(snapshot());
  };
  emit(true);

  let cursor = 0;
  let stop = false;
  const concurrency = 12;

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      if (signal.aborted || stop) return;
      const item = pending[cursor];
      cursor += 1;
      if (!item) continue;
      const url = withBase(item.url);
      try {
        const response = await fetch(url, { signal, cache: 'no-cache', headers: { [OFFLINE_DOWNLOAD_HEADER]: '1' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.arrayBuffer();
        const digest = await sha256Hex(body);
        if (digest !== item.sha256) {
          p.integrityFailures.push(item.url);
          throw new Error('SHA-256 no coincide con el manifiesto');
        }
        const headers = new Headers();
        const type = response.headers.get('Content-Type');
        if (type) headers.set('Content-Type', type);
        headers.set('X-Atlas-Sha256', digest);
        try {
          await cache.put(url, new Response(body, { status: 200, headers }));
        } catch (putErr) {
          if (isQuotaError(putErr)) {
            p.quotaExceeded = true;
            stop = true;
          }
          throw putErr;
        }
        p.succeeded += 1;
        p.processed += 1;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        p.failed += 1;
        p.processed += 1;
        p.failedUrls.push(item.url);
      } finally {
        emit(false);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, () => worker()));
  p.cancelled = p.total - p.processed;

  if (signal.aborted) {
    p.currentPhase = 'cancelled';
    p.errorMessage = 'Descarga cancelada por el usuario. Los archivos ya guardados se conservan y la copia anterior completa sigue disponible.';
  } else if (p.quotaExceeded) {
    p.currentPhase = 'error';
    p.errorMessage = 'Se alcanzó el límite de almacenamiento del navegador antes de completar el paquete. La copia anterior completa, si existía, se conserva.';
  } else if (p.failed > 0) {
    p.currentPhase = 'error';
    p.errorMessage = `No se pudieron guardar ${p.failed} ${p.failed === 1 ? 'recurso' : 'recursos'}${p.integrityFailures.length > 0 ? ` (${p.integrityFailures.length} con SHA-256 distinto del manifiesto)` : ''}. Puedes reintentar los fallidos.`;
  } else {
    // Phase two: only a revision whose every item is present moves the pointer.
    const present = await countPresent(cacheName, manifest);
    if (present === manifest.items.length) {
      await writeOfflineState({
        activeRevision: manifest.revision,
        activeVersion: manifest.version,
        completedAt: new Date().toISOString(),
        totalFiles: manifest.items.length,
      });
      for (const key of await caches.keys()) {
        if (key.startsWith(OFFLINE_CACHE_PREFIX) && key !== cacheName && key !== OFFLINE_META_CACHE) await caches.delete(key);
      }
      p.currentPhase = 'complete';
    } else {
      p.currentPhase = 'error';
      p.errorMessage = `Faltan ${manifest.items.length - present} recursos obligatorios de esta revisión; la descarga no se declara completa.`;
    }
  }
  onProgress(snapshot());
  return p;
}

export interface IntegrityReport {
  checked: number;
  corrupted: string[];
  missing: number;
}

/**
 * Re-hash every cached item of the current revision against the manifest. Corrupt
 * entries are removed (a later download repairs them) and, if the revision was the
 * active one, the pointer is withdrawn so the UI no longer claims completeness.
 */
export async function verifyOfflineIntegrity(onProgress?: (checked: number, total: number) => void): Promise<IntegrityReport> {
  const manifest = await loadOfflineManifest();
  const cache = await caches.open(cacheNameForVersion(manifest.version));
  const corrupted: string[] = [];
  let checked = 0;
  let missing = 0;
  for (const item of manifest.items) {
    const res = await cache.match(withBase(item.url));
    if (!res) {
      missing += 1;
    } else {
      const digest = await sha256Hex(await res.arrayBuffer());
      if (digest !== item.sha256) {
        corrupted.push(item.url);
        await cache.delete(withBase(item.url));
      }
    }
    checked += 1;
    if (onProgress && checked % 250 === 0) onProgress(checked, manifest.items.length);
  }
  const state = await readOfflineState();
  if (corrupted.length > 0 && state?.activeRevision === manifest.revision) await writeOfflineState(null);
  onProgress?.(checked, manifest.items.length);
  return { checked, corrupted, missing };
}

/** Delete every offline copy and the runtime catalogue cache. Favorites (localStorage) are not touched. */
export async function clearOfflineCatalog(): Promise<void> {
  if (typeof caches === 'undefined') return;
  for (const key of await caches.keys()) {
    if (key.startsWith(OFFLINE_CACHE_PREFIX) || key === OFFLINE_META_CACHE || key === CATALOG_CACHE_NAME) {
      await caches.delete(key);
    }
  }
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
