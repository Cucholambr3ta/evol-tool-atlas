# ETAPA 2 — Validador ATDS v1 · Informe de corrección E2-R3

**Repositorio:** https://github.com/Cucholambr3ta/evol-tool-atlas
**Rama:** `atlas/etapa-02-validador-atds` · **PR:** https://github.com/Cucholambr3ta/evol-tool-atlas/pull/2 (abierto, sin fusionar)
**Baseline (`main`):** `6517ec4e7e4ab6ecb477f9c179571ed33bdb29ef`
**SHA auditado (dictamen NO-GO focalizado):** `e939a6fbc85670b1922335bd0528bf6d56a5f8f5`
**SHA de la implementación E2-R3:** `a98928094e5ce40c747ce1e5399a3078017e31a7` — CI run [45915327655](https://github.com/Cucholambr3ta/evol-tool-atlas/actions/runs/45915327655): `success`
**Fecha:** 2026-11-26

> El SHA del commit que contiene este informe no se escribe aquí (sería autorreferente). El SHA final y su run de CI figuran en la descripción del PR #2 y en la respuesta de entrega.
>
> Este informe no constituye aprobación del gate E2. La aprobación corresponde a la auditoría independiente.

## 1. Commits de corrección (sobre `e939a6fb`)

| SHA | Mensaje | Hallazgos |
|---|---|---|
| `e24cf69c` | fix(atds): L1 provisional values, candidate/validated split, L2 depth, L4 artifact integrity | 03, 04, 05, 06, 09 |
| `40192ca5` | fix(atds): STRICT evaluates only the requested level policy | 01 |
| `5be00d66` | ci(atds): real STRICT gate with positive, negative and regression controls | 02 |
| `bab06d2b` | fix(types): resolvable .d.mts declarations, typecheck and lint tests | 07 |
| `a9892809` | chore: stop versioning generated ATDS report and agent cache | 08 |
| (este commit) | docs(etapa-02): informe y manifiesto E2-R3 | 10 |

## 2. Resultado por hallazgo

### E2-R3-01 — Política STRICT
`evaluateStrict()` (ahora en `scripts/lib/atds/evaluate.mjs`, importado por los tests) considera bloqueantes solo los hallazgos con `blocking: true` cuyo nivel sea ≤ al mínimo solicitado, más los estructurales (`STRUCT`). Los de niveles superiores se cuentan en `excludedHigherLevelIssues` y no bloquean. Nivel inválido y target inexistente (cualquiera de la lista, no solo cuando no coincide ninguno) lanzan `OperationalError` → exit 2. `NONE` es un mínimo válido (solo bloquean errores estructurales).

Ejemplos reales (CLI sobre el catálogo):

| Comando | Exit | Resultado |
|---|---|---|
| `--strict --targets semgrep --min-level L1` | 0 | PASS — L1; 6 hallazgos L2+ no bloquean |
| `--strict --targets semgrep --min-level L2` | 1 | FAIL — L1 < L2 |
| `--strict --targets promptfoo --min-level L1` | 1 | FAIL — NONE < L1 |
| `--strict --targets AT-SEC-001` | 0 | resuelve `id_catalogo` → semgrep |
| `--strict --targets semgrep --min-level L9` | 2 | nivel inválido |
| `--strict --targets semgrep,nope-tool` | 2 | target inexistente |

### E2-R3-02 — Gate CI
Eliminado `|| true`. El workflow ejecuta:
- `npm run validate:atds` (REPORT, 2.137 fichas; solo falla por error operacional, exit 2).
- `npm run gate:atds` (`scripts/atds-gate.mjs`): ejecuta la CLI real como subproceso y exige el código exacto de 19 controles; cualquier otro código hace fallar el paso. Fixtures en `fs.mkdtemp(os.tmpdir())`, eliminadas al terminar.

| Tipo | Controles | Código esperado |
|---|---|---|
| Positivos | REPORT sobre fixtures; política de no regresión; Semgrep L1/L1; fixtures L1, L1 con L2 incompleto, L2 CLI/GUI/API, L3, L4; copia intacta de semgrep | 0 |
| Negativos | Semgrep/L2; promptfoo/L1; fixture NONE/L1; fixture L1/L2; fixture L4 con artefacto secundario corrupto/L4; **copia de semgrep sin fuentes bajo la política L1** | 1 |
| Operacionales | nivel inválido; target inexistente; política con nivel inválido; argumento desconocido | 2 |

**Control de regresión:** `scripts/atds-strict-policy.json` fija, para las 12 herramientas prioritarias (alcance de la etapa), el nivel validado actual (9 × L1, 3 × NONE). No impone un mínimo al catálogo histórico. La capacidad de bloqueo se demuestra con la copia degradada de semgrep, que debe y produce exit 1. **No existe un gate por archivos modificados del PR**; no se declara.

### E2-R3-03 — Integridad L4
`checkEvidenceContent()` verifica el artefacto principal y cada `artefactos[]`: identidad (`nombre`), hash SHA-256 bien formado, ruta dentro de la raíz autorizada (`resolveWithin`: absoluta, traversal, NUL, symlink que escapa), existencia, fichero regular, hash calculado vs registrado, duplicados (nombre, ruta o hash), y coherencia `sha256` del registro con el principal. Cada resultado queda en `evidenceIntegrity[].artifacts[].status`.

Artefactos históricos sin ruta: si su hash coincide con el principal verificado → `VERIFIED_VIA_PRIMARY`; si no → `UNVERIFIABLE_NO_PATH`, advertencia y limitación registrada, sin integridad atribuida. No se inventan rutas ni se modifican evidencias. Un PASS solo soporta L4 si está completo (incluye `criterio_aceptacion` y `resultado_observado`), todos sus artefactos están verificados y no es una verificación de versión. `BLOCKED`, `FAIL` e `INCONCLUSIVE` nunca soportan L4. Se corrigió el falso positivo por el que `--disable-version-check` se interpretaba como verificación de versión.

Evidencias históricas (5 PASS): semgrep, cargo-audit y gitleaks → principal `VERIFIED`, binario `UNVERIFIABLE_NO_PATH`, salida `VERIFIED_VIA_PRIMARY`; cargo-fuzz → `VERIFIED` + `VERIFIED_VIA_PRIMARY`; promptfoo → verificación de versión (no funcional). Ninguna soporta L4 (además carecen de criterio de aceptación). Los 7 BLOCKED se conservan.

### E2-R3-04 — candidateLevel / validatedLevel
- `candidateLevel`: presencia acumulativa de recursos (metadata → GUIA.md → SKILL.md o casos → evidencia con ≥1 PASS). Indica potencial, no certifica.
- `validatedLevel`: cumplimiento acumulativo de los controles L1→L4.

Demostrado con fixtures: candidato L4/validado L1; L3/L2; L2/NONE; L4/L4; sin recursos NONE/NONE. Catálogo real: candidatos L1 = 2.125, L3 = 7, L4 = 5.

### E2-R3-05 — L1 sin valores provisionales
`isVerifiedValue()` se aplica a todos los campos L1 y L2. Rechaza nulos, vacíos, `NO_VERIFICADA/O`, `PENDIENTE`, `NO_DETERMINADO`, `DESCONOCIDO`, `N/A`, `TBD`, `POR_DEFINIR` y equivalentes con variaciones de mayúsculas, espacios, guiones y acentos, y valores con prefijo provisional (`NO_VERIFICADA_EN_HOST`). Los arrays valen si contienen al menos un valor verificado. URLs en hosts de ejemplo (`example.com`, `*.test`, `localhost`…) no cuentan como fuente (`L1_SOURCE_PLACEHOLDER_ONLY`). Se distinguen `L1_FUENTE_IDENTIFICADA` y `L1_FUENTE_CONTRASTADA` (estado + fecha ISO válida). `id`/`nombre` deben declararse en `metadata.json` (no se aceptan los inferidos del directorio). Sin verificación de red.

### E2-R3-06 — Diagnósticos DOC
Cada herramienta del reporte incluye `findings[]` con `doc`, `code`, `severity`, `level`, `toolId`, `file`, `field`, `message`, `action`, `blocking`. `issues`/`warnings` se conservan por compatibilidad; los marcadores en cascada (`L3_BLOCKED_BY_L2`) quedan solo en `issues` para no inflar los conteos. El resumen expone niveles validados y candidatos, estados, hallazgos por DOC y severidad, bloqueantes, `reviewRequired` y DOC-12. DOC-12 se registra como `INFO` no bloqueante: enlaces identificados **no comprobados** (no se afirma que estén rotos). En STRICT, la salida indica qué hallazgos bloquean el nivel solicitado.

### E2-R3-07 — Tipado y ESLint
Causa raíz: TypeScript resuelve `x.mjs` a `x.d.mts`; los `.d.ts` existentes nunca se usaban y `tests/global.d.ts` declaraba módulos relativos inválidos. Se renombraron a `.d.mts`, se reescribieron según las exportaciones reales, se eliminó `tests/global.d.ts` y todos los `@ts-expect-error`. `tsconfig.tests.json` comprueba `tests/**` (unit y e2e), las declaraciones y los configs; `npm run typecheck` lo incluye y CI ejecuta exactamente ese script (se quitó `--excludeDirectories tests`, que es una opción de watch sin efecto). Un test compara las exportaciones declaradas de cada `.d.mts` con `Object.keys()` del módulo real. ESLint evalúa `src`, `scripts` (todos los `.mjs` de producción y los `.d.mts`, con `no-explicit-any`) y `tests`; se retiró la exclusión de declaraciones.

### E2-R3-08 — Archivos generados
- `reports/atds-validation.json`: salida de `npm run validate:atds`, regenerable, sin consumidores en el repositorio.
- `.atlas-cache/normalizacion-journal.json`, `.atlas-cache/progreso.json`: estado de trabajo de un proceso externo de normalización por lotes; ningún script del repositorio los lee ni escribe (no son regenerables desde el repositorio, por lo que se conserva la copia local).

Retirados del índice con `git rm --cached` (copias locales intactas) e ignorados en `.gitignore`. El diff del PR contra `main` ya no los contiene. Para regenerar el reporte: `npm run validate:atds`.

### E2-R3-09 — Profundidad L2
Las secciones se detectan por encabezado (`#`/`##`), no por aparición de la palabra en el texto. Requisito sustantivo por tipo, evaluado sobre las secciones de procedimiento:
- CLI: ≥2 líneas de comando ejecutables (bloques de código o invocaciones en línea).
- GUI: ≥3 pasos ordenados; no exige flags ni comandos.
- API/SDK: ejemplo de solicitud y ejemplo de respuesta; no exige instalación por terminal.
- Servicio/otros: comandos o pasos ordenados.
Además se rechaza el contenido repetido en ≥3 secciones. Los conteos de backticks, bloques, flags, URLs y palabras clave quedan como señales (`GUIDE_LOW_SIGNAL_*`, advertencia). Probado: CLI, GUI y API válidas aprueban; guía con todas las secciones repetitivas, guía extensa sin procedimiento, GUI sin pasos y API sin respuesta se rechazan; guía breve pero suficiente aprueba.

### E2-R3-10 — Informe y manifiesto
Reescritos sin marcadores provisionales; solo datos verificados.

## 3. Validaciones (checkout limpio, `git worktree` en `a9892809`, Node 26.13.1 local)

| Comando | Exit | Resultado |
|---|---|---|
| `npm ci` | 0 | avisos de npm: paquetes deprecados (glob, eslint 9) y script de instalación de esbuild bloqueado por política local |
| `npm run typecheck` | 0 | app, service worker y tests |
| `npm run lint` | 0 | 0 errores, 0 advertencias |
| `npm run test:unit` | 0 | 6 archivos, 313 tests (152 en la suite ATDS) |
| `npm run validate:atds` | 0 | 2.137 fichas evaluadas |
| `npm run gate:atds` | 0 | 19/19 controles con el código esperado |
| `npm run check` | 0 | incluye build y verify:catalog |
| `npm run verify:catalog` | 0 | 49 categorías, 2.137 herramientas, 741 excluidas |

GitHub Actions run 45915327655 (evento `pull_request`, `headSha` = `a9892809…`): todos los pasos `success`; el log muestra 313 tests, las 19 líneas del gate y ninguna aparición de `|| true`. Anotación de GitHub: acciones v4 con Node 20 forzadas a Node 24 (aviso de plataforma, no un fallo).

## 4. Distribución ATDS (validador corregido)

| Nivel | Validado | Candidato |
|---|---|---|
| NONE | 2.128 | 0 |
| L1 | 9 | 2.125 |
| L2 | 0 | 0 |
| L3 | 0 | 7 |
| L4 | 0 | 5 |

Estados: FAIL 2.137 (frente al contrato completo L1–L4; indica requisitos pendientes, no un error del validador). Hallazgos: 18.814 (16.678 ERROR bloqueantes, 8 WARNING, 2.128 INFO DOC-12); 8 fichas requieren revisión humana.

La distribución validada coincide con la anterior. Explicación: los nuevos rechazos de L1 (por ejemplo `L1_UNVERIFIED_LICENCIA` en 1.261 fichas con `NO_VERIFICADA`) afectan a fichas que ya fallaban otros requisitos de L1 (`tipo`, `plataformas`, `limitaciones`, …). Las 9 fichas L1 cumplen todos los requisitos L1 con valores verificados. Ninguna alcanza L2: todas incumplen secciones obligatorias de su guía. No se forzaron niveles ni se modificaron fichas.

## 5. Conservación del catálogo
Sin cambios en `02-catalogo/` ni en `catalogo.json`: 49 categorías, 2.137 herramientas, 741 exclusiones (2.878 entradas), 12 prioritarias, 5 PASS y 7 BLOCKED históricos. No se descargó ni ejecutó ninguna herramienta catalogada. `07-laboratorio/` no se tocó.

## 6. Limitaciones residuales
- No hay gate por archivos modificados: la no regresión cubre las 12 prioritarias de la política explícita; el resto del catálogo solo se evalúa en REPORT.
- No hay verificación de red de enlaces (DOC-12 informativo).
- `normalizeMetadata` conserva equivalencias históricas: `funciones_principales` puede satisfacerse con `descripcion`, y `problema_que_resuelve` con `caso_uso_evol`. Endurecerlas cambiaría la clasificación de las 9 fichas L1 y queda fuera del alcance E2-R3.
- Las heurísticas de procedimiento (comandos, pasos, solicitud/respuesta) detectan estructura técnica, no corrección semántica; una guía bien estructurada pero errónea requiere revisión humana.
- El estado global (`FAIL` en todas) se calcula frente a L4; la lectura útil por ficha es `validatedLevel` y STRICT por política.
- Artefactos históricos sin ruta (binarios) no son verificables y no se les atribuye integridad.
