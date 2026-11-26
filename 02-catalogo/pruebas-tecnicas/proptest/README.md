# proptest · Evol Tool Atlas

**ID de catálogo:** AT-SEC-012  
**Categoría:** Pruebas y auditoría técnica · Property testing  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** 1.12.0.  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Probar invariantes de parsers, codecs y estructuras de datos de EVOL con entradas generadas.

## Fuente original

- Repositorio oficial: https://github.com/proptest-rs/proptest
- Libro de proptest: https://proptest-rs.github.io/proptest/intro.html
- Documentación de la API: https://docs.rs/proptest/latest/proptest/

## Datos técnicos

- Licencia: MIT OR Apache-2.0
- Sistemas: Linux, macOS y Windows con toolchain Rust (MSRV 1.88)
- Dependencias: Rust 1.88 o superior; crate de desarrollo `proptest` 1.12.
- Requisitos: Invariantes bien definidos y estrategias de generación adecuadas.
- Mantenimiento: ACTIVO · mantenimiento pasivo; versión 1.12.0 (2026-10-10)

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Las entradas generadas pueden ser muy grandes; limitar tamaño y tiempo para evitar consumo excesivo.
- No generar datos reales ni credenciales en las estrategias.
- Un test de propiedad que pasa no demuestra corrección total; depende de la propiedad y del espacio de entradas.
- Registrar la semilla o el caso reducido para reproducir fallos.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
