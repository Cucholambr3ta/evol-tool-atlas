---
name: atlas-dm-flakey
description: Guía operativa para usar dm-flakey (AT-SEC-007) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# dm-flakey — skill reutilizable de pruebas y auditoría técnica · inyección de fallos

## Cuándo usar esta skill

- Se necesita aplicar dm-flakey sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `sudo dmsetup targets | grep flakey` y registrar la versión.
3. Ejecutar el primer caso acotado: `sudo dmsetup status flakey-test`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Riesgo ALTO: apuntar el target a un dispositivo real puede destruir datos. Usar únicamente dispositivos de pruebas desechables.
- Requiere privilegios de root o CAP_SYS_ADMIN; limitar el uso a entornos aislados.
- El módulo y el target forman parte del kernel: un fallo puede afectar a todo el sistema.
- Registrar siempre la tabla, el dispositivo y el momento de eliminación.
- No usar en producción ni en el host principal sin una autorización explícita y copia de seguridad verificada.
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

- [Documentación del kernel](https://docs.kernel.org/admin-guide/device-mapper/dm-flakey.html)
- [Código en el árbol de Linux](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/md/dm-flakey.c)
- [Documentación de device-mapper](https://docs.kernel.org/admin-guide/device-mapper/)
