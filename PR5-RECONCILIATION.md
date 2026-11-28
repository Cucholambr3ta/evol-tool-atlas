# PR #5 — Informe de Reconciliación y Evidencia Verificable

**Rama:** `atlas/etapa-03-lote-01-categorias-minimas`
**Baseline oficial:** `main` = `1144dedd1b65fe3c9a844fc0519e3a441f931ba6` (PR #4, estabilización post-E3-01)
**Estado:** trabajo local verificado; **sin push, sin PR abierto, sin merge**
**Fecha de ejecución:** 2026-11-27
**Entorno:** Node `v26.13.1`, npm `12.2.3`, `node-html-parser@9.0.7`

---

## 1. Alcance y corrección de la baseline

La revisión anterior se hizo sobre una baseline obsoleta (`c543fe86`, main `6517ec4e`) y reportó
**391 tests / 22 controles ATDS**. Esas cifras **no corresponden** a la baseline aprobada.

| Dato | Valor obsoleto | Baseline real `1144dedd` |
|---|---|---|
| `main` | `6517ec4e` (PR #1) | **`1144dedd`** (PR #4) |
| Tests unitarios | 391 | **561** (16 archivos) |
| Controles ATDS | 22/22 | **27/27** |
| Gate de release | `npm run check` | **`npm run check:release`** = `check && verify:release && test:e2e` |

La rama se fast-forwardeó de `c543fe86` a `1144dedd` conservando todo el trabajo local de PR #5.
La baseline se verificó limpia antes de añadir los entregables: `561/561` tests y `27/27`
controles.

---

## 2. Entregables

### Archivos nuevos

| Archivo | Propósito |
|---|---|
| `scripts/lib/html-structure.mjs` | Implementación real de las 15 reglas, contexto, allowlist y resúmenes (API exportada y testeable) |
| `scripts/lib/html-structure.d.mts` | Tipos para los tests TypeScript |
| `scripts/validate-html-structure.mjs` | CLI advisory/strict, JSON + texto, ejecuta también `html-scan.mjs` |
| `scripts/audit-html-structure.mjs` | Auditoría DOM reproducible de las 2.186 páginas |
| `scripts/html-validation-allowlist.json` | 9 entradas `focus-visible` con `reason`, `ticket`, `expiresAt` |
| `scripts/html-audit-results.json` | Inventario por archivo (métricas DOM) |
| `scripts/html-validation-results.json` | Resultado compacto del validador (schema v2; agregados por regla/archivo; el detalle completo se regenera sin `--compact`) |
| `scripts/html-contracts.md` | Contratos canónicos, clasificación P1/P2/P3 y plan piloto |
| `tests/unit/html-structure.test.ts` | 51 tests que importan las reglas reales |
| `PR5-SUMMARY.md` / `PR5-RECONCILIATION.md` | Resumen y este informe |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `package.json` | `node-html-parser@^9.0.7` en `devDependencies`; scripts `validate:html`, `audit:html`, `test:html` |
| `package-lock.json` | Resolución de la dependencia |

**Sin cambios (verificado con `git diff 1144dedd`):** `catalogo.json`, `02-catalogo/**`,
`docs/diseno/`, políticas ATDS, `scripts/atds-gate.mjs`, `scripts/verify-atlas.mjs`,
`scripts/lib/html-scan.mjs`.

---

## 3. Reconciliación de la clasificación (P1 / P2 / P3)

La revisión exigió no etiquetar como P1 nada que sea HTML válido. La versión anterior lo hacía
mal: contaba `header`/`footer` dentro de `main`, `main` sin `id`, `<nav>` sin nombre y
`meta description` como errores. La versión actual los reclasifica.

| Prioridad | Categoría | Reglas |
|---|---|---|
| **P1** | `normative-html` | `dl-valid` |
| **P2** | `wcag-candidate` | `skip-link` |
| **P2** | `recommendation` | `nav-present`, `nav-named`, `main-id`, `header-footer-landmarks`, `internal-link`, `category-link`, `resource-links`, `section-heading`, `focus-visible`, `link-text` |
| **P2** | `contract-integrity` | `atds-badge` |
| **P3** | `visual-contract` | `meta-description`, `no-inline-style` |

Justificación de los traslados:

- `header`/`footer` dentro de `main` es **HTML válido**; solo pierde el rol implícito
  `banner`/`contentinfo`. Es P2.
- `<main>` sin `id` es **HTML válido**. El `id` es una recomendación para el skip link. Es P2.
- `<nav>` sin `aria-label` es una **recomendación WAI-ARIA**, no un fallo de conformidad HTML. Es P2.
- `meta description` y `style=""` son convenciones de publicación/contrato visual. Son P3.
- `dl-valid` sí es inválido: `<dt>`/`<dd>` fuera de `<dl>` incumple el content model de WHATWG.
- `skip-link` es P2 (`wcag-candidate`): WCAG 2.4.1 exige *algún* mecanismo de bypass, pero su
  ausencia no demuestra por sí sola un fallo. Encabezados, landmarks u otro mecanismo
  documentado pueden satisfacerlo; el mensaje pide verificación manual.

---

## 4. Auditoría DOM real (2.186 páginas)

Parser: `node-html-parser@9.0.7` (árbol DOM, no regex). Corpus: **2.186 archivos**
(2.137 fichas + 49 índices).

### 4.1 Conteo por regla

| Regla | Prioridad | Hallazgos | Archivos |
|---|---:|---:|---:|
| `resource-links` | P2 | 6.419 | 2.127+ |
| `dl-valid` | **P1** | 6.156 | 772 |
| `header-footer-landmarks` | P2 | 3.605 | 1.419 headers + 2.186 footers |
| `skip-link` | P2 | 2.186 | 2.186 |
| `main-id` | P2 | 2.186 | 2.186 |
| `meta-description` | P3 | 2.167 | 2.167 (solo 19 páginas la tienen) |
| `nav-named` | P2 | 1.268 | 1.268 |
| `nav-present` | P2 | 918 | 918 |
| `section-heading` | P2 | 765 | 749 |
| `link-text` | P2 | 726 | 720 |
| `no-inline-style` | P3 | 696 | 3 |
| `category-link` | P2 | 604 | 604 |
| `internal-link` | P2 | 594 | 594 |
| `focus-visible` | P2 | 228 | 228 |
| `atds-badge` | P2 | 0 | 0 (no hay badges reales en el corpus) |

**Totales:** P1 = **6.156**, P2 = **19.499**, P3 = **2.863**, total **28.518**.
Con allowlist en strict se suprimen exactamente 9 `focus-visible`: P2 = 19.490, total 28.509.

> `header-footer-landmarks` genera 3.605 hallazgos porque cuenta cada `<header>` y cada
> `<footer>` dentro de `main` (1.419 + 2.186), no porque haya 3.605 archivos afectados.

### 4.2 Las tres preguntas de navegación, separadas

| Pregunta | Regla | Resultado |
|---|---|---:|
| ¿La ficha enlaza a su índice de categoría? | `category-link` | **604 fichas sin enlace** |
| ¿La página tiene navegación semántica `<nav>`? | `nav-present` | **918 páginas sin `<nav>`** |
| ¿El `<nav>` existente tiene nombre accesible? | `nav-named` | **1.268 páginas con `<nav>` sin nombre** |

No se suman ni se sustituyen entre sí. Una página sin `<nav>` no dispara `nav-named`; una
página con `<nav>` sin nombre no dispara `nav-present`.

### 4.3 Verificación específica de `threat-dragon`

- `catalogo.json`: `cat: 2` → categoría `modelado-amenazas` →
  `href: 02-catalogo/seguridad/catalogo/modelado-amenazas/index.html`.
- La ficha contiene `<a href="../modelado-amenazas/index.html">Volver al índice de la categoría</a>`.
- `resolveLocalHref()` produce exactamente ese `href`.
- Resultado: **`category-link` = OK**; **`nav-present` = hallazgo** (no tiene `<nav>`);
  **`nav-named` = sin hallazgo** (no hay `<nav>` que nombrar).

Esto demuestra las tres distinciones: enlace de categoría presente, navegación semántica
ausente, y nombre accesible no aplicable.

### 4.4 Badge ATDS

El corpus histórico **no contiene badges ATDS reales** (0 elementos con
`data-atds-validated`, `data-atds-candidate`, `.atds-badge`). Por eso `atds-badge` reporta 0.
La regla solo comprueba badges **presentes** y los compara con
`reports/atds-validation.json` (`id`, `level`, `candidateLevel`); las fichas legacy sin badge
no se penalizan. Los tests cubren un badge correcto, uno incorrecto y la ausencia de badge.

---

## 5. Allowlist: justificación y anti-regresión

`scripts/html-validation-allowlist.json` contiene **9 entradas**, todas
`focus-visible` del template legacy `pruebas-tecnicas/`, con `reason`, `ticket: "PR #6"` y
`expiresAt: "2027-03-31"`.

Garantías implementadas y testeadas:

1. Una regla **P1 nunca se puede permitir**: `loadAllowlist()` lanza error.
2. Solo suprime en **strict**; advisory reporta las 228 y marca las 9 como `allowed`.
3. Una entrada **caducada no suprime nada**.
4. El test comprueba que **cada archivo permitido sigue disparando la regla**; si se arregla,
   el test falla y obliga a borrar la entrada.
5. El loader exige archivo existente, regla conocida, `expiresAt` válido y ausencia de duplicados.
6. Los tests importan `RULES`, `validateHtml()` y `applyAllowlist()` reales; no duplican lógica.

Resultado: advisory `focus-visible` = 228; strict = 219 (9 suprimidas).

---

## 6. Compatibilidad con la baseline real

| Componente | Baseline `1144dedd` | Trato en PR #5 |
|---|---|---|
| `scripts/lib/html-scan.mjs` | Escáner de seguridad bloqueante | **Intacto**; el validador lo ejecuta y reporta `0 blocking` |
| `scripts/verify-atlas.mjs` | Gate de seguridad, enlaces, marca y `dist/` | **Intacto**; se ejecuta en `check:release` |
| `scripts/atds-gate.mjs` | 27/27 controles | **Intacto**; 27/27 en la entrega |
| `reports/atds-validation.json` | `report.tools[]` con `id`, `level`, `candidateLevel` | Única fuente del badge |
| `build-catalog-index.mjs` | Ya publica `tool.atds.validatedLevel` / `candidateLevel` | Se reutiliza; no se duplica lógica |
| CSP | **Por cabecera** (`scripts/lib/security-headers.mjs`): APP y DOCUMENT | No se inyecta `<meta>` CSP; `frame-ancestors` se ignora en meta |
| CSP documentos | `script-src 'none'; style-src 'unsafe-inline'` | Los `<style>` legados son compatibles; `style=""` es P3 |
| SHA-256 | `SHA256SUMS.txt` raíz + por herramienta; copiado a `dist/` | PR #5 no toca HTML; no hay que regenerar |
| Manifiesto offline | **6.672** entradas; revisión `08847af71c6e04eb…` derivada del contenido | PR #5 no lo modifica |
| Base path | `/evol-tool-atlas/` (`scripts/lib/base-path.mjs`) | Los contratos usan rutas relativas o `BASE_URL` |
| Identidad | Fine Line Premium, Manrope + Atkinson Hyperlegible | `verify-atlas.mjs` la valida sin cambios |

---

## 7. Evidencia de ejecución

```bash
$ git rev-parse HEAD
1144dedd1b65fe3c9a844fc0519e3a441f931ba6

$ git rev-parse origin/main
1144dedd1b65fe3c9a844fc0519e3a441f931ba6

$ node -v && npm -v
v26.13.1
12.2.3

$ npm run test:unit
Test Files  17 passed (17)
Tests       612 passed (612)        # 561 baseline + 51 nuevos

$ npm run gate:atds
[ATDS-GATE] 27/27 controles con el código de salida esperado.

$ npm run validate:atds
2137 herramientas evaluadas (NONE 2124, L1 9, L3 4; candidato L1 2121, L3 11, L4 5)

$ npm run check:release
ALL VERIFICATIONS PASSED: 49 categories, 2137 tools, 741 excluded, 0 broken links,
0 forbidden mentions, official Evol branding verified.
...
12 passed (1.9m)
```

`npm run check:release` = `check` + `verify:release` + `test:e2e`. Pasó completo:
generate:data, typecheck, lint, 612 tests, ATDS, build, verify:catalog, verify:release y
**12/12 E2E** (CSP, router, ATDS UI, accesibilidad, offline, PWA).

> Nota de entorno: en la primera ejecución E2E falló únicamente porque faltaba el binario de
> Chromium (`npx playwright install chromium`). Tras instalarlo, los 12 tests pasaron. No fue
> un fallo del código.

### Validador

```bash
$ node scripts/validate-html-structure.mjs --strict
Mode: strict
Parser: node-html-parser@9.0.7
Corpus: 2186 files (2137 fichas, 49 indices)
Security scan (scripts/lib/html-scan.mjs): 2186 files, 0 blocking, 2186 advisory
Total findings: 28509
  P1 normative HTML (error): 6156
  P2 accessibility/navigation/contract (warn): 19490
  P3 visual/publication contract (warn): 2863
  ...
  entries: 9, expired: 0, suppressed in strict: 9
[VALIDATE] strict gate: P1=6156, security blocking=0, expired allowlist=0
[VALIDATE] WOULD FAIL (strict without --fail-on-error; no exit code set)
```

El validador es **advisory por defecto** y **no forma parte de `check:release`**. El modo
strict no bloquea el release por los defectos históricos aún no migrados.
`--strict --fail-on-error` falla hoy porque el corpus sin migrar conserva 6.156 hallazgos P1
(`dl-valid`); ese es el estado real y no se oculta. El gate bloqueante de release sigue siendo
`verify-atlas.mjs` + `html-scan.mjs`, que reportan **0 blocking**. El modo strict está pensado
para el piloto de PR #6, no para bloquear el corpus legacy en este PR.

---

## 8. Inmutabilidad verificada

```bash
$ git diff --stat 1144dedd -- catalogo.json 02-catalogo docs/diseno \
    scripts/atds-gate.mjs scripts/verify-atlas.mjs scripts/lib/html-scan.mjs
(no output)
```

También se verificó que `scripts/lib/html-scan.mjs` sigue importado y llamado por
`scripts/verify-atlas.mjs` (`scanStaticTree`), y un test comprueba que sigue bloqueando
`<script>`, `onerror` y recursos remotos.

---

## 9. SHA final y solicitud de autorización

**SHA de baseline:** `1144dedd1b65fe3c9a844fc0519e3a441f931ba6`
**Diff:** solo los archivos nuevos listados en §2 + `package.json`/`package-lock.json`.
**Nada publicado:** no hay push, no hay PR #5 abierto, no hay merge, no se inició PR #6 ni E3-02.

El commit local de PR #5 se crea sobre `1144dedd` como parte de la entrega; su SHA se reporta
en la conversación. Solicito autorización para:

1. Publicar la rama y abrir **PR #5** hacia `main`.
2. Mantener el merge y el piloto PR #6 a la espera de revisión humana.
