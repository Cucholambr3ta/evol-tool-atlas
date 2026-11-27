# ETAPA 3 · Lote E3-01 — Informe de enriquecimiento documental

**Repositorio:** https://github.com/Cucholambr3ta/evol-tool-atlas
**Baseline (`main`):** `48136e09f7cc9964477f6a9101ec3afeeb1280a1` (coincide con la baseline indicada; sin delta)
**Rama:** `atlas/etapa-03-lote-01-categorias-minimas`
**SHA de implementación:** `b2476c834393a2d0cacae969174ae414a23b09ab` (último commit de contenido y controles)
**PR, SHA final y run de CI:** se publican en la descripción del PR y en la entrega (este commit no puede citarse a sí mismo).
**Fecha de consulta de fuentes:** 2026-11-26
**Metodología aplicada:** `docs/atds/METODOLOGIA-ENRIQUECIMIENTO-INCREMENTAL.md`

> Solo se declara implementado el lote E3-01. La etapa 3 global no está completada. La aprobación corresponde a la auditoría independiente y al propietario.

## 1. Identidad, tamaño y criterio de orden

Lote **E3-01**: 4 herramientas, 4 categorías, 1 PR. Criterio: categorías con menor número de herramientas admitidas; empate por `categorias[].numero` ascendente. Conteo efectivo de `herramientas[]` por categoría contrastado con `admitidas` sin discrepancias:

| Orden | Nº | Categoría | admitidas | efectivas | ID | Ruta |
|---|---|---|---|---|---|---|
| 1 | 2 | Modelado de amenazas | 1 | 1 | `threat-dragon` | `02-catalogo/seguridad/catalogo/threat-dragon/` |
| 2 | 3 | Detección de intrusiones | 1 | 1 | `sagan` | `02-catalogo/seguridad/catalogo/sagan/` |
| 3 | 4 | NFC | 1 | 1 | `nfcutils` | `02-catalogo/seguridad/catalogo/nfcutils/` |
| 4 | 5 | Anti-forense | 1 | 1 | `secure-delete` | `02-catalogo/seguridad/catalogo/secure-delete/` |

Siguen en el orden (fuera de alcance): Packer (6) y Keylogger (7) con 2; Firmware (1), Drones (9) y Bases de datos (10) con 3.

## 2. Matriz de comparación

| Herramienta | Nivel inicial | Nivel final | Fuentes primarias | Guía | Casos/skill | Bloqueos |
|---|---|---|---|---|---|---|
| OWASP Threat Dragon | NONE | **L3** | Repositorio OWASP, release v2.6.2 (API), docs 2.6.2 | GUI, 13 secciones | 2 casos; sin skill | Páginas de Bitbucket/GitLab/Google y variable de analítica no leídas |
| Sagan | NONE | **L3** | quadrantsec/sagan, releases, sagan-rules, readthedocs, `src/usage.c` | CLI, 14 secciones | 2 casos; sin skill | Página de opciones vacía; saganpeek 404; formato «Sagan format» no documentado |
| nfcutils | NONE | **L3** | nfc-tools/nfcutils (código, configure.ac, debian/), libnfc README | CLI, 14 secciones | 2 casos; sin skill | README vacío; sin releases; AUR bloqueado; sin hardware |
| secure-delete | NONE | **L3** | Paquete, copyright y manuales Debian 3.1-12 | CLI, 14 secciones | 2 casos (VM desechable); sin skill | Descarga THC 404; repositorio del autor 404; Arch Wiki y GNU shred inaccesibles |

Los niveles los asigna el validador ATDS v1 de `main` sin cambios. Ninguna ficha alcanza L4 porque no existe evidencia experimental y este lote no ejecuta herramientas (motivo común por el que no se alcanza el siguiente nivel). No se crearon skills: ninguna de las cuatro tiene un uso por agentes que pueda fundamentarse con las fuentes revisadas; L3 se apoya en casos sustantivos, que el contrato admite como alternativa.

## 3. Por herramienta

### 3.1 OWASP Threat Dragon (Modelado de amenazas)

- **Campos completados:** `tipo` (escritorio Electron + web autoalojable → guía GUI), `categoria`, `problema_que_resuelve`, `funciones_principales`, `sistema_operativo` (instaladores 2.6.2 por plataforma), `licencia` Apache-2.0, `dependencias`, `requisitos`, `estado_mantenimiento` (release 2026-05-10; último commit 2026-11-19), `fecha_verificacion` 2026-11-26, `fuentes_oficiales`, `registro_fuentes` (8 registros).
- **Corregido / explicado:** la licencia previa («Open source; comprobar LICENSE…») se conserva en `licencia_historica`; la versión histórica 2.2.0 se mantiene y se marca superada; «DIE» del registro previo se documenta como «CIA-DIE»; el README upstream aún usa ejemplos Docker v2.2.0 (contradicción registrada).
- **Guía:** instalación escritorio con verificación SHA-512 propuesta, Docker `owasp/threat-dragon:stable`, ejecución desde fuente, variables de entorno documentadas, flujo de creación de modelo y amenazas, esquemas JSON v1/v2, exportación SVG/PNG, informe Print/PDF, privacidad y analítica.
- **Sin verificar:** páginas de proveedores Bitbucket/GitLab/Google; variable de activación de analítica; formato interno de `ENCRYPTION_KEYS` (se remite a `minimal.env`).
- **DOC pendientes:** DOC-10 (sin evidencias L4), DOC-09 informativo (sin skill), DOC-12 (enlaces no comprobados por el validador).

### 3.2 Sagan (Detección de intrusiones)

- **Campos completados:** descripción específica, `tipo` CLI, `categoria`, problema, funciones, plataformas (según documentación, sin lista oficial), GPL-2.0, dependencias obligatorias/opcionales, requisitos, `estado_fuente`, mantenimiento bajo, release 2.0.2 (2021-12-29), `registro_fuentes` (7).
- **Identidad:** `quadrantsec/sagan` es el repositorio vigente; `beave/sagan` solo contiene el aviso «This repo has MOVED»; las notas de 2.0.0 confirman el traslado. La versión histórica 2.0.2 coincide con la última release.
- **Inconsistencias registradas:** etiqueta literal `v,2,0.2`; fechas de etiqueta (2021-12-09) y release (2021-12-29); rutas FIFO distintas para rsyslog y syslog-ng; documentación con versiones 1.2.1/2.0.1, enlaces incompletos, `--disable-snortsam` pese a retirarse Snortsam/Unified2 en 2.0.0; clonado de reglas desde `beave/sagan-rules`.
- **Guía:** compilación, preparación de usuario/FIFO, rsyslog `ompipe`, `sagan.yaml`, opciones extraídas de `src/usage.c` en `main` (marcadas como posibles diferencias con 2.0.2), regla de ejemplo literal sid 5000116.
- **DOC pendientes:** DOC-10, DOC-09 informativo, DOC-12.

### 3.3 nfcutils (NFC)

- **Campos completados:** descripción de `lsnfc`, `tipo` CLI, GPL-3.0-or-later (COPYING y cabecera), versión declarada 0.3.2 (`configure.ac`), estado INACTIVO (último commit 2015-04-07, sin releases), dependencias (libnfc ≥ 1.7.0), requisitos de acceso al lector, `registro_fuentes` (7). La versión histórica `61.49aa178` se explica como 61 commits con cabeza `49aa178`, coherente con el repositorio.
- **Plataformas:** sin declaración upstream; se documentan como inferencia de dependencias.
- **Guía:** compilación **propuesta** e inferida de autotools (el README tiene 0 bytes); udev, lista negra de módulos y `libnfc.conf` según libnfc; comportamiento y salida de `lsnfc` derivados de `src/lsnfc.c`.
- **Sin verificar:** compatibilidad con libnfc 1.8.0, con lectores del equipo local y disponibilidad en AUR (acceso bloqueado). No se ejecutaron pruebas de hardware.
- **DOC pendientes:** DOC-10, DOC-09 informativo, DOC-02 señal heurística (pocos flags CLI; la herramienta no tiene opciones), DOC-12.

### 3.4 secure-delete (Anti-forense)

- **Campos completados:** descripción de srm/sfill/sswap/sdmem, `tipo` CLI, GPL-2 upstream y GPL-2+ del empaquetado (debian/copyright), versión upstream 3.1 y Debian 3.1-12 (trixie y sid), arquitecturas, dependencias, requisitos, estado UPSTREAM_INACTIVO, `registro_fuentes` (8).
- **Corregido / explicado:** la versión histórica `1.b63d814` procede de un espejo no identificado y no coincide con la numeración 3.1; un resultado de búsqueda secundario indicaba 3.1-10 en trixie y se descartó frente a la página del paquete (3.1-12).
- **Guía:** opciones y modos por defecto de los manuales Debian, advertencias literales (NFS, RAID, copias temporales, swap, beta), primer uso **solo** en VM con imagen loop, y limitaciones respaldadas: SSD/flash y wear levelling (NIST SP 800-88 Rev. 1, retirada en 2025 y sustituida por Rev. 2 no revisada), Btrfs copy-on-write y snapshots (documentación de Btrfs), bloques remapeados, cifrado y borrado criptográfico, copias de seguridad. No se promete irrecuperabilidad.
- **Bloqueos:** `https://www.thc.org/releases/secure_delete-3.1.tar.gz` devuelve 404; `github.com/van-hauser-thc/secure-delete` devuelve 404; Arch Wiki (acceso denegado) y manual de GNU shred (limitación de peticiones) no se citan.
- **DOC pendientes:** DOC-10, DOC-09 informativo, DOC-02 señal heurística, DOC-12.

## 4. Archivos creados o modificados

Por herramienta: `GUIA.md` y `casos-uso.json` creados; `metadata.json` y `SHA256SUMS.txt` modificados; `README.md` e `index.html` sin cambios. Además: `scripts/atds-lote-e3-01-policy.json` (nuevo), `scripts/atds-gate.mjs` (3 controles nuevos), `tests/unit/etapa-03-lote-01.test.ts` (nuevo), `docs/atds/METODOLOGIA-ENRIQUECIMIENTO-INCREMENTAL.md` (nuevo), y este informe y su manifiesto.

## 5. Hashes SHA-256 de las fichas (estado final)

| Ficha | GUIA.md | casos-uso.json | metadata.json |
|---|---|---|---|
| threat-dragon | `e616166d…` | `863f3273…` | `b0c25531…` |
| sagan | `96707bd9…` | `92f00950…` | `70f42e66…` |
| nfcutils | `fd426915…` | `ddca4c49…` | `95d484cb…` |
| secure-delete | `3f79eaa5…` | `1b42065f…` | `10278aec…` |

Los hashes completos de todos los archivos están en `ETAPA-03-LOTE-01-MANIFIESTO.json` y en el `SHA256SUMS.txt` de cada ficha (verificados con `sha256sum -c`). `catalogo.json` conserva `bf279af87d037e4e904712c3047aac2bfd42e511d530940d335f54cae3410483`.

## 6. Controles y validaciones

Control focalizado del lote: política `scripts/atds-lote-e3-01-policy.json` (las cuatro a L3) y 43 tests en `tests/unit/etapa-03-lote-01.test.ts` (alcance y orden, catálogo intacto, nivel ≥ política, identidad sin IDs inventados, valores L1/L2 verificados, sin URLs ficticias como fuente, fuentes ↔ referencias, sin evidencias fabricadas, SHA256SUMS completo y coincidente). El gate añade política del lote → 0, copia intacta de threat-dragon → 0 y copia sin `GUIA.md` → 1. La política de las 12 prioritarias de la etapa 2 no cambia. El validador no se modificó.

Checkout limpio (`git worktree` en `b2476c83`, Node 26.13.1):

| Comando | Exit | Resultado |
|---|---|---|
| `npm ci` | 0 | avisos de paquetes deprecados y script de esbuild bloqueado por política local |
| `npm run generate:data` | 0 | — |
| `npm run typecheck` | 0 | app, service worker y tests |
| `npm run lint` | 0 | sin errores ni advertencias |
| `npm run test:unit` | 0 | 7 archivos, 356 tests |
| `npm run validate:atds` | 0 | 2.137 fichas |
| `npm run gate:atds` | 0 | 22/22 controles |
| `npm run check` | 0 | incluye build |
| `npm run verify:catalog` | 0 | 49 categorías, 2.137 herramientas, 741 excluidas |

## 7. Distribución ATDS y cambios de clasificación

| | NONE | L1 | L2 | L3 | L4 |
|---|---|---|---|---|---|
| Validado antes (baseline) | 2.128 | 9 | 0 | 0 | 0 |
| Validado después | 2.124 | 9 | 0 | 4 | 0 |

Únicos cambios: las cuatro fichas del lote, NONE → L3. Ninguna otra ficha cambia de nivel.

## 8. Integridad del catálogo

49 categorías, 2.137 herramientas, 741 exclusiones; `catalogo.json` sin cambios; ninguna herramienta nueva ni cambio de categoría; evidencias históricas y fichas fuera del lote intactas (`git diff` contra `main` limitado a las rutas autorizadas). No se descargó ni ejecutó software catalogado. `07-laboratorio/` no se tocó.

## 9. Limitaciones

- Las guías son documentales; ningún comando se ejecutó y no hay pruebas de hardware.
- Las páginas `index.html` y `README.md` de las fichas no se rediseñaron; la PWA enlaza automáticamente la guía y los casos y toma la descripción de `metadata.json`.
- El validador verifica estructura y procedencia, no la corrección técnica de cada paso; los procedimientos [Propuesto] requieren revisión humana.
- Fuentes bloqueadas o inexistentes enumeradas en §3; no se citan como respaldo.
- NIST SP 800-88 Rev. 1 está retirada; no se revisó la Rev. 2 vigente.

## 10. Fuera de alcance

Packer (Sherlocked, vbsmin), Keylogger (logkeys, Python Keylogger), Firmware, Drones, Bases de datos y el resto de categorías. No se abrió rama ni trabajo de E3-02.
