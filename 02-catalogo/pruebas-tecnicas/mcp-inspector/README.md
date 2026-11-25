# MCP Inspector · Evol Tool Atlas

**ID de catálogo:** AT-SEC-004  
**Categoría:** Pruebas y auditoría técnica · MCP  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** 2.16.0.  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Verificar contratos, herramientas y recursos de servidores MCP de EVOL antes de conectarlos a agentes.

## Fuente original

- Repositorio oficial: https://github.com/modelcontextprotocol/inspector
- Paquete npm: https://www.npmjs.com/package/@modelcontextprotocol/inspector
- Documentación MCP: https://modelcontextprotocol.io/

## Datos técnicos

- Licencia: Apache-2.0 (transición desde MIT; revisar LICENSE)
- Sistemas: Linux, macOS y Windows con Node.js 22.23.4+, 24.22.1+ o 26.12.1+
- Dependencias: Node.js y npm/npx; servidor MCP local o remoto.
- Requisitos: Definir si la inspección es local o remota; revisar permisos de las herramientas del servidor.
- Mantenimiento: ACTIVO · última release 2.16.0 (2026-11-18)

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Un servidor MCP puede exponer herramientas con efectos destructivos; inspeccionar primero el contrato y usar un servidor de pruebas.
- Las cabeceras y variables de entorno pueden contener credenciales; no incluirlas en capturas, informes ni evidencia.
- La inspección remota puede enviar datos al servidor y a proxies intermedios; revisar la política de red.
- El Inspector no certifica la seguridad del servidor: solo muestra su contrato y comportamiento observable.
- Revisar la licencia en transición (MIT/Apache-2.0) antes de redistribuir.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
