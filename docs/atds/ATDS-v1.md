# EVOL ATLAS TOOL DOCUMENTATION STANDARD — ATDS v1

**Proyecto:** EVOL Tool Atlas  
**Ámbito:** fichas, guías, skills, casos de uso y evidencias del catálogo.  
**Versión:** 1.0  
**Estado:** estándar editorial y validación documental.

## 1. Principio central

Una ficha incorrecta, vaga o sin fuentes verificables es un defecto documental, aunque su diseño visual sea excelente. Atlas documenta conocimiento; no ejecuta herramientas ni instala software.

## 2. Niveles de madurez

### ATDS-L1 — Identificación verificable

Campos mínimos:

- Identificador estable.
- Nombre oficial.
- Categoría.
- Tipo de herramienta.
- Descripción específica.
- Problema que resuelve.
- Funciones principales.
- Fuente oficial o referencia primaria disponible.
- Plataformas compatibles según fuente.
- Limitaciones conocidas.
- Estado de la información.

### ATDS-L2 — Guía técnica

Además de L1:

- Requisitos.
- Dependencias.
- Instalación manual.
- Plataformas de instalación.
- Verificación de instalación.
- Configuración inicial.
- Primer ejemplo de uso.
- Explicación de comandos.
- Entradas requeridas.
- Salidas esperadas.
- Errores frecuentes.
- Solución de problemas.
- Advertencias.
- Referencias verificables.

### ATDS-L3 — Conocimiento aplicado

Además de L2:

- Guías avanzadas.
- Skill para agentes cuando corresponda.
- Casos de uso.
- Escenarios de aplicación.
- Interpretación de resultados.
- Limitaciones del método.
- Buenas prácticas.
- Alternativas o herramientas relacionadas cuando estén fundamentadas.

### ATDS-L4 — Evidencia experimental

Además de L3:

- Pruebas ejecutadas.
- Entornos.
- Versiones reales.
- Comandos o procedimientos utilizados.
- Resultados observados.
- Criterios de aceptación.
- Referencias a artefactos.
- Hashes.
- Procedencia.
- Limitaciones.
- Reproducciones independientes cuando existan.

ATDS-L4 no puede alcanzarse solo mediante investigación documental. Debe existir evidencia de ejecución real.

## 3. Reglas de veracidad

1. Verificar antes de afirmar.
2. Separar tipos de información: oficial, secundaria, observación local, resultado experimental, inferencia técnica, no verificado.
3. No inventar versiones.
4. No inventar compatibilidad.
5. No fabricar evidencias.
6. No rellenar para aparentar completitud.
7. Preservar la historia.

## 4. Clasificación de problemas documentales

- DOC-01 Descripción vaga.
- DOC-02 Información técnica insuficiente.
- DOC-03 Ausencia de fuente verificable.
- DOC-04 Versión ambigua o histórica presentada como actual.
- DOC-05 Compatibilidad no demostrada.
- DOC-06 Instalación incompleta o incorrecta.
- DOC-07 Comandos sin explicación.
- DOC-08 Casos de uso genéricos.
- DOC-09 Skill ausente o insuficiente.
- DOC-10 Evidencia mal clasificada.
- DOC-11 Información duplicada o contradictoria.
- DOC-12 Enlaces rotos o referencias obsoletas.

## 5. Estrategia de cobertura

- Etapa A: inventario completo con reglas automatizadas.
- Etapa B: prioridad técnica sobre herramientas destacadas, usadas por EVOL, con guías/evidencias, o con deficiencias corregibles.
- Etapa C: ampliación progresiva en lotes verificables, sin fabricar información.

No declarar completitud documental si no se ha realizado verificación por fuentes.

## 6. Validación automática

El validador documental (`scripts/validate-atds.mjs`) comprueba campos, identificadores, fuentes, enlaces, niveles y señales de vaguedad. La detección automática es una señal de revisión, no una prueba semántica definitiva.
