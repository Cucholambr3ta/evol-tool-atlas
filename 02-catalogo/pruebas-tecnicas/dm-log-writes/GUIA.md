# dm-log-writes · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-008  
**Categoría Atlas:** Pruebas y auditoría técnica · Consistencia de almacenamiento  
**Versión de referencia verificada:** kernel Linux (docs 7.4.0-rc4; host 7.3.5-2-cachyos)  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta dm-log-writes. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

dm-log-writes es un objetivo de device-mapper que envía la E/S normal a un dispositivo y registra todas las escrituras en otro. Permite reproducir el log hasta marcas concretas y comprobar la consistencia del sistema de archivos.

En EVOL se propone para validar fsync, journaling y recuperación tras un corte. Es una herramienta de kernel de riesgo alto y requiere dispositivos de pruebas dedicados.

## 2. Instalación manual

El target forma parte del kernel Linux. La reproducción requiere además la herramienta userspace `replay-log`, distribuida en el repositorio oficial del proyecto. El Atlas no cargó el módulo ni ejecutó una reproducción.

### Linux

```bash
sudo modprobe dm-log-writes
```

```bash
sudo dmsetup targets | grep log-writes
```

La herramienta `replay-log` se obtiene del repositorio oficial; revisar sus instrucciones de compilación antes de usarla.


### macOS

No disponible: específico del kernel Linux.


### Windows

No disponible: específico del kernel Linux.


### Verificación básica de la instalación

```bash
sudo dmsetup targets | grep log-writes
```

```bash
modinfo dm-log-writes | head
```

## 3. Configuración

La tabla tiene la forma `log-writes <dev_path> <log_dev_path>`, donde el primer dispositivo recibe la E/S y el segundo almacena el log.

Ejemplo de la documentación oficial (dispositivos de ejemplo; sustituir por dispositivos de pruebas y confirmar tamaños):

```bash
TABLE="0 $(blockdev --getsz /dev/sdb) log-writes /dev/sdb /dev/sdc"
dmsetup create log --table "$TABLE"
```

Las marcas se insertan con `dmsetup message <nombre> 0 mark <descripción>` y permiten delimitar puntos de reproducción.

## 4. Primer uso

```bash
sudo dmsetup status log
```

```bash
sudo dmsetup remove log
```

Verificar con `lsblk` que `/dev/sdb` y `/dev/sdc` son dispositivos de pruebas y no contienen datos necesarios.

## 5. Uso avanzado

Flujo de la documentación para probar fsync:

```bash
TABLE="0 $(blockdev --getsz /dev/sdb) log-writes /dev/sdb /dev/sdc"
dmsetup create log --table "$TABLE"
mkfs.btrfs -f /dev/mapper/log
dmsetup message log 0 mark mkfs
mount /dev/mapper/log /mnt/btrfs-test
# ejecutar la prueba que hace fsync
dmsetup message log 0 mark fsync
md5sum /mnt/btrfs-test/foo
umount /mnt/btrfs-test
dmsetup remove log
replay-log --log /dev/sdc --replay /dev/sdb --end-mark fsync
mount /dev/sdb /mnt/btrfs-test
md5sum /mnt/btrfs-test/foo
```

La documentación también describe la reproducción con comprobación de consistencia (`--fsck`) y paradas en peticiones FUA. Revisar la sintaxis exacta de `replay-log` en su repositorio antes de usar.

Los logs pueden contener datos del sistema de archivos; tratarlos como material sensible y eliminarlos al terminar.

## 6. Seguridad, alcance y limitaciones

- Riesgo ALTO: los dispositivos usados se sobrescriben. Usar solo discos o imágenes desechables.
- Requiere privilegios elevados y puede afectar a la estabilidad del kernel.
- El log contiene datos de escritura y puede incluir información sensible.
- No usar en producción ni en el host principal sin autorización y copia de seguridad.
- Verificar dos veces las rutas de dispositivo antes de ejecutar `dmsetup create`.



## 7. Solución de problemas

### El target no está disponible

Comprobar CONFIG_DM_LOG_WRITES y el módulo para la versión del kernel en ejecución.

### replay-log no se encuentra

Obtenerlo del repositorio oficial y revisar sus dependencias; no se distribuye con el kernel.

### El sistema de archivos no monta tras la reproducción

Revisar la marca final, la integridad del log y los mensajes del kernel; no forzar el montaje sobre datos que se quieran conservar.

## 8. Referencias oficiales

- [Documentación del kernel](https://docs.kernel.org/admin-guide/device-mapper/log-writes.html)
- [Código en el árbol de Linux](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/md/dm-log-writes.c)
- [Herramienta de replay](https://github.com/josefbacik/log-writes)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
