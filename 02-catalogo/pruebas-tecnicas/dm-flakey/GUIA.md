# dm-flakey · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-007  
**Categoría Atlas:** Pruebas y auditoría técnica · Inyección de fallos  
**Versión de referencia verificada:** kernel Linux (docs 7.4.0-rc4; host 7.3.5-2-cachyos)  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta dm-flakey. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

dm-flakey es un objetivo de device-mapper que se comporta como un dispositivo lineal pero introduce periodos de comportamiento no fiable. Está pensado para simular fallos de dispositivos en pruebas.

En EVOL se propone para validar tolerancia a errores de sistemas de archivos, journaling y capas de almacenamiento. Es una herramienta de kernel con riesgo alto: un dispositivo equivocado puede provocar pérdida de datos.

## 2. Instalación manual

No se instala como paquete de usuario: es un módulo del kernel Linux. La disponibilidad depende de la configuración del kernel y de los módulos instalados. El Atlas no cargó ni probó el módulo.

### Linux

```bash
sudo modprobe dm-flakey
```

```bash
sudo dmsetup targets | grep flakey
```


### macOS

No disponible: device-mapper y este target son específicos del kernel Linux.


### Windows

No disponible: no existe soporte de device-mapper del kernel Linux en Windows.


### Verificación básica de la instalación

```bash
sudo dmsetup targets | grep flakey
```

```bash
modinfo dm-flakey | head
```

## 3. Configuración

La tabla usa los parámetros documentados: `<dev path> <offset> <up interval> <down interval> [<num_features> [<feature arguments>]]`.

Ejemplo mínimo construido con los parámetros documentados (no ejecutado en el Atlas; sustituir `/dev/sdX` por un dispositivo de pruebas y confirmar su tamaño):

```bash
sudo dmsetup create flakey-test --table "0 $(sudo blockdev --getsz /dev/sdX) flakey /dev/sdX 0 60 5"
```

En los periodos de indisponibilidad, sin features adicionales, toda la E/S devuelve error. Las features documentadas incluyen `error_reads`, `drop_writes`, `error_writes` y `corrupt_bio_byte`.

## 4. Primer uso

```bash
sudo dmsetup status flakey-test
```

```bash
sudo dmsetup remove flakey-test
```

Antes de crear el target, identificar el dispositivo correcto con `lsblk` y verificar que no está montado ni contiene datos necesarios.

## 5. Uso avanzado

Corromper el byte 32 de las lecturas con el valor 1 (ejemplo de la documentación):

```bash
dmsetup create flakey-corrupt --table "0 <sectores> flakey <dev> 0 <up> <down> 1 corrupt_bio_byte 32 r 1 0"
```

Combinar con `dm-delay` para simular latencia y errores, como sugiere la documentación del kernel.

Automatizar la creación y eliminación del target en un script de laboratorio, con trap para limpiar incluso si la prueba falla.

## 6. Seguridad, alcance y limitaciones

- Riesgo ALTO: apuntar el target a un dispositivo real puede destruir datos. Usar únicamente dispositivos de pruebas desechables.
- Requiere privilegios de root o CAP_SYS_ADMIN; limitar el uso a entornos aislados.
- El módulo y el target forman parte del kernel: un fallo puede afectar a todo el sistema.
- Registrar siempre la tabla, el dispositivo y el momento de eliminación.
- No usar en producción ni en el host principal sin una autorización explícita y copia de seguridad verificada.



## 7. Solución de problemas

### El target no aparece en dmsetup

Comprobar que el kernel tiene CONFIG_DM_FLAKEY y que el módulo está disponible para la versión en ejecución.

### Error al crear la tabla

Revisar el número de sectores, la ruta del dispositivo y los parámetros; consultar `dmsetup` y el log del kernel.

### El dispositivo queda ocupado

Desmontar, comprobar que no hay procesos usando el mapper y ejecutar `dmsetup remove`; no forzar sin revisar.

## 8. Referencias oficiales

- [Documentación del kernel](https://docs.kernel.org/admin-guide/device-mapper/dm-flakey.html)
- [Código en el árbol de Linux](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/md/dm-flakey.c)
- [Documentación de device-mapper](https://docs.kernel.org/admin-guide/device-mapper/)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
