---
name: atlas-promptfoo
description: Guía operativa para usar promptfoo (AT-SEC-002) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# promptfoo — skill reutilizable de ia · evaluación de llm

## Cuándo usar esta skill

- Se necesita aplicar promptfoo sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `promptfoo --version` y registrar la versión.
3. Ejecutar el primer caso acotado: `promptfoo init`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Configurar explícitamente el uso offline o local para evitar envío no deseado de datos a proveedores.
- No incluir claves de API en archivos de configuración versionados; usar variables de entorno o un gestor de secretos.
- Los resultados de red teaming pueden contener contenido sensible o reproducir ataques; tratarlos como material restringido.
- Las aserciones automáticas no demuestran seguridad: requieren revisión y casos de prueba bien diseñados.
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

- [Repositorio oficial](https://github.com/promptfoo/promptfoo)
- [Documentación oficial](https://www.promptfoo.dev/docs/)
- [Paquete npm](https://www.npmjs.com/package/promptfoo)
- [Guía de Red Teaming](https://www.promptfoo.dev/docs/red-team/quickstart/)
