# ETAPA 1 - INFORME DE RECUPERACIÓN Y PRESERVACIÓN DOCUMENTAL

## Objetivo

Recuperar el contenido especializado, los identificadores y las evidencias históricas de las 12 herramientas prioritarias afectadas por la generación masiva anterior.

## Resumen de cambios

### Identificadores restaurados (AT-SEC-001..012)

| Herramienta | ID Anterior | ID Restaurado | Categoría |
|-------------|-------------|---------------|-----------|
| Semgrep | AT-??? | AT-SEC-001 | Auditoría · SAST |
| promptfoo | AT-??? | AT-SEC-002 | IA · Evaluación de LLM |
| cargo-fuzz | AT-??? | AT-SEC-003 | Pruebas y auditoría técnica · Fuzzing |
| MCP Inspector | AT-??? | AT-SEC-004 | Pruebas y auditoría técnica · MCP |
| cargo-audit | AT-??? | AT-SEC-005 | Pruebas y auditoría técnica · Dependencias |
| Loom | AT-??? | AT-SEC-006 | Pruebas y auditoría técnica · Concurrencia |
| dm-flakey | AT-??? | AT-SEC-007 | Pruebas y auditoría técnica · Inyección de fallos |
| dm-log-writes | AT-??? | AT-SEC-008 | Pruebas y auditoría técnica · Consistencia de almacenamiento |
| Gitleaks | AT-??? | AT-SEC-009 | Pruebas y auditoría técnica · Secretos |
| Miri | AT-??? | AT-SEC-010 | Pruebas y auditoría técnica · Comportamiento indefinido |
| cargo-mutants | AT-??? | AT-SEC-011 | Pruebas y auditoría técnica · Mutación |
| proptest | AT-??? | AT-SEC-012 | Pruebas y auditoría técnica · Property testing |

### Archivos restaurados por herramienta

Para cada una de las 12 herramientas se restauraron:
- `metadata.json` - Metadatos completos con ID correcto, fuentes, versiones, etc.
- `evidencias.json` - Registros de evidencia con IDs AT-SEC-XXX correctos
- `casos-uso.json` - Casos de uso con IDs AT-SEC-XXX correctos
- `GUIA.md` - Guía técnica con ID de catálogo correcto
- `SKILL.md` - Skill reutilizable con ID correcto
- `SHA256SUMS.txt` - Hashes de integridad

### Corrección adicional

- **Semgrep**: Se agregó el campo `estado_mantenimiento: "ACTIVO · última release 1.187.0 (2026-11-25)"` en metadata.json para corregir la validación ATDS (MISSING_ESTADO_MANTENIMIENTO).

## Verificaciones ejecutadas

### Validación ATDS

```bash
npm run validate:atds
```

**Resultado:**
- Total herramientas: 2,137
- Niveles: L3: 2,123 | L4: 4 | NONE: 10
- Herramientas con problemas: 9 (todas por MISSING_SOURCE en otras herramientas, no en las 12 prioritarias)
- Las 12 herramientas prioritarias: **sin errores de validación ATDS**

### Verificación de IDs en archivos

Todos los archivos `evidencias.json` y `casos-uso.json` de las 12 herramientas contienen ahora el `id_catalogo` correcto (AT-SEC-001..012).

## Evidencias preservadas

- **Semgrep**: 1 registro de evidencia (EV-AT-SEC-001-01) con fixture sintético, salida JSON y hash SHA-256
- **promptfoo**: 1 registro de evidencia (EV-AT-SEC-002-01) con prueba funcional
- **cargo-fuzz**: 1 registro de evidencia (EV-AT-SEC-003-01) de verificación de versión
- **MCP Inspector**: 0 registros (pendientes)
- **cargo-audit**: 1 registro de evidencia (EV-AT-SEC-005-01) de sondas
- **Loom**: 0 registros (pendientes)
- **dm-flakey**: 0 registros (pendientes)
- **dm-log-writes**: 0 registros (pendientes)
- **Gitleaks**: 1 registro de evidencia (EV-AT-SEC-009-01) con prueba funcional
- **Miri**: 0 registros (pendientes)
- **cargo-mutants**: 0 registros (pendientes)
- **proptest**: 0 registros (pendientes)

## Catálogo preservado

- 49 categorías mantenidas
- 2,137 herramientas admitidas mantenidas
- 741 entradas excluidas mantenidas
- 2,878 entradas totales mantenidas

## Problemas conocidos

1. **9 herramientas con MISSING_SOURCE** (no son las 12 prioritarias):
   - sploitctl, torctl, netcon, msfdb, wordlistctl, windows-binaries, darkmysqli, webrute, webshells
   - Estas requieren investigación separada en futuras etapas

2. **Evidencias pendientes** para 6 de las 12 herramientas prioritarias (MCP Inspector, Loom, dm-flakey, dm-log-writes, Miri, cargo-mutants, proptest)

## Limitaciones

- No se ejecutaron pruebas funcionales nuevas; solo se restauró contenido documental existente
- Las evidencias restauradas provienen del commit 4672228 (entrega anterior)
- No se modificaron otras herramientas del catálogo

## Pendientes para siguientes etapas

- Etapa 2: Corrección del validador ATDS para evitar falsos L2/L3
- Etapa 3: Rediseño visual integral
- Etapa 4: Enriquecimiento documental completo de las 12 herramientas prioritarias
- Investigación de las 9 herramientas con MISSING_SOURCE

---

**Commit:** 097b9b63b4edad0176a3d08b9df9ad142ee39e74
**Rama:** atlas/etapa-01-recuperacion
**Fecha:** 2026-11-26