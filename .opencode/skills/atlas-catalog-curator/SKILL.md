---
name: atlas-catalog-curator
description: Punto de entrada de OpenCode para la curaduría de EVOL Tool Atlas y los lotes de enriquecimiento documental incremental (E3-NN) bajo ATDS v1. Usar al planificar o ejecutar un lote, o al crear, completar o validar fichas (catalogo.json, 02-catalogo/, GUIA.md, casos-uso.json, SKILL.md de herramientas, evidencias.json, políticas ATDS). Remite a la skill canónica del repositorio y respeta el gate humano.
---

# atlas-catalog-curator (OpenCode)

Este archivo solo es un punto de entrada para que OpenCode descubra la skill. **No contiene el
procedimiento**, para no crear una segunda fuente de verdad.

1. Lee completa la skill canónica: `skills/atlas-catalog-curator/SKILL.md` (desde la raíz del
   repositorio).
2. Lee la Metodología que cita: `docs/atds/METODOLOGIA-ENRIQUECIMIENTO-INCREMENTAL.md`, y el
   estándar `docs/atds/ATDS-v1.md`.
3. Sigue sus pasos en orden. Los pasos 1–2 (estado y `node scripts/atlas-next-batch.mjs`) son de
   solo lectura. Para modificar fichas, publicar un PR, fusionar o abrir el lote siguiente hace
   falta la autorización humana que exige su §1. Sin ella, entrega el plan y detente.

Si este archivo y la skill canónica difieren, prevalece la canónica.
