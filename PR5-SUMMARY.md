# PR #5 — Validador estructural, auditoría DOM y contratos HTML

**Rama:** `atlas/etapa-03-lote-01-categorias-minimas`
**Baseline:** `main` = `1144dedd1b65fe3c9a844fc0519e3a441f931ba6`
**Estado:** verificado localmente; **sin push, sin PR, sin merge**
**Fecha:** 2026-11-27

---

## Qué entrega este PR

1. **Validador estructural advisory/strict** con 15 reglas, códigos estables, salida JSON y
   texto, prioridades P1/P2/P3 y conteo por regla.
2. **Auditoría DOM reproducible** de las 2.186 páginas con `node-html-parser@9.0.7`.
3. **Allowlist justificada** de 9 entradas `focus-visible`, con expiración y tests
   anti-regresión.
4. **Contratos HTML canónicos** para ficha e índice, compatibles con la CSP por cabecera,
   SHA-256, manifiesto offline, base path y Fine Line Premium.
5. **Plan piloto PR #6** (10 fichas + 1 índice). No se migra ninguna página en este PR.

---

## Gates (baseline real, no la obsoleta 391/22)

| Gate | Resultado |
|---|---|
| `npm run test:unit` | **612/612** (561 baseline + 51 nuevos) |
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

## Inmutabilidad

Verificado con `git diff 1144dedd`: **sin cambios** en `catalogo.json`, `02-catalogo/`,
`docs/diseno/`, políticas ATDS, `scripts/atds-gate.mjs`, `scripts/verify-atlas.mjs` ni
`scripts/lib/html-scan.mjs`.

---

## Próximo paso

Revisión humana de este PR #5. El commit local se crea sobre `1144dedd` como parte de la
entrega; tras autorización se publica la rama y se abre el PR. **No se fusiona** y **no se
inicia PR #6 ni E3-02** sin aprobación.
