# Evol Tool Atlas

**Evol Tool Atlas** es una Progressive Web App (PWA) documental, instalable, responsive y utilizable sin conexión que organiza el catálogo completo de herramientas de seguridad y auditoría para **Evol OS**.

- **Categorías documentales:** 48
- **Fichas admitidas:** 2.127
- **Entradas excluidas documentadas en auditoría:** 741 (total corpus analizado: 2.868)
- **Identidad visual:** Sistema oficial **Evol OS — Minimal line art** (`14-minimal-line-art`, tipografías locales *Manrope* y *Atkinson Hyperlegible*, iconografía *Evol Fine Line* y glifo oficial *O*).

---

## Arquitectura técnica

- **Stack:** Vite + TypeScript estricto + `vite-plugin-pwa` (estrategia `injectManifest` con Workbox) + CSS modular alineado con los tokens DTCG oficiales.
- **Preservación documental:** Las rutas estáticas originales en `02-catalogo/` y `05-referencias/auditoria-v2.3.2/` se conservan íntegramente y se copian al directorio final `dist/` sin alterar los HTML individuales.
- **Generación de índices desde las fuentes:** `scripts/build-catalog-index.mjs` construye en tiempo de compilación:
  - `public/data/catalog-index.json` (índice compacto de búsqueda para 48 categorías y 2.127 fichas).
  - `public/data/categories/<slug>.json` (48 fragmentos por categoría con metadatos normalizados y exclusiones).
  - `public/data/offline-manifest.json` (lista ordenada de 2.224 recursos descargables bajo demanda).
- **Enrutamiento:** Hash routing (`#/`, `#/categorias`, `#/categoria/<slug>`, `#/buscar`, `#/herramienta/<id>`, `#/favoritos`, `#/offline`, `#/acerca`) compatible con publicación en subrutas de GitHub Pages (`/evol-tool-atlas/`) sin errores 404 al recargar.

---

## Cómo funciona el modo offline

1. **Instalación rápida:** Al instalar o abrir la PWA, el Service Worker (`src/sw.ts`) precarga únicamente el *App Shell* (HTML, CSS, JS, fuentes, iconos oficiales, `catalog-index.json` y `offline-manifest.json`). No descarga masivamente los más de 2.000 HTML durante el `install` para evitar fallos o bloqueos por cuota.
2. **Descarga explícita del catálogo completo:** Desde la vista **Centro offline** (`#/offline`), el usuario puede pulsar **«Guardar catálogo completo para uso sin conexión»** con barra de progreso en tiempo real, botón de **cancelación**, **reanudación** (omite archivos ya cacheados), **reintento de fallidos** y gestión de errores de cuota.
3. **Almacenamiento local:**
   - Las fichas offline se almacenan en `CacheStorage` (`evol-atlas-catalog-v1`).
   - Los favoritos y la preferencia de tema (`Sistema`, `Claro`, `Oscuro`) se guardan exclusivamente en `localStorage` sin cuentas, telemetría ni sincronización en nube.
4. **Actualizaciones controladas:** El Service Worker no ejecuta `skipWaiting()` automáticamente mientras el usuario consulta una ficha; muestra un aviso visible **«Actualizar ahora»** para aplicar la nueva versión bajo control del usuario sin perder favoritos.

---

## Seguridad y alcance documental

- **Solo documentación:** La inclusión de una ficha **no** implica instalación, compatibilidad ni validación funcional en CachyOS / Evol OS.
- **Sin ejecución ni instalaciones automáticas:** La aplicación no ejecuta binarios, comandos del sistema ni instaladores de herramientas del catálogo.
- **Política CSP estricta y renderizado seguro:** Construcción del DOM sin `innerHTML` sobre datos externos, validación estricta de URLs `http(s)` y rutas internas, y cabecera `<meta http-equiv="Content-Security-Policy">` en compilación de producción.

---

## Instalación local, desarrollo y compilación

Requisitos: Node.js 22+ y npm.

```bash
# 1. Instalar dependencias exactas
npm ci

# 2. Generar índices desde catalogo.json y metadata.json
npm run generate:data

# 3. Levantar entorno de desarrollo en /evol-tool-atlas/
npm run dev

# 4. Compilar versión de producción en ./dist (incluye copia de 02-catalogo y 05-referencias)
npm run build

# 5. Previsualizar build de producción bajo /evol-tool-atlas/
npm run preview
```

---

## Validación y pruebas

```bash
# Verificación integral: datos + TypeScript (app y SW) + ESLint + Vitest + build + auditoría de catálogo y marca
npm run check

# Pruebas end-to-end reales con Chromium (PWA, manifiesto, SW, offline real y responsive)
npm run test:e2e
```

---

## Despliegue en GitHub Pages

El repositorio incluye el workflow único `.github/workflows/deploy-pages.yml`:

1. Compila con `VITE_BASE_PATH=/evol-tool-atlas/`.
2. Ejecuta `generate:data`, `typecheck`, `lint`, `test:unit`, `build` y `verify:catalog`.
3. Publica el artefacto `./dist` en el entorno `github-pages` de `https://cucholambr3ta.github.io/evol-tool-atlas/`.

En la configuración del repositorio en GitHub (**Settings → Pages**), la fuente de publicación debe estar configurada como **GitHub Actions**.
