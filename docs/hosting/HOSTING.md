# Hosting de Evol Tool Atlas y capacidades de seguridad (SEC-WEB-01, QA-03)

## Despliegue efectivo

| Elemento | Valor |
|---|---|
| Servidor | `vite preview` sobre `dist/`, como servicio de usuario systemd (`scripts/install-local.sh`) |
| Origen | `http://127.0.0.1:4173` (fijo: la PWA instalada depende de él) |
| Base path | `/evol-tool-atlas/` por defecto; `VITE_BASE_PATH` lo cambia (`scripts/lib/base-path.mjs`, única fuente) |
| CI | `.github/workflows/ci.yml` valida y prueba; **no publica** la app |

## Cabeceras HTTP

`vite.config.ts` (`securityHeadersPreviewPlugin`) añade a **todas** las respuestas de
`vite preview` las cabeceras de `scripts/lib/security-headers.mjs`:

| Ruta | Política CSP |
|---|---|
| SPA, `assets/`, `data/`, `sw.js`, manifest | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| `02-catalogo/`, `05-referencias/`, `skills/`, `docs/` | `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` |

Además: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` restrictiva.

- Las 2.186 páginas históricas usan bloques `<style>` en línea (verificado por
  `scripts/lib/html-scan.mjs`), por eso su política admite `style-src 'unsafe-inline'`
  y nada más: sin scripts, sin recursos remotos, sin formularios, sin marcos.
- La SPA conserva además la meta CSP en `index.html` (sin `frame-ancestors`, que los
  navegadores ignoran en meta).
- La página de respaldo offline que genera el Service Worker lleva su propia CSP.
- El servidor de desarrollo (`npm run dev`) solo sirve `02-catalogo/`, `05-referencias/`,
  `skills/`, `catalogo.json`, `SHA256SUMS.txt` y `docs/atds/ATDS-v1.md`, rechaza
  traversal, codificaciones ambiguas y symlinks (`scripts/lib/dev-static.mjs`) y aplica la
  política de documentos a esas rutas.

Verificación: `tests/e2e/post-e3-01.spec.ts` comprueba las cabeceras reales del
preview y que la SPA y una ficha estática se cargan sin violaciones CSP.

## Si se publicara en otro hosting

- **GitHub Pages:** no permite cabeceras propias. Solo quedaría la meta CSP de la SPA;
  `frame-ancestors` no podría imponerse y las páginas estáticas no tendrían CSP. No se
  debe afirmar la protección anterior en ese escenario. Mitigación realista: servir el
  Atlas desde un hosting con cabeceras (Netlify `_headers`, Cloudflare Pages, nginx) o
  mantener la distribución local actual.
- **Netlify / Cloudflare Pages / nginx:** trasladar las dos políticas de la tabla a su
  configuración de cabeceras por ruta y volver a ejecutar el E2E contra ese origen.
- **Base path:** probado en subruta (`/evol-tool-atlas/`) y en raíz (`VITE_BASE_PATH=/`:
  build, `verify:release` y E2E en verde durante la estabilización post-E3-01).
