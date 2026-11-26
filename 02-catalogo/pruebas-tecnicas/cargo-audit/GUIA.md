# cargo-audit · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-005  
**Categoría Atlas:** Pruebas y auditoría técnica · Dependencias  
**Versión de referencia verificada:** 0.23.0  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta cargo-audit. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

cargo-audit revisa un archivo `Cargo.lock` contra la base de datos pública RustSec y muestra avisos de seguridad conocidos en las dependencias.

En EVOL se propone como comprobación periódica de dependencias Rust y como puerta de CI. No detecta vulnerabilidades en código propio ni sustituye el análisis de licencias o de cadena de suministro.

## 2. Instalación manual

Se instala como subcomando de Cargo. El Atlas no verificó la instalación en el host.

### Linux

```bash
cargo install cargo-audit
```


### macOS

```bash
cargo install cargo-audit
```


### Windows

```powershell
cargo install cargo-audit
```


### Verificación básica de la instalación

```bash
cargo audit --version
```

```bash
cargo audit --help | head
```

## 3. Configuración

La configuración principal es la base de avisos y el archivo de lock. Para entornos sin red puede usarse una copia local con `--db` y `--no-fetch`.

Las excepciones deben ser explícitas y documentadas; no se recomienda ignorar avisos sin un análisis de impacto y una fecha de revisión.

En CI conviene fijar la versión y conservar la salida JSON como artefacto.

## 4. Primer uso

```bash
cargo audit
```

```bash
cargo audit --json --output audit.json
```

El código de salida no siempre es cero cuando hay avisos; revisar la documentación de la versión usada y no asumir que un fallo de proceso equivale a una vulnerabilidad explotable.

## 5. Uso avanzado

Auditoría con base local y sin red:

```bash
cargo audit --db ./advisory-db --no-fetch --json
```

Auditoría de un lock concreto:

```bash
cargo audit --file Cargo.lock
```

Las excepciones se documentan con justificación, propietario y fecha de caducidad; no se deben convertir en una lista permanente.

## 6. Seguridad, alcance y limitaciones

- La base de avisos debe actualizarse; una copia antigua produce falsos negativos.
- Un aviso no implica explotabilidad en este proyecto: revisar la ruta de dependencia y el uso real.
- No ejecutar herramientas que modifiquen dependencias sin revisar el diff y las pruebas.
- La salida puede revelar nombres de dependencias internas; tratarla según la política de información.


### Evidencia disponible

Registro EV-AT-SEC-005-01: PASS en detección positiva y negativa sobre fixtures, con base local.


## 7. Solución de problemas

### No se puede acceder a la base RustSec

Usar una copia local con `--db` y `--no-fetch`, y registrar la fecha de la base.

### El proyecto no tiene Cargo.lock

Generar el lock en el contexto adecuado; sin lock la auditoría no representa las versiones resueltas.

### Avisos en dependencias transitivas

Revisar la cadena, evaluar actualización o mitigación y documentar la decisión; no ignorar sin análisis.

## 8. Referencias oficiales

- [Repositorio RustSec](https://github.com/rustsec/rustsec)
- [Sitio de RustSec](https://rustsec.org/)
- [Base de avisos](https://github.com/rustsec/advisory-db)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
