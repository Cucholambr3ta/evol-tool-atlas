/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

const CATALOG_CACHE_NAME = 'evol-atlas-catalog-v1';
const NETWORK_TIMEOUT_MS = 4000;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

function getBasePath(): string {
  const scopeUrl = new URL(self.registration.scope);
  return scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
}

function buildOfflineFallbackHtml(basePath: string, targetPath: string): string {
  const escapedTarget = targetPath
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>Contenido no disponible sin conexión · Evol Tool Atlas</title>
  <style>
    :root {
      color-scheme: light dark;
      --canvas: #f6f3ed;
      --surface: #fffdf7;
      --text: #30383c;
      --muted: #4d4b48;
      --accent: #365568;
      --on-accent: #ffffff;
      --border: #9b8793;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --canvas: #191b1e;
        --surface: #27292d;
        --text: #faf8f0;
        --muted: #ccc9c1;
        --accent: #f6f3ed;
        --on-accent: #30383c;
        --border: #a98a9f;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--canvas);
      color: var(--text);
      font: 14px/1.6 "Atkinson Hyperlegible", system-ui, sans-serif;
    }
    main {
      width: min(560px, 100%);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 28px;
    }
    h1 {
      margin: 0 0 10px;
      font: 700 1.45rem/1.2 "Manrope", system-ui, sans-serif;
    }
    p { margin: 0 0 14px; color: var(--muted); }
    code { word-break: break-all; color: var(--text); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    a {
      display: inline-flex;
      align-items: center;
      padding: 10px 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      text-decoration: none;
      font-weight: 600;
      color: var(--text);
    }
    a.primary {
      background: var(--accent);
      color: var(--on-accent);
      border-color: var(--accent);
    }
  </style>
</head>
<body>
  <main>
    <h1>Contenido no disponible sin conexión</h1>
    <p>Este documento del catálogo todavía no se ha guardado en el almacenamiento local del navegador:</p>
    <p><code>${escapedTarget}</code></p>
    <p>Conéctate a la red o abre el gestor offline para descargar el catálogo documental completo.</p>
    <div class="actions">
      <a class="primary" href="${basePath}#/offline">Abrir centro offline</a>
      <a href="${basePath}">Volver a Evol Tool Atlas</a>
    </div>
  </main>
</body>
</html>`;
}

self.addEventListener('activate', (event) => {
  clientsClaim();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('evol-atlas-catalog-') && key !== CATALOG_CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener('message', (event) => {
  const payload = event.data as { type?: string } | null;
  if (payload && payload.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// Serve catalog JSON shards, static reference reports, and individual HTML sheets from CacheStorage
registerRoute(
  ({ url, sameOrigin }) => {
    if (!sameOrigin) return false;
    const base = getBasePath();
    const rel = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
    return (
      rel.startsWith('data/categories/') ||
      rel.startsWith('02-catalogo/') ||
      rel.startsWith('05-referencias/') ||
      rel === 'catalogo.json' ||
      rel === 'SHA256SUMS.txt'
    );
  },
  async ({ request, url }) => {
    // Network-first: the catalog is served by the local service, so a live copy is
    // always preferred (keeps catalog updates visible) and refreshes the cache.
    // The cached copy is used only when the server is unreachable (offline mode).
    const cache = await caches.open(CATALOG_CACHE_NAME);
    try {
      const response = await fetch(request, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      if (response.ok && response.status === 200) {
        try {
          await cache.put(request, response.clone());
        } catch {
          // Recover gracefully if storage quota is full; still deliver live response.
        }
        return response;
      }
      const cachedOnError = await cache.match(request);
      return cachedOnError ?? response;
    } catch {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      const base = getBasePath();
      const accept = request.headers.get('accept') ?? '';
      if (accept.includes('text/html') || url.pathname.endsWith('.html')) {
        return new Response(buildOfflineFallbackHtml(base, url.pathname), {
          status: 503,
          statusText: 'Offline Unavailable',
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response(
        JSON.stringify({
          error: 'offline_unavailable',
          message: 'Recurso no disponible en caché local sin conexión.',
          path: url.pathname,
        }),
        {
          status: 503,
          statusText: 'Offline Unavailable',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      );
    }
  },
);

// App shell navigation handler (never hijacks static 02-catalogo or 05-referencias pages)
const basePath = getBasePath();
const shellHandler = createHandlerBoundToURL(`${basePath}index.html`);
const navigationRoute = new NavigationRoute(shellHandler, {
  denylist: [
    /\/02-catalogo\//,
    /\/05-referencias\//,
    /\/catalogo\.json$/,
    /\/SHA256SUMS\.txt$/,
  ],
});
registerRoute(navigationRoute);
