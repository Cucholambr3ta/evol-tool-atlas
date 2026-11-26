# Loom · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-006  
**Categoría Atlas:** Pruebas y auditoría técnica · Concurrencia  
**Versión de referencia verificada:** 0.7.3  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta Loom. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

Loom ejecuta un test concurrente muchas veces, permutando las ejecuciones posibles bajo el modelo de memoria C11. Aplica reducción de estado para evitar una explosión combinatoria.

En EVOL se propone para validar estructuras de concurrencia acotadas, no para probar sistemas completos. Es complementario a Miri y a pruebas de estrés.

## 2. Instalación manual

Loom es una dependencia de desarrollo; no se instala como binario global. Se añade al `Cargo.toml` del crate que se va a probar.

### Linux

```toml
[target.'cfg(loom)'.dependencies]
loom = "0.7"
```


### macOS

Mismo procedimiento: añadir la dependencia de desarrollo y compilar con la cfg de Loom.


### Windows

Con Rust instalado, el procedimiento es el mismo; no se verificó en el host.


### Verificación básica de la instalación

```bash
cargo tree -i loom
```

```bash
RUSTFLAGS="--cfg loom" cargo test --release
```

## 3. Configuración

El código bajo prueba debe abstraer las primitivas de sincronización para usar `loom::sync` cuando `cfg(loom)` está activo. Un patrón habitual es un módulo de compatibilidad que reexporta `std` o `loom` según la cfg.

El test debe crear un modelo con `loom::model` y usar `loom::thread` para las tareas. No se debe ejecutar el modelo contra el sistema real.

## 4. Primer uso

```rust
use loom::sync::Arc;
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
}
```

```bash
RUSTFLAGS="--cfg loom" cargo test --test contador_concurrente --release
```

El ejemplo es una adaptación mínima del patrón documentado; debe revisarse contra la API de la versión 0.7 antes de usarlo en un proyecto real.

## 5. Uso avanzado

Ejecutar solo el modelo de concurrencia:

```bash
RUSTFLAGS="--cfg loom" cargo test --release modelo_
```

Aumentar el límite de permutaciones implica más tiempo y memoria; documentar el límite usado y no presentar un resultado acotado como prueba exhaustiva.

Loom no implementa todo el modelo C11: `SeqCst` se trata como `AcqRel` y no explora todos los comportamientos de load buffering. Leer las limitaciones oficiales antes de interpretar un PASS.

## 6. Seguridad, alcance y limitaciones

- Un resultado sin fallos no demuestra ausencia de carreras; Loom explora un subconjunto de ejecuciones.
- No usar Loom como sustituto de Miri, pruebas de estrés o revisión de diseño.
- Los modelos deben ser acotados; un modelo demasiado grande puede consumir memoria y tiempo.
- Ejecutar en un entorno de CI aislado y con límites.



## 7. Solución de problemas

### El código usa `std::sync` y Loom no lo intercepta

Abstraer las primitivas y usar `loom::sync` bajo `cfg(loom)`.

### El test tarda demasiado o agota memoria

Reducir el número de hilos/operaciones y documentar el límite; no aumentar sin control.

### Falsos positivos con SeqCst

Revisar las limitaciones oficiales; Loom trata SeqCst como AcqRel.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/tokio-rs/loom)
- [Documentación de la API](https://docs.rs/loom)
- [Publicaciones oficiales](https://github.com/tokio-rs/loom/releases)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
