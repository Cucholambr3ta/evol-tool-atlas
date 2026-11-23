# secure-delete

**Evol Tool Atlas — Fine Line Premium**

## Función
Conjunto histórico de utilidades para sobrescritura de archivos y espacios libres en determinados soportes. Se conserva como referencia de análisis de sanitización.

## Aplicación a EVOL
Comparar mecanismos de eliminación de datos y documentar limitaciones frente a cifrado por volumen, borrado criptográfico y retención de snapshots.

## Evidencia
- Estado: DISTRIBUCION_VERIFICADA_HEREDADA
- Fuente primaria: Referencia externa retirada por política editorial
- Canal de distribución: https://packages.debian.org/trixie/secure-delete
- Fecha consulta: 2026-11-22
- Versión registrada en el expediente documental (histórica, no actual): `1.b63d814`
- Utilidad heredada; la fuente GitHub consultada es un espejo, no upstream

## Restricciones
No prometer borrado irrecuperable en SSD, Btrfs, snapshots, copy-on-write, remapeo de bloques o backups. No ejecutar sobre el disco anfitrión ni sobre recuerdos reales. El sitio THC del catálogo no identifica el recurso; se verificó espejo histórico y paquete Debian.

## Validaciones pendientes
- Prueba local real en CachyOS.
- Versión actualmente distribuida, compatibilidad y mantenimiento.
- Licencia validada desde fuente primaria.
- Instalación o aprobación en entorno EVOL.
