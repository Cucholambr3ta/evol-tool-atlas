# EVOL Tool Atlas — Plan de remediación post-E3-01

Rama local: `atlas/estabilizacion-post-e3-01` (worktree `../evol-tool-atlas-estab`), creada desde
`origin/main` = `6a98bfb48fe3bd1945c007cfb0032f8e52b95d6a` (verificado con `git fetch` el 2026-11-27).
El árbol de trabajo original (`atlas/etapa-03-lote-01-categorias-minimas`) tiene archivos no
versionados del usuario (`docs/diseno/evol-tool-atlas-codigo-pwa-e3-01*`); no se tocan.

Matriz de hallazgos: [`POST-E3-01-MATRIZ-HALLAZGOS.md`](POST-E3-01-MATRIZ-HALLAZGOS.md).
Informe de cierre: [`POST-E3-01-INFORME-CIERRE.md`](POST-E3-01-INFORME-CIERRE.md).

## 1. Línea base (Fase 0)

| Elemento | Valor |
|---|---|
| Node / npm | v26.13.1 / 12.2.3 |
| TypeScript / Vite / Playwright | 5.9.3 / 6.4.6 / 1.65.1 |
| Navegador E2E | Chromium 158.0.8127.88 (`/usr/bin/chromium`, sistema) |
| `npm ci` | exit 0 (npm 12 no ejecuta el postinstall de esbuild; el binario de plataforma se instala igual y el build funciona) |
| `npm run check` | exit 0 — 356 pruebas unitarias, 22/22 controles STRICT, `verify:catalog` OK |
| `npm run test:e2e` | exit 0 — 4/4 |
| `sha256sum catalogo.json` | `bf279af87d037e4e904712c3047aac2bfd42e511d530940d335f54cae3410483` |
| Niveles ATDS (REPORT) | validados NONE 2124 · L1 9 · L3 4; candidatos L1 2121 · L3 11 · L4 5 |

## 2. Hosting real y capacidades

- **Despliegue efectivo:** servicio de usuario systemd creado por `scripts/install-local.sh`, que
  ejecuta `vite preview` sobre `dist/` en `http://127.0.0.1:4173/evol-tool-atlas/`. El CI
  (`.github/workflows/ci.yml`) no publica la app; no hay GitHub Pages ni Netlify configurados.
- **Cabeceras HTTP:** `vite preview` permite añadir cabeceras por respuesta mediante un
  middleware de `configurePreviewServer`. Es el mecanismo para aplicar la CSP a la SPA y a las
  páginas estáticas copiadas (`02-catalogo/`, `05-referencias/`, `skills/`).
- **Base path:** `/evol-tool-atlas/` por defecto; `VITE_BASE_PATH` lo sustituye.
- **Si se publicara en GitHub Pages:** no admite cabeceras propias. Solo la meta CSP de
  `index.html` protegería la SPA; `frame-ancestors` no puede imponerse con meta, y las páginas
  estáticas quedarían sin CSP. Se documenta como limitación (ver `docs/hosting/HOSTING.md`), sin
  afirmar protección.

## 3. Fases y orden de ejecución

Cada defecto confirmado sigue: prueba roja → corrección focalizada → prueba verde. Un commit
temático por bloque coherente. Sin dependencias nuevas.

| Fase | Bloques | Gate |
|---|---|---|
| F1 Seguridad y motor ATDS | SEC-DEV-01, ROUTER-01, SEC-WEB-01, SEC-DATA-01, SEC-SVG-01, ATDS-ROB-01/02, ATDS-11..15, ATDS-L3-01 | fixtures E2/E3 positivas + negativas L4 nuevas; router y servidor dev resistentes; CSP evaluada en el hosting real; corpus sin cambios |
| F2 Contrato ATDS→PWA | ATDS-UI-01..06, ATDS-PUBLISH-01 | ficha con datos ATDS oficiales; E3-01 ≥ L3; ninguna evidencia no acreditada presentada como acreditada |
| F3 Offline y consistencia | OFF-01..05, FAV-01, DATA-02, OFF-VERIFY-01 | descarga completa/parcial/cancelada, revisión nueva, corrupción, offline real, manifiesto contra `dist/` |
| F4 Accesibilidad y UX | A11Y-01..04, UX-01..03, DOC-01 | Playwright de teclado, foco, drawer, progreso, migas, 404, tema oscuro, zoom/reflow |
| F5 Build y certificación | QA-01..04, SEC-STATIC-01, métricas | `check:release` de extremo a extremo con E2E sobre el artefacto de producción |

## 4. Reglas que no cambian

- 49 categorías / 2.137 admitidas / 741 excluidas / 2.878 entradas. `catalogo.json`, las fichas,
  sus evidencias, hashes, fuentes y fechas no se modifican.
- threat-dragon, sagan, nfcutils y secure-delete siguen en L3 validado; nada se promueve a L4.
- Las políticas `scripts/atds-strict-policy.json` (E2) y `scripts/atds-lote-e3-01-policy.json`
  se conservan sin cambios; los controles existentes del gate se mantienen y se amplían.
- Los `index.html` de las fichas no se rediseñan ni se editan; sus hallazgos se registran para
  una auditoría separada.
- No se publica, no se abre PR, no se fusiona y no se hace force-push sin autorización.
