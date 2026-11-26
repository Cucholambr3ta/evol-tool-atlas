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

function checkContentSubstantive(content, sectionKey, patterns) {
  const sectionContent = extractSectionContent(content, sectionKey, patterns);
  if (!sectionContent || sectionContent.trim().length < 50) return false;
  
  const vagueCount = VAGUE_PATTERNS.filter(p => p.test(sectionContent)).length;
  if (vagueCount >= 2) return false;
  
  if (PLACEHOLDER_RE.test(sectionContent)) return false;
  
  // References section often just lists URLs - special handling
  if (sectionKey.toLowerCase() === 'referencias' || sectionKey.toLowerCase() === 'referencias oficiales') {
    // Just check it has at least one URL
    const urls = (sectionContent.match(/https?:\/\/[^\s)]+/g) || []).length;
    return urls >= 1;
  }
  
  const words = sectionContent.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const uniqueWords = new Set(words);
  // Lower threshold for technical content - 5 unique meaningful words (technical terms count)
  if (uniqueWords.size < 5) return false;
  
  return true;
}

function extractSectionContent(content, sectionKey, patterns) {
  const lines = content.split('\n');
  let inSection = false;
  let result = [];
  
  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      const header = headerMatch[1].trim();
      const isMainHeader = line.startsWith('# ') || line.startsWith('## ');
      const isSubHeader = line.startsWith('### ');
      
      if (inSection) {
        if (isMainHeader) {
          // Main headers (## or #) end the section
          break;
        }
        // Sub-headers (###) should be included in the section content
        if (isSubHeader) {
          result.push(line);
          continue;
        }
      }
      // Check against patterns - only start on main headers
      if (isMainHeader && patterns.some(p => header.toLowerCase().includes(p.toLowerCase()))) {
        inSection = true;
        continue;
      }
    }
    if (inSection) {
      result.push(line);
    }
  }
  
  return result.join('\n').trim();
}

function checkGuideContent(guidePath, toolType = 'other') {
  if (!fs.existsSync(guidePath)) {
    return { valid: false, issues: ['MISSING_GUIDA'], warnings: [], sections: [], stats: {} };
  }
  const content = fs.readFileSync(guidePath, 'utf8');
  const issues = [];
  const warnings = [];
  const sections = [];
  
  const { required, markers } = getGuideSections(toolType);
  
  let foundSections = 0;
  let substantiveSections = 0;
  
  for (const sec of required) {
    const found = sec.patterns.some(p => content.includes(p));
    if (found) {
      foundSections++;
      sections.push(sec.key);
      if (checkContentSubstantive(content, sec.key, sec.patterns)) {
        substantiveSections++;
      } else {
        issues.push(`GUIDE_SECTION_GENERIC_${sec.key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`);
      }
    } else {
      issues.push(`GUIDE_MISSING_SECTION_${sec.key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`);
    }
  }
  
  const vagueCount = VAGUE_PATTERNS.filter(p => p.test(content)).length;
  if (vagueCount >= 3) {
    issues.push('GUIDE_GENERIC_CONTENT');
  } else if (vagueCount > 0) {
    warnings.push(`GUIDE_VAGUE_PATTERNS_${vagueCount}`);
  }
  
  if (PLACEHOLDER_RE.test(content)) {
    issues.push('GUIDE_CONTAINS_PLACEHOLDERS');
  }
  
  const backticks = (content.match(/`/g) || []).length;
  const codeFences = (content.match(/```/g) || []).length;
  const cliFlags = (content.match(/--[a-zA-Z][\w-]*/g) || []).length;
  const urls = (content.match(/https?:\/\/[^\s)]+/g) || []).length;
  const guiMarkers = (content.match(/(bot[óo]n|ventana|panel|men[uú]|clic|interfaz|UI|interacci[oó]n)/gi) || []).length;
  const apiMarkers = (content.match(/(endpoint|request|response|payload|json|http|status|header|token|auth)/gi) || []).length;
  const serviceMarkers = (content.match(/(despliegue|provisioning|regi[oó]n|zona|monitoreo|m[eé]trica|sla|costo)/gi) || []).length;
  
  let markerPass = true;
  if (markers.backticks && backticks < markers.backticks) markerPass = false;
  if (markers.codeFences && codeFences < markers.codeFences) markerPass = false;
  if (markers.cliFlags && cliFlags < markers.cliFlags) markerPass = false;
  if (markers.urls && urls < markers.urls) markerPass = false;
  if (markers.guiMarkers && guiMarkers < markers.guiMarkers) markerPass = false;
  if (markers.apiMarkers && apiMarkers < markers.apiMarkers) markerPass = false;
  if (markers.serviceMarkers && serviceMarkers < markers.serviceMarkers) markerPass = false;
  
  if (foundSections >= 10 && substantiveSections >= 8 && markerPass) {
    // Good
  } else if (foundSections >= 10) {
    if (substantiveSections < 8) {
      issues.push('GUIDE_INSUFFICIENT_SUBSTANTIVE_SECTIONS');
    } else if (!markerPass) {
      warnings.push('GUIDE_LOW_TECHNICAL_DEPTH');
    }
  }
  
  return { 
    valid: issues.length === 0, 
    issues, 
    warnings, 
    sections, 
    stats: { 
      backticks, codeFences, cliFlags, urls, guiMarkers, apiMarkers, serviceMarkers,
      vagueCount, foundSections, substantiveSections 
    } 
  };
}

export { checkGuideContent, getGuideSections, SECTION_DEFINITIONS };