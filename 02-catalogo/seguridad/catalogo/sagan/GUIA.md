# Sagan · Guía técnica

Ficha del lote E3-01 de EVOL Tool Atlas. Release documentada: **2.0.2** (publicada 2021-12-29; etiqueta literal `v,2,0.2` en GitHub). Fuentes consultadas el 2026-11-26.

Convención de procedencia:

- **[Upstream-docs]** tomado de https://sagan.readthedocs.io/en/latest/.
- **[Upstream-código]** tomado del código de `quadrantsec/sagan` en `main` (commit `3b9b0fa3ad4d`, 2025-10-06); puede diferir de la release 2.0.2.
- **[Propuesto]** ejemplo redactado para el Atlas a partir de las fuentes.
- Nada de esta guía se ejecutó en el Atlas.

## Identidad del proyecto

- Repositorio vigente: https://github.com/quadrantsec/sagan (GPL-2.0, no archivado).
- `https://github.com/beave/sagan` es el repositorio anterior: su README solo indica «This repo has MOVED to https://github.com/quadrantsec/sagan». Las notas de la release 2.0.0 confirman el traslado de `sagan` y `sagan-rules` a la organización `quadrantsec`.
- La URL histórica `https://quadrantsec.com/sagan_log_analysis_engine/` del inventario antiguo cambió de destino (registro previo de la ficha).

## Requisitos

- Sistema tipo Unix con compilador C, autotools y `make`.
- Una fuente de registros (rsyslog o syslog-ng) capaz de escribir en una tubería con nombre (FIFO) o en JSON.
- Usuario de sistema dedicado `sagan` y directorios propios para FIFO, registros y PID.

## Dependencias

Según la página *Installation* [Upstream-docs]:

| Biblioteca | Carácter | Paquete Debian/Ubuntu |
|---|---|---|
| libpcre | Obligatoria (expresiones `pcre` de las reglas) | `libpcre3-dev libpcre3` |
| libyaml | Obligatoria (lectura de `sagan.yaml`) | `libyaml-dev` |
| liblognorm (+ libfastjson) | Recomendada (normalización) | `liblognorm-dev liblognorm5` |
| libesmtp | Opcional (alertas por correo) | `libesmtp-dev` |
| libmaxminddb | Opcional (GeoIP) | `libmaxminddb0 libmaxminddb-dev` |
| hiredis | Opcional, beta (Redis) | `libhiredis-dev` |
| libpcap | Opcional (captura de syslog en red) | `libpcap-dev` |

## Instalación

Compilación desde el repositorio [Upstream-docs]:

```bash
sudo apt-get install libpcre3-dev libpcre3 libyaml-dev liblognorm-dev
git clone https://github.com/quadrantsec/sagan.git
cd sagan
./autogen.sh
./configure
make
sudo make install
```

Opciones de `configure` documentadas: `--enable-esmtp`, `--enable-geoip`, `--enable-redis`, `--enable-libpcap`, `--disable-lognorm`, `--disable-libfastjson`, `--prefix`, `--sysconfdir`.

Preparación del sistema tras la instalación [Upstream-docs]:

```bash
sudo useradd --system -d /var/sagan -s /bin/false sagan
sudo mkdir -p /var/sagan/fifo /var/log/sagan /var/run/sagan
sudo mkfifo /var/sagan/fifo/sagan.fifo
sudo chmod 420 /var/sagan/fifo/sagan.fifo
sudo chown -R sagan:sagan /var/sagan /var/log/sagan /var/run/sagan
```

Reglas: el repositorio vigente es https://github.com/quadrantsec/sagan-rules (GPL-2.0, actualizado el 2026-11-25). La documentación aún indica clonar `https://github.com/beave/sagan-rules` en `/usr/local/etc`; se recomienda la ubicación `quadrantsec` [Propuesto]:

```bash
cd /usr/local/etc
sudo git clone https://github.com/quadrantsec/sagan-rules
```

## Plataformas

- La documentación da instrucciones de dependencias para Debian/Ubuntu, Red Hat/CentOS, FreeBSD/OpenBSD y Gentoo; no publica una lista formal de plataformas soportadas.
- No consta paquete binario oficial en la release 2.0.2; la vía documentada es la compilación desde fuente.

## Verificación

```bash
sagan --help
sagan --test
```

`--help` muestra la versión compilada y las funciones incluidas (libesmtp, liblognorm, GeoIP, Redis…). `-T, --test` comprueba `sagan.yaml` y los conjuntos de reglas [Upstream-código, `src/usage.c`]; confirmar que la opción existe en la versión instalada con `--help`.

## Configuración

`sagan.yaml` (por defecto en `/usr/local/etc`) tiene cinco secciones [Upstream-docs, *Sagan Configuration*]:

- `vars`: rutas y grupos, por ejemplo `FIFO "/var/sagan/fifo/sagan.fifo"`, `RULE_PATH "/usr/local/etc/sagan-rules"`, `LOCKFILE "/var/run/sagan/sagan.pid"`, `LOG_PATH "/var/log/sagan"`, y grupos de direcciones como `$HOME_NET`/`$EXTERNAL_NET`.
- `sagan-core`: `input-type` (`pipe` o `json`), `json-software`, `max-threads`, `batch-size`, almacenamiento de flexbits/xbits (`mmap` o `redis`), GeoIP y liblognorm.
- `processors`: seguimiento de clientes, listas negras, monitor de rendimiento y otros.
- `outputs`: `eve-log` (`$LOG_PATH/eve.json`), `alert` (`$LOG_PATH/alert.log`), `fast` (`$LOG_PATH/fast.log`), `smtp` y `syslog`.
- `rule-files`: lista de `$RULE_PATH/*.rules` cargados.

Alimentación desde rsyslog en modo tubería [Upstream-docs]: crear `/etc/rsyslog.d/10-sagan.conf` con la plantilla `SaganPipe` y la acción

```
*.*  action(type="ompipe" pipe="/var/sagan/fifo/sagan.fifo" template="SaganPipe")
```

y aplicar permisos:

```bash
sudo chown sagan:syslog /var/sagan/fifo/sagan.fifo
sudo chmod 420 /var/sagan/fifo/sagan.fifo
sudo systemctl restart rsyslog
```

El cuerpo completo de la plantilla `SaganPipe` debe copiarse de la página *Sagan Configuration*; no se reproduce aquí.

## Primer uso

1. Arrancar Sagan en primer plano con depuración, como indica la documentación: `sudo sagan --debug syslog,engine`.
2. Generar un evento de prueba en otra terminal [Propuesto]: `logger "No space left on device"`.
3. Comprobar la recepción en la salida de depuración y, si una regla coincide, la alerta en `/var/log/sagan/alert.log`.
4. Detener el proceso con `Ctrl+C` y, para servicio permanente, usar la unidad systemd documentada (`ExecStart=/usr/local/bin/sagan $OPTIONS`, `User=sagan`, `Before=rsyslog.service syslog-ng.service`).

## Comandos

Opciones según `src/usage.c` en `main` [Upstream-código]:

- `sagan -f /usr/local/etc/sagan.yaml`: carga un archivo de configuración concreto.
- `sagan -T`: comprueba configuración y reglas sin procesar registros.
- `sagan -D -u sagan`: se ejecuta como demonio con el usuario `sagan` (valor por defecto del usuario).
- `sagan -d engine,syslog`: activa tipos de depuración (`engine`, `syslog`, `confload`, `json`, `threads`…).
- `sagan -F archivo.log`: lee un archivo en lugar del FIFO; el archivo debe estar en formato Sagan.
- `sagan -r archivo.rules`: usa un conjunto de reglas concreto en lugar del de `sagan.yaml`.
- `sagan -t 8 -b 10`: fija hilos y tamaño de lote, sustituyendo los valores de `sagan.yaml`.
- `sagan -Q`: modo silencioso sin salida por consola; `-l archivo`: ubicación de `sagan.log`.

La página *Command Line Options* de la documentación está incompleta («This document needs to be completed!»), por eso la fuente de esta lista es el código.

## Entradas

- Eventos syslog recibidos por el FIFO en formato tubería (`input-type: pipe`) o en JSON (`input-type: json` con `json-software: rsyslog` o `syslog-ng`).
- Reglas con sintaxis similar a Snort/Suricata: `acción proto ip_origen puerto -> ip_destino puerto (opciones)`. Ejemplo documentado [Upstream-docs, *Rule syntax*]:

```
alert any $EXTERNAL_NET any -> $HOME_NET any (msg: "[SYSLOG] System out of disk space"; pcre: "/file system full|No space left on device/i"; classtype: hardware-event; threshold: type limit, track by_src, count 1, seconds 300; reference: url,wiki.quadrantsec.com/bin/view/Main/5000116; sid:5000116; rev:2;)
```

## Salidas

- `alert.log` y `fast.log` con las alertas en texto.
- `eve.json` con eventos y alertas en JSON para un SIEM.
- Notificaciones por SMTP o reenvío a syslog si se configuran.
- `sagan.log` con el registro operativo del propio proceso.

## Errores y solución de problemas

- **`configure` no encuentra libpcre o libyaml:** instalar los paquetes de desarrollo de la tabla de dependencias o indicar rutas con `--with-libpcre-includes`/`--with-libyaml-includes`.
- **Sagan no recibe eventos:** comprobar que el FIFO existe, que rsyslog escribe en la misma ruta y los permisos `sagan:syslog` 420. La documentación usa `/var/sagan/fifo/sagan.fifo` para rsyslog pero `/var/sagan/sagan.fifo` en los ejemplos de syslog-ng: unificar la ruta en ambos lados.
- **Reglas que no cargan:** ejecutar `sagan -T` y revisar `RULE_PATH` y la sección `rule-files`.
- **Instrucciones de reglas desactualizadas:** la documentación remite a `beave/sagan-rules`; usar `quadrantsec/sagan-rules`.

## Advertencias

- Sagan procesa registros que pueden contener datos personales o secretos: proteger `eve.json` y `alert.log` con los mismos controles que los registros originales.
- Las reglas de terceros generan falsos positivos; revisarlas antes de activar salidas automáticas (correo, bloqueos externos).
- Ejecutar con el usuario sin privilegios `sagan`, no como root, salvo para la prueba inicial de depuración que propone la documentación.

## Referencias

- Repositorio vigente: https://github.com/quadrantsec/sagan
- Releases: https://github.com/quadrantsec/sagan/releases
- Reglas: https://github.com/quadrantsec/sagan-rules
- Documentación: https://sagan.readthedocs.io/en/latest/
- Instalación: https://sagan.readthedocs.io/en/latest/install.html
- Configuración: https://sagan.readthedocs.io/en/latest/configuration.html
- Sintaxis de reglas: https://sagan.readthedocs.io/en/latest/rule-syntax.html
- Opciones en código: https://github.com/quadrantsec/sagan/blob/main/src/usage.c
- Repositorio anterior (traslado): https://github.com/beave/sagan

## Limitaciones

- La release más reciente es de 2021; hay commits posteriores en `main` (2025-10-06) sin release asociada.
- La documentación contiene secciones incompletas, enlaces sin completar, versiones antiguas en ejemplos (1.2.1, 2.0.1) y la referencia a `--disable-snortsam`, aunque la 2.0.0 retiró Snortsam y Unified2.
- El formato exacto de línea «Sagan format» para `-F` no está documentado en las páginas consultadas.
- No se compiló ni ejecutó Sagan para esta ficha.
