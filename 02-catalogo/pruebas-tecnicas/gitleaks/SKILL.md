---
name: atlas-gitleaks
description: Guía operativa para usar Gitleaks (AT-SEC-009) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# Gitleaks — skill reutilizable de pruebas y auditoría técnica · secretos

## Cuándo usar esta skill

- Se necesita aplicar Gitleaks sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `gitleaks version` y registrar la versión.
3. Ejecutar el primer caso acotado: `gitleaks git .`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Un hallazgo confirma una coincidencia de regla, no necesariamente un secreto válido; y la ausencia de hallazgos no demuestra que no haya secretos.
- Los informes pueden contener el secreto o parte de él; restringir el acceso y rotar cualquier credencial expuesta.
- No usar allowlists amplias para "limpiar" el informe sin revisar cada caso.
- El historial de Git puede contener secretos aunque el árbol actual esté limpio.
- Ejecutar sobre copias autorizadas y no enviar el código a servicios externos sin revisar la política.
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

- [Repositorio oficial](https://github.com/gitleaks/gitleaks)
- [Publicaciones oficiales](https://github.com/gitleaks/gitleaks/releases)
- [Configuración de ejemplo](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml)
