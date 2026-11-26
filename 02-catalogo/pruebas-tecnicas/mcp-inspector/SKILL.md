---
name: atlas-mcp-inspector
description: Guía operativa para usar MCP Inspector (AT-SEC-004) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# MCP Inspector — skill reutilizable de pruebas y auditoría técnica · mcp

## Cuándo usar esta skill

- Se necesita aplicar MCP Inspector sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `node --version` y registrar la versión.
3. Ejecutar el primer caso acotado: `npx @modelcontextprotocol/inspector --cli node build/index.js --method initialize`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Un servidor MCP puede exponer herramientas con efectos destructivos; inspeccionar primero el contrato y usar un servidor de pruebas.
- Las cabeceras y variables de entorno pueden contener credenciales; no incluirlas en capturas, informes ni evidencia.
- La inspección remota puede enviar datos al servidor y a proxies intermedios; revisar la política de red.
- El Inspector no certifica la seguridad del servidor: solo muestra su contrato y comportamiento observable.
- Revisar la licencia en transición (MIT/Apache-2.0) antes de redistribuir.
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

- [Repositorio oficial](https://github.com/modelcontextprotocol/inspector)
- [Paquete npm](https://www.npmjs.com/package/@modelcontextprotocol/inspector)
- [Documentación MCP](https://modelcontextprotocol.io/)
