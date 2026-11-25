---
name: atlas-semgrep
description: Guía operativa para usar Semgrep (AT-SEC-001) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# Semgrep — skill reutilizable de auditoría · sast

## Cuándo usar esta skill

- Se necesita aplicar Semgrep sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `semgrep --version` y registrar la versión.
3. Ejecutar el primer caso acotado: `semgrep scan --config .semgrep.yml --metrics=off .`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Los hallazgos requieren revisión humana; las reglas genéricas producen falsos positivos y falsos negativos.
- Revisar la política de telemetría y el origen de las reglas antes de analizar código privado.
- No ejecutar `--config auto` sobre repositorios sensibles sin revisar qué reglas se descargan y qué datos se envían.
- Semgrep analiza código, pero no ejecuta el programa analizado; aun así, tratar los informes como material sensible.
- No ejecutar desde el Atlas ni desde la PWA.
- No incluir credenciales, secretos, rutas privadas ni datos personales en la evidencia.
- No declarar PASS sin una ejecución real y verificable.

## Evidencia y trazabilidad

- Registrar cada ejecución real en el formato `evol-tool-atlas/evidencias/1`.
- Guardar comando, versión, entorno, fecha, salida relevante y hash del artefacto.
- Estados permitidos: `PASS`, `FAIL`, `BLOCKED`, `INCONCLUSIVE`.
- No convertir un resultado parcial en PASS. Si no se ejecutó, el estado correcto es `BLOCKED`.
- No incluir credenciales, tokens, rutas privadas ni datos de clientes en la evidencia.

## Referencias

- [Repositorio oficial](https://github.com/semgrep/semgrep)
- [Publicaciones oficiales](https://github.com/semgrep/semgrep/releases)
- [Documentación oficial](https://semgrep.dev/docs/)
- [Paquete PyPI](https://pypi.org/project/semgrep/)
