# nfcutils (lsnfc) · Guía técnica

Ficha del lote E3-01 de EVOL Tool Atlas. Proyecto histórico: último commit `49aa1781205f` (2015-04-07, «update code to use libnfc 1.7.0»), sin releases ni etiquetas. Versión declarada en `configure.ac`: **0.3.2**. Fuentes consultadas el 2026-11-26.

Convención de procedencia:

- **[Upstream-código]** derivado de los archivos del repositorio `nfc-tools/nfcutils` (`configure.ac`, `src/Makefile.am`, `src/lsnfc.c`, `debian/control`).
- **[Upstream-libnfc]** tomado del README de `nfc-tools/libnfc`.
- **[Propuesto]** paso redactado para el Atlas; el README de nfcutils está vacío (0 bytes) y no documenta instalación.
- Nada se ejecutó en el Atlas y **no se probó ningún lector NFC**.

## Requisitos

- Lector NFC compatible con libnfc. El README de libnfc enumera los controladores `pn53x_usb`, `acr122_usb`, `acr122_pcsc`, `pcsc` y conexiones serie como `pn532_uart:/dev/ttyACM0`; menciona Feitian bR500 y R502 como funcionales vía PC/SC.
- Permiso del usuario para acceder al dispositivo USB o serie (regla udev de libnfc).
- Etiquetas o tarjetas propias o autorizadas para la prueba.

## Dependencias

- libnfc **≥ 1.7.0**: `configure.ac` falla con «libnfc >= 1.7.0 is mandatory» si no la encuentra [Upstream-código]. La última etiqueta de libnfc es `libnfc-1.8.0` (2020-05-22).
- `pkg-config`, compilador C (el proyecto fuerza `-std=c99`), autoconf y automake.
- `debian/control` del propio repositorio declara `Build-Depends: debhelper (>= 5.0.37.2), libnfc-dev (>= 1.7.0)` [Upstream-código].

## Instalación

No existe paquete `nfcutils` en Debian (búsqueda en packages.debian.org sin resultados el 2026-11-26) ni release descargable. Compilación desde fuente [Propuesto, inferido de los archivos autotools del repositorio]:

```bash
sudo apt-get install libnfc-dev pkg-config autoconf automake build-essential
git clone https://github.com/nfc-tools/nfcutils.git
cd nfcutils
autoreconf -vis
./configure
make
sudo make install
```

`--enable-debug` es la única opción propia de `configure` (añade `-O0 -g3 -Wall -DDEBUG -pedantic`). `make install` instala el binario `lsnfc` (`bin_PROGRAMS = lsnfc` en `src/Makefile.am`).

Preparación del acceso al lector según libnfc [Upstream-libnfc], desde un clon de libnfc:

```bash
sudo cp contrib/udev/93-pn53x.rules /lib/udev/rules.d/
sudo cp contrib/linux/blacklist-libnfc.conf /etc/modprobe.d/blacklist-libnfc.conf
```

La lista negra evita que los módulos del núcleo `nfc`, `pn533` y `pn533_usb` (Linux ≥ 3.1) se apropien del lector.

## Plataformas

- No hay lista oficial de plataformas para nfcutils. Por sus dependencias (autotools, pkg-config, libnfc) apunta a sistemas tipo Unix; libnfc documenta además FreeBSD (`contrib/devd/pn53x.conf`) y compilación en Windows. Esta compatibilidad es una inferencia, no una declaración de nfcutils.
- La compatibilidad con libnfc 1.8.0 no está declarada: el último cambio del proyecto adaptó el código a libnfc 1.7.0.

## Verificación

```bash
LIBNFC_AUTO_SCAN=true nfc-scan-device
lsnfc
```

`nfc-scan-device` (herramienta de libnfc) debe mostrar el lector y su cadena de conexión. `lsnfc` sin etiquetas en el campo debe listar el dispositivo y terminar con «0 tag(s) on device.» [Upstream-código, `src/lsnfc.c`].

## Configuración

Configuración de libnfc [Upstream-libnfc]:

```bash
sudo mkdir /etc/nfc
sudo cp libnfc.conf.sample /etc/nfc/libnfc.conf
```

- Dispositivos adicionales: archivos en `/etc/nfc/devices.d/`.
- Variables de entorno: `LIBNFC_DEVICE=<connstring>` (usa solo ese dispositivo), `LIBNFC_DEFAULT_DEVICE`, `LIBNFC_AUTO_SCAN`, `LIBNFC_INTRUSIVE_SCAN` y `LIBNFC_LOG_LEVEL` (0–3).
- `lsnfc` no tiene archivo de configuración propio ni opciones.

## Primer uso

1. Conectar el lector y confirmar que `nfc-scan-device` lo detecta.
2. Colocar una etiqueta propia sobre el lector.
3. Ejecutar `lsnfc` y leer el tipo de etiqueta e identificadores.
4. Para fijar el lector cuando hay varios [Propuesto]: `LIBNFC_DEVICE=pn532_uart:/dev/ttyACM0 lsnfc`.

## Comandos

- `lsnfc`: no acepta argumentos (`main` ignora `argc` y `argv`). Abre cada dispositivo detectado por libnfc, activa el campo, enumera objetivos pasivos ISO14443A, ISO14443B y FeliCa (212 y 424 kbps) e intenta identificar el modelo de cada etiqueta.
- Variables de libnfc como `LIBNFC_DEVICE` y `LIBNFC_LOG_LEVEL=3` controlan qué lector se usa y cuánto diagnóstico se muestra.

## Entradas

- Lectores NFC detectados por libnfc (o el indicado en `LIBNFC_DEVICE`).
- Etiquetas presentes en el campo del lector en el momento de la ejecución.

## Salidas

Texto por salida estándar [Upstream-código, `src/lsnfc.c`]:

- ISO14443A: identificación por SAK/ATS de MIFARE Ultralight (y UL-C mediante el comando de autenticación 0x1A), Mini, Classic 1k/4k, DESFire (EV1 y tamaño mediante GetVersion), Plus, JCOP31/41, Gemplus MPCOS, Jewel (con duda declarada en el código); el resto aparece como «Unknown ISO14443A tag type».
- ISO14443B: PUPI, datos de aplicación e información de protocolo.
- FeliCa: NFCID2, PAD y código de sistema; reconoce FeliCa Lite, NFC Forum (NDEF) y FeliCa Plug.
- Cierre por dispositivo «N tag(s) on device.» y, con varios lectores, una línea «Total:».

## Errores y solución de problemas

- **`configure` aborta con «libnfc >= 1.7.0 is mandatory»:** instalar `libnfc-dev` o exportar `PKG_CONFIG_PATH` hacia la instalación local de libnfc.
- **`configure` aborta con «pkg-config not found»:** instalar `pkg-config`.
- **El lector no aparece:** comprobar la regla udev, la lista negra de módulos `pn533`, y ejecutar con `LIBNFC_LOG_LEVEL=3` para ver el diagnóstico de libnfc.
- **Etiqueta «Unknown ISO14443A tag type»:** el código solo conoce los modelos enumerados en Salidas; no implica un fallo del lector.
- **Avisos de autoconf al regenerar:** `configure.ac` usa macros antiguas (`AC_CONFIG_HEADER`, `svnversion`); los avisos no bloquean necesariamente la compilación, pero no se comprobó con autoconf actual.

## Advertencias

- Leer solo tarjetas propias o con autorización: los identificadores de tarjetas de acceso o transporte pueden ser datos personales.
- `lsnfc` envía comandos a las etiquetas (selección, GetVersion, autenticación UL-C); no es un escaneo pasivo.
- Instalar con `make install` en un prefijo de laboratorio o contenedor si no se quiere modificar el sistema.

## Referencias

- Repositorio: https://github.com/nfc-tools/nfcutils
- Página del proyecto: https://nfc-tools.github.io/projects/nfcutils/
- Código de lsnfc: https://github.com/nfc-tools/nfcutils/blob/master/src/lsnfc.c
- Historial: https://github.com/nfc-tools/nfcutils/commits/master/
- libnfc: https://github.com/nfc-tools/libnfc
- Etiquetas de libnfc: https://github.com/nfc-tools/libnfc/tags

## Limitaciones

- Proyecto sin actividad desde 2015, sin releases y con README vacío.
- Las instrucciones de compilación son inferidas de los archivos autotools; no están documentadas por upstream ni se compilaron.
- No se comprobó compatibilidad con libnfc 1.8.0 ni con ningún lector del equipo local.
- No se pudo consultar el AUR (acceso bloqueado al intentarlo); su disponibilidad en Arch/CachyOS queda sin verificar.
