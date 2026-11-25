# Miri · Evol Tool Atlas

**ID de catálogo:** AT-SEC-010  
**Categoría:** Pruebas y auditoría técnica · Comportamiento indefinido  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** nightly (commit b526f1b236e1, 2026-11-24).  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Revisar código unsafe de EVOL Memory Engine y dependencias Rust antes de integrarlas.

## Fuente original

- Repositorio oficial: https://github.com/rust-lang/miri
- Documentación de Miri: https://github.com/rust-lang/miri#readme
- Referencia de comportamiento indefinido: https://doc.rust-lang.org/reference/behavior-considered-undefined.html

## Datos técnicos

- Licencia: MIT OR Apache-2.0
- Sistemas: Linux, macOS y Windows mediante toolchain nightly; mejor soporte con target Linux
- Dependencias: Rust nightly y componente miri; toolchain con la versión correspondiente.
- Requisitos: Tests o binario ejecutable; código que no dependa de APIs de plataforma no implementadas.
- Mantenimiento: ACTIVO · desarrollo vinculado a nightly (commit 2026-11-24)

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Miri no es un sandbox de seguridad; el aislamiento es una ayuda de determinismo, no una frontera de confianza.
- No usar Miri para generar claves o material criptográfico: sus APIs de aleatoriedad son simuladas.
- Un resultado sin errores no demuestra ausencia de UB; solo cubre las ejecuciones exploradas.
- Miri requiere nightly y puede cambiar; fijar el commit y registrar la versión.
- Ejecutar tests no confiables en un entorno aislado y con límites.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
