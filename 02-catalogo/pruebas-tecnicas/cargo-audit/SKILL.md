---
name: atlas-cargo-audit
description: Guía operativa para usar cargo-audit (AT-SEC-005) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# cargo-audit — skill reutilizable de pruebas y auditoría técnica · dependencias

## Cuándo usar esta skill

- Se necesita aplicar cargo-audit sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `cargo audit --version` y registrar la versión.
3. Ejecutar el primer caso acotado: `cargo audit`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- La base de avisos debe actualizarse; una copia antigua produce falsos negativos.
- Un aviso no implica explotabilidad en este proyecto: revisar la ruta de dependencia y el uso real.
- No ejecutar herramientas que modifiquen dependencias sin revisar el diff y las pruebas.
- La salida puede revelar nombres de dependencias internas; tratarla según la política de información.
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

- [Repositorio RustSec](https://github.com/rustsec/rustsec)
- [Sitio de RustSec](https://rustsec.org/)
- [Base de avisos](https://github.com/rustsec/advisory-db)
