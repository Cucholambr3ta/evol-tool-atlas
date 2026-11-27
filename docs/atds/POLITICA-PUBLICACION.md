# Política de publicación ATDS (ATDS-PUBLISH-01)

Este documento fija qué bloquea una publicación del Atlas y qué solo se informa. Lo aplican
`npm run gate:atds` (STRICT) y `npm run validate:atds` (REPORT), ambos dentro de `npm run check`
y de `npm run check:release`.

## 1. Dos modos, dos propósitos

| Modo | Comando | Alcance | Bloquea |
|---|---|---|---|
| REPORT | `npm run validate:atds` | las 2.137 fichas | solo errores operacionales (exit 2) |
| STRICT | `npm run gate:atds` | políticas explícitas por herramienta | cualquier código de salida inesperado |

REPORT es un diagnóstico: describe el estado heredado y nunca falla por lagunas documentales
históricas. STRICT solo se aplica a las fichas que una política nombra con su nivel mínimo.

## 2. Políticas vigentes

| Política | Archivo | Fichas | Mínimo |
|---|---|---|---|
| E2 — 12 prioritarias | `scripts/atds-strict-policy.json` | semgrep, cargo-fuzz, mcp-inspector, cargo-audit, dm-flakey, dm-log-writes, gitleaks, miri, proptest (L1); promptfoo, loom, cargo-mutants (NONE) | el nivel validado medido en E2 |
| E3-01 — categorías con una herramienta | `scripts/atds-lote-e3-01-policy.json` | threat-dragon, sagan, nfcutils, secure-delete | L3 |

Cada lote nuevo añade **su propia** política con el nivel validado que alcanzó. No se modifica
una política aprobada para que un lote posterior pase.

## 3. Defectos globales frente a mínimos editoriales

- **Defectos estructurales globales** (bloquean en cualquier política, incluso NONE):
  `MISSING_METADATA`, `INVALID_METADATA_JSON`, `INVALID_CASOS_USO_JSON`,
  `INVALID_EVIDENCIAS_JSON`, `EVALUATION_ERROR`, rutas inseguras (`PATH_*`, `SYMLINK_ESCAPE`).
- **Mínimos editoriales por lote**: el nivel que fija cada política. Los hallazgos de niveles
  superiores al mínimo no bloquean esa política.
- **No se impone L1 a las 2.137 fichas históricas.** La línea base verificable es el REPORT de
  cada lote: sus conteos de niveles validados y candidatos se registran en el manifiesto del lote
  (`reports/etapas/*-MANIFIESTO.json`), y un lote no puede reducirlos fuera de su alcance.
  `NONE` nunca se promueve artificialmente a L1.

## 4. Controles del gate

`scripts/atds-gate.mjs` ejecuta el CLI real como subproceso y exige el código exacto:

- positivos (0): REPORT de fixtures, políticas E2 y E3-01, fixtures L1–L4, copias intactas;
- negativos (1): niveles insuficientes, artefacto secundario corrupto, tipo de prueba
  desconocido, versión envuelta (`env … --version`), identidad ajena, artefacto de otra ficha,
  copia degradada de semgrep sin fuentes, threat-dragon sin `GUIA.md`;
- operacionales (2): nivel inválido, target inexistente, política inválida, argumento desconocido.

Las degradaciones se hacen sobre copias temporales (`os.tmpdir`), nunca sobre el corpus. Ningún
paso de CI neutraliza un fallo con `|| true`.

## 5. Excepciones

- **Procedencia de artefactos (ATDS-14):** `scripts/atds-provenance-exceptions.json`. Cada
  excepción cubre un triple exacto (herramienta, ruta, sha256) y exige `motivo`, `aprobado_por` y
  `vence` (AAAA-MM-DD). Al vencer deja de aplicarse sola. Hoy la lista está vacía.
- **Cualquier otra excepción** a una política STRICT la aprueba el propietario del repositorio
  en el PR del lote, con motivo y fecha de vencimiento registrados en el informe del lote. El
  agente que implementa un lote no puede aprobar sus propias excepciones.

## 6. Qué significa NO VERIFICADO

Un control que no se ejecutó (falta un navegador, un servicio o una dependencia) se informa como
**NO VERIFICADO**, con el motivo. Nunca cuenta como PASS ni se excluye en silencio. Un lote con
controles obligatorios NO VERIFICADOS no puede declararse listo para fusionar.
