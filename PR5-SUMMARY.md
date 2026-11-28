# PR #5 — Validador estructural, auditoría DOM y contratos HTML

**Rama:** `atlas/html-structure-pr5-advisory` (PR #5 hacia `main`)
**Baseline:** `main` = `1144dedd1b65fe3c9a844fc0519e3a441f931ba6`
**Estado:** publicado en PR #5; delta correctivo de auditoría (HTML5-01/02/03) incluido; **sin merge**
**Fecha:** 2026-11-27 (inicial) · 2026-11-28 (delta correctivo)

> **Sobre los SHA.** Este archivo no puede contener el SHA del commit que lo incluye. El SHA
> definitivo es el `head` del PR #5 en GitHub (`gh pr view 5 --json headRefOid`). Los SHA que
> aparecen aquí son la **baseline** (`1144dedd`) o commits **intermedios** ya superados, y se
> rotulan como tales.

---

## Qué entrega este PR

1. **Validador estructural** con 15 reglas, prioridades P1/P2/P3 y salida JSON, texto y Markdown.
   Tiene tres modos: advisory (por defecto), strict global y **certificación por targets**
   (`--targets-file`).
   Códigos de salida: 0 = OK, 1 = FAIL, 2 = error operativo.
2. **Auditoría DOM reproducible** de las 2.186 páginas con `node-html-parser@9.0.7`.
3. **Allowlist justificada** de 9 entradas `focus-visible`, con expiración y tests
   anti-regresión.
4. **Contratos HTML publicables**: plantillas reales en `scripts/contracts/`. Usan CSS
   embebido (Opción A, compatible con la CSP de documentos sin cambiarla) y rutas
   relativas calculadas por profundidad, comprobadas bajo `/` y `/evol-tool-atlas/`. El badge
   ATDS sale del resultado oficial, calculado en proceso.
5. **Plan piloto PR #6** (10 fichas + 1 índice) en `scripts/html-pilot-targets.json`. No se
   migra ninguna página en este PR; la certificación del piloto falla hoy por diseño.
6. **Advisory en CI**: un paso del workflow analiza las 2.186 páginas y publica el resumen del job.

---

## Gates (baseline real, no la obsoleta 391/22)

| Gate | Resultado |
|---|---|
| `npm run test:unit` | **667/667** (561 baseline + 51 del validador + 55 de certificación/contratos) |
| `npm run gate:atds` | **27/27** controles |
| `npm run validate:atds` | 2.137 herramientas; NONE 2.124 / L1 9 / L3 4 |
| `npm run check:release` | **PASS** completo, incluidos **12/12 E2E** |
| `verify-atlas.mjs` | 49 categorías, 2.137 herramientas, 741 excluidas, 0 enlaces rotos |
| `html-scan.mjs` | 2.186 archivos, **0 blocking** |
| Manifiesto offline | **6.672** entradas, revisión `08847af71c6e04eb…` |

---

## Hallazgos (2.186 páginas)

| Prioridad | Total | Reglas principales |
|---|---:|---|
| **P1** normativo HTML | **6.156** | `dl-valid` 6.156 |
| **P2** accesibilidad/navegación/contrato | **19.499** | `resource-links` 6.419; `header-footer-landmarks` 3.605; `main-id` 2.186; `skip-link` 2.186 (candidato WCAG, verificación manual); `nav-named` 1.268; `nav-present` 918; `section-heading` 765; `link-text` 726; `category-link` 604; `internal-link` 594; `focus-visible` 228 |
| **P3** contrato visual | **2.863** | `meta-description` 2.167; `no-inline-style` 696 |

Con allowlist en strict se suprimen 9 `focus-visible`: P2 = 19.490.

### Tres distinciones de navegación

- **604 fichas** no enlazan a su índice de categoría (`category-link`).
- **918 páginas** no tienen `<nav>` (`nav-present`).
- **1.268 páginas** tienen `<nav>` sin nombre accesible (`nav-named`).

`threat-dragon` es el control positivo: **sí** enlaza a
`../modelado-amenazas/index.html`, **no** tiene `<nav>` y por eso no dispara `nav-named`.

### Badge ATDS

El corpus legacy no tiene badges reales (0). La regla solo valida badges presentes contra
`reports/atds-validation.json`; no penaliza fichas sin badge.

---

## Por qué P1 solo contiene una regla

- `dl-valid`: `<dt>`/`<dd>` fuera de `<dl>` incumple WHATWG HTML.
- `skip-link` **no** es P1: WCAG 2.2 2.4.1 (A) exige *algún* mecanismo de bypass, y la
  ausencia de skip link no demuestra por sí sola un fallo (encabezados, landmarks u otro
  mecanismo documentado pueden satisfacerlo). Es P2 `wcag-candidate`, con verificación manual.

`header`/`footer` dentro de `main`, `main` sin `id`, `<nav>` sin nombre, `meta description`
y `style=""` son **HTML válido**. Se reportan como P2/P3, nunca como P1.

---

## Allowlist

9 entradas `focus-visible` del template legacy `pruebas-tecnicas/`, con `reason`,
`ticket: "PR #6"` y `expiresAt: "2027-03-31"`.

- P1 no se puede permitir (el loader lanza error).
- Solo suprime en strict; advisory reporta todo.
- Una entrada caducada no suprime nada.
- Un test verifica que cada archivo permitido **sigue** disparando la regla; si se arregla,
  hay que borrar la entrada.

---

## Contratos

`scripts/html-contracts.md` define:

- Ficha: skip link, `main#main-content`, `dl` válido, `<nav>` con nombre, enlace de categoría,
  badge ATDS oficial, recursos existentes, footer fuera de `main`.
- Índice: `<nav>` nombrado, `ul.tool-grid[role="list"]`, cards con `h3 > a`, badge ATDS.
- CSP por cabecera (no meta en estáticas), `script-src 'none'` en documentos.
- SHA-256 y manifiesto offline: PR #6 debe regenerarlos si cambia HTML.
- Base path `/evol-tool-atlas/` y rutas relativas.
- Identidad Fine Line Premium.

---

## Delta correctivo de auditoría (2026-11-28)

| Hallazgo | Corrección |
|---|---|
| **HTML5-01**: strict siempre procesaba las 2.186 páginas | `--targets-file` certifica solo los targets, contra **todas** las reglas obligatorias de su contrato (no solo P1) y sin allowlist. Una selección inválida aborta con exit 2; nunca se omite un target. Un badge ATDS discrepante bloquea (exit 1), y la falta de resultados ATDS es un error operativo (exit 2). El resto del corpus sigue en advisory. Tests positivos, negativos y de aislamiento sobre un árbol fixture |
| **HTML5-02**: contratos no publicables | Plantillas reales (`scripts/contracts/*.template.html`) y CSS embebido (Opción A; la Opción B se documenta como descartada, con sus requisitos). Desaparecen `shared/*.css` y las rutas fijas erróneas. Las 11 páginas piloto, renderizadas en sus rutas reales, pasan la certificación y el escáner de seguridad, con enlaces verificados bajo `/` y `/evol-tool-atlas/`. El ATDS se calcula en proceso (build limpio) |
| **HTML5-03**: advisory fuera de CI | Paso `HTML structure validation — ADVISORY` en `.github/workflows/ci.yml`, con resumen en `$GITHUB_STEP_SUMMARY`. Sin `\|\| true`. Exit 2 ante errores operativos |
| Evidencia confundible con el SHA final | `scripts/html-validation-results.json` ya no guarda `head` ni `generatedAt`; un test exige que coincida con el corpus recalculado |

## Inmutabilidad

Verificado con `git diff 1144dedd`: **sin cambios** en `catalogo.json`, `02-catalogo/`,
`docs/diseno/`, políticas ATDS, `scripts/atds-gate.mjs`, `scripts/verify-atlas.mjs`,
`scripts/lib/html-scan.mjs` ni `scripts/lib/security-headers.mjs` (CSP).
`scripts/copy-static-catalog.mjs` solo importa su lista de `scripts/lib/static-publish.mjs`
y copia exactamente los mismos elementos.

---

## Próximo paso

Revisión focalizada del delta correctivo sobre el `head` publicado del PR #5. **No se
fusiona** y **no se inicia PR #6 ni E3-02** sin aprobación.
