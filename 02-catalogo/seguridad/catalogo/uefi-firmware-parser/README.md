# UEFI Firmware Parser — Evol Tool Atlas

- **Estado de la fuente:** `DISTRIBUCION_PYPI_VERIFICADA`
- **Versión de publicación comprobada:** 1.17
- **Versión histórica v2.3.2:** `215.c4b8c64`
- **Instalación en CachyOS:** `NO_VERIFICADA_EN_HOST`
- **Pruebas funcionales locales:** `NO_EJECUTADAS`
- **Fecha de comprobación:** 2026-11-22

## Función

Módulo y utilidad CLI de Python para analizar estructuras UEFI, cápsulas, volúmenes y otras estructuras de firmware.

## Aplicación a EVOL

Análisis sin ejecución de muestras UEFI en el laboratorio EVOL; apoyo a diagnósticos de compatibilidad de arranque.

## Fuentes primarias

- Repositorio: https://github.com/theopolis/uefi-firmware-parser
- Distribución: https://pypi.org/project/uefi-firmware/

## Mantenimiento y límites

Publicación 1.17 en PyPI el 15-11-2026; requiere Python 3.10 o superior.

El número 215.c4b8c64 del expediente documental corresponde a su esquema de paquetización, no se equipara directamente a la versión PyPI 1.17.

## Seguridad

Analizar firmware desconocido únicamente en entornos aislados; no ejecutar código extraído ni instalar globalmente por defecto.

## Licencia

Consultar LICENSE del repositorio; licencia no ratificada en este paquete

## Política de publicación

La comprobación de una fuente no equivale a evaluación de seguridad de la herramienta. No se ha instalado ni probado en el host. No se realizan instalaciones automáticas.
