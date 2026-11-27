# EVOL TOOL ATLAS — ESTABILIZACIÓN POST-E3-01 IMPLEMENTADA — AUDITORÍA INDEPENDIENTE REQUERIDA

| | |
|---|---|
| Rama local | `atlas/estabilizacion-post-e3-01` (worktree `../evol-tool-atlas-estab`) |
| Baseline | `origin/main` = `6a98bfb48fe3bd1945c007cfb0032f8e52b95d6a` |
| HEAD certificado | `d4e903f2a236a527fbf429b87a6d5be2740bea1e` (el commit de este informe va encima; sin autorreferencia) |
| Publicación | **No publicada.** Sin push, sin PR, sin fusión. Pendiente de autorización del propietario |
| CI remoto | **NO VERIFICADO**: no existe un run porque la rama no se publicó |

Documentos: [matriz](POST-E3-01-MATRIZ-HALLAZGOS.md) · [plan](POST-E3-01-PLAN-REMEDIACION.md) ·
[manifiesto de resultados](POST-E3-01-MANIFIESTO-RESULTADOS.json) ·
[política de publicación](../atds/POLITICA-PUBLICACION.md) · [hosting](../hosting/HOSTING.md) ·
[evidencia OpenCode](evidencias/POST-E3-01-OPENCODE-TRANSFERENCIA.md).

## 1. Resultado por hallazgo

Los 41 IDs exigidos están en la matriz con evidencia roja y verde. Resumen:

- **Cerrados con prueba roja → verde:** SEC-DEV-01, ROUTER-01, SEC-WEB-01, SEC-DATA-01, ATDS-ROB-01/02,
  ATDS-11..15, ATDS-L3-01, ATDS-UI-01..06, ATDS-PUBLISH-01, OFF-01..05, FAV-01, DATA-02, OFF-VERIFY-01,
  A11Y-01..04, UX-01, UX-03, DOC-01, QA-01..04, SEC-STATIC-01.
- **Riesgo verificado y acotado:** SEC-SVG-01. No hay entrada externa; se añade validación estática.
- **Parcial:** UX-02. Los controles automáticos están cerrados; la revisión manual con lector de
  pantalla queda **NO VERIFICADA**.
- **Defectos nuevos encontrados y corregidos:**
  - el timeout del SW truncaba los cuerpos grandes;
  - `localStorage` bloqueado lanzaba fuera del `try`;
  - un slug de categoría inexistente se mostraba como «JSON malformado»;
  - «1 fichas» en las 4 categorías E3-01;
  - nombres accesibles que ocultaban el texto visible.
- **P1 abiertos:** ninguno.

## 2. Cambios por subsistema (9 commits)

| Commit | Bloque |
|---|---|
| `709fb746` | Línea base y plan |
| `dcd0dd31` | Servidor dev, router, CSP por cabecera, base path |
| `14da2d4e` | Motor ATDS: esquema, identidad, tipos, versión, procedencia, declarada/acreditada, L3 opcional; gate 27/27 |
| `0c1915fb` | Contratos JSON en el fetch; iconos |
| `071b8668` | Resumen ATDS oficial en la PWA, fechas explícitas, etiquetas, política de publicación |
| `e1857025` | Offline por revisión con SHA-256, manifiesto determinista, consistencia por ID, favoritos reales, timeout del SW |
| `d71a972b` | Drawer, foco y scroll, migas, estados, nombres accesibles, Playwright portátil, E2E nuevo |
| `755c70c4` | `check:release`, CI bloqueante, escaneo estructural del HTML, métricas, documentación de hosting |
| `d4e903f2` | Skill canónica, punto de entrada OpenCode, Metodología 1.1, planificador del lote |

## 3. Pruebas realmente ejecutadas (sobre `d4e903f2`, checkout del worktree)

| Comando | Exit | Resultado |
|---|---|---|
| `npm ci` | 0 | dependencias exactas del lockfile |
| `npm run check:release` | 0 | incluye todo lo siguiente |
| ↳ `generate:data` | 0 | 49 categorías, 2.137 herramientas, 741 excluidas, 6.672 recursos offline |
| ↳ `typecheck` (app, SW, tests) · `lint` | 0 · 0 | sin errores |
| ↳ `test:unit` | 0 | **549/549** (15 archivos; baseline 356) |
| ↳ `validate:atds` (REPORT) | 0 | 2.137 evaluadas; 0 `ERROR` de estado |
| ↳ `gate:atds` (STRICT) | 0 | **27/27** códigos esperados (baseline 22) |
| ↳ `build` · `verify:catalog` · `verify:release` | 0 · 0 · 0 | integridad, marca, escaneo HTML, manifiesto contra `dist/` |
| ↳ `test:e2e` (Chromium 158, `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium`) | 0 | **12/12** sobre `dist/` servido por `vite preview` |
| `VITE_BASE_PATH=/`: build + `verify:release` + E2E no offline | 0 | 7/7 (despliegue en raíz) |
| `verify-atlas --release` sin `dist/` | **1** | esperado: «dist/ is required in --release mode» |
| `node scripts/atlas-next-batch.mjs --json` | 0 | plan E3-02 de solo lectura |

Durante el trabajo, `/tmp` (tmpfs de 15 GB) se llenó con datos de otras sesiones ajenas a este
repositorio. Las pruebas se ejecutaron con `TMPDIR` en `/mnt/evol-dev`; no se borró nada ajeno.

## 4. Niveles E3-01 e integridad del catálogo

- threat-dragon, sagan, nfcutils y secure-delete: **L3 validado**. `L3_SKILL` = `ABSENT_OPTIONAL`;
  ninguna en L4. Las políticas E2 y E3-01 no cambian y pasan.
- REPORT idéntico a la baseline. Validados: NONE 2124 · L1 9 · L3 4. Candidatos: L1 2121 · L3 11 ·
  L4 5.
- `catalogo.json` `bf279af87d037e4e904712c3047aac2bfd42e511d530940d335f54cae3410483` (idéntico).
  `git diff 6a98bfb4 -- catalogo.json SHA256SUMS.txt 02-catalogo 05-referencias 01-inventario
  06-planificacion plantillas` está vacío. Ninguna ficha, evidencia, hash, fuente ni fecha
  modificada.
- **Único documento del corpus documental modificado, por mandato expreso:** la skill canónica
  `skills/atlas-catalog-curator/SKILL.md` y la Metodología (v1.1).

## 5. CSP en el hosting

El hosting real es `vite preview` (servicio systemd). Por cabecera se envían:

- **SPA:** CSP de app con `frame-ancestors 'none'`.
- **Páginas estáticas:** CSP de documentos (`script-src 'none'`, solo estilos en línea).
- **Todas las respuestas:** `nosniff`, `no-referrer`, COOP y Permissions-Policy.

El E2E lo comprueba con cabeceras reales y 0 violaciones. GitHub Pages no admite cabeceras; esa
limitación está documentada sin afirmar protección.

## 6. Offline

- **Revisión:** `a2388f71…` con 6.672 recursos (26,1 MB), determinista.
- **E2E con perfil limpio:**
  - descarga parcial con un fallo simulado, sin declararse completa;
  - reintento → completa;
  - corrupción controlada detectada, eliminada y reparada;
  - navegación realmente offline;
  - borrado con confirmación cancelable;
  - favoritos intactos.
- **Unitarias:** cuota agotada, nueva revisión en dos fases, SHA distinto y cancelación.

## 7. Accesibilidad

- **Automático (E2E):** drawer con contención de foco y fondo inerte, progreso con nombre, migas,
  h1 en estados, foco y scroll al navegar, objetivos ≥ 24 px, reflow a 320/640 px, contraste en
  tema oscuro, movimiento reducido y foco visible.
- **NO VERIFICADO:** revisión manual con lector de pantalla (NVDA/Orca/VoiceOver).

## 8. Métricas (medianas de 5 ejecuciones, `scripts/measure-performance.mjs`, misma máquina)

| Métrica | Baseline `6a98bfb4` | Estabilizado | Δ |
|---|---|---|---|
| Dashboard listo | 273 ms | 256 ms | −17 ms (ruido) |
| Búsqueda «semgrep» | 59 ms | 69 ms | +10 ms |
| Categoría mayor (webapp, 257) | 74 ms | 95 ms | +21 ms |
| Ficha semgrep | 46 ms | 51 ms | +5 ms |
| Heap JS | 5 MB | 7 MB | +2 MB |
| `catalog-index.json` | 932.314 B | 963.291 B | +3,3 % |
| Fragmentos (49) | 5.859.647 B | 8.842.182 B | +51 % (resumen ATDS por ficha) |
| `offline-manifest.json` | 184.701 B | 1.154.542 B | ×6,3 (SHA-256 por recurso, 6.672 recursos) |
| JS de la app | 69.508 B | 96.638 B | +39 % |
| Prueba E2E offline completa | 7,9 s (2.292 recursos) | 28–170 s según la carga del equipo (6.672 recursos, hash incluido) | más cobertura e integridad |

No se declara ninguna optimización. El coste viene de la integración ATDS, los contratos y la
integridad offline. Un recorte posible, no aplicado, sería mover `rawMetadata` fuera de los
fragmentos.

## 9. Rúbrica (sin autoaprobación; puntuación orientativa con evidencia)

| Componente | Máx. | Puntos | Evidencia / límite |
|---|---|---|---|
| HTML/semántica | 15 | 13 | landmarks, h1 por vista, migas, escaneo estructural; plantillas históricas pendientes de su auditoría |
| Arquitectura de información | 20 | 17 | estado ATDS oficial, fuentes por tipo, fechas explícitas; peso de los fragmentos |
| UX | 15 | 12 | foco, scroll, estados, confirmaciones; sin estudio con usuarios |
| ATDS | 15 | 14 | contrato L4 endurecido, 27 controles; heurística sintáctica de versión |
| Accesibilidad | 10 | NO VERIFICADO (parcial 7) | automático completo; falta la revisión manual con lector de pantalla |
| Seguridad | 10 | 9 | traversal, CSP por cabecera, contratos; `style-src 'unsafe-inline'` en documentos históricos |
| Rendimiento | 5 | 3 | medido; regresiones moderadas documentadas |
| Mantenibilidad | 10 | 9 | módulos probados y `.d.mts`; base path central |
| **Total** | 100 | 84 + NO VERIFICADO | la nota no compensa los puntos pendientes de §10 |

## 10. Dictamen

**GO CON OBSERVACIONES** (propuesto; la decisión corresponde a la auditoría independiente y al
propietario). No hay P1 abiertos y todos los gates locales están completos. Observaciones que
requieren aprobación explícita:

1. Run de CI remoto: NO VERIFICADO hasta que se autorice publicar la rama.
2. Revisión manual con lector de pantalla: NO VERIFICADA.
3. OpenCode: la herramienta `skill` no pudo cargar la skill en `opencode run` no interactivo
   (permiso `ask` autorrechazado). El descubrimiento y la lectura sí se demostraron (§11).

## 11. Transferencia operativa a OpenCode

- **Skill canónica actualizada:** `skills/atlas-catalog-curator/SKILL.md`, con un flujo de 15 pasos,
  comandos reales, contratos post-E3-01 y gates humanos.
- **Punto de entrada:** `.opencode/skills/atlas-catalog-curator/SKILL.md` (frontmatter `name` y
  `description`; remite a la canónica sin duplicarla).
- **Referencias:**
  - `docs/atds/METODOLOGIA-ENRIQUECIMIENTO-INCREMENTAL.md` (v1.1), `docs/atds/ATDS-v1.md` y
    `docs/atds/POLITICA-PUBLICACION.md`;
  - `scripts/atlas-next-batch.mjs`, `scripts/atds-*-policy.json` y
    `scripts/atds-provenance-exceptions.json`.
- **Contratos reutilizados:**
  - validador ATDS (L3 opcional; identidad, tipo, versión y procedencia para L4);
  - gate STRICT y `check:release`;
  - regeneración automática de `public/data`;
  - regla NO VERIFICADO.
- **Prueba estática:** `tests/unit/post-e3-01-skill.test.ts` 7/7. Frontmatter válido, sin rutas
  absolutas, cada `npm run`, `node scripts/…` y archivo citado existe, y el plan E3-02 es correcto.
- **Prueba real con OpenCode v2.4.1:** agente `plan`, edición denegada, sin `--auto`. Árbol idéntico
  antes y después; todos los comandos fueron de lectura.

  | Requisito | Resultado |
  |---|---|
  | Descubrir la skill | **PASS**: la listó como `atlas-catalog-curator` y pidió cargarla |
  | Leerla | **PASS** mediante lectura de archivo; carga por la herramienta `skill` **NO VERIFICADA** |
  | Localizar la Metodología y ATDS | **PASS** |
  | Próximas categorías sin modificar | **PASS**: ejecutó el planificador; packer, keylogger, firmware… |
  | Plan simulado de E3-02 | **PASS**: sherlocked, vbsmin, logkeys, python-keylogger, con pasos y archivos |
  | Comandos de validación | **PASS**: `check` y `check:release` |
  | Gate humano | **PASS**: se detuvo y enumeró las autorizaciones |

- **Limitaciones:**
  - para usar la herramienta `skill` en ejecuciones no interactivas, el propietario debe permitir
    `skill` en su configuración de OpenCode, o ejecutarlo de forma interactiva;
  - el agente que ejecute el E2E necesita Chromium.
- **Instrucción mínima para iniciar E3-02:**
  > Lee `skills/atlas-catalog-curator/SKILL.md` y la Metodología. Ejecuta los pasos 1–2 y preséntame
  > el plan del lote E3-02. Autorizo abrir y ejecutar el lote E3-02 con el alcance propuesto
  > [y publicar su PR]. Detente antes de fusionar.

## 12. Riesgos residuales

- La detección de «solo versión» es sintáctica. Un comando funcional que no lo parezca, o al revés,
  requiere revisión humana del registro.
- Las páginas históricas necesitan `style-src 'unsafe-inline'` hasta la auditoría de su plantilla.
- La cobertura offline completa (26 MB) puede chocar con cuotas pequeñas. Esos casos se gestionan
  conservando la copia anterior.
- El E2E offline completo es lento en equipos cargados (timeout de 5 min para esa espera).

## 13. Publicación pendiente de autorización

Para publicar hace falta la autorización expresa del propietario. Con ella:

```bash
git push -u origin atlas/estabilizacion-post-e3-01
gh pr create --base main --head atlas/estabilizacion-post-e3-01
```

Después, verificar el run de CI del SHA final en sus logs. No se fusiona sin auditoría independiente.

## Adenda — corrección del P1 NEXT-BATCH-01 (auditoría independiente del PR #4)

- **Hallazgo:** el planificador `scripts/atlas-next-batch.mjs` marcaba como completada una categoría en cuanto una parte de sus herramientas aparecía en una política de lote aprobado. Los sublotes de categorías con más de 6 herramientas habrían omitido herramientas pendientes.
- **Reproducción con la versión `d4e903f2`:**
  - Raíz temporal con una categoría de 8 herramientas y un sublote aprobado de 6.
  - El plan propuso la categoría siguiente y omitió `g7` y `g8`.
- **Corrección (`7c070aaf`), en `scripts/lib/next-batch.mjs`, ahora función pura con el CLI como envoltorio de solo lectura:**
  - El progreso se mide por ID.
  - Una categoría sigue pendiente hasta procesar todas sus herramientas admitidas.
  - Una categoría ya empezada se continúa primero.
  - Los sublotes son consecutivos: `E3-NNa` y luego `E3-NNb`, `E3-NNc`… con el mismo número.
  - Se respeta el límite `--max-tools`, sin repetir ni omitir IDs.
  - Una política que cita un ID inexistente, o un ID presente en dos políticas, provoca exit 2.
- **Ajuste formal:** Metodología §1.6–§1.7 y §2 (regla de numeración y nombre de la política del sublote) y paso 2 de la skill canónica.
- **Pruebas** (`tests/unit/post-e3-01-next-batch.test.ts`, 7/7; junto con la de la skill, 14/14):
  - progresión categoría de 8 → sublote E3-02a de 6 → sublote E3-02b de 2 → categoría completada, con la unión exacta de IDs y sin intersección;
  - límite 3 (E3-02a/b/c);
  - categoría pequeña parcialmente cubierta;
  - políticas inconsistentes;
  - CLI real en una raíz temporal;
  - repositorio real.
- **Resultado actual sin cambios:** E3-02 = sherlocked, vbsmin, logkeys, python-keylogger.
- **Alcance:** sin cambios en fichas, `catalogo.json` ni políticas aprobadas. E3-02 no se ha iniciado y el PR no se fusiona.
- **Certificación del nuevo SHA final:** `npm run check:release` local y el run de GitHub Actions sobre ese SHA se registran en el comentario de cierre del P1 en el PR #4. No se escriben aquí para evitar la autorreferencia del SHA.
