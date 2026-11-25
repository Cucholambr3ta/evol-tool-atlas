# cargo-mutants · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-011  
**Categoría Atlas:** Pruebas y auditoría técnica · Mutación  
**Versión de referencia verificada:** 27.1.0  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta cargo-mutants. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

cargo-mutants inserta cambios en el código fuente y ejecuta los tests para comprobar si detectan el fallo. Ayuda a medir si la suite comprueba el comportamiento real, no solo si recorre el código.

En EVOL se propone para componentes Rust con tests estables. No sustituye la cobertura, la revisión de diseño ni las pruebas de seguridad.

## 2. Instalación manual

Se instala como subcomando de Cargo. El proyecto recomienda `--locked`. El Atlas no verificó la instalación ni ejecutó mutaciones.

### Linux

```bash
cargo install --locked cargo-mutants
```


### macOS

```bash
cargo install --locked cargo-mutants
```


### Windows

```powershell
cargo install --locked cargo-mutants
```


### Verificación básica de la instalación

```bash
cargo mutants --version
```

```bash
cargo mutants --help | head
```

## 3. Configuración

La configuración principal es el alcance de mutación: archivos, funciones y número de mutantes. Empezar por un archivo o un módulo evita ejecuciones largas.

Los tests deben ser deterministas y no depender de red, tiempo real ni estado externo. Un test flaky produce resultados de mutación poco fiables.

En CI, limitar el tiempo y los jobs, y conservar el informe para comparar entre revisiones.

## 4. Primer uso

```bash
cargo mutants --list
```

```bash
cargo mutants -f src/lib.rs
```

Revisar primero la lista de mutantes y el tiempo estimado. Una ejecución completa puede ser muy larga.

## 5. Uso avanzado

Limitar el tiempo por mutante:

```bash
cargo mutants --timeout 60 -f src/lib.rs
```

Ejecutar en paralelo con un número acotado de jobs:

```bash
cargo mutants --jobs 2
```

Analizar los mutantes no detectados: pueden indicar pruebas ausentes o equivalencias semánticas. No todos los mutantes no detectados son un fallo de la suite.

## 6. Seguridad, alcance y limitaciones

- Los mutantes se compilan y ejecutan; aislar el entorno y limitar recursos.
- No ejecutar sobre código que realice acciones irreversibles durante los tests.
- Los tests pueden acceder a datos reales si no están aislados; usar fixtures y variables de entorno de prueba.
- El informe puede revelar estructura interna del código; tratarlo según la política de información.



## 7. Solución de problemas

### La ejecución tarda demasiado

Limitar a un archivo, reducir jobs o usar timeout; empezar por el módulo más crítico.

### Tests flaky

Corregir la fuente de no determinismo antes de interpretar los resultados de mutación.

### Muchos mutantes no detectados

Revisar si son equivalentes o si faltan aserciones; no añadir tests triviales solo para subir la métrica.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/sourcefrog/cargo-mutants)
- [Manual](https://mutants.rs/)
- [Publicaciones oficiales](https://github.com/sourcefrog/cargo-mutants/releases)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
