---
name: atlas-proptest
description: Guía operativa para usar proptest (AT-SEC-012) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# proptest — skill reutilizable de pruebas y auditoría técnica · property testing

## Cuándo usar esta skill

- Se necesita aplicar proptest sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `cargo tree -i proptest` y registrar la versión.
3. Ejecutar el primer caso acotado: `use proptest::prelude::*;

fn suma_es_conmutativa(a: i32, b: i32) -> bool {
    a.wrapping_add(b) == b.wrapping_add(a)
}

proptest! {
    #[test]
    fn conmutativa(a in any::<i32>(), b in any::<i32>()) {
        prop_assert!(suma_es_conmutativa(a, b));
    }
}`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Las entradas generadas pueden ser muy grandes; limitar tamaño y tiempo para evitar consumo excesivo.
- No generar datos reales ni credenciales en las estrategias.
- Un test de propiedad que pasa no demuestra corrección total; depende de la propiedad y del espacio de entradas.
- Registrar la semilla o el caso reducido para reproducir fallos.
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

- [Repositorio oficial](https://github.com/proptest-rs/proptest)
- [Libro de proptest](https://proptest-rs.github.io/proptest/intro.html)
- [Documentación de la API](https://docs.rs/proptest/latest/proptest/)
