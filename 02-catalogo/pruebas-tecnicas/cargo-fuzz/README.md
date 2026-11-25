# cargo-fuzz · Evol Tool Atlas

**ID de catálogo:** AT-SEC-003  
**Categoría:** Pruebas y auditoría técnica · Fuzzing  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** 0.13.2.  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Fuzzing de parsers y rutas de entrada no confiable en componentes Rust de EVOL.

## Fuente original

- Repositorio oficial: https://github.com/rust-fuzz/cargo-fuzz
- Rust Fuzz Book: https://rust-fuzz.github.io/book/cargo-fuzz.html
- Publicaciones oficiales: https://github.com/rust-fuzz/cargo-fuzz/releases

## Datos técnicos

- Licencia: MIT OR Apache-2.0
- Sistemas: Linux y macOS (x86-64 y AArch64); Windows no soportado oficialmente
- Dependencias: Rust nightly, LLVM con soporte de sanitizers, compilador C++ con C++11.
- Requisitos: Toolchain nightly, target soportado, corpus y límites de ejecución.
- Mantenimiento: ACTIVO · última release 0.13.2 (2026-06-09)

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Ejecutar en un entorno aislado y con límites de CPU, memoria, tiempo y disco.
- No usar entradas de producción sin autorización; el corpus y los crashes pueden contener datos personales o secretos.
- Los fallos encontrados requieren triaje y reproducción; un crash no implica por sí mismo una vulnerabilidad explotable.
- La toolchain nightly y los sanitizers cambian con frecuencia; fijar versiones y registrar la evidencia.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
