# OWASP Threat Dragon · Guía técnica

Ficha del lote E3-01 de EVOL Tool Atlas. Versión documentada: **2.6.2** (release oficial; `published_at` 2026-05-10 según la API de GitHub). Fuentes consultadas el 2026-11-26.

Convención de procedencia de cada procedimiento:

- **[Upstream]** paso o comando tomado de la documentación oficial de Threat Dragon 2.6.2.
- **[Propuesto]** ejemplo redactado para el Atlas a partir de la documentación; no figura literalmente en ella.
- Ningún comando ni paso de esta guía se ejecutó en el Atlas. No hay evidencia experimental.

## Requisitos del sistema

- Escritorio: un equipo Windows de 64 bits, macOS (Intel o Apple silicon) o Linux x86-64 con entorno gráfico.
- Aplicación web: Docker con soporte `linux/amd64` o `linux/arm64`, o bien Node.js y git para ejecutar desde código fuente.
- Para la aplicación web, un archivo `.env` con las claves de cifrado del servidor; `ENCRYPTION_KEYS` es obligatoria y sin ella el servidor no arranca («ENCRYPTION_KEYS is a required property»).

## Acceso o Instalación

### Escritorio [Upstream]

Descargar el instalador de la release 2.6.2 desde https://github.com/OWASP/threat-dragon/releases/tag/v2.6.2:

| Sistema | Archivo publicado |
|---|---|
| Windows | `Threat-Dragon-ng-Setup-2.6.2.exe` (instalador NSIS) |
| macOS Intel | `Threat-Dragon-ng-2.6.2.dmg` |
| macOS Apple silicon | `Threat-Dragon-ng-2.6.2-arm64.dmg` |
| Linux | `Threat-Dragon-ng-2.6.2.AppImage`, `threat-dragon_2.6.2_amd64.deb`, `threat-dragon-2.6.2.x86_64.rpm` o Snap (https://snapcraft.io/threat-dragon) |

La release publica `checksum.yml`, `checksum-mac.yml`, `checksum-mac-arm64.yml` y `checksum-linux.yml` con hashes SHA-512 de los instaladores; los paquetes `.deb` y `.rpm` no tienen enlace de checksum en la tabla de la release.

Procedimiento de instalación verificada [Propuesto]:

1. Descargar el instalador de la plataforma y el `checksum*.yml` correspondiente desde la misma release.
2. Calcular el SHA-512 del instalador descargado y compararlo con el valor del archivo de checksum antes de abrirlo.
3. Instalar con el mecanismo nativo del sistema (asistente NSIS, arrastrar a Aplicaciones, `chmod +x` del AppImage o el gestor de paquetes).
4. Registrar versión, archivo, hash y fecha de descarga en la ficha de evidencias si la instalación forma parte de una prueba.

### Aplicación web con Docker [Upstream]

```bash
docker pull owasp/threat-dragon:stable
docker run -it --rm -p 8080:3000 -v $(pwd)/.env:/app/.env owasp/threat-dragon:stable
```

La etiqueta `stable` es siempre la última release oficial; `threatdragon/owasp-threat-dragon:latest` es una compilación de desarrollo sin garantía de estabilidad. La release 2.6.2 indica `docker pull --platform linux/x86_64 owasp/threat-dragon:v2.6.2` y `owasp/threat-dragon:v2.6.2-arm64` para arm64. La aplicación queda en `http://localhost:8080` (puerto 3000 del contenedor).

### Aplicación web desde código fuente [Upstream]

```bash
git clone https://github.com/owasp/threat-dragon.git
cd threat-dragon
cp minimal.env .env
npm install
npm start
```

Según la documentación, esta configuración mínima es una aplicación **de demostración** que guarda los modelos solo en el sistema de archivos local del cliente o navegador.

## Plataformas

- Escritorio 2.6.2: Windows 64 bits, macOS x86-64 y arm64, Linux x86-64 (AppImage, deb, rpm, Snap).
- Web: imagen de contenedor para `linux/amd64` y `linux/arm64`; ejecución desde fuente donde haya Node.js.
- El README describe el proyecto como «primarily a web application».

## Verificación

1. Escritorio: abrir la aplicación y comprobar que la pantalla de bienvenida carga sin errores.
2. Web: abrir `http://localhost:8080` y comprobar que aparece la página de bienvenida con la opción de crear un modelo.
3. Comprobar que la versión mostrada por la aplicación coincide con la release descargada (2.6.2).
4. Si el servidor falla al arrancar, revisar la salida del contenedor (`docker run -it` muestra la consola) y la presencia de `ENCRYPTION_KEYS` en `.env`.

## Configuración

Variables documentadas del servidor web (página *Configure*):

- `ENCRYPTION_KEYS` (obligatoria), `ENCRYPTION_JWT_SIGNING_KEY`, `ENCRYPTION_JWT_REFRESH_SIGNING_KEY`: la documentación recomienda una cadena hexadecimal aleatoria de 16 bytes generada con `openssl rand -hex 16`, y que la clave de refresco JWT sea distinta de la de firma.
- `PORT` (servidor, por defecto 3000), `APP_PORT` (front-end, por defecto 8080), `APP_HOSTNAME`, `APP_USE_TLS`, `APP_TLS_CERT_PATH`, `APP_TLS_KEY_PATH`, `NODE_ENV` (`production`, `development`, `test`), `LOG_LEVEL` (por defecto `warn`).
- Acceso a repositorios: `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`; Bitbucket, GitLab y Google Drive tienen páginas propias de configuración.
- Cualquier variable admite el sufijo `_FILE` para leer el valor desde un archivo (por ejemplo `ENCRYPTION_KEYS_FILE`), útil para no escribir secretos en `.env`.

Preparación de `.env` para un laboratorio local [Propuesto, basado en *Configure* y *Web install*]:

1. Copiar la plantilla del repositorio: `cp minimal.env .env` (paso documentado para la instalación web).
2. Generar tres valores distintos con `openssl rand -hex 16`: uno para la clave de cifrado y dos para las claves JWT de firma y de refresco.
3. Sustituir en `.env` los valores de `ENCRYPTION_KEYS`, `ENCRYPTION_JWT_SIGNING_KEY` y `ENCRYPTION_JWT_REFRESH_SIGNING_KEY` respetando el formato que trae `minimal.env` de la versión descargada.
4. Restringir permisos del archivo (`chmod 600 .env`) y no añadirlo al control de versiones.

## Primer uso

Flujo documentado para la aplicación web [Upstream, página *Getting started*]:

1. En la página de bienvenida, pulsar el área con el signo «+» para crear un modelo nuevo.
2. Elegir el repositorio y la rama (o el almacenamiento local si está configurado); el nombre del modelo se usa como nombre de archivo.
3. Rellenar los datos del modelo; solo «Title» es obligatorio. Pulsar «Edit» para empezar a editar.
4. Pulsar «Add a new diagram…», darle nombre y confirmar con «Add».
5. Pulsar «Save» para guardar; «Reload» vuelve al último guardado y «Close» regresa a la página principal.
6. Abrir el diagrama desde la página del modelo para entrar al editor.

## Interfaz y Flujo

- Editor de diagramas: los componentes se arrastran desde el panel lateral izquierdo (*stencil*). Proceso = círculo; almacén de datos = dos líneas paralelas; actor = rectángulo; flujo de datos = flecha; límite de confianza = caja o curva.
- Los elementos marcados fuera de alcance se dibujan con línea discontinua; los elementos con amenazas abiertas se muestran en rojo.
- Amenazas: seleccionar un elemento y pulsar «New Threat» (abajo a la derecha; desactivado para elementos fuera de alcance). «Title» y «Threat Type» son obligatorios; «Apply» añade la amenaza. «New Threat by Type» y «New Threat by Context» proponen amenazas.
- Metodologías disponibles para el tipo de amenaza: STRIDE, LINDDUN, CIA, CIA-DIE, PLOT4ai y Generic.
- Informe: en la vista del modelo, «Report» permite incluir diagramas, amenazas mitigadas, elementos fuera de alcance y propiedades. El escritorio ofrece «Print» y «PDF Report»; la web ofrece «Print» (el navegador puede guardarlo como PDF).

## Entradas

- Archivos de modelo en JSON conformes al esquema `threat-dragon-v2.schema.json` (modelos 2.x) o `threat-dragon-v1.schema.json` (modelos 1.x). La aplicación valida el modelo contra el esquema al cargarlo y avisa, pero no bloquea la carga.
- En la web con repositorio, los modelos se leen de `ThreatDragonModels/<nombre del modelo>/<título del modelo>.json` en la rama elegida.

## Salidas

- Modelo guardado en JSON (local en escritorio; repositorio o almacenamiento local en la web).
- Diagramas exportados desde la barra del editor en SVG o PNG.
- Informe imprimible y, en escritorio, informe PDF.
- Validación opcional de un modelo contra el esquema [Upstream, página *Schema*]:

```bash
npx ajv validate --allow-union-types -s ~/threat-dragon-v2.schema.json --all-errors --verbose -d ThreatDragonModels/v2-threat-model.json
```

## Errores y solución de problemas

- **El servidor no arranca y muestra «ENCRYPTION_KEYS is a required property»:** falta la variable en `.env` o el archivo no está montado en `/app/.env`.
- **Imagen `latest` inestable:** usar `owasp/threat-dragon:stable` o la etiqueta de versión `v2.6.2`.
- **Mac M1 sin manifiesto compatible:** la documentación indica `docker pull --platform linux/x86_64 owasp/threat-dragon:stable`.
- **El modelo carga con avisos de esquema:** validar con `ajv` (sección Salidas) y revisar la versión del esquema (v1 o v2).
- **Depuración del contenedor:** ejecutar con `docker run -it` para ver la consola y fijar `LOG_LEVEL=debug` en `.env`.

## Advertencias

- La aplicación web expone los modelos a quien pueda acceder al servidor; la documentación pide considerar quién tendrá acceso. Para modelos confidenciales de EVOL usar el escritorio o una instancia autoalojada restringida, nunca una instancia pública.
- Guardar modelos en GitHub, Bitbucket, GitLab o Google Drive los deposita en un servicio de terceros: aplicar la política de clasificación de datos antes de elegir ese almacenamiento.
- Analítica: según la documentación, está desactivada por defecto, requiere configuración del servidor, no se captura nunca en el escritorio, y no envía nombres ni contenido de modelos; si se activa, el servidor reenvía IP y User-Agent de la petición a Plausible.
- Las claves de cifrado y los secretos OAuth no deben versionarse; usar el sufijo `_FILE` o un gestor de secretos.

## Referencias

- Proyecto OWASP: https://owasp.org/projects/threat-dragon
- Repositorio oficial: https://github.com/OWASP/threat-dragon
- Release 2.6.2: https://github.com/OWASP/threat-dragon/releases/tag/v2.6.2
- Documentación 2.6.2: https://www.threatdragon.com/docs/
- Configuración: https://www.threatdragon.com/docs/configure/configure.html
- Docker: https://www.threatdragon.com/docs/install/docker.html
- Primeros pasos: https://www.threatdragon.com/docs/usage/getting-started.html
- Esquema de modelos: https://www.threatdragon.com/docs/development/schema.html
- Analítica: https://www.threatdragon.com/docs/trust/analytics.html

## Limitaciones

- No se descargó, instaló ni ejecutó Threat Dragon para esta ficha; los procedimientos son documentales.
- La versión de la guía histórica (2.2.0) queda superada por la release 2.6.2; el README del repositorio aún muestra ejemplos Docker con `v2.2.0` y espacios de nombres antiguos.
- No se revisaron las páginas de configuración de Bitbucket, GitLab, Google Drive ni la variable concreta de analítica.
- El formato interno del valor de `ENCRYPTION_KEYS` no se reproduce aquí: debe tomarse de `minimal.env` y de *Configure* de la versión instalada.
- La herramienta ayuda a razonar sobre amenazas; no detecta vulnerabilidades ni sustituye pruebas de seguridad.
