/**
 * Synthetic ATDS fixtures for the STRICT gate and the unit tests.
 *
 * Everything is written under a caller-supplied root (a temporary directory
 * created with fs.mkdtemp outside the repository). Nothing here reads or
 * modifies the real catalogue. Tool names, URLs and evidence are synthetic and
 * describe no real software.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** Complete L1/L2 metadata for a synthetic tool. */
export function fixtureMetadata(id, overrides = {}) {
  return {
    id,
    id_catalogo: `AT-FX-${id.toUpperCase()}`,
    nombre: `Fixture ${id}`,
    tipo: 'CLI / analizador estático sintético',
    categoria: 'Fixtures ATDS',
    descripcion: 'Analizador sintético que recorre ficheros de texto y reporta coincidencias de reglas declaradas en YAML.',
    problema_que_resuelve: 'Permite comprobar el validador ATDS con una ficha controlada y reproducible.',
    funciones_principales: 'Lectura de reglas YAML, búsqueda de patrones y salida JSON con ruta y línea.',
    upstream: `https://fixtures.evol-tool-atlas.dev/${id}`,
    sistema_operativo: 'Linux, macOS',
    dependencias: 'Node.js 22 o superior.',
    requisitos: 'Directorio de trabajo con permisos de lectura.',
    licencia: 'MIT',
    estado_fuente: 'FUENTE_VERIFICADA',
    fecha_verificacion: '2026-11-20',
    limites: ['Fixture sintética: no representa ninguna herramienta real.'],
    ...overrides,
  };
}

export const CLI_GUIDE = `# Fixture CLI — guía técnica

## Requisitos
Node.js 22 o superior y un directorio con ficheros de texto UTF-8 legibles por el usuario actual.

## Dependencias
Sin dependencias nativas; el paquete solo usa la biblioteca estándar de Node.js.

## Instalación
\`\`\`bash
npm install --global fx-cli@1.0.0
\`\`\`

## Plataformas
Linux x86_64 y macOS 14 o superior; Windows no está soportado por la fixture.

## Verificación
\`\`\`bash
fx-cli --version
\`\`\`
Debe imprimir \`1.0.0\` y terminar con código 0.

## Configuración
Crear \`rules.yml\` con una regla:
\`\`\`yaml
rules:
  - id: no-console
    pattern: console.log
\`\`\`

## Primer uso
\`\`\`bash
fx-cli scan --config rules.yml --json src/
\`\`\`

## Comandos
- \`fx-cli scan --config <archivo>\`: analiza el directorio indicado con las reglas del archivo.
- \`fx-cli scan --json <dir>\`: emite resultados en JSON por la salida estándar.

## Entradas
Directorio de código fuente y archivo de reglas YAML con identificador y patrón por regla.

## Salidas
JSON con una entrada por coincidencia: regla, ruta relativa, línea y fragmento.

## Errores
Código 2 si el archivo de reglas no existe o es YAML inválido; el mensaje indica la línea del error.

## Advertencias
Revisar manualmente cada coincidencia; la fixture no distingue falsos positivos.

## Referencias
- https://fixtures.evol-tool-atlas.dev/fx-cli/docs

## Limitaciones
Solo patrones literales; no hay análisis sintáctico ni de flujo de datos.
`;

export const GUI_GUIDE = `# Fixture GUI — guía técnica

## Requisitos del sistema
Equipo con 4 GB de RAM, pantalla de 1280x800 y cuenta de usuario sin privilegios.

## Acceso o Instalación
Descargar el instalador firmado desde la página de publicaciones y abrirlo con doble clic.

## Plataformas
Linux con entorno gráfico Wayland o X11 y macOS 14 o superior.

## Verificación
Abrir Ayuda > Acerca de y comprobar que la ventana muestra la versión 2.1.0.

## Configuración
En Preferencias > Proyecto elegir la carpeta de trabajo y el idioma de los reportes.

## Primer uso
1. Abrir la aplicación desde el menú de aplicaciones del sistema.
2. Pulsar el botón Nuevo modelo y escribir un nombre para el diagrama.
3. Arrastrar un componente desde el panel lateral al lienzo principal.
4. Elegir Archivo > Exportar informe y guardar el PDF generado.

## Interfaz y Flujo
La ventana principal tiene una barra de menús, un panel lateral de componentes y un lienzo central; el panel inferior lista avisos.

## Entradas
Modelos guardados en formato JSON propio y plantillas importadas desde el menú Archivo.

## Salidas
Informe PDF con el diagrama y tabla de amenazas, y el modelo guardado en JSON.

## Errores
Si el modelo está dañado, la aplicación muestra un diálogo con la ruta del archivo y no lo abre.

## Advertencias
No abrir modelos de terceros sin revisar su contenido; pueden contener rutas locales.

## Referencias
- https://fixtures.evol-tool-atlas.dev/fx-gui/manual

## Limitaciones
Sin colaboración simultánea; un modelo solo puede editarse en un equipo a la vez.
`;

export const API_GUIDE = `# Fixture API — guía técnica

## Requisitos de integración
Cliente HTTPS con soporte TLS 1.2 o superior y capacidad de enviar cabeceras personalizadas.

## Autenticación y Acceso
Cada solicitud lleva la cabecera \`Authorization: Bearer <token>\` emitida desde el panel de la cuenta.

## Instalación o Disponibilidad
Servicio accesible por HTTPS en la URL base del proveedor; no requiere instalar software local.

## Configuración
Definir la URL base y el token como variables de entorno del cliente que realizará las llamadas.

## Primer uso
Solicitar la lista de proyectos para comprobar el acceso con el token configurado.

## Ejemplos de llamada
\`\`\`http
GET /v1/projects?limit=10
Authorization: Bearer <token>
\`\`\`

## Entradas
Parámetro de consulta \`limit\` (entero de 1 a 100) y cabecera de autorización obligatoria.

## Respuestas
\`\`\`json
{ "data": [{ "id": "p-1", "name": "demo" }], "next": null }
\`\`\`
200 OK con la lista; 401 Unauthorized si el token es inválido.

## Errores
Los errores devuelven JSON con \`code\` y \`message\`; 429 indica que se superó la cuota.

## Límites
Rate limit de 60 solicitudes por minuto y por token; la cabecera Retry-After indica la espera.

## Advertencias
No registrar el token en logs; rotarlo si se expone en un repositorio.

## Referencias
- https://fixtures.evol-tool-atlas.dev/fx-api/reference

## Limitaciones
Solo lectura de proyectos; la API sintética no admite escritura.
`;

/** Guide with every CLI section, generic boilerplate repeated in each one. */
export const REPETITIVE_GUIDE = ['Requisitos', 'Dependencias', 'Instalación', 'Plataformas', 'Verificación', 'Configuración', 'Primer uso', 'Comandos', 'Entradas', 'Salidas', 'Errores', 'Advertencias', 'Referencias', 'Limitaciones']
  .map((h) => `## ${h}\nEsta sección describe de forma general el uso correcto de la herramienta en distintos contextos de trabajo habituales.${h === 'Referencias' ? '\nhttps://fixtures.evol-tool-atlas.dev/x' : ''}\n`)
  .join('\n');

/** Long guide with every CLI section and distinct prose, but no executable procedure. */
export const PROSE_ONLY_GUIDE = `# Guía extensa sin procedimiento

## Requisitos
Se recomienda disponer de un equipo moderno con suficiente memoria y un sistema actualizado para trabajar con comodidad durante sesiones largas.

## Dependencias
La herramienta se apoya en componentes habituales del ecosistema que normalmente ya están presentes en la mayoría de entornos de desarrollo.

## Instalación
La instalación sigue el procedimiento habitual del gestor de paquetes que el equipo utilice normalmente en sus proyectos internos.

## Plataformas
Funciona en los sistemas operativos más comunes utilizados por equipos de desarrollo, tanto en portátiles como en servidores.

## Verificación
Tras instalarla conviene confirmar que responde correctamente antes de integrarla en cualquier flujo de trabajo del equipo.

## Configuración
La configuración se adapta a cada proyecto según sus necesidades particulares y las convenciones acordadas por el equipo.

## Primer uso
En el primer uso se recomienda explorar las opciones disponibles con calma para familiarizarse con su comportamiento general.

## Comandos
Ofrece numerosas opciones que cubren los escenarios más frecuentes de análisis y que pueden combinarse entre sí con flexibilidad.

## Entradas
Acepta los formatos de entrada que suelen manejarse en proyectos de software contemporáneos de tamaño pequeño o mediano.

## Salidas
Produce resultados comprensibles que el equipo puede revisar e incorporar a sus procesos de calidad y documentación.

## Errores
Cuando algo falla muestra mensajes que orientan sobre el origen del problema para facilitar su corrección posterior.

## Advertencias
Conviene revisar siempre los resultados con criterio profesional antes de tomar decisiones relevantes sobre el código.

## Referencias
- https://fixtures.evol-tool-atlas.dev/prose/docs

## Limitaciones
No cubre todos los casos posibles y su eficacia depende del contexto concreto de cada proyecto y de su configuración.
`;

/** Short guide: every section brief but technically sufficient. */
export const BRIEF_CLI_GUIDE = `## Requisitos
Node.js 22 y lectura sobre el directorio.
## Dependencias
Ninguna fuera de Node.js estándar.
## Instalación
\`npm install -g fx-brief@1.0.0\`
## Plataformas
Linux y macOS (x86_64, arm64).
## Verificación
\`fx-brief --version\` imprime 1.0.0.
## Configuración
\`fx-brief init\` crea fx.json vacío.
## Primer uso
\`fx-brief run fx.json\`
## Comandos
\`fx-brief run <cfg>\`: ejecuta reglas.
## Entradas
Archivo fx.json con lista de reglas.
## Salidas
Una línea \`ruta:línea:regla\` por coincidencia.
## Errores
Código de salida 2 si fx.json no existe.
## Advertencias
Revisar cada coincidencia manualmente antes de actuar.
## Referencias
https://fixtures.evol-tool-atlas.dev/fx-brief
## Limitaciones
Solo patrones literales en UTF-8.
`;

export const SKILL_MD = `---
name: fx-skill
description: Skill sintética para validar la ejecución de la fixture con evidencia trazable
---

## Cuándo usar
Cuando se necesite comprobar el análisis de la fixture en un entorno aislado con criterios definidos.

## Entradas mínimas
- Directorio autorizado y alcance escrito.
- Versión exacta de la herramienta y método de instalación.
- Criterio de aceptación y límites de recursos.

## Procedimiento
1. Confirmar autorización y alcance documentado antes de ejecutar.
2. Verificar la instalación con el comando de versión y registrar la versión exacta.
3. Ejecutar el análisis sobre datos sintéticos y guardar la salida completa.
4. Revisar los resultados manualmente y clasificarlos según el criterio acordado.

## Salidas esperadas
Registro de evidencia con versión, comando, entorno, fecha y hash del artefacto.

## Guardrails obligatorios
Los hallazgos requieren revisión humana; no convertir verificación de versión en prueba funcional.

## Evidencia y trazabilidad
Registrar cada ejecución real en formato evol-tool-atlas/evidencias/1 con hash SHA-256.

## Referencias
- https://fixtures.evol-tool-atlas.dev/fx-skill/manual
- https://fixtures.evol-tool-atlas.dev/fx-skill/evidencias
`;

export function fixtureCases(meta) {
  return {
    schema: 'evol-tool-atlas/casos-uso/1',
    herramienta: meta.nombre,
    id_catalogo: meta.id_catalogo,
    casos: [{
      id: 'CU-01',
      objetivo: 'Detectar llamadas de depuración olvidadas en un directorio sintético sin enviar datos externos.',
      prerequisitos: ['Directorio sintético autorizado', 'Archivo de reglas revisado'],
      pasos: [
        'Crear rules.yml con la regla no-console acordada.',
        'Ejecutar fx-cli scan --config rules.yml --json src/ y guardar la salida.',
        'Revisar cada coincidencia y registrar la clasificación manual.',
      ],
      resultado_esperado: 'Lista JSON reproducible con regla, ruta y línea de cada coincidencia.',
    }],
  };
}

/**
 * Write evidencias.json plus its artifacts. With `corruptSecondary`, the
 * second artifact's file content no longer matches its declared hash.
 */
export function writeFixtureEvidence(root, toolDir, meta, options = {}) {
  const evDir = path.join(root, toolDir, 'evidencias');
  fs.mkdirSync(evDir, { recursive: true });
  const output = JSON.stringify({ results: [{ rule: 'no-console', path: 'src/a.js', line: 3 }] });
  const log = 'fx-cli scan --config rules.yml --json src/\nexit=0\n';
  fs.writeFileSync(path.join(evDir, 'salida.json'), output);
  fs.writeFileSync(path.join(evDir, 'ejecucion.log'), options.corruptSecondary ? `${log}alterado\n` : log);
  const outRel = `${toolDir}/evidencias/salida.json`;
  const logRel = `${toolDir}/evidencias/ejecucion.log`;
  const record = {
    id: `EV-${meta.id_catalogo}-01`,
    herramienta: meta.nombre,
    id_catalogo: meta.id_catalogo,
    tipo: 'prueba_funcional_acotada',
    fecha: '2026-11-20',
    entorno: 'Contenedor sintético Node.js 22 sin red',
    version: '1.0.0',
    comando: 'fx-cli scan --config rules.yml --json src/',
    resultado: 'PASS',
    resumen: 'La ejecución terminó con código 0 y produjo un JSON válido con una coincidencia esperada.',
    criterio_aceptacion: 'Código de salida 0 y JSON con exactamente una coincidencia de no-console.',
    resultado_observado: 'Código 0; JSON válido con una coincidencia en src/a.js línea 3.',
    evidencia: { sha256: sha256(output), destRel: outRel },
    sha256: sha256(output),
    procedencia: { repositorio: 'fixture-sintetica', archivo_original: 'salida.json' },
    artefactos: [
      { nombre: 'Salida JSON', sha256: sha256(output), destRel: outRel },
      { nombre: 'Registro de ejecución', sha256: sha256(log), destRel: logRel },
    ],
    limitaciones: ['Fixture sintética; no demuestra comportamiento sobre código real.'],
  };
  const doc = { schema: 'evol-tool-atlas/evidencias/1', herramienta: meta.nombre, id_catalogo: meta.id_catalogo, registros: [record] };
  fs.writeFileSync(path.join(root, toolDir, 'evidencias.json'), JSON.stringify(doc, null, 2));
  return doc;
}

const FIXTURE_DIR = 'fixtures';

/**
 * Fixture catalogue. `expected` is the validated level the fixture is built
 * to reach; the gate and tests assert it against the real validator.
 */
export const FIXTURE_SPECS = [
  { id: 'fx-none', expected: 'NONE', meta: { tipo: '', sistema_operativo: '', limites: [] } },
  { id: 'fx-l1', expected: 'L1' },
  { id: 'fx-l1-l2-incompleto', expected: 'L1', guide: REPETITIVE_GUIDE },
  { id: 'fx-l2-cli', expected: 'L2', guide: CLI_GUIDE },
  { id: 'fx-l2-gui', expected: 'L2', guide: GUI_GUIDE, meta: { tipo: 'Aplicación de escritorio (GUI) sintética' } },
  { id: 'fx-l2-api', expected: 'L2', guide: API_GUIDE, meta: { tipo: 'API REST / SDK sintético' } },
  { id: 'fx-l3', expected: 'L3', guide: CLI_GUIDE, skill: true, cases: true },
  { id: 'fx-l4', expected: 'L4', guide: CLI_GUIDE, skill: true, cases: true, evidence: {} },
  { id: 'fx-l4-artefacto-corrupto', expected: 'L3', guide: CLI_GUIDE, skill: true, cases: true, evidence: { corruptSecondary: true } },
];

/**
 * Write one fixture tool into `root`. Returns its catalogue entry.
 */
export function writeFixtureTool(root, spec) {
  const toolDir = `${FIXTURE_DIR}/${spec.id}`;
  const abs = path.join(root, toolDir);
  fs.mkdirSync(abs, { recursive: true });
  const meta = fixtureMetadata(spec.id, spec.meta || {});
  fs.writeFileSync(path.join(abs, 'metadata.json'), JSON.stringify(meta, null, 2));
  if (spec.guide) fs.writeFileSync(path.join(abs, 'GUIA.md'), spec.guide);
  if (spec.skill) fs.writeFileSync(path.join(abs, 'SKILL.md'), SKILL_MD);
  if (spec.cases) fs.writeFileSync(path.join(abs, 'casos-uso.json'), JSON.stringify(fixtureCases(meta), null, 2));
  if (spec.evidence) writeFixtureEvidence(root, toolDir, meta, spec.evidence);
  return { id: spec.id, name: meta.nombre, cat: 1, href: `${toolDir}/index.html` };
}

/**
 * Build a complete fixture root (catalogo.json + tools) in `root`.
 *
 * @param {string} root temporary directory outside the repository
 * @param {Array<object>} [specs]
 */
export function buildFixtureRoot(root, specs = FIXTURE_SPECS) {
  const herramientas = specs.map((s) => writeFixtureTool(root, s));
  fs.writeFileSync(path.join(root, 'catalogo.json'), JSON.stringify({ categorias: [{ id: 1, nombre: 'Fixtures' }], herramientas }, null, 2));
  return herramientas;
}
