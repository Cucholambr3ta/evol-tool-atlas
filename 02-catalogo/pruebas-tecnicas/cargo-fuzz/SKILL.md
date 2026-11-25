---
name: atlas-cargo-fuzz
description: Guía operativa para usar cargo-fuzz (AT-SEC-003) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# cargo-fuzz — skill reutilizable de pruebas y auditoría técnica · fuzzing

## Cuándo usar esta skill

- Se necesita aplicar cargo-fuzz sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `cargo fuzz --version` y registrar la versión.
3. Ejecutar el primer caso acotado: `cargo fuzz run parser`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Ejecutar en un entorno aislado y con límites de CPU, memoria, tiempo y disco.
- No usar entradas de producción sin autorización; el corpus y los crashes pueden contener datos personales o secretos.
- Los fallos encontrados requieren triaje y reproducción; un crash no implica por sí mismo una vulnerabilidad explotable.
- La toolchain nightly y los sanitizers cambian con frecuencia; fijar versiones y registrar la evidencia.
- No ejecutar desde el Atlas ni desde la PWA.
- No incluir credenciales, secretos, rutas privadas ni datos personales en la evidencia.
- No declarar PASS sin una ejecución real y verificable.

## Evidencia y trazabilidad

- Registrar cada ejecución real en el formato `evol-tool-atlas/evidencias/1`.
- Guardar comando, versión, entorno, fecha, salida relevante y hash del artefacto.
- Estados permitidos: `PASS`, `FAIL`, `BLOCKED`, `INCONCLUSIVE`.
- No convertir un resultado parcial en PASS. Si no se ejecutó, el estado correcto es `BLOCKED`.
- No incluir credenciales, tokens, rutas privadas ni datos de clientes en la evidencia.

## Referencias

- [Repositorio oficial](https://github.com/rust-fuzz/cargo-fuzz)
- [Rust Fuzz Book](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [Publicaciones oficiales](https://github.com/rust-fuzz/cargo-fuzz/releases)
