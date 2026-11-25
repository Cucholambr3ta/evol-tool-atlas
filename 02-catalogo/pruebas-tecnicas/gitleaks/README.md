# Gitleaks · Evol Tool Atlas

**ID de catálogo:** AT-SEC-009  
**Categoría:** Pruebas y auditoría técnica · Secretos  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** 8.30.1.  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Detección de credenciales y secretos antes de publicar repositorios o artefactos de EVOL.

## Fuente original

- Repositorio oficial: https://github.com/gitleaks/gitleaks
- Publicaciones oficiales: https://github.com/gitleaks/gitleaks/releases
- Configuración de ejemplo: https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml

## Datos técnicos

- Licencia: MIT
- Sistemas: Linux, macOS y Windows (binarios de release)
- Dependencias: Binario único; Go o Docker como alternativas de instalación.
- Requisitos: Acceso al repositorio o directorio; configuración revisada para evitar falsos positivos.
- Mantenimiento: ACTIVO · última release 8.30.1 (2026-03-21)

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Un hallazgo confirma una coincidencia de regla, no necesariamente un secreto válido; y la ausencia de hallazgos no demuestra que no haya secretos.
- Los informes pueden contener el secreto o parte de él; restringir el acceso y rotar cualquier credencial expuesta.
- No usar allowlists amplias para "limpiar" el informe sin revisar cada caso.
- El historial de Git puede contener secretos aunque el árbol actual esté limpio.
- Ejecutar sobre copias autorizadas y no enviar el código a servicios externos sin revisar la política.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
