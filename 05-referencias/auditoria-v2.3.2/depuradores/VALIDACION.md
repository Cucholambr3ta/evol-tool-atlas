# Validación de la categoría

# Categoría 14 — Depuradores y análisis de ejecución

**Evol Tool Atlas · Fine Line Premium · 22-11-2026**

Inspección de procesos, errores de memoria, registros de ejecución y depuración de binarios.

- Entradas originales registro documental: 10.
- Fichas conservadas con fuente pública comprobada: 9.
- Excluidas del catálogo operativo: 1.
- Ninguna herramienta ha sido instalada o probada en CachyOS por este proceso.
- Disponibilidad de una fuente **no** significa aprobación de uso, mantenimiento activo ni seguridad de dependencias.

## Herramientas
- **edb-debugger** · EVALUACION: Depurador gráfico de código máquina para distintas arquitecturas.
- **Electric Fence** · LEGADO: Biblioteca histórica para detectar accesos indebidos a memoria mediante guard pages.
- **gdbgui** · EVALUACION: Interfaz web local para GNU Debugger.
- **heaptrace** · HISTORICO: Herramienta para observar operaciones de heap y apoyar depuración de memoria.
- **rr** · EVALUACION: Grabación y reproducción determinista de ejecuciones para depuración.
- **Saleae Logic 2** · EVALUACION: Software oficial para análisis y captura de señales de hardware Saleae.
- **shellnoob** · HISTORICO: Kit histórico para creación y análisis de código máquina en contextos de investigación.
- **Vivisect** · EVALUACION: Entorno de análisis estático y dinámico de binarios.
- **Voltron** · HISTORICO: Interfaz complementaria para depuradores, orientada a análisis de bajo nivel.

## Exclusiones
- **ollydbg**: Sitio oficial y descarga histórica verificados, pero es un depurador Win32; no existe validación nativa Linux ni utilidad operativa demostrada para CachyOS.

## Instalación
Descomprimir este ZIP de categoría dentro de `/mnt/evol-dev/workspaces/evol-tool-atlas/`. No ejecuta ninguna instalación de las herramientas descritas. Utilizar `unzip -n` para no sobrescribir archivos anteriores.

## Criterio editorial
Excluir enlaces sin procedencia suficiente y herramientas incompatibles con el alcance operativo EVOL; permitir documentación histórica si la fuente de distribución es identificable y marcarla de modo inequívoco.
