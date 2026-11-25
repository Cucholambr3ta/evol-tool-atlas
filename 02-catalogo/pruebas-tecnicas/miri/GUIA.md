# Miri · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-010  
**Categoría Atlas:** Pruebas y auditoría técnica · Comportamiento indefinido  
**Versión de referencia verificada:** nightly (commit b526f1b236e1, 2026-11-24)  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta Miri. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

Miri es un intérprete de Rust que ejecuta binarios y tests y detecta comportamiento indefinido: accesos fuera de límites, use-after-free, datos no inicializados, violaciones de alineación, carreras de datos y violaciones experimentales de las reglas de aliasing.

En EVOL se propone para revisar código unsafe y dependencias críticas. No demuestra que el código sea seguro ni que no tenga UB: solo detecta lo que ocurre en las ejecuciones que explora.

## 2. Instalación manual

Miri se instala como componente de la toolchain nightly mediante rustup. El Atlas no instaló ni ejecutó Miri.

### Linux

```bash
rustup toolchain install nightly
```

```bash
rustup +nightly component add miri
```


### macOS

```bash
rustup toolchain install nightly
```

```bash
rustup +nightly component add miri
```


### Windows

```powershell
rustup +nightly component add miri
```

No se verificó en el host.


### Verificación básica de la instalación

```bash
rustup +nightly component list --installed | grep miri
```

```bash
rustc +nightly --version
```

## 3. Configuración

Miri aísla el programa del sistema por defecto. Algunas APIs de entorno, reloj y aleatoriedad se sustituyen por implementaciones deterministas. `MIRIFLAGS="-Zmiri-disable-isolation"` permite acceder a APIs reales, pero el aislamiento no es un sandbox de seguridad.

Para detectar problemas de layout se puede usar `-Zrandomize-layout`; para variar la ejecución, `-Zmiri-seed`. Revisar las flags disponibles en la versión de nightly usada.

Miri no soporta la mayoría de APIs de red y muchas APIs específicas de plataforma. Los tests que dependen de ellas pueden necesitar adaptación o quedar fuera del alcance.

## 4. Primer uso

```bash
cargo +nightly miri test
```

```bash
cargo +nightly miri run
```

La primera ejecución puede instalar dependencias adicionales y pedir confirmación. Revisar qué se instala antes de aceptar.

## 5. Uso avanzado

Ejecutar un subconjunto de tests:

```bash
cargo +nightly miri test filtro
```

Permitir acceso al sistema (solo en entorno controlado):

```bash
MIRIFLAGS="-Zmiri-disable-isolation" cargo +nightly miri test
```

Combinar Miri con Loom: Miri detecta UB en una ejecución, Loom explora interleavings. Ninguno sustituye al otro.

## 6. Seguridad, alcance y limitaciones

- Miri no es un sandbox de seguridad; el aislamiento es una ayuda de determinismo, no una frontera de confianza.
- No usar Miri para generar claves o material criptográfico: sus APIs de aleatoriedad son simuladas.
- Un resultado sin errores no demuestra ausencia de UB; solo cubre las ejecuciones exploradas.
- Miri requiere nightly y puede cambiar; fijar el commit y registrar la versión.
- Ejecutar tests no confiables en un entorno aislado y con límites.



## 7. Solución de problemas

### Miri no está instalado para la toolchain

Ejecutar `rustup +nightly component add miri` y confirmar la toolchain usada por Cargo.

### El test usa una API no soportada

Aislar la parte testeable, usar cfg para excluir la API o documentar la limitación.

### La ejecución es muy lenta

Reducir el conjunto de tests y usar filtros; Miri interpreta el programa y es más lento que la ejecución nativa.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/rust-lang/miri)
- [Documentación de Miri](https://github.com/rust-lang/miri#readme)
- [Referencia de comportamiento indefinido](https://doc.rust-lang.org/reference/behavior-considered-undefined.html)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
