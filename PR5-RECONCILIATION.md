# PR #5 — Informe de Reconciliación y Evidencia Verificable

**Rama:** `atlas/etapa-03-lote-01-categorias-minimas`
**Baseline oficial:** `main` = `1144dedd1b65fe3c9a844fc0519e3a441f931ba6` (PR #4, estabilización post-E3-01)

> **Sobre los SHA.** Este archivo no puede contener el SHA del commit que lo incluye. El SHA
> definitivo es el `head` del PR #5 en GitHub (`gh pr view 5 --json headRefOid`). Los SHA que
> aparecen aquí son la **baseline** (`1144dedd`) o commits **intermedios** ya superados, y se
> rotulan como tales.
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
| `scripts/html-validation-results.json` | Resultado compacto del validador (schema v3; agregados por regla/archivo, sin marca de tiempo ni SHA; el detalle completo se obtiene con `--output`) |
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

## 7. Evidencia de ejecución (entrega inicial, histórica)

> Esta sección reproduce la evidencia de la **entrega inicial** (antes de la auditoría). La
> evidencia vigente del delta correctivo está en el §10.

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
`verify-atlas.mjs` + `html-scan.mjs`, que reportan **0 blocking**. El piloto de PR #6 no se
certifica con strict global, sino con `--targets-file` (§10).

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

## 9. Publicación

PR #5 se publicó desde la rama nueva `atlas/html-structure-pr5-advisory`; la rama
`atlas/etapa-03-lote-01-categorias-minimas` no se reutilizó. Historial sobre `1144dedd`:

| Commit (intermedio) | Contenido |
|---|---|
| `47dc06e3` | Validador, auditoría y contratos (entrega inicial) |
| `c7c63d3f` | `skip-link` pasa a P2 `wcag-candidate` |
| `11b6efcf` | Los tests no dependen de `reports/atds-validation.json` |
| `14912fe7` | Directorio temporal por ejecución en los tests (CI en verde) |
| *head del PR* | Delta correctivo HTML5-01/02/03 (§10) |

---

## 10. Delta correctivo de auditoría (HTML5-01 / HTML5-02 / HTML5-03)

Dictamen de la auditoría independiente sobre `14912fe7`: NO-GO temporal por tres hallazgos.

### HTML5-01 — Certificación del piloto

- `scripts/lib/html-contract.mjs`: `CONTRACTS` (`ficha`, `category-index`) clasifica **cada**
  regla del validador como obligatoria o no aplicable, y añade comprobaciones de contrato
  (`single-h1`, `h1-matches-catalog`, `atds-badge-required`, `no-external-stylesheet`,
  `no-web-fonts`, `external-link-rel`, `local-links-resolve`, `tool-grid-list`,
  `links-every-tool`, `card-badges-match-atds`).
- `--targets-file=<json>` (schema `evol-tool-atlas/html-certification-targets/1`) y
  `expectedCount` obligatorio. Las rutas inexistentes, fuera de `02-catalogo/`, no catalogadas,
  duplicadas o con contrato incorrecto, y las claves desconocidas, abortan con exit 2.
  `scripts/html-pilot-targets.json` contiene las 11 páginas del piloto, y un test lo compara
  con la tabla de `scripts/html-contracts.md`.
- ATDS: se calcula en proceso con `evaluateToolSafe()` (opcionalmente
  `--atds-source=report`). Si falta el resultado o la evaluación se interrumpe, es exit 2; un
  badge discrepante es FAIL.
- La allowlist no se aplica en certificación. El resto del corpus se informa en advisory y no bloquea.
- Hoy, `npm run certify:html:pilot` termina con **exit 1 (0/11 PASS)**, como se espera: no se migró ninguna página.

### HTML5-02 — Contratos publicables

- Plantillas: `scripts/contracts/ficha.template.html` y
  `scripts/contracts/category-index.template.html`. El renderizador rechaza placeholders sin
  valor y fichas sin descripción.
- CSS: Opción A (embebido). La CSP de documentos no cambia, y un test fija su valor exacto.
  La Opción B queda documentada con sus requisitos (CSP, `dist/`, hashes y manifiesto) y descartada.
- Rutas: `{{ROOT}}` y `{{CATEGORY_HREF}}` se calculan por profundidad. Las 11 páginas piloto,
  renderizadas en sus rutas reales, pasan la certificación y `html-scan.mjs` (0 blocking).
  Todos sus enlaces se resuelven bajo `/` y `/evol-tool-atlas/` a archivos existentes y
  publicados en `dist/`, según la lista compartida `scripts/lib/static-publish.mjs`.
- Se eliminaron las referencias a archivos inexistentes, y un test verifica todas las rutas citadas en el contrato.

### HTML5-03 — Advisory en CI

- Paso nuevo en `.github/workflows/ci.yml`:
  `npm run validate:html -- --output="$RUNNER_TEMP/html-validation.json" --summary-md="$GITHUB_STEP_SUMMARY"`.
- Analiza las 2.186 páginas. Comprueba la cobertura: si falta una página catalogada, exit 2.
  Los hallazgos históricos dan exit 0. Sin `|| true` ni `continue-on-error`, y un test lo comprueba.

### Evidencia

- `npm run test:unit`: **667/667** (18 archivos).
- `npm run check:release`, el CI y el SHA definitivo se reportan en el PR #5 sobre su `head`.
