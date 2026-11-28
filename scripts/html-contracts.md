# EVOL Tool Atlas — Contratos HTML Canónicos (v2.0)

**PR:** #5 — validador estructural + auditoría DOM + contratos propuestos
**Baseline aprobada:** `main` = `1144dedd1b65fe3c9a844fc0519e3a441f931ba6` (PR #4, estabilización post-E3-01)
**Estado:** propuesta; **no se migra ninguna página en este PR**
**Fuente de verdad ATDS:** `reports/atds-validation.json` (generado por `validate-atds.mjs`)
**Validador:** `scripts/validate-html-structure.mjs` (advisory por defecto; strict con allowlist)
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
| **P2** | `contract-integrity` | `atds-badge` | El badge, **si existe**, debe coincidir con `reports/atds-validation.json`. Las fichas legacy sin badge no se penalizan. |
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

## 2. Contrato A — Ficha de herramienta

### 2.1 Reglas de oro

1. **Sin scripts.** Ni `<script>`, ni `on*`, ni `javascript:`. La CSP de documentos es
   `default-src 'none'; script-src 'none'; ...`.
2. **Enlaces relativos o con base path.** El despliegue por defecto es
   `/evol-tool-atlas/` (`scripts/lib/base-path.mjs`). Una ruta absoluta `/shared/...`
   rompe la subruta; usar rutas relativas desde la ficha o `import.meta.env.BASE_URL`
   en el renderizador.
3. **Sin recursos remotos embebidos.** Nada de `<img src="https://...">`, `<link>` a
   CDN, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<form>`.
4. **Estilos.** La CSP de documentos permite `style-src 'unsafe-inline'` para el legado,
   pero el contrato visual prefiere una hoja compartida. Un bloque `<style>` es
   compatible con la CSP; un atributo `style="..."` es P3 (`no-inline-style`).
5. **ATDS oficial.** El badge se rellena desde `reports/atds-validation.json`
   (`id`, `level`, `candidateLevel`) o desde el resumen de build
   (`tool.atds.validatedLevel`, `tool.atds.candidateLevel`). Nunca desde
   `catalogo.json.evidence` ni desde etiquetas escritas a mano.
6. **Recursos reales.** Solo se enlaza `README.md`, `metadata.json`, `SHA256SUMS.txt`,
   `GUIA.md`, `SKILL.md`, `casos-uso.json` o `evidencias.json` si el archivo existe en
   disco en el momento del build.
7. **Identidad Fine Line Premium.** Tokens oficiales, fuentes Manrope/Atkinson
   Hyperlegible y pie `Fine Line Premium · Evol Tool Atlas`.

### 2.2 Esqueleto

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="[Descripción ATDS L1 verificada, ≤160 caracteres]">
  <title>[Nombre oficial] · Evol Tool Atlas</title>
  <!-- Ruta relativa: funciona en / y en /evol-tool-atlas/ -->
  <link rel="stylesheet" href="../../../shared/ficha.css">
</head>
<body>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>

  <header class="site-header" role="banner">
    <p class="brand">Evol Tool Atlas</p>
    <nav aria-label="Ruta de navegación">
      <a href="../../../../index.html">Inicio</a> ›
      <a href="../[categoria]/index.html">[Categoría]</a> ›
      <span aria-current="page">[Nombre]</span>
    </nav>
  </header>

  <main id="main-content" role="main">
    <article class="tool-ficha">
      <header class="ficha-header">
        <p class="eyebrow">[Categoría] · Ficha [ID catálogo]</p>
        <h1>[Nombre oficial]</h1>
        <p class="lead">[Descripción ATDS L1]</p>

        <dl class="ficha-meta" aria-label="Metadatos de la herramienta">
          <div><dt>Identificador</dt><dd>[AT-SEC-XXX]</dd></div>
          <div><dt>Tipo</dt><dd>[tipo verificado]</dd></div>
          <div><dt>Licencia</dt><dd>[licencia verificada]</dd></div>
          <div><dt>Plataformas</dt><dd>[SO verificados]</dd></div>
          <div><dt>Estado documental ATDS</dt><dd>
            <!-- Valores inyectados desde reports/atds-validation.json -->
            <span class="atds-badge"
                  data-atds-validated="[L1|L2|L3|L4|NONE]"
                  data-atds-candidate="[L1|L2|L3|L4|NONE]">
              Validado: [level] · Candidato: [candidateLevel]
            </span>
          </dd></div>
          <div><dt>Fecha de verificación</dt><dd>[YYYY-MM-DD]</dd></div>
        </dl>
      </header>

      <section aria-labelledby="problema-h">
        <h2 id="problema-h">Problema que resuelve</h2>
        <p>[ATDS L1]</p>
      </section>

      <section aria-labelledby="funciones-h">
        <h2 id="funciones-h">Funciones principales</h2>
        <ul>[ATDS L1]</ul>
      </section>

      <section aria-labelledby="recursos-h">
        <h2 id="recursos-h">Recursos técnicos disponibles</h2>
        <nav aria-label="Recursos técnicos">
          <!-- Solo si el archivo existe en disco -->
          <a href="README.md" rel="noopener">README</a>
          <a href="metadata.json" rel="noopener">Metadatos JSON</a>
          <a href="SHA256SUMS.txt" rel="noopener">SHA-256</a>
          <a href="GUIA.md" rel="noopener">Guía técnica</a>
          <a href="casos-uso.json" rel="noopener">Casos de uso</a>
          <a href="SKILL.md" rel="noopener">Skill reutilizable</a>
          <a href="evidencias.json" rel="noopener">Registro de evidencias</a>
        </nav>
      </section>

      <section aria-labelledby="fuentes-h">
        <h2 id="fuentes-h">Fuentes y referencias</h2>
        <ul>
          <li><a href="[url oficial]" rel="noopener noreferrer">[Título verificado]</a></li>
        </ul>
      </section>
    </article>
  </main>

  <!-- Fuera de <main>: conserva el landmark contentinfo -->
  <footer class="site-footer" role="contentinfo">
    <p><small>Fine Line Premium · Evol Tool Atlas · [fecha] ·
      <a href="../../../docs/atds/ATDS-v1.md">ATDS v1</a></small></p>
  </footer>
</body>
</html>
```

### 2.3 Reglas obligatorias (ficha)

| Regla | Comprobación |
|---|---|
| `h1` único | Coincide con `catalogo.json` (2.137/2.137 exactos en la baseline) |
| `dl` | `<dt>`/`<dd>` dentro de `<dl>` (directos o en `<div>`); `dl-valid` P1 |
| Skip link | `a[href="#main-content"]` + `main#main-content`; `skip-link` P2 (verificación manual de 2.4.1) |
| Landmarks | `<header role="banner">` y `<footer role="contentinfo">` fuera de `<main>` |
| Navegación | Al menos un `<nav>` con `aria-label`; `nav-present` y `nav-named` P2 |
| Enlace de categoría | La ficha enlaza al `href` de su categoría en `catalogo.json`; `category-link` P2 |
| Badge ATDS | `data-atds-validated`/`data-atds-candidate` = `level`/`candidateLevel` oficiales |
| Recursos | Solo archivos existentes; `resource-links` P2 |
| Enlaces externos | Texto descriptivo; `target="_blank"` solo con `rel="noopener noreferrer"` |
| Meta description | Presente y no vacía; `meta-description` P3 |
| Estilos | Sin atributos `style`; `no-inline-style` P3 |

---

## 3. Contrato B — Índice de categoría

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="Índice de [N] herramientas en [Categoría] — Evol Tool Atlas">
  <title>[N]. [Categoría] · Evol Tool Atlas</title>
  <link rel="stylesheet" href="../../shared/index.css">
</head>
<body>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>

  <header class="site-header" role="banner">
    <p class="brand">Evol Tool Atlas</p>
    <nav aria-label="Ruta de navegación">
      <a href="../../../index.html">Inicio</a> ›
      <span aria-current="page">[Categoría]</span>
    </nav>
  </header>

  <main id="main-content" role="main">
    <header class="index-header">
      <p class="eyebrow">Categoría [NN] · [slug]</p>
      <h1>[Nombre categoría]</h1>
      <p class="lead">[N] herramientas documentadas · [M] con procedencia verificada · [K] excluidas</p>
    </header>

    <nav aria-label="Acciones del índice">
      <a href="../../../index.html">Volver al navegador principal</a>
      <a href="README.md" rel="noopener">Criterios de la categoría</a>
    </nav>

    <section aria-labelledby="tools-h">
      <h2 id="tools-h">Herramientas documentadas</h2>
      <ul class="tool-grid" role="list">
        <li>
          <article class="tool-card">
            <h3><a href="[herramienta]/index.html">[Nombre]</a></h3>
            <p class="muted">[Descripción corta ≤140 caracteres]</p>
            <!-- Nivel desde reports/atds-validation.json, no desde catalogo.json.evidence -->
            <span class="atds-badge"
                  data-atds-validated="[level]"
                  data-atds-candidate="[candidateLevel]">ATDS: [level]</span>
          </article>
        </li>
      </ul>
    </section>

    <section aria-labelledby="excluidas-h" hidden>
      <h2 id="excluidas-h">Entradas excluidas del índice operativo</h2>
      <ul>...</ul>
    </section>
  </main>

  <footer class="site-footer" role="contentinfo">
    <p><small>Fine Line Premium · Evol Tool Atlas · [fecha] ·
      <a href="../../docs/atds/ATDS-v1.md">ATDS v1</a></small></p>
  </footer>
</body>
</html>
```

### 3.1 Reglas obligatorias (índice)

| Regla | Comprobación |
|---|---|
| `<nav>` con nombre | `nav-present` + `nav-named` P2 |
| `ul.tool-grid` | `role="list"` (Safari/VoiceOver) |
| Card | `h3 > a` con nombre accesible; sin texto de enlace vacío |
| Badge ATDS | Sincronizado con `reports/atds-validation.json` |
| Enlace a cada ficha | Ruta relativa `[herramienta]/index.html` |
| Footer | `role="contentinfo"` fuera de `<main>` |
| Sección excluidas | `hidden` si no hay entradas |

---

## 4. Compatibilidad con la baseline real

| Componente | Baseline `1144dedd` | Contrato | Acción en PR #5 / PR #6 |
|---|---|---|---|
| `scripts/lib/html-scan.mjs` | Escáner estructural bloqueante (SEC-STATIC-01) | **Intocable** | PR #5 no lo modifica; el validador nuevo lo ejecuta y reporta `0 blocking` |
| `scripts/verify-atlas.mjs` | Gate de seguridad + enlaces + marca + dist | **Intocable** | Se ejecuta tal cual en `check:release` |
| `scripts/atds-gate.mjs` | **27/27** controles | Mantener 27 | PR #5 no toca ATDS |
| `tests/unit` | **561/561** tests | Mantener ≥561 + tests nuevos | PR #5 añade tests del validador |
| `npm run check:release` | `check && verify:release && test:e2e` | Mantener | Se ejecuta en la entrega |
| `reports/atds-validation.json` | `report.tools[]` con `id`, `level`, `candidateLevel` | Única fuente de badge | El renderizador lee estos campos |
| `build-catalog-index.mjs` | Ya publica `tool.atds.validatedLevel`/`candidateLevel` | Reutilizar | No duplicar lógica |
| CSP SPA | Cabecera + meta: `script-src 'self'; style-src 'self'; ...` | Mantener | No se toca |
| CSP documentos | Cabecera `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; ...` | Mantener | No se inyecta meta CSP en estáticas |
| `SHA256SUMS.txt` | Raíz + por herramienta; copiado a `dist/` | Regenerar si cambia HTML | PR #5 no cambia HTML; PR #6 debe regenerar y verificar `sha256sum -c` |
| `public/data/offline-manifest.json` | **6.672** entradas, revisión determinista por SHA-256 | Incluir cada HTML nuevo | `build-catalog-index.mjs` ya recorre las 2.186 páginas |
| Base path | `/evol-tool-atlas/` (`scripts/lib/base-path.mjs`) | Rutas relativas o `BASE_URL` | Nunca `/shared/...` absoluto |
| Identidad | Fine Line Premium, Manrope + Atkinson Hyperlegible, paleta oficial | Mantener | `verify-atlas.mjs` valida colores y fuentes |

### 4.1 CSP: qué permite y qué prohíbe

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

### 4.2 SHA-256 y manifiesto offline

- Cada herramienta publica `SHA256SUMS.txt`; la raíz publica `SHA256SUMS.txt`.
- `copy-static-catalog.mjs` copia ambos a `dist/`.
- El manifiesto offline incluye el SHA-256 y el tamaño de **cada** archivo publicado;
  su `revision` se deriva del contenido, no de timestamps.
- **Regla:** si PR #6 modifica un `index.html`, debe regenerar el `SHA256SUMS.txt` de esa
  herramienta y el raíz, y volver a ejecutar `generate:data` para que la revisión del
  manifiesto cambie. `verify:release` compara el manifiesto de `dist/` con el generado y
  verifica cada hash (`verifyManifestAgainstDist`).
- **PR #5 no modifica HTML**, por lo que los hashes y el manifiesto actuales siguen
  siendo válidos; se comprueba en la evidencia.

---

## 5. Validador: modos, allowlist y anti-regresión

### 5.1 Modos

```bash
# Advisory (por defecto): reporta todo, nunca bloquea
node scripts/validate-html-structure.mjs

# Strict: solo para el piloto / árbol migrado; falla con P1, seguridad o allowlist expirada
node scripts/validate-html-structure.mjs --strict --fail-on-error

# JSON reproducible
node scripts/validate-html-structure.mjs --output=/tmp/html.json

# JSON compacto (solo agregados; es el artefacto versionado)
node scripts/validate-html-structure.mjs --compact
```

El validador **no** sustituye a `verify-atlas.mjs`. De hecho, ejecuta
`scanStaticTree()` de `scripts/lib/html-scan.mjs` y muestra su resultado
(`0 blocking` en la baseline). Así se demuestra que los controles de seguridad siguen
activos y que el validador solo añade semántica, accesibilidad y contrato.

### 5.2 Allowlist (9 entradas, P2/P3 solamente)

`scripts/html-validation-allowlist.json` contiene 9 pares `file:focus-visible` del
template legacy `pruebas-tecnicas/`. Cada entrada declara `reason`, `ticket` y
`expiresAt: 2027-03-31` (o la fusión de PR #6, lo que ocurra antes).

Garantías anti-regresión:

1. **P1 nunca se permite.** `loadAllowlist()` lanza error si una entrada referencia una
   regla P1.
2. **Solo suprime en strict.** En advisory se reportan las 228 fichas sin
   `:focus-visible`; en strict se suprimen exactamente 9 y quedan 219.
3. **Entrada caducada no suprime nada.** Si `expiresAt` ya pasó, strict falla.
4. **Entrada obsoleta rompe el test.** Un test comprueba que cada archivo permitido
   sigue disparando la regla; si se arregla, el test obliga a borrar la entrada.
5. **Archivo/regla deben existir.** El loader valida que el archivo exista y que la regla
   esté en el catálogo.
6. **Tests del validador real.** Los tests importan `RULES` y `validateHtml()` del
   módulo, no una copia de la lógica.

---

## 6. Piloto PR #6 (10 fichas + 1 índice)

| # | Herramienta | Ruta | Familia | Por qué |
|---|---|---|---|---|
| 1 | threat-dragon | `02-catalogo/seguridad/catalogo/threat-dragon/index.html` | E3-01 L3 | Enlace de categoría correcto, sin `<nav>`: control de la distinción |
| 2 | sagan | `02-catalogo/seguridad/catalogo/sagan/index.html` | E3-01 L3 | Referencia ATDS L3 |
| 3 | nfcutils | `02-catalogo/seguridad/catalogo/nfcutils/index.html` | E3-01 L3 | Referencia ATDS L3 |
| 4 | secure-delete | `02-catalogo/seguridad/catalogo/secure-delete/index.html` | E3-01 L3 | Referencia ATDS L3 |
| 5 | semgrep | `02-catalogo/testing-y-auditoria/semgrep/index.html` | L1 prioritario | ATDS L1, recursos completos |
| 6 | promptfoo | `02-catalogo/seguridad/catalogo/promptfoo/index.html` | NONE prioritario | Caso límite, recursos parciales |
| 7 | cargo-fuzz | `02-catalogo/pruebas-tecnicas/cargo-fuzz/index.html` | L1 prioritario | Template legacy sin `focus-visible` (allowlist) |
| 8 | mcp-inspector | `02-catalogo/pruebas-tecnicas/mcp-inspector/index.html` | L1 prioritario | Template legacy sin `focus-visible` (allowlist) |
| 9 | 0trace | `02-catalogo/seguridad/catalogo/0trace/index.html` | `nav` + `dt/dd` sueltos | Familia mayoritaria |
| 10 | adversarial-robustness-toolbox | `02-catalogo/seguridad/catalogo/adversarial-robustness-toolbox/index.html` | Sin nav/header | Familia minimalista |
| 11 | scanner (índice) | `02-catalogo/seguridad/catalogo/scanner/index.html` | Índice grande | 257 `style` inline, grid de cards |

### Criterios de aceptación del piloto

- [ ] `node scripts/validate-html-structure.mjs --strict --fail-on-error` pasa **solo**
      en los 11 archivos piloto (el resto del corpus sigue en advisory).
- [ ] `npm run check:release` pasa completo (check + verify:release + E2E).
- [ ] `scripts/verify-atlas.mjs` pasa sin cambios y `html-scan.mjs` sigue bloqueando.
- [ ] `SHA256SUMS.txt` regenerado y `sha256sum -c` OK para los 11 archivos.
- [ ] Manifiesto offline regenerado, con revisión nueva y cobertura de los 11 HTML.
- [ ] `reports/atds-validation.json` sin cambios; badge = `level`/`candidateLevel`.
- [ ] Base path probado en `/` y `/evol-tool-atlas/`.
- [ ] Sin scripts, sin recursos remotos, sin formularios, sin `<base>`.
- [ ] Identidad Fine Line Premium y contraste WCAG AA verificados.
- [ ] Las 9 entradas de allowlist se eliminan al migrar el template.

---

## 7. Fuera de alcance de PR #5

- No se migra ninguna ficha ni índice.
- No se modifica `catalogo.json`, `02-catalogo/`, `docs/diseno/` ni las políticas ATDS.
- No se toca `scripts/verify-atlas.mjs` ni `scripts/lib/html-scan.mjs`.
- No se abre PR #6 ni se inicia E3-02.
