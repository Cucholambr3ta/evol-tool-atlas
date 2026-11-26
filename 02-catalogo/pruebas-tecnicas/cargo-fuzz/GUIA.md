# cargo-fuzz · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-003  
**Categoría Atlas:** Pruebas y auditoría técnica · Fuzzing  
**Versión de referencia verificada:** 0.13.2  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta cargo-fuzz. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

cargo-fuzz es un subcomando de Cargo que facilita la creación y ejecución de objetivos de fuzzing con libFuzzer. Genera entradas y busca fallos, especialmente en código que procesa datos no confiables.

En EVOL se propone para parsers, decodificadores y rutas de entrada de componentes Rust. No sustituye pruebas de seguridad completas ni garantiza ausencia de fallos.

## 2. Instalación manual

Requiere una toolchain nightly y un entorno Unix-like con soporte de sanitizers. El Atlas no verificó la instalación en el host.

### Linux

```bash
rustup toolchain install nightly
```

```bash
cargo install cargo-fuzz
```


### macOS

```bash
rustup toolchain install nightly
```

```bash
cargo install cargo-fuzz
```

Requiere las herramientas de compilación de Xcode y un compilador C++ compatible.


### Windows

No soportado oficialmente: libFuzzer necesita soporte de sanitizers y el README indica Unix-like, no Windows. Usar un entorno Linux autorizado si se necesita.


### Verificación básica de la instalación

```bash
cargo fuzz --version
```

```bash
rustc +nightly --version
```

## 3. Configuración

Inicializar el proyecto de fuzzing dentro de un crate:

```bash
cargo fuzz init
```

Añadir un objetivo:

```bash
cargo fuzz add parser
```

El objetivo generado vive en `fuzz/fuzz_targets/` y usa la macro `fuzz_target!`. Revisar el código generado antes de adaptarlo; no se debe asumir que el template cubre el parser real.

## 4. Primer uso

```bash
cargo fuzz run parser
```

```bash
cargo fuzz run parser -- -max_total_time=60
```

Fijar un límite de tiempo y recursos. Un fuzzer sin límites puede consumir CPU y disco de forma prolongada.

## 5. Uso avanzado

Reproducir una entrada concreta y obtener una traza:

```bash
cargo fuzz run parser artifacts/parser/crash-<hash>
```

Medir cobertura (requiere las herramientas de cobertura documentadas por el proyecto):

```bash
cargo fuzz coverage parser
```

Gestionar el corpus:

```bash
cargo fuzz corpus parser
```

El corpus y los artefactos pueden contener datos sensibles si se generaron a partir de entradas reales; no publicarlos sin revisión.

## 6. Seguridad, alcance y limitaciones

- Ejecutar en un entorno aislado y con límites de CPU, memoria, tiempo y disco.
- No usar entradas de producción sin autorización; el corpus y los crashes pueden contener datos personales o secretos.
- Los fallos encontrados requieren triaje y reproducción; un crash no implica por sí mismo una vulnerabilidad explotable.
- La toolchain nightly y los sanitizers cambian con frecuencia; fijar versiones y registrar la evidencia.


### Evidencia disponible

Registro EV-AT-SEC-003-01: PASS limitado a `--version` (0.13.2); no es una campaña de fuzzing.


## 7. Solución de problemas

### Error por falta de nightly

Instalar y usar la toolchain nightly; el proyecto requiere flags inestables.

### Falta de soporte de sanitizers o compilador C++

Instalar las dependencias de compilación del sistema y verificar que el target sea x86-64 o AArch64 en Unix.

### El fuzzer consume demasiado

Detenerlo y repetir con `-max_total_time`, límites de memoria y un corpus acotado.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/rust-fuzz/cargo-fuzz)
- [Rust Fuzz Book](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [Publicaciones oficiales](https://github.com/rust-fuzz/cargo-fuzz/releases)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
