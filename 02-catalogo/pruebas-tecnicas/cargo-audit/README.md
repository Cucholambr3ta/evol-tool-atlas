# cargo-audit · Evol Tool Atlas

**ID de catálogo:** AT-SEC-005  
**Categoría:** Pruebas y auditoría técnica · Dependencias  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** 0.23.0.  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Detección de dependencias Rust con avisos de seguridad antes de integrar componentes EVOL.

## Fuente original

- Repositorio RustSec: https://github.com/rustsec/rustsec
- Sitio de RustSec: https://rustsec.org/
- Base de avisos: https://github.com/rustsec/advisory-db

## Datos técnicos

- Licencia: MIT OR Apache-2.0 (RustSec)
- Sistemas: Linux, macOS y Windows con toolchain Rust
- Dependencias: Rust estable, acceso a la base RustSec o una copia local.
- Requisitos: Cargo.lock del proyecto y política de actualización de la base de avisos.
- Mantenimiento: ACTIVO · cargo-audit 0.23.0 (2026-11-10)

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- La base de avisos debe actualizarse; una copia antigua produce falsos negativos.
- Un aviso no implica explotabilidad en este proyecto: revisar la ruta de dependencia y el uso real.
- No ejecutar herramientas que modifiquen dependencias sin revisar el diff y las pruebas.
- La salida puede revelar nombres de dependencias internas; tratarla según la política de información.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
