---
name: atlas-dm-log-writes
description: Guía operativa para usar dm-log-writes (AT-SEC-008) en revisiones técnicas de EVOL con evidencia trazable y sin ejecución automática desde el Atlas.
---

# dm-log-writes — skill reutilizable de pruebas y auditoría técnica · consistencia de almacenamiento

## Cuándo usar esta skill

- Se necesita aplicar dm-log-writes sobre un componente o repositorio autorizado de EVOL.
- Existe un entorno aislado y un responsable que revisará los resultados.
- Se requiere conservar evidencia reproducible con versión, comando y hash.

## Entradas mínimas

- Objetivo autorizado y alcance escrito.
- Versión de la herramienta y método de instalación.
- Datos de prueba ficticios o autorizados.
- Criterio de aceptación y límites de recursos.

## Procedimiento

1. Confirmar autorización, alcance y ausencia de datos reales no autorizados.
2. Verificar la instalación con `sudo dmsetup targets | grep log-writes` y registrar la versión.
3. Ejecutar el primer caso acotado: `sudo dmsetup status log`.
4. Guardar salida, código de salida, fecha, entorno y hash del artefacto.
5. Revisar los resultados manualmente y clasificarlos sin exagerar el alcance.
6. Registrar el resultado como PASS, FAIL, BLOCKED o INCONCLUSIVE y actualizar `evidencias.json` si corresponde.

## Salidas esperadas

- Registro de evidencia con procedencia y hash.
- Lista de hallazgos o resultados con limitaciones explícitas.
- Recomendación de adopción, rechazo o nueva prueba.

## Guardrails obligatorios

- Riesgo ALTO: los dispositivos usados se sobrescriben. Usar solo discos o imágenes desechables.
- Requiere privilegios elevados y puede afectar a la estabilidad del kernel.
- El log contiene datos de escritura y puede incluir información sensible.
- No usar en producción ni en el host principal sin autorización y copia de seguridad.
- Verificar dos veces las rutas de dispositivo antes de ejecutar `dmsetup create`.
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

- [Documentación del kernel](https://docs.kernel.org/admin-guide/device-mapper/log-writes.html)
- [Código en el árbol de Linux](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/md/dm-log-writes.c)
- [Herramienta de replay](https://github.com/josefbacik/log-writes)
