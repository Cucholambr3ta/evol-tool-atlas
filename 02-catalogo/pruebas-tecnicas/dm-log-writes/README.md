# dm-log-writes · Evol Tool Atlas

**ID de catálogo:** AT-SEC-008  
**Categoría:** Pruebas y auditoría técnica · Consistencia de almacenamiento  
**Verificación documental:** 2026-11-25.  
**Versión de referencia:** kernel Linux (docs 7.4.0-rc4; host 7.3.5-2-cachyos).  
**Estado:** fuente y publicación oficial verificadas; instalación local NO VERIFICADA.

## Utilidad para EVOL

Verificar la consistencia de escrituras y fsync en capas de almacenamiento de EVOL OS.

## Fuente original

- Documentación del kernel: https://docs.kernel.org/admin-guide/device-mapper/log-writes.html
- Código en el árbol de Linux: https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/md/dm-log-writes.c
- Herramienta de replay: https://github.com/josefbacik/log-writes

## Datos técnicos

- Licencia: GPL-2.0-only (kernel Linux); herramienta de replay con su propia licencia
- Sistemas: Linux únicamente
- Dependencias: Kernel con CONFIG_DM_LOG_WRITES, device-mapper, dmsetup y la herramienta userspace replay-log.
- Requisitos: Root o CAP_SYS_ADMIN, dos dispositivos de pruebas y espacio para el log.
- Mantenimiento: MANTENIDO EN EL KERNEL · documentación y código en el árbol de Linux

## Recursos técnicos

- [Guía técnica](GUIA.md)
- [Skill reutilizable](SKILL.md)
- [Casos de uso](casos-uso.json)
- [Evidencias](evidencias.json)

## Riesgos / restricciones

- Riesgo ALTO: los dispositivos usados se sobrescriben. Usar solo discos o imágenes desechables.
- Requiere privilegios elevados y puede afectar a la estabilidad del kernel.
- El log contiene datos de escritura y puede incluir información sensible.
- No usar en producción ni en el host principal sin autorización y copia de seguridad.
- Verificar dos veces las rutas de dispositivo antes de ejecutar `dmsetup create`.

## Validación pendiente

- Instalación real mediante método autorizado.
- Compatibilidad con arquitectura local y dependencias.
- Ejecución de prueba segura, reproducible y aislada.
- Verificación de licencia y decisiones de adopción al entorno.

**Importante:** no se ha copiado software de terceros ni se ha ejecutado la herramienta desde este repositorio.
