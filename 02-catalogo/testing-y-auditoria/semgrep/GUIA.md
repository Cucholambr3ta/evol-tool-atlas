# Semgrep · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-001  
**Categoría Atlas:** Auditoría · SAST  
**Versión de referencia verificada:** 1.187.0  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta Semgrep. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

Semgrep es un analizador estático ligero que busca patrones similares al código fuente. Permite escribir reglas propias y ejecutarlas sobre un repositorio sin compilar el proyecto, lo que encaja con revisiones de seguridad y comprobaciones de CI.

En EVOL se propone como herramienta de apoyo para detectar patrones inseguros en código propio, no como sustituto de revisión manual, pruebas dinámicas ni análisis de dependencias.

## 2. Instalación manual

La vía principal documentada es el paquete de Python. También existen Homebrew y una imagen de contenedor. El Atlas no verificó ninguna de estas instalaciones en el host.

### Linux

```bash
python3 -m pip install --user semgrep
```

```bash
brew install semgrep
```

```bash
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config auto
```


### macOS

```bash
brew install semgrep
```

También puede usarse el paquete de Python con pip.


### Windows

```powershell
python -m pip install semgrep
```

El soporte nativo en Windows no se verificó en esta ficha; si aparece un problema de dependencias, usar contenedor o WSL2 y registrarlo como limitación.


### Verificación básica de la instalación

```bash
semgrep --version
```

```bash
semgrep --help | head
```

## 3. Configuración

Semgrep puede ejecutarse con reglas de un registro remoto o con un archivo local. Para repositorios privados es preferible revisar y fijar las reglas localmente antes de ejecutar.

Ejemplo mínimo de regla local (`.semgrep.yml`), con sintaxis de Semgrep:

```yaml
rules:
  - id: evitar-eval
    languages: [python]
    message: Evitar eval sobre datos no confiables
    severity: WARNING
    pattern: eval(...)
```

La configuración de telemetría se controla con `--metrics=off`. La comprobación de versión puede desactivarse con `--disable-version-check` en entornos sin red.

## 4. Primer uso

```bash
semgrep scan --config .semgrep.yml --metrics=off .
```

```bash
semgrep scan --config .semgrep.yml --metrics=off --json --output resultados.json .
```

El primer uso debe hacerse sobre un repositorio de prueba o una copia autorizada. Revisar los hallazgos antes de abrir incidencias: un patrón detectado no demuestra explotabilidad.

## 5. Uso avanzado

Integración en CI con SARIF:

```bash
semgrep scan --config .semgrep.yml --metrics=off --sarif --output semgrep.sarif .
```

Comparación contra una línea base para revisar solo cambios:

```bash
semgrep scan --config .semgrep.yml --baseline-commit <commit> --metrics=off .
```

El comando `semgrep ci` está orientado a la plataforma de Semgrep y puede implicar autenticación o envío de datos; no usarlo sin revisar antes la política de privacidad y la configuración de la organización.

## 6. Seguridad, alcance y limitaciones

- Los hallazgos requieren revisión humana; las reglas genéricas producen falsos positivos y falsos negativos.
- Revisar la política de telemetría y el origen de las reglas antes de analizar código privado.
- No ejecutar `--config auto` sobre repositorios sensibles sin revisar qué reglas se descargan y qué datos se envían.
- Semgrep analiza código, pero no ejecuta el programa analizado; aun así, tratar los informes como material sensible.


### Evidencia disponible

Registro EV-AT-SEC-001-01: PASS acotado sobre fixture sintético, con salida JSON y hash del binario.


## 7. Solución de problemas

### Python o pip no disponibles

Instalar Python 3.10+ desde el gestor del sistema o usar la imagen de contenedor. No se validó esta instalación en el Atlas.

### La descarga de reglas falla sin red

Usar un archivo de reglas local con `--config .semgrep.yml` y evitar `--config auto`.

### Demasiados hallazgos en el primer análisis

Empezar por una regla concreta, revisar resultados y ampliar el conjunto de forma incremental.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/semgrep/semgrep)
- [Publicaciones oficiales](https://github.com/semgrep/semgrep/releases)
- [Documentación oficial](https://semgrep.dev/docs/)
- [Paquete PyPI](https://pypi.org/project/semgrep/)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
