import fs from 'node:fs';
import { VAGUE_PATTERNS } from './normalize.mjs';

const PLACEHOLDER_RE = /(^|\s)(TODO|FIXME)(\s|$|[.,;:])|\[PENDIENTE\]|\[TODO\]|\bPLACEHOLDER\b/i;

const SECTION_DEFINITIONS = {
  cli: {
    required: [
      { key: 'Requisitos', patterns: ['Requisitos', 'requisitos', 'Prerrequisitos', 'pre-requisitos'] },
      { key: 'Dependencias', patterns: ['Dependencias', 'dependencias', 'Dependencias del sistema'] },
      { key: 'Instalación', patterns: ['Instalación', 'instalación', 'Instalación manual', 'Instalación y configuración'] },
      { key: 'Plataformas', patterns: ['Plataformas', 'plataformas', 'Compatibilidad', 'Sistemas operativos'] },
      { key: 'Verificación', patterns: ['Verificación', 'verificación', 'Comprobar instalación', 'Validar instalación'] },
      { key: 'Configuración', patterns: ['Configuración', 'configuración', 'Configuración inicial'] },
      { key: 'Primer uso', patterns: ['Primer uso', 'primer uso', 'Uso básico', 'Ejemplo básico', 'Quick start', 'Iniciación'] },
      { key: 'Comandos', patterns: ['Comandos', 'comandos', 'Parámetros', 'Opciones', 'Flags', 'Argumentos'] },
      { key: 'Entradas', patterns: ['Entradas', 'entradas', 'Input', 'Entrada esperada'] },
      { key: 'Salidas', patterns: ['Salidas', 'salidas', 'Output', 'Resultado esperado', 'Salida esperada'] },
      { key: 'Errores', patterns: ['Errores', 'errores', 'Errores frecuentes', 'Solución de problemas', 'Troubleshooting'] },
      { key: 'Advertencias', patterns: ['Advertencias', 'advertencias', 'Guardrails', 'Seguridad', 'Precauciones'] },
      { key: 'Referencias', patterns: ['Referencias', 'referencias', 'Referencias oficiales', 'Enlaces'] },
      { key: 'Limitaciones', patterns: ['Limitaciones', 'limitaciones', 'Alcance y limitaciones', 'Limitaciones conocidas'] },
    ],
    // For CLI, these markers indicate technical depth
    markers: { backticks: 10, codeFences: 4, cliFlags: 3, urls: 2 },
  },
  gui: {
    required: [
      { key: 'Requisitos', patterns: ['Requisitos', 'requisitos', 'Prerrequisitos', 'pre-requisitos', 'Requisitos del sistema'] },
      { key: 'Acceso o Instalación', patterns: ['Instalación', 'instalación', 'Acceso', 'acceso', 'Descarga', 'Ejecución'] },
      { key: 'Plataformas', patterns: ['Plataformas', 'plataformas', 'Compatibilidad', 'Sistemas operativos'] },
      { key: 'Verificación', patterns: ['Verificación', 'verificación', 'Comprobar', 'Validar'] },
      { key: 'Configuración', patterns: ['Configuración', 'configuración', 'Configuración inicial', 'Preferencias'] },
      { key: 'Primer uso', patterns: ['Primer uso', 'primer uso', 'Uso básico', 'Ejemplo básico', 'Quick start', 'Iniciación', 'Tutorial'] },
      { key: 'Interfaz y Flujo', patterns: ['Interfaz', 'interfaz', 'Flujo', 'flujo', 'Navegación', 'Ventanas', 'Paneles'] },
      { key: 'Entradas', patterns: ['Entradas', 'entradas', 'Input', 'Entrada esperada', 'Datos de entrada'] },
      { key: 'Salidas', patterns: ['Salidas', 'salidas', 'Output', 'Resultado esperado', 'Salida esperada', 'Exportar', 'Reportes'] },
      { key: 'Errores', patterns: ['Errores', 'errores', 'Errores frecuentes', 'Solución de problemas', 'Troubleshooting'] },
      { key: 'Advertencias', patterns: ['Advertencias', 'advertencias', 'Guardrails', 'Seguridad', 'Precauciones'] },
      { key: 'Referencias', patterns: ['Referencias', 'referencias', 'Referencias oficiales', 'Enlaces', 'Documentación'] },
      { key: 'Limitaciones', patterns: ['Limitaciones', 'limitaciones', 'Alcance y limitaciones', 'Limitaciones conocidas'] },
    ],
    // For GUI, no CLI flags required, but need visual/interaction markers
    markers: { backticks: 5, codeFences: 2, urls: 2, guiMarkers: 3 },
  },
  'api/sdk': {
    required: [
      { key: 'Requisitos de integración', patterns: ['Requisitos', 'requisitos', 'Prerrequisitos', 'Dependencias', 'Requisitos de integración'] },
      { key: 'Autenticación y Acceso', patterns: ['Autenticación', 'autenticación', 'Acceso', 'acceso', 'Credenciales', 'API Key', 'Token'] },
      { key: 'Instalación o Disponibilidad', patterns: ['Instalación', 'instalación', 'Disponibilidad', 'Paquete', 'Importar', 'Dependency'] },
      { key: 'Configuración', patterns: ['Configuración', 'configuración', 'Configuración inicial', 'Client', 'Setup'] },
      { key: 'Primer uso', patterns: ['Primer uso', 'primer uso', 'Uso básico', 'Ejemplo básico', 'Quick start', 'Iniciación', 'Hello World'] },
      { key: 'Ejemplos de llamada', patterns: ['Ejemplos', 'ejemplos', 'Llamadas', 'llamadas', 'Requests', 'Métodos', 'Endpoints', 'Funciones'] },
      { key: 'Entradas', patterns: ['Entradas', 'entradas', 'Input', 'Parámetros', 'Payload', 'Request Body', 'Tipos'] },
      { key: 'Respuestas', patterns: ['Respuestas', 'respuestas', 'Salidas', 'Output', 'Response', 'Códigos de estado', 'Esquema'] },
      { key: 'Errores', patterns: ['Errores', 'errores', 'Errores frecuentes', 'Manejo de errores', 'Error codes', 'Troubleshooting'] },
      { key: 'Límites', patterns: ['Límites', 'límites', 'Rate limit', 'Cuotas', 'Limitaciones', 'Throttling'] },
      { key: 'Advertencias', patterns: ['Advertencias', 'advertencias', 'Guardrails', 'Seguridad', 'Precauciones', 'Buenas prácticas'] },
      { key: 'Referencias', patterns: ['Referencias', 'referencias', 'Referencias oficiales', 'Enlaces', 'Documentación oficial', 'OpenAPI', 'Swagger'] },
      { key: 'Limitaciones', patterns: ['Limitaciones', 'limitaciones', 'Alcance y limitaciones', 'Limitaciones conocidas', 'Known issues'] },
    ],
    markers: { backticks: 10, codeFences: 4, urls: 2, apiMarkers: 3 },
  },
  'service/infra': {
    required: [
      { key: 'Requisitos', patterns: ['Requisitos', 'requisitos', 'Prerrequisitos', 'Dependencias'] },
      { key: 'Acceso y Condiciones', patterns: ['Acceso', 'acceso', 'Condiciones', 'Suscripción', 'Cuenta', 'Autenticación'] },
      { key: 'Plataformas y Compatibilidad', patterns: ['Plataformas', 'plataformas', 'Compatibilidad', 'Regiones', 'Zonas'] },
      { key: 'Configuración', patterns: ['Configuración', 'configuración', 'Setup', 'Provisioning', 'Despliegue'] },
      { key: 'Primer uso', patterns: ['Primer uso', 'primer uso', 'Uso básico', 'Quick start', 'Onboarding'] },
      { key: 'Operación', patterns: ['Operación', 'operación', 'Uso', 'Gestión', 'Administración', 'Monitoreo'] },
      { key: 'Entradas', patterns: ['Entradas', 'entradas', 'Input', 'Parámetros', 'Configuración de entrada'] },
      { key: 'Salidas', patterns: ['Salidas', 'salidas', 'Output', 'Resultados', 'Métricas', 'Logs'] },
      { key: 'Errores', patterns: ['Errores', 'errores', 'Errores frecuentes', 'Solución de problemas', 'Troubleshooting', 'Incidentes'] },
      { key: 'Advertencias', patterns: ['Advertencias', 'advertencias', 'Guardrails', 'Seguridad', 'Precauciones', 'Costes', 'Límites'] },
      { key: 'Referencias', patterns: ['Referencias', 'referencias', 'Documentación', 'Enlaces', 'API', 'CLI'] },
      { key: 'Limitaciones', patterns: ['Limitaciones', 'limitaciones', 'Alcance y limitaciones', 'Limitaciones conocidas', 'SLA'] },
    ],
    markers: { backticks: 5, codeFences: 2, urls: 2, serviceMarkers: 3 },
  },
  other: {
    required: [
      { key: 'Requisitos', patterns: ['Requisitos', 'requisitos', 'Prerrequisitos'] },
      { key: 'Dependencias', patterns: ['Dependencias', 'dependencias'] },
      { key: 'Instalación', patterns: ['Instalación', 'instalación', 'Acceso'] },
      { key: 'Plataformas', patterns: ['Plataformas', 'plataformas', 'Compatibilidad'] },
      { key: 'Verificación', patterns: ['Verificación', 'verificación'] },
      { key: 'Configuración', patterns: ['Configuración', 'configuración'] },
      { key: 'Primer uso', patterns: ['Primer uso', 'primer uso', 'Uso básico', 'Ejemplo'] },
      { key: 'Comandos o Uso', patterns: ['Comandos', 'comandos', 'Uso', 'Parámetros', 'Opciones'] },
      { key: 'Entradas', patterns: ['Entradas', 'entradas', 'Input'] },
      { key: 'Salidas', patterns: ['Salidas', 'salidas', 'Output', 'Resultado'] },
      { key: 'Errores', patterns: ['Errores', 'errores', 'Solución de problemas'] },
      { key: 'Advertencias', patterns: ['Advertencias', 'advertencias', 'Guardrails', 'Seguridad'] },
      { key: 'Referencias', patterns: ['Referencias', 'referencias', 'Enlaces'] },
      { key: 'Limitaciones', patterns: ['Limitaciones', 'limitaciones', 'Alcance'] },
    ],
    markers: { backticks: 5, codeFences: 2, urls: 2 },
  },
};

function getGuideSections(toolType) {
  const def = SECTION_DEFINITIONS[toolType] || SECTION_DEFINITIONS.other;
  return { required: def.required, markers: def.markers };
}

/**
 * Sections whose content must carry the procedure for each tool type, and the
 * kind of procedural evidence required. These are substantive requirements;
 * counts of backticks, flags or URLs are only heuristic signals.
 */
const PROCEDURE_REQUIREMENTS = {
  cli: { sections: ['Instalación', 'Verificación', 'Primer uso', 'Comandos', 'Configuración'], need: 'commands' },
  other: { sections: ['Instalación', 'Verificación', 'Primer uso', 'Comandos o Uso', 'Configuración'], need: 'commandsOrSteps' },
  gui: { sections: ['Acceso o Instalación', 'Primer uso', 'Interfaz y Flujo', 'Configuración', 'Verificación'], need: 'steps' },
  'api/sdk': { sections: ['Primer uso', 'Ejemplos de llamada', 'Configuración'], responseSections: ['Respuestas'], need: 'requestResponse' },
  'service/infra': { sections: ['Configuración', 'Primer uso', 'Operación'], need: 'commandsOrSteps' },
};

const MIN_SECTION_CHARS = 30;
const MIN_UNIQUE_WORDS = 4;

function normalizeForComparison(text) {
  return text.toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function checkContentSubstantive(sectionContent, sectionKey) {
  if (!sectionContent) return false;
  const text = sectionContent.trim();
  if (PLACEHOLDER_RE.test(text)) return false;
  if (VAGUE_PATTERNS.filter((p) => p.test(text)).length >= 2) return false;

  const key = sectionKey.toLowerCase();
  if (key === 'referencias' || key === 'referencias oficiales') {
    return (text.match(/https?:\/\/[^\s)]+/g) || []).length >= 1;
  }
  const hasCode = /```[\s\S]*?\S[\s\S]*?```|`[^`\n]+`/.test(text);
  if (text.length < MIN_SECTION_CHARS && !hasCode) return false;
  const uniqueWords = new Set(text.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  return uniqueWords.size >= MIN_UNIQUE_WORDS || hasCode;
}

/** Ordered steps such as "1. Abrir el menú Archivo > Nuevo proyecto". */
function countOrderedSteps(text) {
  return (text.match(/^\s*\d+[.)]\s+\S.{9,}$/gm) || []).length;
}

/**
 * Executable command lines: non-empty lines inside fenced code blocks plus
 * inline code spans that look like an invocation (`tool arg`, `tool --flag`).
 */
function countCommands(text) {
  let count = 0;
  for (const block of text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
    count += block[1].split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).length;
  }
  const withoutFences = text.replace(/```[\s\S]*?```/g, '');
  for (const span of withoutFences.matchAll(/`([^`\n]+)`/g)) {
    if (/^[\w./-]+\s+\S/.test(span[1].trim())) count++;
  }
  return count;
}

function hasRequestExample(text) {
  return /\b(GET|POST|PUT|PATCH|DELETE|HEAD)\s+\/\S*/.test(text) ||
    /\bcurl\s+\S/.test(text) ||
    /```[\s\S]*?\w+\s*\.\s*\w+\s*\([\s\S]*?```/.test(text) ||
    /```[\s\S]*?\w+\s*\([^)]*\)[\s\S]*?```/.test(text);
}

function hasResponseExample(text) {
  return /```[\s\S]*?[{[][\s\S]*?```/.test(text) ||
    /\b(HTTP\/\d(?:\.\d)?\s+)?[1-5]\d\d\b\s*(OK|Created|Accepted|No Content|Bad Request|Unauthorized|Forbidden|Not Found|Too Many Requests|Internal Server Error|:|-|—)/i.test(text);
}

/**
 * Evaluate whether the guide contains a technically usable procedure for its
 * tool type. Returns the blocking issues (empty when sufficient).
 */
function checkProcedure(sectionTexts, toolType) {
  const req = PROCEDURE_REQUIREMENTS[toolType] || PROCEDURE_REQUIREMENTS.other;
  const procText = req.sections.map((k) => sectionTexts[k] || '').join('\n');
  const steps = countOrderedSteps(procText);
  const commands = countCommands(procText);
  const issues = [];
  switch (req.need) {
    case 'commands':
      if (commands < 2) issues.push('GUIDE_NO_EXECUTABLE_PROCEDURE');
      break;
    case 'steps':
      if (steps < 3) issues.push('GUIDE_NO_ORDERED_PROCEDURE');
      break;
    case 'commandsOrSteps':
      if (commands < 2 && steps < 3) issues.push('GUIDE_NO_PROCEDURE');
      break;
    case 'requestResponse': {
      const respText = (req.responseSections || []).map((k) => sectionTexts[k] || '').join('\n');
      if (!hasRequestExample(procText)) issues.push('GUIDE_NO_REQUEST_EXAMPLE');
      if (!hasResponseExample(respText)) issues.push('GUIDE_NO_RESPONSE_EXAMPLE');
      break;
    }
    default:
      break;
  }
  return { issues, steps, commands };
}

/**
 * Detect boilerplate: the same text repeated across several sections.
 */
function countRepeatedSections(sectionTexts) {
  const seen = new Map();
  for (const text of Object.values(sectionTexts)) {
    const norm = normalizeForComparison(text);
    if (norm.length < 20) continue;
    seen.set(norm, (seen.get(norm) || 0) + 1);
  }
  let repeated = 0;
  for (const n of seen.values()) if (n > 1) repeated += n;
  return repeated;
}

function extractSectionContent(content, sectionKey, patterns) {
  const lines = content.split('\n');
  let inSection = false;
  let inFence = false;
  const result = [];

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const headerMatch = !inFence && line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const header = headerMatch[2].trim();
      const isMainHeader = headerMatch[1].length <= 2;
      if (inSection) {
        if (isMainHeader) break;
        result.push(line);
        continue;
      }
      if (isMainHeader && patterns.some((p) => header.toLowerCase().includes(p.toLowerCase()))) {
        inSection = true;
        continue;
      }
    }
    if (inSection) result.push(line);
  }
  return result.join('\n').trim();
}

function hasSectionHeader(content, patterns) {
  return content.split('\n').some((line) => {
    const m = line.match(/^#{1,2}\s+(.+)$/);
    return Boolean(m) && patterns.some((p) => m[1].toLowerCase().includes(p.toLowerCase()));
  });
}

function sectionCode(key) {
  return key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function checkGuideContent(guidePath, toolType = 'other') {
  if (!fs.existsSync(guidePath)) {
    return { valid: false, issues: ['MISSING_GUIDA'], warnings: [], sections: [], stats: {} };
  }
  const content = fs.readFileSync(guidePath, 'utf8');
  const issues = [];
  const warnings = [];
  const sections = [];
  const sectionTexts = {};
  const { required, markers } = getGuideSections(toolType);

  let foundSections = 0;
  let substantiveSections = 0;
  for (const sec of required) {
    if (!hasSectionHeader(content, sec.patterns)) {
      issues.push(`GUIDE_MISSING_SECTION_${sectionCode(sec.key)}`);
      continue;
    }
    foundSections++;
    sections.push(sec.key);
    const text = extractSectionContent(content, sec.key, sec.patterns);
    sectionTexts[sec.key] = text;
    if (checkContentSubstantive(text, sec.key)) substantiveSections++;
    else issues.push(`GUIDE_SECTION_GENERIC_${sectionCode(sec.key)}`);
  }

  const vagueCount = VAGUE_PATTERNS.filter((p) => p.test(content)).length;
  if (vagueCount >= 3) issues.push('GUIDE_GENERIC_CONTENT');
  else if (vagueCount > 0) warnings.push(`GUIDE_VAGUE_PATTERNS_${vagueCount}`);

  if (PLACEHOLDER_RE.test(content)) issues.push('GUIDE_CONTAINS_PLACEHOLDERS');

  const repeatedSections = countRepeatedSections(sectionTexts);
  if (repeatedSections >= 3) issues.push('GUIDE_REPETITIVE_CONTENT');
  else if (repeatedSections > 0) warnings.push('GUIDE_REPEATED_SECTION_TEXT');

  // Substantive requirement: a usable procedure for the tool type.
  const procedure = checkProcedure(sectionTexts, toolType);
  issues.push(...procedure.issues);

  // Heuristic signals: informative only, never sufficient nor blocking.
  const backticks = (content.match(/`/g) || []).length;
  const codeFences = (content.match(/```/g) || []).length;
  const cliFlags = (content.match(/--[a-zA-Z][\w-]*/g) || []).length;
  const urls = (content.match(/https?:\/\/[^\s)]+/g) || []).length;
  const guiMarkers = (content.match(/(bot[óo]n|ventana|panel|men[uú]|clic|interfaz|UI|interacci[oó]n)/gi) || []).length;
  const apiMarkers = (content.match(/(endpoint|request|response|payload|json|http|status|header|token|auth)/gi) || []).length;
  const serviceMarkers = (content.match(/(despliegue|provisioning|regi[oó]n|zona|monitoreo|m[eé]trica|sla|costo)/gi) || []).length;
  const signals = { backticks, codeFences, cliFlags, urls, guiMarkers, apiMarkers, serviceMarkers };
  for (const [name, min] of Object.entries(markers)) {
    if (typeof signals[name] === 'number' && signals[name] < min) warnings.push(`GUIDE_LOW_SIGNAL_${sectionCode(name)}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    sections,
    stats: {
      ...signals,
      vagueCount,
      foundSections,
      substantiveSections,
      orderedSteps: procedure.steps,
      commands: procedure.commands,
      repeatedSections,
    },
  };
}

export { checkGuideContent, getGuideSections, SECTION_DEFINITIONS, PROCEDURE_REQUIREMENTS, countOrderedSteps, countCommands };
