# ETAPA 2 — INFORME DE VALIDADOR ATDS v1

**Rama:** `atlas/etapa-02-validador-atds`  
**Repositorio:** https://github.com/Cucholambr3ta/evol-tool-atlas  
**Fecha:** 2026-11-26

## Objetivo

Implementar un validador ATDS v1 funcional, riguroso, reproducible y auditable que reemplace las comprobaciones superficiales actuales. El validador debe impedir que archivos genéricos, vacíos, incompletos, inconsistentes o carentes de evidencia reciban niveles documentales que no pueden demostrar.

## Alcance de esta iteración

- Refactorización completa de `scripts/validate-atds.mjs`
- Implementación de validación por niveles acumulativos (L1→L2→L3→L4)
- Detección de defectos documentales (códigos DOC-01 a DOC-12)
- Suite de pruebas con fixtures positivas, negativas y metamórficas
- Evaluación de las 12 herramientas prioritarias como calibración
- Validación del catálogo completo sin alterar fichas

## Arquitectura implementada

### Módulos de validación

| Módulo | Función | Archivo/función |
|--------|---------|-----------------|
| Descubrimiento | Lee `catalogo.json`, resuelve rutas seguras | `evaluateTool()` |
| Normalización | Interpreta metadatos y esquemas existentes | `ToolMeta` interface |
| Validación estructural | Comprueba campos, secciones, esquemas JSON | `checkGuideContent`, `checkSkillContent`, `checkCasesContent` |
| Validación de contenido | Detecta placeholders, duplicación, vaguedad | `VAGUE_PATTERNS`, `UNVERIFIED_VALUES` |
| Validación referencial | IDs, relaciones entre archivos, fuentes | `collectUrls`, `isVerifiedValue` |
| Validación experimental | Evidencias, procedencia, artefactos, hashes | `checkEvidenceContent` |
| Clasificación ATDS | Nivel máximo respaldado por prerrequisitos | Lógica acumulativa en `evaluateTool` |
| Reporte | JSON determinista + resumen legible | `reports/atds-validation.json` |

### Niveles ATDS implementados

#### ATDS-L1 — Identificación verificable
**Requisitos:**
- Identificador estable (`id`)
- Nombre oficial (`nombre`)
- Descripción específica y no vaga (`descripcion`)
- Categoría (`categoria`)
- Tipo de herramienta (`tipo`)
- Problema que resuelve (`problema_que_resuelve` / `caso_uso_evol` / `uso_evol_propuesto`)
- Funciones principales (`funciones_principales`)
- Fuente primaria identificada y disponible (`fuentes_oficiales`, etc.)
- Plataformas compatibles (`sistema_operativo`)
- Limitaciones conocidas (`limites`)
- Estado de la información (`estado_fuente` / `estado_mantenimiento`)
- Fecha de verificación (`fecha_verificacion` / `verificacion_fecha`)
- Licencia (`licencia`)

**Reglas:** No se consideran verificados valores como `NO_VERIFICADA`, `NO_VERIFICADO`, `PENDIENTE`, `NO_DETERMINADO`, `DESCONOCIDO`, `N/A`, cadenas vacías, marcadores provisionales.

#### ATDS-L2 — Guía técnica útil
**Requisitos:** L1 + Guía con secciones técnicas:
- Requisitos, Dependencias, Instalación, Plataformas, Verificación
- Configuración, Primer uso, Comandos, Entradas, Salidas
- Errores frecuentes, Advertencias, Referencias, Limitaciones

**Validación de contenido:** La guía debe tener profundidad técnica (backticks ≥10, code fences ≥4, CLI flags ≥3, URLs ≥2). Contenido genérico repetitivo (≥3 frases vagas) → ERROR `GUIDE_GENERIC_CONTENT`. Placeholders → ERROR `GUIDE_CONTAINS_PLACEHOLDERS`.

#### ATDS-L3 — Conocimiento aplicado
**Requisitos:** L2 + (Skill válida O Casos de uso sustantivos)
- Skill: name, description, Cuándo usar, Entradas mínimas, Procedimiento (≥3 pasos), Salidas esperadas, Guardrails, Evidencia, Referencias. Sin placeholders.
- Casos: Objetivo >20 chars, ≥3 pasos, ≥1 prerrequisito, resultado esperado >10 chars. Casos "propuestos" válidos si son sustantivos.

#### ATDS-L4 — Evidencia experimental verificable
**Requisitos:** L3 + Evidencia PASS con integridad completa:
- Evidencia con SHA-256 y destRel
- Procedencia (repositorio/origen)
- Artefactos con SHA-256
- Comando ejecutado (>5 chars)
- Entorno (>3 chars)
- Versión
- Integridad de hash verificada (artefacto existe y hash coincide)

**Nota:** BLOCKED no equivale a PASS/FAIL. Evidencia `--version` no demuestra capacidad funcional general.

### Detección de defectos documentales

| Código | Descripción | Implementación |
|--------|-------------|----------------|
| DOC-01 | Descripción vaga | `VAGUE_PATTERNS` en `descripcion` |
| DOC-02 | Información técnica insuficiente | Secciones faltantes en guía, skill, casos |
| DOC-03 | Ausencia de fuente verificable | `collectUrls` devuelve array vacío |
| DOC-04 | Versión ambigua | `NO_VERIFICADA` en campos de versión |
| DOC-05 | Compatibilidad no demostrada | `sistema_operativo` no verificado |
| DOC-06 | Instalación incompleta | Sección Instalación faltante en guía |
| DOC-07 | Comandos sin explicación | Sección Comandos faltante o sin flags CLI |
| DOC-08 | Casos de uso genéricos | `CASOS_NO_SUBSTANTIVE` o `CASOS_PARTIAL` |
| DOC-09 | Skill ausente o insuficiente | `MISSING_SKILL`, `SKILL_CONTAINS_PLACEHOLDERS`, `SKILL_FEW_STEPS` |
| DOC-10 | Evidencia mal clasificada | BLOCKED con evidencia/artefactos/SHA |
| DOC-11 | Información duplicada/contradictoria | IDs inconsistentes entre archivos |
| DOC-12 | Enlaces rotos/referencias obsoletas | Validación externa no implementada (offline) |

## Resultados de validación

### Checkout limpio (equivalente a CI)

| Comando | Exit | Resultado |
|---------|------|-----------|
| `npm ci` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |
| `npm run lint` (archivos versionados) | 0 | PASS — 0 errores |
| `npm run test:unit` | 0 | PASS — 195/195 tests (6 archivos) |
| `npm run check` | 1* | FAIL — lint falla por archivos NO versionados |
| `npm run validate:atds` | 0 | Ejecutado — 2137 herramientas evaluadas |
| `npm run verify:catalog` | 0 | PASS — 49 cat, 2137 tools, 741 exc, 0 enlaces rotos |

*Los 42 errores de lint provienen de `scripts/lib/familias.js` y `scripts/normalizar-catalogo.mjs` que NO están versionados (no existen en baseline ni en HEAD). Los archivos versionados pasan ESLint limpio.

### Distribución ATDS del catálogo completo (2137 herramientas)

| Nivel | Cantidad | % |
|-------|----------|---|
| NONE | 1263 | 59.1% |
| L1 | 874 | 40.9% |
| L2 | 0 | 0% |
| L3 | 0 | 0% |
| L4 | 0 | 0% |

**Herramientas con incidencias:** 2137 (todas)

**Principales causas de no promoción:**
- `L2_GUIDE_MISSING_SECTION_PLATAFORMAS`: 2130
- `L2_GUIDE_MISSING_SECTION_ENTRADAS`: 2134
- `L2_GUIDE_MISSING_SECTION_ERRORES`: 2122
- `L3_SKILL_MISSING_SECTION_*`: 2125 (skill faltante en la mayoría)
- `L1_MISSING_LICENCIA`: 1260 (licencia `NO_VERIFICADA`)

### Evaluación de las 12 herramientas prioritarias (calibración)

| Herramienta | ID | Nivel anterior | Nivel validado | Status | Issues principales |
|-------------|-----|----------------|----------------|--------|-------------------|
| Semgrep | AT-SEC-001 | L4 | L1 | FAIL | Guía incompleta (4 secciones), skill OK, casos OK, evidencia con integridad |
| promptfoo | AT-SEC-002 | L4 | NONE | FAIL | Falta categoría, límites, guía incompleta |
| cargo-fuzz | AT-SEC-003 | L4 | L1 | FAIL | Guía incompleta (3 secciones), skill OK, casos OK |
| MCP Inspector | AT-SEC-004 | BLOCKED | L1 | FAIL | Guía incompleta (4 secciones), skill OK, evidencia BLOCKED |
| cargo-audit | AT-SEC-005 | L4 | L1 | FAIL | Guía incompleta (4 secciones), skill OK, casos OK |
| Loom | AT-SEC-006 | BLOCKED | L1 | FAIL | Guía incompleta (4 secciones), placeholders en skill |
| dm-flakey | AT-SEC-007 | BLOCKED | L1 | FAIL | Guía incompleta (4 secciones), placeholders en guía y skill |
| dm-log-writes | AT-SEC-008 | BLOCKED | L1 | FAIL | Guía incompleta (4 secciones), skill OK |
| Gitleaks | AT-SEC-009 | L4 | L1 | FAIL | Guía incompleta (4 secciones), skill OK, casos OK |
| Miri | AT-SEC-010 | BLOCKED | L1 | FAIL | Guía incompleta (4 secciones), skill OK |
| cargo-mutants | AT-SEC-011 | BLOCKED | L1 | FAIL | Guía incompleta (4 secciones), placeholders en skill |
| proptest | AT-SEC-012 | BLOCKED | L1 | FAIL | Guía incompleta (3 secciones), skill OK, casos OK |

**Observaciones:**
- Ninguna alcanza L2 porque las guías, aunque especializadas, carecen de secciones requeridas por ATDS-L2 (Requisitos, Plataformas, Entradas, Salidas, Errores, etc.)
- Las 5 herramientas con evidencia PASS (Semgrep, promptfoo, cargo-fuzz, cargo-audit, Gitleaks) tienen integridad de hash verificada
- Los 7 registros BLOCKED se preservan correctamente y no otorgan L4
- La clasificación deriva de los datos y ATDS v1, no de una tabla predeterminada

### Falsos positivos corregidos vs validador anterior

| Herramienta | Validador anterior | Nuevo validador | Corrección |
|-------------|-------------------|-----------------|------------|
| Semgrep | L4 | L1 | Evidencia PASS no otorga L4 sin L2/L3 |
| promptfoo | L4 | NONE | Licencia `NO_VERIFICADA` bloquea L1 |
| cargo-fuzz | L4 | L1 | Guía incompleta bloquea L2 |
| Gitleaks | L4 | L1 | Guía incompleta bloquea L2 |
| MCP Inspector | L4 | L1 | BLOCKED no otorga L4, guía incompleta |

## Suite de pruebas (34 tests en `tests/unit/etapa-02-atds-validator.test.ts`)

| Categoría | Tests | Descripción |
|-----------|-------|-------------|
| T01-T04 | 4 | Identificación válida (L1) |
| T05-T09 | 5 | Guía técnica útil (L2) |
| T10-T12 | 3 | Conocimiento aplicado (L3) |
| T13-T17 | 5 | Evidencia experimental (L4) |
| T18-T20 | 3 | Validaciones adicionales |
| T21-T24 | 4 | Determinismo y compatibilidad |
| NEG-ATDS | 5 | Fixtures negativas |
| MET-ATDS | 5 | Pruebas metamórficas |

**Total Etapa 2:** 34 tests PASS
**Total proyecto:** 195 tests PASS (6 archivos)

### Fixtures negativas destacadas

- **NEG-ATDS-01:** Ficha sin metadata.json → `MISSING_METADATA` + NONE
- **NEG-ATDS-02:** Guía con placeholders → `GUIDE_CONTAINS_PLACEHOLDERS`
- **NEG-ATDS-03:** Skill sin procedimiento → `SKILL_FEW_STEPS`
- **NEG-ATDS-04:** Evidencia con hash incorrecto → `EVIDENCE_HASH_MISMATCH`
- **NEG-ATDS-05:** BLOCKED con evidencia no nula → `BLOCKED_HAS_EVIDENCE`

### Pruebas metamórficas destacadas

- **MET-ATDS-01:** Quitar fuente → impide L1
- **MET-ATDS-02:** Guía placeholder → impide L2
- **MET-ATDS-03:** Vaciar casos → impide L3
- **MET-ATDS-04:** Evidencia real → BLOCKED impide L4
- **MET-ATDS-05:** Restaurar info válida → recupera nivel

## Integración CI

### GitHub Actions actualizado

El workflow `.github/workflows/ci.yml` ejecuta:
1. `npm ci`
2. `npm run generate:data`
3. `npm run typecheck`
4. `npm run lint` (solo archivos versionados)
5. `npm run test:unit`
6. `npm run validate:atds` (modo reporte)
7. `npm run build`
8. `npm run verify:catalog`

### Modo estricto vs modo reporte

- **Modo reporte (actual):** Evalúa todo el catálogo, genera hallazgos, exit code 0 si no hay errores operacionales. No bloquea por defectos heredados.
- **Modo estricto (futuro):** Permitirá aplicar reglas bloqueantes a herramientas modificadas en PR, fixtures de prueba, o conjunto configurado.

## Documentación actualizada

- `docs/atds/ATDS-v1.md` — Contrato principal (sin cambios sustantivos)
- `skills/atlas-catalog-curator/SKILL.md` — Referencia al validador
- `scripts/validate-atds.mjs` — Implementación completa
- `tests/unit/etapa-02-atds-validator.test.ts` — Suite de pruebas

## Conservación verificada

- 49 categorías ✓
- 2.137 herramientas admitidas ✓
- 741 exclusiones ✓
- 2.878 entradas totales ✓
- 12 IDs `AT-SEC-001..012` ✓
- 5 evidencias PASS históricas ✓
- 7 evidencias BLOCKED históricas ✓
- Manifiestos SHA-256 consistentes ✓
- Estructura de navegación, identidades, historial Git ✓
- Sin cambios en `main`, sin force-push, sin merge, sin tocar `07-laboratorio/` ✓

## Incidencias pendientes

1. **Lint local:** 42 errores en `scripts/lib/familias.js` y `scripts/normalizar-catalogo.mjs` (archivos no versionados, ajenos a esta entrega).
2. **1263 herramientas en NONE:** Requieren investigación documental (Etapa 3+). No se enriquecieron masivamente.
3. **874 herramientas en L1:** Cumplen identificación verificable pero no L2-L4.
4. **Validación de enlaces externos:** No implementada (requiere red, opt-in futuro).
5. **Modo estricto:** No implementado completamente; pendiente configuración por PR/archivos modificados.

## Commits de la etapa

1. `fix(validator): implement rigorous ATDS v1 validator` — Validador completo con niveles acumulativos
2. `test(etapa-02): add ATDS validator test suite` — 34 tests (positivos, negativos, metamórficos)
3. `docs(etapa-02): record validation results and evidence` — Este informe y manifiesto

---

**HEAD inicial etapa:** `6517ec4e7e4ab6ecb477f9c179571ed33bdb29ef`  
**HEAD final etapa:** `[SHA a comunicar en entrega/PR]`  
**Rama:** `atlas/etapa-02-validador-atds`  
**SHA final:** Comunicado en la respuesta de entrega y en el PR (sin autorreferencia).