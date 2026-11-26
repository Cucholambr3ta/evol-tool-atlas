# Evol Tool Atlas

**Evol Tool Atlas** es una Progressive Web App (PWA) documental, instalable, responsive y utilizable sin conexión que organiza el catálogo completo de herramientas de seguridad y auditoría para **Evol OS**.

- **Categorías documentales:** 49
- **Fichas admitidas:** 2.137
- **Entradas excluidas documentadas en auditoría:** 741 (total corpus analizado: 2.878)
- **Ampliación 2026-11-25:** 12 fichas de pruebas y auditoría técnica (AT-SEC-001…AT-SEC-012), con guía, skill, casos de uso y evidencias.
- **Identidad visual:** Sistema oficial **Evol OS — Minimal line art** (`14-minimal-line-art`, tipografías locales *Manrope* y *Atkinson Hyperlegible*, iconografía *Evol Fine Line* y glifo oficial *O*).

---

## Arquitectura técnica

- **Stack:** Vite + TypeScript estricto + `vite-plugin-pwa` (estrategia `injectManifest` con Workbox) + CSS modular alineado con los tokens DTCG oficiales.
- **Preservación documental:** Las rutas estáticas originales en `02-catalogo/` y `05-referencias/auditoria-v2.3.2/` se conservan íntegramente y se copian al directorio final `dist/` sin alterar los HTML individuales.
- **Contrato MCP de solo lectura:** Documentado en `05-referencias/mcp/CONTRATO-MCP-READONLY.md`; no existe servidor MCP implementado en este repositorio.
- **Generación de índices desde las fuentes:** `scripts/build-catalog-index.mjs` construye en tiempo de compilación:
  - `public/data/catalog-index.json` (índice compacto de búsqueda para 49 categorías y 2.137 fichas).
  - `public/data/categories/<slug>.json` (49 fragmentos por categoría con metadatos normalizados y exclusiones).
  - `public/data/offline-manifest.json` (lista ordenada de 2.284 recursos descargables bajo demanda, incluidos guías, skills, casos de uso y evidencias de las 12 fichas ampliadas).
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

## Instalar la PWA en un equipo (recomendado)

Requisitos: Linux con systemd, Git, Node.js 22+ y npm (`sudo pacman -S git nodejs npm`), y un navegador Chromium (Chrome, Chromium, Brave o Edge). El repositorio es privado: inicia sesión antes con `gh auth login` y `gh auth setup-git`.

```bash
git clone https://github.com/Cucholambr3ta/evol-tool-atlas.git
cd evol-tool-atlas
./scripts/install-local.sh
```

El script instala dependencias, compila la versión de producción y crea el servicio de usuario systemd `evol-tool-atlas`, que sirve la app en **http://127.0.0.1:4173/evol-tool-atlas/** y arranca solo al iniciar sesión. Abre esa dirección y pulsa el icono de **Instalar** en la barra de direcciones. La dirección no debe cambiar: la PWA instalada depende de ese origen exacto.

- **Actualizar:** `git pull && ./scripts/install-local.sh`
- **Estado / registros:** `systemctl --user status evol-tool-atlas` · `journalctl --user -u evol-tool-atlas -n 50`
- **Quitar el servicio:** `./scripts/install-local.sh --uninstall` (la PWA se desinstala desde el navegador).

### Cómo llegan las actualizaciones

1. Se modifica el contenido (`catalogo.json`, fichas de `02-catalogo/`, etc.) o el código en un equipo, se valida con `npm run check` y se hace `git commit` + `git push`.
2. En cada equipo: `git pull && ./scripts/install-local.sh` (recompila y reinicia el servicio).
3. Al abrir la PWA aparece el aviso **«Hay una nueva versión de Evol Tool Atlas…»**; al aceptarlo se activa la nueva versión. Favoritos y descargas offline se conservan.

Las fichas y categorías se piden siempre primero al servicio local (*network-first*), así que se ve la versión actual y la copia offline se refresca al abrirlas. La copia guardada solo se usa sin conexión. Para refrescar de una vez todas las fichas descargadas, pulsa **«Borrar copia offline»** en el centro offline (`#/offline`) y vuelve a descargarla.

Una vez instalada, el *App Shell* y el índice funcionan sin conexión aunque el servicio esté detenido; las fichas que no hayas descargado para uso offline necesitan el servicio activo.

---

## Desarrollo y compilación

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

# Pruebas end-to-end reales con Chromium (PWA, manifiesto, SW, offline real y responsive).
# Usan el puerto 4174 para no chocar con el servicio local en 4173.
npm run test:e2e
```

---

## Integración continua

El workflow `.github/workflows/ci.yml` se ejecuta en cada push y pull request a `main`: `generate:data`, `typecheck`, `lint`, `test:unit`, `build` y `verify:catalog`. No publica la app en ningún sitio: la distribución es local mediante `scripts/install-local.sh`.
