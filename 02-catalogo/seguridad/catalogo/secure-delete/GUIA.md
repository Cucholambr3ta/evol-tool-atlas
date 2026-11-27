# secure-delete · Guía técnica

Ficha del lote E3-01 de EVOL Tool Atlas. Versión upstream identificable: **3.1** (THC, van Hauser; copyright 1997-2003). Distribución de referencia: **Debian 3.1-12** (trixie y sid). Fuentes consultadas el 2026-11-26.

> **Advertencia principal.** Ninguna utilidad de este paquete garantiza que los datos sean irrecuperables. En SSD y memorias flash, sistemas de archivos copy-on-write (Btrfs), snapshots, RAID, NFS, cachés, bloques remapeados y copias de seguridad, la sobrescritura de un archivo puede no alcanzar todas las copias físicas de los datos. Ejecutar solo en máquinas virtuales o imágenes de laboratorio desechables, **nunca sobre el disco del equipo anfitrión ni sobre datos reales**.

Convención de procedencia:

- **[Debian-man]** tomado de las páginas de manual de Debian trixie (3.1-12).
- **[Debian-paquete]** tomado de packages.debian.org o del archivo `copyright` de Debian.
- **[Propuesto]** paso redactado para el Atlas.
- Nada se ejecutó en el Atlas.

## Procedencia

- Autor: van Hauser / THC (`debian/copyright`: «Copyright: 1997-2003 van Hauser / THC»). Licencia upstream GPL-2 (según el copyright de Debian, «see the licensing in manpages»); empaquetado Debian GPL-2+.
- El campo Homepage de Debian apunta a https://www.thc.org; el 2026-11-26 la página principal no menciona secure-delete y `https://www.thc.org/releases/secure_delete-3.1.tar.gz` devuelve HTTP 404. El paquete de Debian es la fuente conservada verificable.
- El registro histórico de la ficha (`1.b63d814`) procede de un espejo GitHub no identificado; no coincide con la numeración upstream 3.1 y se conserva solo como trazabilidad.

## Requisitos

- Linux. Debian empaqueta 3.1-12 para amd64, arm64, armel, armhf, i386, ppc64el, riscv64 y s390x.
- Privilegios de administrador para `sfill` sobre un punto de montaje ajeno, `sswap` y `sdmem`.
- Una máquina virtual desechable y, para pruebas, imágenes de disco en archivo (dispositivos loop), no particiones reales.

## Dependencias

- Paquete Debian: `Depends: libc6 (>= 2.34)`; recomienda `libgsecuredelete0` y sugiere `nautilus-wipe` [Debian-paquete].

## Instalación

En Debian o derivadas [Debian-paquete]:

```bash
sudo apt-get install secure-delete
```

No existe descarga upstream activa (ver Procedencia). En otras distribuciones, comprobar si empaquetan la versión 3.1 antes de compilar desde un espejo no oficial.

## Plataformas

- Linux con las arquitecturas oficiales de Debian indicadas en Requisitos; puertos no oficiales adicionales en sid.
- `sswap(1)` declara: «sswap is still beta. It was only tested on Linux».

## Verificación

```bash
dpkg -s secure-delete
man srm
```

`dpkg -s` debe mostrar `Version: 3.1-12` en trixie; `man srm` confirma las opciones de la versión instalada.

## Configuración

- No hay archivo de configuración: el modo se elige por opciones.
- Modo por defecto de `srm`, `sfill` y `sswap`: 1 pasada con 0xff, 5 aleatorias, 27 del método Gutmann y 5 aleatorias (1 + 5 + 27 + 5); `srm` además renombra el archivo a un nombre aleatorio y lo trunca [Debian-man].
- `-l` reduce a dos pasadas (0xff y aleatoria); `-ll` a una pasada aleatoria; `-z` usa ceros en la última pasada; `-f` es el modo rápido e inseguro (sin `/dev/urandom` ni modo síncrono).

## Primer uso

Solo dentro de una VM desechable y sobre una imagen loop [Propuesto]:

1. Crear una imagen de 64 MiB con `truncate -s 64M lab.img` y formatearla con `mkfs.ext4 -F lab.img`.
2. Montarla con `sudo mount -o loop lab.img /mnt/lab` y crear `/mnt/lab/muestra.txt` con un marcador de texto único.
3. Borrar el archivo con `srm -v /mnt/lab/muestra.txt`.
4. Desmontar y buscar el marcador en la imagen con `grep -c -a "<marcador>" lab.img`; un resultado distinto de 0 indica restos.

## Comandos

Opciones según [Debian-man]:

- `srm [-d] [-f] [-l] [-l] [-r] [-v] [-z] archivos`: sobrescribe y elimina archivos; `-r` recursivo, `-d` ignora `.` y `..`.
- `sfill [-f] [-i] [-I] [-l] [-l] [-v] [-z] directorio|punto_de_montaje`: sobrescribe el espacio libre; `-i` solo inodos libres, `-I` solo espacio libre de disco.
- `sswap [-f] [-l] [-l] [-v] [-z] dispositivo_swap`: sobrescribe una partición de intercambio **desactivada**.
- `sdmem [-f] [-l] [-l] [-v]`: sobrescribe la memoria libre; la primera pasada es 0x00.

Ejemplos [Propuesto]:

```bash
srm -v -ll /mnt/lab/muestra.txt
sudo sfill -v -l /mnt/lab
```

## Entradas

- `srm`: rutas de archivos o directorios (con `-r`).
- `sfill`: un directorio dentro del sistema de archivos cuyo espacio libre se rellena.
- `sswap`: un dispositivo de swap previamente desactivado.
- `sdmem`: no recibe rutas; actúa sobre la memoria disponible.

## Salidas

- Con `-v`, progreso de pasadas por la salida estándar.
- `srm` deja el archivo renombrado, truncado y eliminado; `sfill` crea y elimina archivos temporales hasta llenar el espacio e inodos libres.
- No generan informes ni hashes: la verificación del resultado debe hacerse por separado (por ejemplo, búsqueda de marcadores en una imagen de laboratorio).

## Errores y solución de problemas

- **El sistema se bloquea al usar `sswap`:** la página de manual exige «unmount your swapspace before using this tool! Otherwise your system might crash!»; desactivar con `swapoff` antes.
- **`sfill` no rellena el espacio libre completo:** el manual advierte que las optimizaciones de sistemas como ext2 o ffs pueden impedir que reciba la totalidad del espacio disponible; en FAT32 el tamaño de archivo está limitado a 4 GB.
- **`sdmem` tarda demasiado:** el manual recomienda `-ll`.
- **Marcador encontrado tras `srm`:** el sistema de archivos conservó copias (journal, snapshot, CoW o bloques reasignados); ver Limitaciones.

## Advertencias

Avisos literales del manual [Debian-man]:

- NFS: «Beware of NFS. You can't ensure you really completely wiped your data from the remote disks.»
- RAID: «Raid Systems use stripped disks and have got large caches. It's hard to wipe them.»
- Copias temporales: «Some of your data might have a temporary (deleted) copy somewhere on the disk.»
- Swap: «Some of your data might have a copy in your swapspace.»
- `sdmem`: «sdmem is still beta.»

## Referencias

- Paquete Debian trixie: https://packages.debian.org/trixie/secure-delete
- Paquete Debian sid: https://packages.debian.org/sid/secure-delete
- Copyright Debian: https://metadata.ftp-master.debian.org/changelogs/main/s/secure-delete/unstable_copyright
- Manuales: https://manpages.debian.org/trixie/secure-delete/srm.1.en.html, https://manpages.debian.org/trixie/secure-delete/sfill.1.en.html, https://manpages.debian.org/trixie/secure-delete/sswap.1.en.html, https://manpages.debian.org/trixie/secure-delete/sdmem.1.en.html
- NIST SP 800-88 Rev. 1 (retirada el 2025-09-26, sustituida por Rev. 2): https://csrc.nist.gov/pubs/sp/800/88/r1/final
- NIST SP 800-88 Rev. 2: https://csrc.nist.gov/pubs/sp/800/88/r2/final
- Btrfs, introducción y subvolúmenes: https://btrfs.readthedocs.io/en/latest/Introduction.html, https://btrfs.readthedocs.io/en/latest/Subvolumes.html

## Limitaciones

- **SSD y flash:** NIST SP 800-88 Rev. 1 indica que estos dispositivos «may contain spare cells and perform wear levelling, making it infeasible for a user to sanitize all previous data» con sobrescritura, y que la sobrescritura «may not sanitize the data in unmapped physical media (i.e., the old data may still remain on the media)». La sobrescritura además reduce la vida útil del medio. No se revisó el texto de la Rev. 2 vigente.
- **Btrfs y copy-on-write:** la documentación de Btrfs lo define como «copy on write (COW) filesystem» y explica que un snapshot y su original «initially share all of the same data blocks» y que modificar uno no afecta al otro; por tanto, sobrescribir un archivo en un subvolumen no elimina sus datos de los snapshots existentes (inferencia directa de esa documentación).
- **Remapeo de bloques:** NIST SP 800-88 Rev. 1 cita los bloques defectuosos remapeados entre las áreas que una sanitización parcial puede no alcanzar; desde el sistema de archivos no son direccionables y la sobrescritura de archivos no los cubre.
- **Cifrado:** con cifrado de volumen, el borrado criptográfico (destrucción de claves, que NIST describe como técnica de sanitización) es una alternativa a sobrescribir archivos; secure-delete no lo implementa.
- **Copias de seguridad y sincronización:** las copias fuera del sistema local no se ven afectadas.
- Utilidad sin desarrollo upstream conocido posterior a 2003 (fin del rango de copyright); versión distribuida 3.1 con parches de Debian.
- No se ejecutó ninguna utilidad para esta ficha; la Arch Wiki y el manual de GNU shred no pudieron consultarse (acceso bloqueado o limitado).
