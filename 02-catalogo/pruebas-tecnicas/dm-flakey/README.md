# dm-flakey · Evol Tool Atlas

**ID de catálogo:** AT-SEC-007  
**Categoría:** Pruebas y auditoría técnica · Inyección de fallos  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** kernel Linux (docs 7.4.0-rc4; host 7.3.5-2-cachyos).  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Probar la tolerancia a fallos de sistemas de archivos y capas de almacenamiento de EVOL OS.

## Fuente original

- Documentación del kernel: https://docs.kernel.org/admin-guide/device-mapper/dm-flakey.html
- Código en el árbol de Linux: https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/md/dm-flakey.c
- Documentación de device-mapper: https://docs.kernel.org/admin-guide/device-mapper/

## Datos técnicos

- Licencia: GPL-2.0-only (kernel Linux)
- Sistemas: Linux únicamente
- Dependencias: Kernel con CONFIG_DM_FLAKEY, device-mapper y dmsetup; dispositivo de bloque de pruebas.
- Requisitos: Root o CAP_SYS_ADMIN, dispositivo no productivo y copia de seguridad.
- Mantenimiento: MANTENIDO EN EL KERNEL · documentación y código en el árbol de Linux

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Riesgo ALTO: apuntar el target a un dispositivo real puede destruir datos. Usar únicamente dispositivos de pruebas desechables.
- Requiere privilegios de root o CAP_SYS_ADMIN; limitar el uso a entornos aislados.
- El módulo y el target forman parte del kernel: un fallo puede afectar a todo el sistema.
- Registrar siempre la tabla, el dispositivo y el momento de eliminación.
- No usar en producción ni en el host principal sin una autorización explícita y copia de seguridad verificada.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
