import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveBasePath } from './scripts/lib/base-path.mjs';
import { createDevStaticMiddleware } from './scripts/lib/dev-static.mjs';
import { APP_CSP_META, createSecurityHeadersMiddleware } from './scripts/lib/security-headers.mjs';

const BASE = resolveBasePath();
const WORKSPACE_ROOT = __dirname;

/** Dev server only: serves the static catalogue from the repository (SEC-DEV-01). */
function serveStaticCatalogDevPlugin(basePath: string): Plugin {
  return {
    name: 'evol-serve-static-catalog-dev',
    configureServer(server) {
      server.middlewares.use(createSecurityHeadersMiddleware(basePath, { documentsOnly: true }));
      server.middlewares.use(createDevStaticMiddleware(basePath, WORKSPACE_ROOT));
    },
  };
}

/**
 * Production hosting (`vite preview`, systemd service): HTTP security headers on every
 * response, including the static catalogue pages copied into dist/ (SEC-WEB-01).
 */
function securityHeadersPreviewPlugin(basePath: string): Plugin {
  return {
    name: 'evol-security-headers-preview',
    configurePreviewServer(server) {
      server.middlewares.use(createSecurityHeadersMiddleware(basePath));
    },
  };
}

/** Meta CSP for the SPA shell, for hosts that cannot send headers. */
function productionCspPlugin(): Plugin {
  return {
    name: 'evol-production-csp',
    apply: 'build',
    transformIndexHtml(html: string) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${APP_CSP_META}" />`,
      );
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    serveStaticCatalogDevPlugin(BASE),
    securityHeadersPreviewPlugin(BASE),
    productionCspPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      manifestFilename: 'manifest.webmanifest',
      includeManifestIcons: false,
      includeAssets: [],
      manifest: {
        id: BASE,
        name: 'Evol Tool Atlas',
        short_name: 'Evol Atlas',
        description:
          'Atlas documental navegable y disponible sin conexión de herramientas de seguridad y auditoría para Evol OS.',
        lang: 'es',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        start_url: BASE,
        scope: BASE,
        background_color: '#f6f3ed',
        theme_color: '#365568',
        categories: ['security', 'developer', 'reference', 'utilities'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: [
          'index.html',
          'assets/**/*.{js,css,svg,ttf,woff2}',
          'icons/*.{png,svg}',
          'data/catalog-index.json',
          'data/offline-manifest.json',
        ],
        globIgnores: ['02-catalogo/**', '05-referencias/**', 'data/categories/**'],
        dontCacheBustURLsMatching: /-[a-zA-Z0-9_-]{8}\.(js|css|ttf|woff2)$/,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
