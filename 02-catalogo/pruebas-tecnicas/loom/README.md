# Loom · Evol Tool Atlas

**ID de catálogo:** AT-SEC-006  
**Categoría:** Pruebas y auditoría técnica · Concurrencia  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** 0.7.3.  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Explorar interleavings en estructuras concurrentes de EVOL Memory Engine y detectar carreras lógicas.

## Fuente original

- Repositorio oficial: https://github.com/tokio-rs/loom
- Documentación de la API: https://docs.rs/loom
- Publicaciones oficiales: https://github.com/tokio-rs/loom/releases

## Datos técnicos

- Licencia: MIT
- Sistemas: Linux, macOS y Windows con toolchain Rust
- Dependencias: Rust estable; crate de desarrollo `loom` 0.7.
- Requisitos: Modelo acotado de la estructura concurrente y tests deterministas.
- Mantenimiento: ACTIVO · última release 0.7.3 (2026-11-08)

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Un resultado sin fallos no demuestra ausencia de carreras; Loom explora un subconjunto de ejecuciones.
- No usar Loom como sustituto de Miri, pruebas de estrés o revisión de diseño.
- Los modelos deben ser acotados; un modelo demasiado grande puede consumir memoria y tiempo.
- Ejecutar en un entorno de CI aislado y con límites.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
