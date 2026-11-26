# ETAPA 1 - INFORME DE RECUPERACIÓN Y PRESERVACIÓN DOCUMENTAL (CORREGIDA Y VERIFICADA)

## Objetivo

Recuperar el contenido especializado, los identificadores y las evidencias históricas de las 12 herramientas prioritarias afectadas por la generación masiva anterior.

## Reconciliación con auditoría (E1-01)

La auditoría independiente identificó que el diff real entre `e061d48c30c488016c2bfe5e660eaf01e28c907e` (HEAD inicial) y `bc50dea4458b5f9ff86f635e49744fa4ea0a776e` (HEAD auditado) mostraba **solo 3 archivos modificados**.

**Hallazgo:** Las 12 herramientas prioritarias **ya tenían sus IDs AT-SEC-001..012 correctos en la baseline `e061d48`** (commit `4672228` que las introdujo). No fue necesario "restaurar" los IDs porque nunca se perdieron en el historial Git.

## Qué sí se corrigió en esta etapa

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| **E1-02 SHA-256** | `02-catalogo/testing-y-auditoria/semgrep/SHA256SUMS.txt` | Actualizado hash de `metadata.json` tras la adición de `estado_mantenimiento` |
| | `02-catalogo/seguridad/catalogo/promptfoo/SHA256SUMS.txt` | Agregado hash de artefacto `evidencias/promptfoo-prueba.json` |
| | `02-catalogo/pruebas-tecnicas/cargo-fuzz/SHA256SUMS.txt` | Agregado hash de artefacto `evidencias/cargo-fuzz-version.json` |
| | `02-catalogo/pruebas-tecnicas/cargo-audit/SHA256SUMS.txt` | Agregado hash de artefacto `evidencias/cargo-audit-sondas.json` |
| | `02-catalogo/pruebas-tecnicas/gitleaks/SHA256SUMS.txt` | Agregado hash de artefacto `evidencias/gitleaks-prueba.json` |
| **E1-04 Pruebas regresión** | `tests/unit/etapa-01-recuperacion.test.ts` | 151 pruebas automatizadas focalizadas (REG-01 a REG-13) |
| **E1-03 Informe** | `reports/etapas/ETAPA-01-INFORME.md`, `reports/etapas/ETAPA-01-MANIFIESTO.json` | Documentos corregidos para reflejar la realidad del historial |
| **E1-04-A TypeScript** | `tests/unit/etapa-01-recuperacion.test.ts` | Interfaz `PriorityTool` unificada con `hasPassEvidence` |
| **E1-04-B no any** | `tests/unit/etapa-01-recuperacion.test.ts` | Tipos explícitos para `CatalogCategory`, `CatalogTool`, `EvidenceRecord`, `EvidenceFile` |
| **E1-04-C ES import** | `tests/unit/etapa-01-recuperacion.test.ts` | `import { createHash } from 'node:crypto'` |

## Verificación de las 12 herramientas prioritarias (baseline `e061d48` = commit `4672228`)

Todas las 12 herramientas **ya contenían** en `e061d48`:

| Herramienta | ID Catalogo | metadata.json ✓ | evidencias.json ✓ | casos-uso.json ✓ | GUIA.md ✓ | SKILL.md ✓ | SHA256SUMS.txt ✓ |
|-------------|-------------|-----------------|-------------------|------------------|-----------|------------|-------------------|
| Semgrep | AT-SEC-001 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (corregido) |
| promptfoo | AT-SEC-002 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (corregido) |
| cargo-fuzz | AT-SEC-003 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (corregido) |
| MCP Inspector | AT-SEC-004 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cargo-audit | AT-SEC-005 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (corregido) |
| Loom | AT-SEC-006 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dm-flakey | AT-SEC-007 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dm-log-writes | AT-SEC-008 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gitleaks | AT-SEC-009 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (corregido) |
| Miri | AT-SEC-010 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cargo-mutants | AT-SEC-011 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| proptest | AT-SEC-012 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Evidencias preservadas (confirmadas en baseline)

- **Semgrep**: 1 registro PASS (EV-AT-SEC-001-01) con fixture sintético, JSON y hash
- **promptfoo**: 1 registro PASS (EV-AT-SEC-002-01) verificación de versión
- **cargo-fuzz**: 1 registro PASS (EV-AT-SEC-003-01) verificación de versión
- **MCP Inspector**: 1 registro BLOCKED (EV-AT-SEC-004-BLOCKED-01) — sin evidencia funcional
- **cargo-audit**: 1 registro PASS (EV-AT-SEC-005-01) detección fixtures
- **Loom**: 1 registro BLOCKED (EV-AT-SEC-006-BLOCKED-01)
- **dm-flakey**: 1 registro BLOCKED (EV-AT-SEC-007-BLOCKED-01)
- **dm-log-writes**: 1 registro BLOCKED (EV-AT-SEC-008-BLOCKED-01)
- **Gitleaks**: 1 registro PASS (EV-AT-SEC-009-01) escaneo ~55 bytes
- **Miri**: 1 registro BLOCKED (EV-AT-SEC-010-BLOCKED-01)
- **cargo-mutants**: 1 registro BLOCKED (EV-AT-SEC-011-BLOCKED-01)
- **proptest**: 1 registro BLOCKED (EV-AT-SEC-012-BLOCKED-01)

## Pruebas de regresión ejecutadas (E1-04)

```
npm run test:unit -- tests/unit/etapa-01-recuperacion.test.ts
```

**Resultado: 151 pruebas PASARON / 0 fallaron**

| Código | Descripción | Estado |
|--------|-------------|--------|
| REG-01 | Existen las 12 herramientas prioritarias | ✅ 12/12 |
| REG-02 | Cada herramienta tiene id_catalogo AT-SEC-001..012 | ✅ 12/12 |
| REG-03 | Casos de uso coherentes con herramienta | ✅ 12/12 |
| REG-04 | Evidencias coherentes con herramienta | ✅ 12/12 |
| REG-05 | Sin marcadores AT-??? en registros normalizados | ✅ 12/12 |
| REG-06 | Evidencias PASS conservan referencias/artefactos/hashes | ✅ 5/5 (solo las que tienen PASS) |
| REG-07 | 7 registros BLOCKED históricos permanecen inalterados | ✅ 7/7 IDs verificados individualmente |
| REG-08 | SHA256SUMS.txt consistente — todos los archivos existen y hashes coinciden | ✅ 12/12 |
| REG-09 | Sin duplicados de identidades AT-SEC | ✅ 12 únicos |
| REG-10 | Catálogo preservado (49 cat, 2137 adm, 741 exc, 2878 total) | ✅ |
| REG-11 | Guías/skills estructurales + fixtures negativas rechazan plantillas | ✅ 12/12 + 2 fixtures negativas |
| REG-12 | Artefactos de evidencia PASS existen y hashes cruzados con SHA256SUMS | ✅ 5/5 |
| REG-13 | Pruebas negativas: validador detecta defectos (ID inválido, BLOCKED→PASS, evidencia sin artefacto, hash inválido, archivo faltante, path traversal, guía genérica, skill con placeholders) | ✅ 8/8 |

## Validaciones complementarias

```
npm run typecheck
```
✅ PASS — TypeScript strict mode compila sin errores

```
npm run test:unit
```
✅ PASS — 151 tests / 0 fallos

```
npm run validate:atds
```
✅ PASS — Total: 2,137 | L3: 2,123 | L4: 4 | NONE: 10 | Issues: 9 (MISSING_SOURCE en herramientas NO prioritarias)

```
npm run verify:catalog
```
✅ PASS — 49 categorías, 2,137 herramientas, 741 excluidas, 0 enlaces rotos

```
npm run lint
```
⚠️ 42 errores preexistentes en `scripts/lib/familias.js` y `scripts/normalizar-catalogo.mjs` (no relacionados con esta etapa)

## Discrepancia ZIP vs GitHub (E1-05)

La auditoría detectó que el ZIP histórico (`auditoria-documental-v2.3.2.zip`) contenía `GUIA.md` y `SKILL.md` para **todas las herramientas**, mientras que GitHub (baseline `e061d48`) solo los tiene para las **12 herramientas prioritarias** (commit `4672228`).

**Determinación:** No hay pérdida real de datos respecto a la baseline aprobada (`e061d48`). Las guías/skills masivas del ZIP no estaban versionadas en Git y muchas contenían texto genérico/placeholders (según hallazgos de auditoría previa). **No se importan automáticamente**; la recuperación masiva corresponde a etapas documentales posteriores (Etapa 5).

## Catálogo preservado (invariable)

- 49 categorías
- 2,137 herramientas admitidas
- 741 entradas excluidas
- 2,878 entradas totales

## Problemas conocidos (no bloqueantes para etapa 1)

1. **9 herramientas con MISSING_SOURCE** (sploitctl, torctl, netcon, msfdb, wordlistctl, windows-binaries, darkmysqli, webrute, webshells) — pertenecen a investigación documental posterior
2. **7 herramientas con evidencias BLOCKED** (MCP Inspector, Loom, dm-flakey, dm-log-writes, Miri, cargo-mutants, proptest) — estado correcto, no se convierten a FAIL/PASS
3. **Lint preexistente** — 42 errores en `scripts/lib/familias.js` y `scripts/normalizar-catalogo.mjs` ajenos a esta intervención

## Commits de corrección

1. `bc50dea` — `docs(etapa-01): add recovery report and manifest` (HEAD auditado original)
2. `6368c6e` — `fix(etapa-01): correct SHA-256 for semgrep metadata; add regression tests; update reports`
3. `309c088` — `fix(etapa-01): complete audit corrections E1-04` (HEAD corregido final)

---

**HEAD inicial etapa:** `e061d48c30c488016c2bfe5e660eaf01e28c907e`  
**HEAD auditado (NO-GO):** `bc50dea4458b5f9ff86f635e49744fa4ea0a776e`  
**HEAD corregido final:** `309c088d13596ac9492ca9b7d96803a3309a2111`  
**Rama:** `atlas/etapa-01-recuperacion`  
**Fecha:** 2026-11-26