# ETAPA 1 — INFORME DE RECUPERACIÓN Y PRESERVACIÓN DOCUMENTAL

**Rama:** `atlas/etapa-01-recuperacion`  
**Repositorio:** https://github.com/Cucholambr3ta/evol-tool-atlas  
**Fecha:** 2026-11-26

## Objetivo

Recuperar y preservar el contenido especializado, los identificadores y las evidencias históricas de las 12 herramientas prioritarias afectadas por la generación masiva anterior.

## Alcance de esta iteración

Los hallazgos E1-01, E1-02 y E1-05 ya fueron aceptados y **no se reabren**. Esta iteración corrige exclusivamente:

1. Aislamiento de la prueba negativa NEG-04.
2. Detección efectiva de documentación genérica con estructura completa.
3. Ejecución completa y trazable de las validaciones.
4. Pull Request auténtico y verificación de GitHub Actions.

No se regeneraron fichas, no se modificaron las 12 herramientas prioritarias y no se inició la Etapa 2.

## Correcciones realizadas

### 1. NEG-04 — aislamiento temporal

- El artefacto sintético se crea dentro de un directorio exclusivo `mkdtempSync(path.join(os.tmpdir(), 'evol-tool-atlas-negative-'))`.
- `validateEvidenceRecord` y `validateSha256Manifest` reciben ahora una **raíz documental autorizada explícita**. La misma lógica de resolución (incluida la comprobación de path traversal y de symlinks con `lstatSync`) se aplica a registros reales y sintéticos.
- No se crean excepciones especiales para la prueba.
- El `afterAll` elimina únicamente el directorio temporal creado por la prueba.
- Se eliminó el residuo histórico `tests/unit/fixtures/negative/test-tool/artifact.json` generado por la versión anterior de NEG-04.

**Resultado NEG-04:** PASS.

- Artefacto sintético en directorio temporal aislado.
- SHA-256 incorrecto registrado.
- El validador real detecta `EVIDENCE_HASH_MISMATCH`.
- Control positivo: con el SHA correcto el mismo registro pasa; si la detección se pierde, la aserción negativa falla.
- Sin residuos en el repositorio tras la ejecución.

### 2. Documentación genérica — REG-11 / NEG-11

`validateGuideStructure` ahora distingue:

- **ERROR `GENERIC_DOCUMENTATION`:** cuando concurren señales fuertes (≥3 frases genéricas distintas, o alta repetición de líneas / baja diversidad léxica combinadas con ausencia de marcadores técnicos).
- **WARNING:** señales débiles o aisladas, sin rechazar el documento.

La fixture obligatoria contiene todas las secciones requeridas, ID correcto, categoría, versión, fecha, introducción, instalación, configuración, primer uso, seguridad, limitaciones, advertencias, referencias, URL y longitud superior a 1000 caracteres; aun así es rechazada por `GENERIC_DOCUMENTATION`. Las 12 guías reales siguen superando la misma función.

**Resultado REG-11 / NEG-11:** PASS.

- Guía genérica con estructura completa → rechazada por contenido (`GENERIC_DOCUMENTATION`), sin errores de sección ausente.
- 12/12 guías reales → PASS.
- 12/12 skills reales → PASS.

**Nota metodológica:** esta validación es estructural y heurística; no sustituye una investigación semántica completa. La corrección integral de ATDS corresponde a la Etapa 2.

## Resultados reales de las validaciones

Se ejecutaron los comandos obligatorios en dos contextos, porque el árbol de trabajo local contiene cambios preexistentes no versionados ajenos a esta entrega:

- **Árbol de trabajo local:** incluye 4.253 archivos versionados modificados y dos scripts no versionados (`scripts/lib/familias.js`, `scripts/normalizar-catalogo.mjs`) que no existen en la baseline ni en `HEAD`.
- **Checkout limpio del commit publicado `8884630`:** es el estado real que evalúa GitHub Actions y el que se entrega.

### Checkout limpio del commit `8884630` (autoritativo, equivalente a CI)

| Comando | Código de salida | Resultado |
|---|---|---|
| `npm ci` | 0 | Dependencias instaladas desde `package-lock.json` |
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 0 | PASS — 0 errores (solo archivos versionados) |
| `npm run test:unit` | 0 | PASS — 5 archivos, **161/161 tests** |
| `npm run check` | 0 | PASS — generate:data + typecheck + lint + test + build + verify:catalog |
| `npm run validate:atds` | 0 | Ejecutado; ver detalle ATDS abajo |
| `npm run verify:catalog` | 0 | PASS — 49 categorías, 2.137 herramientas, 741 excluidas, 0 enlaces rotos |

### Árbol de trabajo local (con cambios preexistentes no versionados)

| Comando | Código de salida | Resultado |
|---|---|---|
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 1 | FAIL — 42 errores, todos en `scripts/lib/familias.js` y `scripts/normalizar-catalogo.mjs`, archivos **no versionados** |
| `npm run test:unit` | 0 | PASS — 5 archivos, 161/161 tests |
| `npm run check` | 1 | FAIL — se detiene en el lint anterior |
| `npm run validate:atds` | 0 | Ejecutado sobre metadatos locales enriquecidos (ver detalle) |
| `npm run verify:catalog` | 0 | PASS |

### Procedencia de los 42 errores de lint

- `scripts/lib/familias.js` y `scripts/normalizar-catalogo.mjs` **no existen** en la baseline `e061d48c30c488016c2bfe5e660eaf01e28c907e` ni en `HEAD` (`git ls-tree`).
- Son archivos locales no versionados del árbol de trabajo; no forman parte de la rama ni del PR.
- ESLint sobre los archivos versionados: **0 errores**.
- Checkout limpio y GitHub Actions: **lint PASS**.

No se excluyó ningún archivo del lint ni se modificó la configuración para fabricar un PASS.

### Detalle ATDS

- **Checkout limpio `8884630`:** `totalTools: 2137`, niveles `NONE: 2125`, `L4: 4`, `L1: 1`, `L3: 7`. Las **12 herramientas prioritarias no presentan incidencias** (están en L3/L4/L1). Las 2.125 herramientas restantes conservan el estado de baseline y quedan fuera del alcance de la Etapa 1; su enriquecimiento ATDS corresponde a la Etapa 2. El validador termina con código 0 porque reporta, no bloquea.
- **Árbol de trabajo local:** `L3: 2123`, `NONE: 10`, `L4: 4`, 9 incidencias `MISSING_SOURCE` en herramientas no prioritarias. Este resultado depende de cambios locales no versionados y **no representa el commit publicado**.

## Pruebas de la Etapa 1

```
npm run test:unit -- tests/unit/etapa-01-recuperacion.test.ts
```

**Resultado: 152/152 tests PASS.**

| Código | Descripción | Estado |
|--------|-------------|--------|
| REG-01 | Existen las 12 herramientas prioritarias | PASS 12/12 |
| REG-02 | Cada herramienta tiene id_catalogo AT-SEC-001..012 | PASS 12/12 |
| REG-03 | Casos de uso coherentes con herramienta | PASS 12/12 |
| REG-04 | Evidencias coherentes con herramienta | PASS 12/12 |
| REG-05 | Sin marcadores AT-??? en registros normalizados | PASS 12/12 |
| REG-06 | Evidencias PASS conservan referencias/artefactos/hashes | PASS 5/5 |
| REG-07 | 7 registros BLOCKED históricos permanecen inalterados | PASS 7/7 |
| REG-08 | SHA256SUMS.txt consistente — archivos existen y hashes coinciden | PASS 12/12 |
| REG-09 | Sin duplicados de identidades AT-SEC | PASS 12 únicos |
| REG-10 | Catálogo preservado (49/2137/741/2878) | PASS |
| REG-11 | Guías/skills estructurales + rechazo de guía genérica completa | PASS 12/12 + NEG-11 |
| REG-12 | Artefactos de evidencia PASS existen y hashes cruzados | PASS 5/5 |
| REG-13 | Pruebas negativas NEG-01..NEG-11 | PASS 11/11 |

**Total de pruebas unitarias del proyecto:** 161/161 (5 archivos), no solo la suite de Etapa 1.

## Conservación verificada

- 49 categorías.
- 2.137 herramientas admitidas.
- 741 exclusiones.
- 2.878 entradas totales.
- 12 identificadores `AT-SEC-001..012`.
- 5 evidencias PASS históricas.
- 7 evidencias BLOCKED históricas.
- Manifiestos SHA-256 consistentes.

## Pull Request y GitHub Actions

- **PR real:** https://github.com/Cucholambr3ta/evol-tool-atlas/pull/1
- **Número:** 1
- **Estado:** OPEN
- **Origen:** `atlas/etapa-01-recuperacion`
- **Destino:** `main`
- **SHA HEAD verificado:** `88846308409baea30d05fb371e4c33bbe3afd126`
- **Verificación:** segunda consulta REST API (`repos/.../pulls/1`) confirmó número, URL, estado, ramas y SHA.
- **Merge:** no realizado.

**GitHub Actions:**

- **Workflow:** `CI Evol Tool Atlas PWA`
- **Run ID:** `45758241230`
- **URL:** https://github.com/Cucholambr3ta/evol-tool-atlas/actions/runs/45758241230
- **Evento:** `pull_request`
- **SHA:** `88846308409baea30d05fb371e4c33bbe3afd126`
- **Estado:** `completed`
- **Conclusión:** `success`
- **Jobs:** `Validate, Test & Build PWA` — todos los pasos en `success`: checkout, `npm ci`, `generate:data`, typecheck, ESLint, unit tests, build PWA, `verify:catalog`.

## Incidencias pendientes

1. **2.125 herramientas fuera del alcance de Etapa 1** conservan metadatos ATDS de baseline (`NONE`). Su enriquecimiento corresponde a la Etapa 2.
2. **7 evidencias BLOCKED** permanecen correctamente en estado BLOCKED; no se convierten a PASS/FAIL.
3. **Archivos locales no versionados** (`scripts/lib/familias.js`, `scripts/normalizar-catalogo.mjs`) generan 42 errores de lint solo en el árbol de trabajo local. No están en la baseline, ni en `HEAD`, ni en el PR; el checkout limpio y CI pasan el lint. No se eliminaron para no destruir trabajo local del propietario.
4. **SHA final:** el SHA de este commit de documentación se comunica en la respuesta de entrega y en la descripción del PR, evitando una referencia circular dentro del propio commit. La ejecución de CI se re-verifica sobre ese SHA final.

## Commits de la etapa

1. `bc50dea` — `docs(etapa-01): add recovery report and manifest` (HEAD auditado original)
2. `6368c6e` — `fix(etapa-01): correct SHA-256 for semgrep metadata; add regression tests; update reports`
3. `309c088` — `fix(etapa-01): complete audit corrections E1-04`
4. `31b2d2b` — `fix(etapa-01): complete audit corrections E1-04`
5. `5f9d8a5` — `docs(etapa-01): final corrected reports and manifest` (HEAD auditado en esta iteración)
6. `8884630` — `fix(tests): isolate negative fixtures and reject generic guides`

---

**HEAD inicial etapa:** `e061d48c30c488016c2bfe5e660eaf01e28c907e`  
**HEAD auditado (NO-GO):** `5f9d8a519ec3c2ec88a0d77d220eaf786191fdcc`  
**HEAD de correcciones publicadas:** `88846308409baea30d05fb371e4c33bbe3afd126`  
**SHA final:** comunicado en la respuesta de entrega y en el PR (sin autorreferencia).
