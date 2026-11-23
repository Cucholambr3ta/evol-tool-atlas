# PCILeech

**Evol Tool Atlas — Fine Line Premium**

## Función
Proyecto de investigación de accesos DMA a memoria de equipos, relevante para protección de hardware y threat modeling.

## Aplicación a EVOL
Documentar riesgos de DMA, IOMMU y políticas de acceso periférico, preferentemente sin acceso físico a memoria real.

## Evidencia
- Estado: FUENTE_PRIMARIA_VERIFICADA_RESTRINGIDA
- Fuente primaria: https://github.com/ufrisk/pcileech
- Canal de distribución: https://github.com/ufrisk/pcileech/releases
- Fecha consulta: 2026-11-22
- Versión registrada en el expediente documental (histórica, no actual): `4.19.5`
- Requisitos concretos de hardware/versiones no comprobados

## Restricciones
Puede permitir lectura no autorizada de memoria. No ejecutar en el host de trabajo ni en equipos ajenos; se documenta como herramienta de investigación restringida.

## Validaciones pendientes
- Prueba local real en CachyOS.
- Versión actualmente distribuida, compatibilidad y mantenimiento.
- Licencia validada desde fuente primaria.
- Instalación o aprobación en entorno EVOL.
