---
name: atlas-loom
description: Guía operativa para usar Loom (AT-SEC-006) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# Loom — skill reutilizable de pruebas y auditoría técnica · concurrencia

## Cuándo usar esta skill

- Se necesita aplicar Loom sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `cargo tree -i loom` y registrar la versión.
3. Ejecutar el primer caso acotado: `use loom::sync::Arc;
use loom::sync::atomic::{AtomicUsize, Ordering};
use loom::thread;

#[test]
fn contador_concurrente() {
    loom::model(|| {
        let n = Arc::new(AtomicUsize::new(0));
        let a = n.clone();
        let t = thread::spawn(move || { a.fetch_add(1, Ordering::SeqCst); });
        n.fetch_add(1, Ordering::SeqCst);
        t.join().unwrap();
        assert_eq!(n.load(Ordering::SeqCst), 2);
    });
}`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Un resultado sin fallos no demuestra ausencia de carreras; Loom explora un subconjunto de ejecuciones.
- No usar Loom como sustituto de Miri, pruebas de estrés o revisión de diseño.
- Los modelos deben ser acotados; un modelo demasiado grande puede consumir memoria y tiempo.
- Ejecutar en un entorno de CI aislado y con límites.
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

- [Repositorio oficial](https://github.com/tokio-rs/loom)
- [Documentación de la API](https://docs.rs/loom)
- [Publicaciones oficiales](https://github.com/tokio-rs/loom/releases)
