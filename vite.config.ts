import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const RAW_BASE = process.env.VITE_BASE_PATH ?? '/evol-tool-atlas/';
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`;
const WORKSPACE_ROOT = __dirname;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serveStaticCatalogDevPlugin(basePath: string): Plugin {
  const staticPrefixes = ['02-catalogo/', '05-referencias/', 'catalogo.json', 'SHA256SUMS.txt'];
  return {
    name: 'evol-serve-static-catalog-dev',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const rawUrl = req.url?.split('?')[0] ?? '';
        let rel = rawUrl;
        if (rel.startsWith(basePath)) {
          rel = rel.slice(basePath.length);
        } else if (rel.startsWith('/')) {
          rel = rel.slice(1);
        }
        if (!staticPrefixes.some((p) => rel === p || rel.startsWith(p))) {
          next();
          return;
        }
        const safeRel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
        const abs = path.resolve(WORKSPACE_ROOT, safeRel);
        if (!abs.startsWith(WORKSPACE_ROOT + path.sep) && abs !== WORKSPACE_ROOT) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        const candidate = fs.existsSync(abs) && fs.statSync(abs).isDirectory()
          ? path.join(abs, 'index.html')
          : abs;
        if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
          next();
          return;
        }
        const ext = path.extname(candidate).toLowerCase();
        res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
        fs.createReadStream(candidate).pipe(res);
      });
    },
  };
}

function productionCspPlugin(): Plugin {
  const cspContent = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    name: 'evol-production-csp',
    apply: 'build',
    transformIndexHtml(html: string) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}" />`,
      );
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    serveStaticCatalogDevPlugin(BASE),
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
