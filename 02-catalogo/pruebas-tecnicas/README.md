# Pruebas y auditoría técnica · Categoría 49

Categoría complementaria del Evol Tool Atlas para herramientas de pruebas y auditoría técnica que no formaban parte del catálogo histórico.

## Herramientas

| ID Atlas | Herramienta | Función |
| --- | --- | --- |
| AT-SEC-003 | cargo-fuzz | Fuzzing de Rust con libFuzzer |
| AT-SEC-004 | MCP Inspector | Inspección de servidores MCP |
| AT-SEC-005 | cargo-audit | Avisos RustSec en dependencias |
| AT-SEC-006 | Loom | Permutaciones de concurrencia |
| AT-SEC-007 | dm-flakey | Fallos de E/S intermitentes (kernel) |
| AT-SEC-008 | dm-log-writes | Registro y reproducción de escrituras (kernel) |
| AT-SEC-009 | Gitleaks | Detección de secretos |
| AT-SEC-010 | Miri | Detección de comportamiento indefinido |
| AT-SEC-011 | cargo-mutants | Pruebas de mutación |
| AT-SEC-012 | proptest | Property testing |

Semgrep (AT-SEC-001, categoría 24) y promptfoo (AT-SEC-002, categoría 13) conservan su ubicación original y se documentan como recursos relacionados.

## Estructura de cada ficha

- `metadata.json`: datos normalizados y procedencia.
- `README.md`: resumen documental.
- `index.html`: ficha estática navegable.
- `GUIA.md`: guía técnica de uso seguro.
- `SKILL.md`: skill reutilizable para agentes.
- `casos-uso.json`: casos propuestos, no ejecutados.
- `evidencias.json`: evidencia real normalizada o estado BLOCKED.
- `SHA256SUMS.txt`: integridad de los archivos de la ficha.

## Advertencia

La inclusión no implica instalación ni aprobación. El Atlas no ejecuta pruebas. Las herramientas de kernel requieren laboratorio aislado y dispositivos desechables.
