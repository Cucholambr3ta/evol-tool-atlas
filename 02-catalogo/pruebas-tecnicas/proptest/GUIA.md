# proptest · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-012  
**Categoría Atlas:** Pruebas y auditoría técnica · Property testing  
**Versión de referencia verificada:** 1.12.0  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta proptest. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

proptest es un framework de property testing inspirado en Hypothesis. Genera entradas arbitrarias, comprueba propiedades y reduce automáticamente un fallo a un caso mínimo reproducible.

En EVOL se propone para parsers, codecs y estructuras de datos donde una propiedad debe cumplirse para todas las entradas. Complementa los tests unitarios con ejemplos concretos.

## 2. Instalación manual

Es una dependencia de desarrollo del crate; no se instala como binario global. El Atlas no añadió ni ejecutó proptest en ningún proyecto.

### Linux

```toml
[dev-dependencies]
proptest = "1.12.0"
```


### macOS

Mismo procedimiento con Cargo.


### Windows

Mismo procedimiento con Cargo; requiere Rust 1.88 o superior.


### Verificación básica de la instalación

```bash
cargo tree -i proptest
```

```bash
cargo test --no-run
```

## 3. Configuración

Las propiedades se escriben con la macro `proptest!`. Las estrategias definen el espacio de entradas y el framework reduce los fallos.

El número de casos puede ajustarse con la configuración del test o con variables de entorno documentadas por el proyecto; registrar el valor usado para que el resultado sea reproducible.

Evitar generadores que produzcan entradas irreales o demasiado grandes. Una propiedad mal definida puede dar falsos positivos o pasar sin comprobar nada.

## 4. Primer uso

```rust
use proptest::prelude::*;

fn suma_es_conmutativa(a: i32, b: i32) -> bool {
    a.wrapping_add(b) == b.wrapping_add(a)
}

proptest! {
    #[test]
    fn conmutativa(a in any::<i32>(), b in any::<i32>()) {
        prop_assert!(suma_es_conmutativa(a, b));
    }
}
```

```bash
cargo test conmutativa
```

El ejemplo es mínimo y solo demuestra el patrón; debe adaptarse a una propiedad real del componente.

## 5. Uso avanzado

Ejecutar un número mayor de casos (variable documentada por proptest; confirmar el nombre en la versión usada):

```bash
PROPTEST_CASES=1000 cargo test
```

Persistir un caso fallido como regresión:

```bash
cargo test -- --nocapture
```

Usar estrategias compuestas y `prop_compose!` para generar estructuras válidas. Revisar la documentación de la API antes de definir generadores complejos.

## 6. Seguridad, alcance y limitaciones

- Las entradas generadas pueden ser muy grandes; limitar tamaño y tiempo para evitar consumo excesivo.
- No generar datos reales ni credenciales en las estrategias.
- Un test de propiedad que pasa no demuestra corrección total; depende de la propiedad y del espacio de entradas.
- Registrar la semilla o el caso reducido para reproducir fallos.



## 7. Solución de problemas

### La compilación falla por MSRV

Actualizar Rust a 1.88 o superior, o usar una versión compatible de proptest.

### El test tarda demasiado

Reducir casos, acotar el tamaño de las estrategias o filtrar el test concreto.

### Un fallo no se reproduce

Conservar la semilla y el caso reducido; revisar si la estrategia depende de estado externo.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/proptest-rs/proptest)
- [Libro de proptest](https://proptest-rs.github.io/proptest/intro.html)
- [Documentación de la API](https://docs.rs/proptest/latest/proptest/)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
