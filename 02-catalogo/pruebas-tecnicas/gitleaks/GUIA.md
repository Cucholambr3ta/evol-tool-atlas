# Gitleaks · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-009  
**Categoría Atlas:** Pruebas y auditoría técnica · Secretos  
**Versión de referencia verificada:** 8.30.1  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta Gitleaks. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

Gitleaks busca secretos en código, historial de Git, directorios y entrada estándar. Usa reglas configurables y puede generar informes JSON, SARIF o CSV.

En EVOL se propone como comprobación previa a la publicación de repositorios y artefactos. No sustituye la rotación de secretos ni la revisión de historial una vez que un secreto ha sido expuesto.

## 2. Instalación manual

Existen binarios de release, Homebrew, Go y una imagen de contenedor. Fijar la versión y verificar el hash del binario cuando se descargue manualmente.

### Linux

```bash
brew install gitleaks
```

```bash
go install github.com/gitleaks/gitleaks/v8@latest
```

```bash
docker run --rm -v "${PWD}:/path" zricethezav/gitleaks:latest dir /path
```


### macOS

```bash
brew install gitleaks
```

También hay binarios de release para macOS.


### Windows

Descargar el binario de la página de releases y verificar su hash; no se verificó la instalación en el host.


### Verificación básica de la instalación

```bash
gitleaks version
```

```bash
gitleaks --help | head
```

## 3. Configuración

Gitleaks usa una configuración TOML. El README documenta `[extend]` con `useDefault = true` para heredar las reglas por defecto y `[[rules]]` para reglas propias.

La precedencia documentada incluye `--config/-c`, `GITLEAKS_CONFIG`, `GITLEAKS_CONFIG_TOML` y `.gitleaks.toml` en la ruta objetivo.

Las allowlists deben revisarse: una exclusión demasiado amplia puede ocultar secretos reales. Documentar cada exclusión y su motivo.

## 4. Primer uso

```bash
gitleaks git .
```

```bash
gitleaks dir .
```

```bash
gitleaks git --report-format json --report-path gitleaks.json .
```

Empezar por un repositorio de prueba o una copia autorizada. Revisar los hallazgos antes de compartir el informe: puede contener fragmentos de secretos.

## 5. Uso avanzado

Escanear entrada estándar:

```bash
printf '%s\n' "$CONTENIDO" | gitleaks stdin
```

Usar una configuración concreta:

```bash
gitleaks git --config .gitleaks.toml --report-format sarif --report-path gitleaks.sarif .
```

En CI, fijar la versión del binario y conservar el informe como artefacto restringido. No publicar informes con secretos en claro.

## 6. Seguridad, alcance y limitaciones

- Un hallazgo confirma una coincidencia de regla, no necesariamente un secreto válido; y la ausencia de hallazgos no demuestra que no haya secretos.
- Los informes pueden contener el secreto o parte de él; restringir el acceso y rotar cualquier credencial expuesta.
- No usar allowlists amplias para "limpiar" el informe sin revisar cada caso.
- El historial de Git puede contener secretos aunque el árbol actual esté limpio.
- Ejecutar sobre copias autorizadas y no enviar el código a servicios externos sin revisar la política.


### Evidencia disponible

Registro EV-AT-SEC-009-01: PASS acotado sobre ~55 bytes sin fugas; comando no conservado.


## 7. Solución de problemas

### Demasiados falsos positivos

Ajustar reglas y allowlists con revisión caso por caso; documentar cada exclusión.

### El informe contiene secretos

Tratarlo como material restringido, rotar la credencial y evitar publicarlo.

### El comando de escaneo de Git falla por el repositorio

Verificar que la ruta es un repositorio Git válido o usar `gitleaks dir` para un directorio.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/gitleaks/gitleaks)
- [Publicaciones oficiales](https://github.com/gitleaks/gitleaks/releases)
- [Configuración de ejemplo](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
