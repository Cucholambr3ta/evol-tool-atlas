---
name: atlas-miri
description: Guía operativa para usar Miri (AT-SEC-010) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# Miri — skill reutilizable de pruebas y auditoría técnica · comportamiento indefinido

## Cuándo usar esta skill

- Se necesita aplicar Miri sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `rustup +nightly component list --installed | grep miri` y registrar la versión.
3. Ejecutar el primer caso acotado: `cargo +nightly miri test`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Miri no es un sandbox de seguridad; el aislamiento es una ayuda de determinismo, no una frontera de confianza.
- No usar Miri para generar claves o material criptográfico: sus APIs de aleatoriedad son simuladas.
- Un resultado sin errores no demuestra ausencia de UB; solo cubre las ejecuciones exploradas.
- Miri requiere nightly y puede cambiar; fijar el commit y registrar la versión.
- Ejecutar tests no confiables en un entorno aislado y con límites.
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

- [Repositorio oficial](https://github.com/rust-lang/miri)
- [Documentación de Miri](https://github.com/rust-lang/miri#readme)
- [Referencia de comportamiento indefinido](https://doc.rust-lang.org/reference/behavior-considered-undefined.html)
