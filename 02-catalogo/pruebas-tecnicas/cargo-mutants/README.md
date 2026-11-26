# cargo-mutants · Evol Tool Atlas

**ID de catálogo:** AT-SEC-011  
**Categoría:** Pruebas y auditoría técnica · Mutación  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** 27.1.0.  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Medir la calidad de la suite de pruebas de componentes Rust de EVOL.

## Fuente original

- Repositorio oficial: https://github.com/sourcefrog/cargo-mutants
- Manual: https://mutants.rs/
- Publicaciones oficiales: https://github.com/sourcefrog/cargo-mutants/releases

## Datos técnicos

- Licencia: MIT
- Sistemas: Linux, macOS y Windows con toolchain Rust
- Dependencias: Rust estable, tests que pasan de forma determinista.
- Requisitos: Suite de tests no flaky; tiempo de ejecución acotado y política de mutantes.
- Mantenimiento: ACTIVO · última release v27.1.0 (2026-06-02); proyecto de mantenimiento parcial

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Los mutantes se compilan y ejecutan; aislar el entorno y limitar recursos.
- No ejecutar sobre código que realice acciones irreversibles durante los tests.
- Los tests pueden acceder a datos reales si no están aislados; usar fixtures y variables de entorno de prueba.
- El informe puede revelar estructura interna del código; tratarlo según la política de información.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
