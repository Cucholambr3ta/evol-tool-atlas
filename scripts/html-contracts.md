# EVOL Tool Atlas — Contratos HTML Canónicos (v2.0)

**PR:** #5 — validador estructural + auditoría DOM + contratos propuestos
**Baseline aprobada:** `main` = `1144dedd1b65fe3c9a844fc0519e3a441f931ba6` (PR #4, estabilización post-E3-01)
**Estado:** contratos publicables y certificables; **no se migra ninguna página en este PR**
**Plantillas canónicas:** `scripts/contracts/ficha.template.html` y `scripts/contracts/category-index.template.html`
**Fuente de verdad ATDS:** el resultado oficial de `evaluateToolSafe()` (`scripts/lib/atds/evaluate.mjs`), el mismo que usa `scripts/build-catalog-index.mjs` para `tool.atds`. Se calcula en proceso y **no depende** de artefactos gitignored. `reports/atds-validation.json` es opcional (`--atds-source=report`).
**Validador:** `scripts/validate-html-structure.mjs` (advisory por defecto; certificación por `--targets-file`)
**Escáner de seguridad:** `scripts/lib/html-scan.mjs` (bloqueante, invocado por `scripts/verify-atlas.mjs`; este PR no lo modifica)

---

## 1. Clasificación normativa (P1 / P2 / P3)

La revisión independiente exigió separar tres cosas que antes se mezclaban. El validador
usa una prioridad y una categoría por regla; **P1 solo contiene incumplimientos
normativos de HTML**, nunca elementos válidos según la especificación ni candidatos WCAG que
requieren verificación manual.

> **Criterio de autorización (condición 6):** la ausencia de skip link no se presenta como
> incumplimiento normativo universal. `skip-link` es P2 (`wcag-candidate`) y su mensaje pide
> comprobar si existe otro mecanismo de bypass antes de declarar un fallo de WCAG 2.4.1.

| Prioridad | Categoría | Reglas | Por qué |
|---|---|---|---|
| **P1** | `normative-html` | `dl-valid` | `<dt>`/`<dd>` fuera de `<dl>` incumple el content model de WHATWG HTML. |
| **P2** | `wcag-candidate` | `skip-link` | WCAG 2.2 2.4.1 (A) exige *algún* mecanismo de bypass. La ausencia de skip link **no demuestra por sí sola** un fallo: encabezados, landmarks u otro mecanismo documentado pueden satisfacerlo. Se reporta para verificación manual. |
| **P2** | `recommendation` | `nav-present`, `nav-named`, `main-id`, `header-footer-landmarks`, `internal-link`, `category-link`, `resource-links`, `section-heading`, `focus-visible`, `link-text` | HTML válido y/o WCAG dependiente de contexto. Se reportan como recomendaciones, no como errores P1. |
| **P2** | `contract-integrity` | `atds-badge` | El badge, **si existe**, debe coincidir con el resultado ATDS oficial. Las fichas legacy sin badge no se penalizan en advisory; en certificación el badge es obligatorio. |
| **P3** | `visual-contract` | `meta-description`, `no-inline-style` | Convenciones de publicación y contrato visual; no son errores de HTML ni de WCAG. |

### Las tres preguntas de navegación, separadas

| Pregunta | Regla | Resultado en el corpus actual |
|---|---|---|
| ¿La ficha enlaza a su índice de categoría? | `category-link` | 604 fichas sin enlace |
| ¿La página tiene navegación semántica `<nav>`? | `nav-present` | 918 páginas sin `<nav>` |
| ¿El `<nav>` existente tiene nombre accesible? | `nav-named` | 1.268 páginas con `<nav>` sin `aria-label`/`aria-labelledby` |

`threat-dragon` es el caso de control: **sí** enlaza a
`../modelado-amenazas/index.html` (categoría 2 en `catalogo.json`), pero **no** tiene
`<nav>`; por tanto no aparece en `category-link` y sí en `nav-present`. Es exactamente
la distinción que la revisión pidió.

---

## 2. Estrategia CSS y CSP (decisión)

**Se adopta la Opción A: CSS embebido en un bloque `<style>` por página.**

La CSP de documentos (`DOCUMENT_CSP_HEADER` en `scripts/lib/security-headers.mjs`) es:

```
default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:;
object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

| Recurso | ¿Lo permite la CSP actual? | Consecuencia en el contrato |
|---|---|---|
| Bloque `<style>` | Sí (`style-src 'unsafe-inline'`) | Es la estrategia elegida |
| `<link rel="stylesheet" href="…">` | **No**: `style-src` no incluye `'self'` | Prohibido (`no-external-stylesheet`) |
| `@import` | **No** | Prohibido (`no-external-stylesheet`) |
| `@font-face` / web fonts | **No**: no hay `font-src` y `default-src 'none'` | Prohibido (`no-web-fonts`); `Manrope` y `Atkinson Hyperlegible` se declaran con *fallback* `system-ui` y solo se usan si están instaladas localmente |
| Atributo `style="…"` | Sí, pero es convención visual | Prohibido en páginas migradas (`no-inline-style`) |

**Opción B (CSS compartido), descartada en PR #5 y PR #6.** Exigiría, como mínimo:

1. Añadir `'self'` a `style-src` (y `font-src 'self'` si se quieren las fuentes) en
   `DOCUMENT_CSP_HEADER`, en `scripts/lib/security-headers.mjs` y en el servidor de
   desarrollo `scripts/lib/dev-static.mjs`, con sus tests.
2. Publicar la hoja: añadirla a `STATIC_CATALOG_ITEMS` (`scripts/lib/static-publish.mjs`,
   que usa `scripts/copy-static-catalog.mjs`) para que llegue a `dist/`.
3. Registrar su SHA-256 en `SHA256SUMS.txt` y en el manifiesto offline
   (`scripts/lib/offline-manifest.mjs`), con `verify:release` comprobándolo.
4. Enlazarla con una ruta relativa calculada por profundidad, válida en `/` y en `/evol-tool-atlas/`.

Esto amplía la CSP de documentos, así que no se hace para obtener un resultado verde. Un test
fija el valor exacto de `DOCUMENT_CSP_HEADER`, de modo que cualquier cambio de CSP tiene que
ser explícito y revisado.

---

## 3. Rutas relativas reales

Las fichas y los índices **no** están a la misma profundidad, así que ninguna ruta fija
(`../../../`) vale para todos. El renderizador (`scripts/lib/html-contract.mjs`) calcula:

- `{{ROOT}}` = `rootPrefix(rel)`: un `../` por directorio de la ruta de la página.
- `{{CATEGORY_HREF}}` = `relativeHref(rel, categoria.href)`, a partir de `catalogo.json`.

| Página real | Profundidad | `{{ROOT}}` | Enlace a la categoría |
|---|---:|---|---|
| `02-catalogo/seguridad/catalogo/threat-dragon/index.html` | 4 | `../../../../` | `../modelado-amenazas/index.html` |
| `02-catalogo/testing-y-auditoria/semgrep/index.html` | 3 | `../../../` | `../../seguridad/catalogo/auditoria-codigo/index.html` |
| `02-catalogo/pruebas-tecnicas/cargo-fuzz/index.html` | 3 | `../../../` | `../index.html` |
| `02-catalogo/pruebas-tecnicas/index.html` (índice) | 2 | `../../` | — |
| `02-catalogo/seguridad/catalogo/scanner/index.html` (índice) | 4 | `../../../../` | — |

Reglas de enlace (comprobación `local-links-resolve`, que se ejecuta para **cada** base path):

- Solo se usan rutas relativas. Una ruta que empieza por `/` falla en uno de los dos despliegues.
- Cada enlace se resuelve como lo haría un navegador desde `/<rel>` y desde
  `/evol-tool-atlas/<rel>`. El destino no puede salirse del base path, tiene que existir y
  tiene que estar publicado en `dist/` (`isPublishedPath()`; misma lista que copia
  `scripts/copy-static-catalog.mjs`).
- `{{ROOT}}index.html` es la SPA. `{{ROOT}}docs/atds/ATDS-v1.md` es el único documento de `docs/`
  publicado. Otros documentos de `docs/` **no** se enlazan, porque no llegan a `dist/`.
- Los tests renderizan las 11 páginas del piloto en sus rutas reales y verifican todos sus
  enlaces bajo `/` y `/evol-tool-atlas/`.

---

## 4. Contrato A — Ficha de herramienta

Plantilla canónica: `scripts/contracts/ficha.template.html`. Se renderiza con
`renderContract('ficha', fichaContractVars(rel, base, atdsLookup, { date, description, contentSectionsHtml }))`.
Cualquier placeholder sin valor, o valor sin placeholder, es un error.

| Placeholder | Origen |
|---|---|
| `{{TOOL_NAME}}`, `{{TOOL_ID}}` | `catalogo.json` (`name`, `id`); el `<h1>` debe coincidir con `name` |
| `{{DESCRIPTION}}` | `catalogo.json.description` o una descripción verificada explícita. Si no hay ninguna, el renderizado se rechaza (no se emite un `meta description` vacío) |
| `{{CATEGORY_NAME}}`, `{{CATEGORY_HREF}}` | `catalogo.json.categorias[tool.cat]` (ruta relativa calculada) |
| `{{ROOT}}` | Profundidad de la página (§3) |
| `{{ATDS_VALIDATED}}`, `{{ATDS_CANDIDATE}}` | Resultado ATDS oficial (`level`, `candidateLevel`), **nunca** `catalogo.json.evidence` |
| `{{RESOURCE_LINKS_HTML}}` | Solo los recursos que existen en disco: `README.md`, `metadata.json`, `SHA256SUMS.txt`, `GUIA.md`, `casos-uso.json`, `SKILL.md`, `evidencias.json` |
| `{{CONTENT_SECTIONS_HTML}}` | Secciones de contenido ATDS L1 (`<section aria-labelledby>` + `<h2>`) |
| `{{DATE}}` | Fecha de verificación |

Estructura (extracto de la plantilla):

```html
<body>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
  <header class="site-header" role="banner">
    <nav aria-label="Ruta de navegación">
      <a href="{{ROOT}}index.html">Inicio</a> › <a href="{{CATEGORY_HREF}}">{{CATEGORY_NAME}}</a> ›
      <span aria-current="page">{{TOOL_NAME}}</span>
    </nav>
  </header>
  <main id="main-content">
    <article class="tool-ficha">
      <div class="ficha-header">            <!-- no <header> dentro de <main> -->
        <h1>{{TOOL_NAME}}</h1>
        <dl class="ficha-meta"> … <span class="atds-badge" data-atds-validated="{{ATDS_VALIDATED}}"
            data-atds-candidate="{{ATDS_CANDIDATE}}">…</span> … </dl>
      </div>
      {{CONTENT_SECTIONS_HTML}}
      <section aria-labelledby="recursos-h"> <h2 id="recursos-h">…</h2>
        <nav aria-label="Recursos técnicos">{{RESOURCE_LINKS_HTML}}</nav> </section>
    </article>
  </main>
  <footer class="site-footer" role="contentinfo"> … <a href="{{ROOT}}docs/atds/ATDS-v1.md">ATDS v1</a></footer>
</body>
```

### 4.1 Reglas obligatorias (ficha)

En certificación **bloquean todas**, no solo P1. Proceden de `CONTRACTS.ficha` en
`scripts/lib/html-contract.mjs`, y un test obliga a clasificar cualquier regla nueva.

| Tipo | Reglas / comprobaciones |
|---|---|
| Normativa HTML (P1) | `dl-valid` |
| Reglas del validador como obligación de contrato | `skip-link`, `main-id`, `header-footer-landmarks`, `nav-present`, `nav-named`, `section-heading`, `focus-visible`, `link-text`, `meta-description`, `no-inline-style`, `internal-link`, `category-link`, `resource-links`, `atds-badge` |
| Comprobaciones de contrato | `single-h1`, `h1-matches-catalog`, `atds-badge-required`, `no-external-stylesheet`, `no-web-fonts`, `external-link-rel`, `local-links-resolve` |

`skip-link` bloquea aquí como **obligación de la plantilla**, y el mensaje lo dice
explícitamente. No es un veredicto automático de WCAG 2.4.1; en el corpus advisory sigue
siendo P2 `wcag-candidate`.

---

## 5. Contrato B — Índice de categoría

Plantilla canónica: `scripts/contracts/category-index.template.html`, renderizada con
`categoryContractVars(rel, base, atdsLookup, { date })`. Las tarjetas se generan para
**todas** las herramientas de la categoría en `catalogo.json`, con un badge por tarjeta tomado del
resultado ATDS oficial. El enlace `README.md` ("Criterios de la categoría") solo aparece si
el archivo existe en el directorio del índice.

| Tipo | Reglas / comprobaciones |
|---|---|
| Normativa HTML (P1) | `dl-valid` |
| Reglas del validador como obligación de contrato | `skip-link`, `main-id`, `header-footer-landmarks`, `nav-present`, `nav-named`, `section-heading`, `focus-visible`, `link-text`, `meta-description`, `no-inline-style` |
| No aplican (solo fichas) | `internal-link`, `category-link`, `resource-links`, `atds-badge` |
| Comprobaciones de contrato | `single-h1`, `h1-matches-catalog`, `no-external-stylesheet`, `no-web-fonts`, `external-link-rel`, `local-links-resolve`, `tool-grid-list` (`ul.tool-grid[role=list]`), `links-every-tool`, `card-badges-match-atds` |

---

## 6. Compatibilidad con la baseline real

| Componente | Baseline `1144dedd` | Contrato | Acción en PR #5 / PR #6 |
|---|---|---|---|
| `scripts/lib/html-scan.mjs` | Escáner estructural bloqueante (SEC-STATIC-01) | **Intocable** | PR #5 no lo modifica; el validador nuevo lo ejecuta y reporta `0 blocking` |
| `scripts/verify-atlas.mjs` | Gate de seguridad + enlaces + marca + dist | **Intocable** | Se ejecuta tal cual en `check:release` |
| `scripts/atds-gate.mjs` | **27/27** controles | Mantener 27 | PR #5 no toca ATDS |
| `tests/unit` | 561 tests en la baseline | Mantener todos + tests nuevos | PR #5 añade los tests del validador y de la certificación (ver evidencia del PR) |
| `npm run check:release` | `check && verify:release && test:e2e` | Mantener | Se ejecuta en la entrega |
| `reports/atds-validation.json` | Gitignored; `report.tools[]` con `id`, `level`, `candidateLevel` | Fuente opcional (`--atds-source=report`) | Si se pide y falta, es un error operativo (exit 2) |
| `scripts/build-catalog-index.mjs` | Publica `tool.atds.validatedLevel`/`candidateLevel` con `evaluateToolSafe()` | Misma función que la certificación | Sin lógica ATDS duplicada; funciona en un build limpio |
| CSP SPA | Cabecera + meta: `script-src 'self'; style-src 'self'; ...` | Mantener | No se toca |
| CSP documentos | Cabecera `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; ...` | Mantener | No se inyecta meta CSP en estáticas |
| `SHA256SUMS.txt` | Raíz + por herramienta; copiado a `dist/` | Regenerar si cambia HTML | PR #5 no cambia HTML; PR #6 debe regenerar y verificar `sha256sum -c` |
| `public/data/offline-manifest.json` | **6.672** entradas, revisión determinista por SHA-256 | Incluir cada HTML nuevo | `build-catalog-index.mjs` ya recorre las 2.186 páginas |
| Base path | `/evol-tool-atlas/` (`scripts/lib/base-path.mjs`) | Rutas relativas calculadas por profundidad (§3) | Nunca rutas absolutas `/…`; se comprueba bajo `/` y `/evol-tool-atlas/` |
| Identidad | Fine Line Premium, Manrope + Atkinson Hyperlegible, paleta oficial | Mantener | Un test exige que el `<style>` de las plantillas use solo la paleta oficial de `scripts/verify-atlas.mjs`; las fuentes se declaran por nombre, con *fallback* (§2) |

### 6.1 CSP: qué permite y qué prohíbe

| Directiva | SPA (APP) | Documentos históricos |
|---|---|---|
| `script-src` | `'self'` | `'none'` |
| `style-src` | `'self'` | `'unsafe-inline'` (bloques `<style>` legados) |
| `img-src` | `'self' data:` | `'self' data:` |
| `object-src` | `'none'` | `'none'` |
| `base-uri` | `'self'` | `'none'` |
| `form-action` | `'self'` | `'none'` |
| `frame-ancestors` | `'none'` (solo cabecera) | `'none'` (solo cabecera) |

El contrato **no** añade `<meta http-equiv="Content-Security-Policy">` a las páginas
estáticas: la política se aplica por cabecera en `vite preview`
(`scripts/lib/security-headers.mjs`) y en el servidor de desarrollo
(`scripts/lib/dev-static.mjs`). Inyectar meta CSP en 2.186 páginas sería una migración
masiva y además `frame-ancestors` se ignora en `<meta>`.

### 6.2 SHA-256 y manifiesto offline

- Cada herramienta publica `SHA256SUMS.txt`; la raíz publica `SHA256SUMS.txt`.
- `scripts/copy-static-catalog.mjs` copia ambos a `dist/`.
- El manifiesto offline incluye el SHA-256 y el tamaño de **cada** archivo publicado;
  su `revision` se deriva del contenido, no de timestamps.
- **Regla:** si PR #6 modifica un `index.html`, debe regenerar el `SHA256SUMS.txt` de esa
  herramienta y el raíz, y volver a ejecutar `generate:data` para que la revisión del
  manifiesto cambie. `verify:release` compara el manifiesto de `dist/` con el generado y
  verifica cada hash (`verifyManifestAgainstDist`).
- **PR #5 no modifica HTML**, por lo que los hashes y el manifiesto actuales siguen
  siendo válidos; se comprueba en la evidencia.

---

## 7. Validador: modos, certificación, allowlist y CI

### 7.1 Modos y códigos de salida

| Modo | Comando | Alcance | Bloquea |
|---|---|---|---|
| Advisory (por defecto) | `npm run validate:html` | Las 2.186 páginas | Nunca por hallazgos |
| Strict global | `npm run validate:html -- --strict --fail-on-error` | Las 2.186 páginas | P1, seguridad o allowlist caducada. Hoy falla por los 6.156 `dl-valid` históricos: **no es un gate de release** |
| Certificación | `npm run validate:html -- --targets-file=scripts/html-pilot-targets.json` | **Solo** los targets | Cualquier regla obligatoria del contrato del target. El resto del corpus se informa en advisory y no bloquea |

Códigos de salida: `0` = OK/PASS, `1` = FAIL (strict o certificación), `2` = error
operativo. Un error operativo nunca termina en `0` y un hallazgo nunca termina en `2`.

Errores operativos: argumento desconocido o incompleto (`--target-file` no se ignora en
silencio), `catalogo.json` ilegible, una página catalogada ausente de `02-catalogo/`
(cobertura incompleta), allowlist inválida, selección de targets inválida, resultados ATDS
ausentes cuando se exigen y evaluación ATDS interrumpida.

Opciones: `--root=<dir>` (raíz documental alternativa, para tests),
`--atds-source=evaluate|report`, `--atds-report=<file>`, `--output=<file>` (JSON completo),
`--summary-md=<file>` (resumen Markdown), `--compact` (artefacto agregado versionado:
`scripts/html-validation-results.json`), `--no-security`, `--no-allowlist`.

### 7.2 Selección de targets (`--targets-file`)

```json
{
  "schema": "evol-tool-atlas/html-certification-targets/1",
  "expectedCount": 11,
  "targets": [{ "file": "02-catalogo/…/index.html", "contract": "ficha" }]
}
```

Ningún target se descarta en silencio. Cualquiera de estas condiciones aborta con exit 2:

- La ruta no está normalizada, es absoluta, usa `..` o queda fuera de `02-catalogo/`.
- El archivo no existe, o no es una ficha ni un índice de `catalogo.json`.
- El `contract` es desconocido o no coincide con lo que dice `catalogo.json`.
- Hay targets duplicados, o una clave desconocida (las erratas no se ignoran).
- `expectedCount` falta o no coincide con el número de targets.

Además, la certificación comprueba que el número de páginas certificadas coincide con
`expectedCount`. Un test exige que `scripts/html-pilot-targets.json` contenga exactamente las
11 rutas de la tabla del §8, así que ninguno de los dos puede cambiar sin el otro.

La certificación **no aplica la allowlist**: una página migrada cumple el contrato completo.

### 7.3 ATDS en la certificación

- `--atds-source=evaluate` (por defecto): `evaluateToolSafe()` en proceso. Funciona en un
  checkout limpio.
- `--atds-source=report`: lee `reports/atds-validation.json` o `--atds-report`. Si falta, es exit 2.
- Si una ficha no tiene resultado oficial, o su evaluación se interrumpe, es exit 2. Si el badge
  no coincide con `level`/`candidateLevel`, es FAIL (exit 1).

### 7.4 Allowlist (9 entradas, P2/P3 solamente)

`scripts/html-validation-allowlist.json` contiene 9 pares `file:focus-visible` del
template legacy `pruebas-tecnicas/`. Cada entrada declara `reason`, `ticket` y
`expiresAt: 2027-03-31`.

1. **P1 nunca se permite.** `loadAllowlist()` lanza un error si una entrada referencia una
   regla P1.
2. **Solo suprime en strict global.** En advisory se reportan las 228 fichas sin
   `:focus-visible`; en strict se suprimen 9. En certificación no se aplica.
3. **Una entrada caducada no suprime nada.**
4. **Una entrada obsoleta rompe el test.** Si se arregla el archivo, hay que borrar la entrada.
5. **El archivo y la regla deben existir.**

### 7.5 CI (advisory)

`.github/workflows/ci.yml` ejecuta, después del gate ATDS:

```bash
npm run validate:html -- --output="$RUNNER_TEMP/html-validation.json" --summary-md="$GITHUB_STEP_SUMMARY"
```

Analiza las 2.186 páginas y publica en el resumen del job una tabla por prioridad y por regla.
No falla por los defectos históricos declarados y sí falla (exit 2) ante errores operativos.
No usa `|| true` ni `continue-on-error`; un test lo comprueba.

### 7.6 Artefacto versionado

`scripts/html-validation-results.json` (`--compact`) no contiene marca de tiempo ni SHA de
commit, porque un archivo no puede nombrar el commit que lo contiene. Un test recalcula el
resumen del corpus y exige que coincida con el artefacto.

---

## 8. Piloto PR #6 (10 fichas + 1 índice)

| # | Herramienta | Ruta | Familia | Por qué |
|---|---|---|---|---|
| 1 | threat-dragon | `02-catalogo/seguridad/catalogo/threat-dragon/index.html` | E3-01, ATDS L3/L3 | Enlace de categoría correcto, sin `<nav>`: control de la distinción |
| 2 | sagan | `02-catalogo/seguridad/catalogo/sagan/index.html` | E3-01, ATDS L3/L3 | Referencia L3; sin `description` en `catalogo.json` (el migrador debe aportarla) |
| 3 | nfcutils | `02-catalogo/seguridad/catalogo/nfcutils/index.html` | E3-01, ATDS L3/L3 | Referencia L3; sin `description` en `catalogo.json` |
| 4 | secure-delete | `02-catalogo/seguridad/catalogo/secure-delete/index.html` | E3-01, ATDS L3/L3 | Referencia L3; sin `description` en `catalogo.json` |
| 5 | semgrep | `02-catalogo/testing-y-auditoria/semgrep/index.html` | Prioritaria, ATDS L1/L4 | Profundidad 3 y categoría en otro árbol (`seguridad/catalogo/auditoria-codigo/`) |
| 6 | promptfoo | `02-catalogo/seguridad/catalogo/promptfoo/index.html` | Prioritaria, ATDS NONE/L4 | Caso límite, recursos parciales |
| 7 | cargo-fuzz | `02-catalogo/pruebas-tecnicas/cargo-fuzz/index.html` | Prioritaria, ATDS L1/L4 | Template legacy sin `focus-visible` (allowlist) |
| 8 | mcp-inspector | `02-catalogo/pruebas-tecnicas/mcp-inspector/index.html` | Prioritaria, ATDS L1/L3 | Template legacy sin `focus-visible` (allowlist) |
| 9 | 0trace | `02-catalogo/seguridad/catalogo/0trace/index.html` | `nav` + `dt/dd` sueltos, ATDS NONE/L1 | Familia mayoritaria |
| 10 | adversarial-robustness-toolbox | `02-catalogo/seguridad/catalogo/adversarial-robustness-toolbox/index.html` | Sin nav/header, ATDS NONE/L1 | Familia minimalista |
| 11 | scanner (índice) | `02-catalogo/seguridad/catalogo/scanner/index.html` | Índice grande | 228 atributos `style`, grid de cards |

### Criterios de aceptación del piloto

- [ ] `npm run validate:html -- --targets-file=scripts/html-pilot-targets.json` termina con
      exit 0 (11/11 PASS). Hoy termina con exit 1, porque ninguna página está migrada; el resto
      del corpus sigue en advisory.
- [ ] `npm run check:release` pasa completo (check + verify:release + E2E).
- [ ] `scripts/verify-atlas.mjs` pasa sin cambios y `html-scan.mjs` sigue bloqueando.
- [ ] `SHA256SUMS.txt` regenerado y `sha256sum -c` OK para los 11 archivos.
- [ ] Manifiesto offline regenerado, con revisión nueva y cobertura de los 11 HTML.
- [ ] Políticas ATDS sin cambios; badge = `level`/`candidateLevel` oficiales (certificación).
- [ ] Base path probado en `/` y `/evol-tool-atlas/`.
- [ ] Sin scripts, sin recursos remotos, sin formularios, sin `<base>`.
- [ ] Identidad Fine Line Premium y contraste WCAG AA verificados.
- [ ] Las 9 entradas de allowlist se eliminan al migrar el template.

---

## 9. Fuera de alcance de PR #5

- No se migra ninguna ficha ni índice.
- No se modifica `catalogo.json`, `02-catalogo/`, `docs/diseno/` ni las políticas ATDS.
- No se toca `scripts/verify-atlas.mjs` ni `scripts/lib/html-scan.mjs`.
- `scripts/copy-static-catalog.mjs` solo cambia para importar su lista de `scripts/lib/static-publish.mjs`; copia exactamente los mismos elementos.
- No se modifica la CSP (`scripts/lib/security-headers.mjs`).
- No se abre PR #6 ni se inicia E3-02.
