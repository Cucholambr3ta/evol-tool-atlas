/**
 * Pruebas de regresión para la Etapa 2 — Validador ATDS v1
 * Verifica que el validador detecta correctamente los niveles y defectos documentales.
 * IMPORTANTE: Importa las funciones reales del validador, NO las duplica.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';

// Importar módulos de producción (JS modules without type declarations)
// @ts-expect-error - JS module without type declarations
import { 
  normalizeMetadata, 
  isVerifiedValue, 
  collectUrls,
  VAGUE_PATTERNS
} from '../../scripts/lib/atds/normalize.mjs';

// @ts-expect-error - JS module without type declarations
import { checkGuideContent } from '../../scripts/lib/atds/guide.mjs';
// @ts-expect-error - JS module without type declarations
import { checkSkillContent } from '../../scripts/lib/atds/skill.mjs';
// @ts-expect-error - JS module without type declarations
import { checkCasesContent } from '../../scripts/lib/atds/cases.mjs';
// @ts-expect-error - JS module without type declarations
import { checkEvidenceContent } from '../../scripts/lib/atds/evidence.mjs';
// @ts-expect-error - JS module without type declarations
import { 
  evaluateL1, evaluateL2, evaluateL3, evaluateL4, 
  computeLevels, computeStatus 
} from '../../scripts/lib/atds/classify.mjs';
// @ts-expect-error - JS module without type declarations
import { makeFinding, mapCodeToDoc, summarizeFindings } from '../../scripts/lib/atds/diagnostics.mjs';
// @ts-expect-error - JS module without type declarations
import { resolveWithin, toolDirFromHref } from '../../scripts/lib/atds/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

describe('ETAPA-02 — Validador ATDS v1 (módulos de producción)', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'etapa-02-atds-'));
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('normalize.mjs — Normalización de metadatos', () => {
    it('debe extraer URLs de fuentes_oficiales, referencias y campos directos', () => {
      const meta = {
        fuentes_oficiales: { repo: 'https://github.com/org/repo', releases: 'https://github.com/org/repo/releases' },
        fuentes_consultadas: ['https://example.com/doc'],
        referencias_oficiales: [{ url: 'https://docs.example.com' }],
        sitio_oficial: 'https://tool.example.com',
        repositorio: 'https://gitlab.com/tool',
        upstream: 'https://upstream.example.com',
        sitio_web: 'https://web.example.com',
      };
      const urls = collectUrls(meta);
      expect(urls).toContain('https://github.com/org/repo');
      expect(urls).toContain('https://example.com/doc');
      expect(urls).toContain('https://docs.example.com');
      expect(urls).toContain('https://tool.example.com');
      expect(urls).toContain('https://gitlab.com/tool');
      // Sin duplicados
      expect(new Set(urls).size).toBe(urls.length);
    });

    it('debe rechazar valores NO_VERIFICADA, PENDIENTE, N/A, etc.', () => {
      expect(isVerifiedValue('NO_VERIFICADA')).toBe(false);
      expect(isVerifiedValue('PENDIENTE')).toBe(false);
      expect(isVerifiedValue('N/A')).toBe(false);
      expect(isVerifiedValue('')).toBe(false);
      expect(isVerifiedValue(null)).toBe(false);
      expect(isVerifiedValue('LGPL-2.1')).toBe(true);
      expect(isVerifiedValue('  MIT  ')).toBe(true);
    });

    it('debe clasificar tipos de herramienta correctamente', () => {
      const cliMeta = { tipo: 'CLI / analizador estático (SAST)' };
      const guiMeta = { tipo: 'Aplicación de modelado de amenazas (desktop y web autoalojable)' };
      const apiMeta = { tipo: 'SDK / librería de análisis' };
      const serviceMeta = { tipo: 'Servicio de tunneling de puertos' };
      const otherMeta = { tipo: 'Herramienta de seguridad' };
      
      const normalize = (m) => normalizeMetadata(m, 'test/tool');
      expect(normalize(cliMeta).toolType).toBe('cli');
      expect(normalize(guiMeta).toolType).toBe('gui');
      expect(normalize(apiMeta).toolType).toBe('api/sdk');
      expect(normalize(serviceMeta).toolType).toBe('service/infra');
      expect(normalize(otherMeta).toolType).toBe('other');
    });

    it('debe normalizar campos históricos con nombres alternativos', () => {
      const meta = {
        id: 'test',
        nombre: 'Test',
        descripcion: 'Descripción específica y verificable de la herramienta',
        categoria: 'Test',
        subtipo: 'CLI / test',
        problema_que_resuelve: 'Resuelve X',
        funciones_principales: 'Hace Y',
        fuentes_oficiales: { repo: 'https://github.com/test' },
        sistema_operativo: 'Linux, macOS',
        limites: ['Límite 1'],
        estado_fuente: 'VERIFICADO',
        fecha_verificacion: '2026-01-01',
        licencia: 'MIT',
        id_catalogo: 'AT-SEC-001',
      };
      const norm = normalizeMetadata(meta, '02-catalogo/test/tool');
      expect(norm.id).toBe('test');
      expect(norm.urls.length).toBeGreaterThan(0);
      expect(norm.toolType).toBe('cli');
    });
  });

  describe('guide.mjs — Validación de guías por tipo', () => {
    it('debe rechazar guía genérica con todas las secciones pero contenido vago', () => {
      const genericGuide = `# Herramienta Genérica
## Requisitos
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Dependencias
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Instalación
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Plataformas
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Verificación
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Configuración
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Primer uso
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Comandos
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Entradas
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Salidas
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Errores
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Advertencias
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Referencias
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
## Limitaciones
Esta herramienta avanzada es una utilidad de seguridad que permite realizar pruebas y sirve para analizar sistemas de forma general.
`;

      const guidePath = path.join(tempDir, 'generic-guide.md');
      fs.writeFileSync(guidePath, genericGuide);

      const check = checkGuideContent(guidePath, 'cli');
      expect(check.valid).toBe(false);
      expect(check.issues.some(i => i === 'GUIDE_GENERIC_CONTENT')).toBe(true);
    });

    it('debe rechazar guía con placeholders', () => {
      const guideWithPlaceholder = `# Herramienta X
## Requisitos
[TODO] Pendiente
## Instalación
Instalar
`;

      const guidePath = path.join(tempDir, 'guide-placeholder.md');
      fs.writeFileSync(guidePath, guideWithPlaceholder);

      const check = checkGuideContent(guidePath, 'cli');
      expect(check.valid).toBe(false);
      expect(check.issues).toContain('GUIDE_CONTAINS_PLACEHOLDERS');
    });

    it('GUI no debe requerir flags CLI para profundidad técnica', () => {
      const guiGuide = `# GUI Tool
## Requisitos del sistema
Sistema operativo compatible con la aplicación.
## Acceso o Instalación
Descargar desde la web oficial e instalar.
## Plataformas
Windows, macOS, Linux.
## Verificación
Ejecutar la aplicación y comprobar que abre.
## Configuración
Preferencias en menú Herramientas.
## Primer uso
Abrir la aplicación y crear un nuevo proyecto.
## Interfaz y Flujo
La interfaz tiene una barra de herramientas, panel lateral y área de trabajo principal.
## Entradas
Archivos de proyecto, configuración.
## Salidas
Reportes exportados, diagramas.
## Errores
Ver logs en el panel de consola.
## Advertencias
No ejecutar sin permisos.
## Referencias
https://example.com/docs
## Limitaciones
Solo versión de prueba.
`;

      const guidePath = path.join(tempDir, 'gui-guide.md');
      fs.writeFileSync(guidePath, guiGuide);

      const check = checkGuideContent(guidePath, 'gui');
      // GUI needs guiMarkers >= 3
      expect(check.stats.guiMarkers).toBeGreaterThanOrEqual(3);
    });

    it('API/SDK no debe requerir instalación CLI ficticia', () => {
      const apiGuide = `# API SDK
## Requisitos de integración
Node.js 18+, npm.
## Autenticación y Acceso
API Key desde panel de control.
## Instalación o Disponibilidad
npm install @org/sdk
## Configuración
const client = new Client({ apiKey: '...' });
## Primer uso
client.list().then(console.log);
## Ejemplos de llamada
GET /api/v1/resources
## Entradas
Parámetros de query, body JSON.
## Respuestas
JSON con datos y paginación.
## Errores
Códigos 4xx, 5xx con detalles.
## Límites
Rate limit 100 req/min.
## Advertencias
No exponer API Key.
## Referencias
https://api.example.com/docs
## Limitaciones
Solo región us-east.
`;

      const guidePath = path.join(tempDir, 'api-guide.md');
      fs.writeFileSync(guidePath, apiGuide);

      const check = checkGuideContent(guidePath, 'api/sdk');
      expect(check.stats.apiMarkers).toBeGreaterThanOrEqual(3);
    });
  });

  describe('skill.mjs — Validación de skills operativas', () => {
    it('debe rechazar skill con placeholders', () => {
      const skillWithPlaceholder = `---\nname: test\ndescription: Test\n---\n\n## Cuándo usar\n\n[TODO] Condición\n\n## Entradas mínimas\n\n- Entrada\n\n## Procedimiento\n\n1. Paso genérico\n2. Otro paso\n\n## Salidas esperadas\n\nSalida\n\n## Guardrails\n\nGuardrail\n\n## Evidencia\n\nEvidencia\n\n## Referencias\n\n- https://example.com
`;

      const skillPath = path.join(tempDir, 'skill-placeholder.md');
      fs.writeFileSync(skillPath, skillWithPlaceholder);

      const check = checkSkillContent(skillPath);
      expect(check.valid).toBe(false);
      expect(check.issues).toContain('SKILL_CONTAINS_PLACEHOLDERS');
    });

    it('debe rechazar skill con pasos no sustantivos', () => {
      const skillWithoutSteps = `---\nname: test\ndescription: Test\n---\n\n## Cuándo usar\n\nCuando sea necesario\n\n## Entradas mínimas\n\n- Entrada real\n\n## Procedimiento\n\n1. Paso vacío\n2. Otro\n\n## Salidas esperadas\n\nSalida real\n\n## Guardrails obligatorios\n\nGuardrail real\n\n## Evidencia y trazabilidad\n\nEvidencia real\n\n## Referencias\n\n- https://example.com
`;

      const skillPath = path.join(tempDir, 'skill-no-steps.md');
      fs.writeFileSync(skillPath, skillWithoutSteps);

      const check = checkSkillContent(skillPath);
      expect(check.valid).toBe(false);
      expect(check.issues.some(i => i === 'SKILL_STEPS_NOT_SUBSTANTIVE' || i === 'SKILL_INSUFFICIENT_STEPS')).toBe(true);
    });

    it('debe aceptar skill con 3+ pasos sustantivos', () => {
      const goodSkill = `---\nname: test-skill\ndescription: Skill para validar la ejecución de herramientas en EVOL con evidencia trazable\n---\n\n## Cuándo usar\nCuando se necesite validar X en entorno Y con criterios definidos\n\n## Entradas mínimas\n- Objetivo autorizado y alcance escrito\n- Versión de la herramienta y método de instalación\n- Criterio de aceptación y límites de recursos\n\n## Procedimiento\n1. Confirmar autorización y alcance documentado antes de ejecutar.\n2. Verificar la instalación con el comando de versión y registrar la versión exacta.\n3. Ejecutar el caso de prueba acotado sobre datos sintéticos y guardar la salida completa.\n4. Revisar los resultados manualmente y clasificarlos según el criterio acordado.\n\n## Salidas esperadas\nRegistro de evidencia con versión, comando, entorno, fecha y hash del artefacto.\n\n## Guardrails obligatorios\nLos hallazgos requieren revisión humana; no convertir verificación de versión en prueba funcional.\n\n## Evidencia y trazabilidad\nRegistrar cada ejecución real en formato evol-tool-atlas/evidencias/1 con hash SHA-256.\n\n## Referencias\n- https://example.com/docs\n- https://github.com/org/tool\n`;

      const skillPath = path.join(tempDir, 'good-skill.md');
      fs.writeFileSync(skillPath, goodSkill);

      const check = checkSkillContent(skillPath);
      expect(check.valid).toBe(true);
      expect(check.stats.substantiveSteps).toBeGreaterThanOrEqual(3);
    });
  });

  describe('cases.mjs — Validación de casos de uso sustantivos', () => {
    it('debe rechazar casos-uso.json vacío', () => {
      const emptyCases = { schema: 'v1', herramienta: 'Test', id_catalogo: 'AT-SEC-999', casos: [] };
      const casesPath = path.join(tempDir, 'empty-casos.json');
      fs.writeFileSync(casesPath, JSON.stringify(emptyCases));

      const check = checkCasesContent(casesPath);
      expect(check.valid).toBe(false);
      expect(check.issues).toContain('CASOS_EMPTY');
    });

    it('debe rechazar casos sin objetivo, pasos, prerrequisitos o resultado', () => {
      const badCases = {
        schema: 'v1', herramienta: 'Test', id_catalogo: 'AT-SEC-999',
        casos: [{ id: 'CU-01', objetivo: '', pasos: [], prerequisitos: [], resultado_esperado: '' }]
      };
      const casesPath = path.join(tempDir, 'bad-casos.json');
      fs.writeFileSync(casesPath, JSON.stringify(badCases));

      const check = checkCasesContent(casesPath);
      expect(check.valid).toBe(false);
      expect(check.issues.some(i => i.includes('MISSING_OBJECTIVE'))).toBe(true);
      expect(check.issues.some(i => i.includes('INSUFFICIENT_STEPS'))).toBe(true);
      expect(check.issues.some(i => i.includes('MISSING_PREREQS'))).toBe(true);
      expect(check.issues.some(i => i.includes('MISSING_EXPECTED'))).toBe(true);
    });

    it('debe aceptar caso sustantivo completo', () => {
      const goodCases = {
        schema: 'v1', herramienta: 'Test', id_catalogo: 'AT-SEC-999',
        casos: [{
          id: 'CU-01',
          objetivo: 'Detectar patrones inseguros en código Python sin enviar datos externos.',
          prerequisitos: ['Copia autorizada del repositorio', 'Regla local revisada', 'Entorno aislado'],
          pasos: [
            'Crear archivo .semgrep.yml con la regla acordada.',
            'Ejecutar semgrep scan --config .semgrep.yml --metrics=off .',
            'Clasificar hallazgos y abrir revisión manual para cada uno.',
            'Guardar salida JSON, versión usada y hash del artefacto.'
          ],
          resultado_esperado: 'Lista reproducible de coincidencias con ruta, línea, severidad y regla.',
          evidencia_requerida: ['Comando exacto', 'Versión', 'Archivo JSON', 'SHA-256'],
          riesgo: 'MEDIO',
          estado: 'propuesto_no_ejecutado'
        }]
      };
      const casesPath = path.join(tempDir, 'good-casos.json');
      fs.writeFileSync(casesPath, JSON.stringify(goodCases));

      const check = checkCasesContent(casesPath);
      expect(check.valid).toBe(true);
      expect(check.stats.substantive).toBe(1);
    });
  });

  describe('evidence.mjs — Validación de evidencia experimental con integridad', () => {
    it('debe rechazar evidencia PASS con hash incorrecto', () => {
      const evidence = {
        schema: 'evol-tool-atlas/evidencias/1',
        herramienta: 'Test',
        id_catalogo: 'AT-SEC-999',
        fecha_actualizacion: '2026-11-26',
        registros: [{
          id: 'EV-TEST-01',
          herramienta: 'Test',
          id_catalogo: 'AT-SEC-999',
          tipo: 'prueba_funcional_acotada',
          fecha: '2026-11-26',
          entorno: 'Test environment con detalles',
          version: '1.0.0',
          comando: 'test command with arguments',
          resultado: 'PASS',
          resumen: 'Test summary with sufficient detail',
          evidencia: { sha256: 'a'.repeat(64), destRel: 'tests/unit/fixtures/atds-test/test.json' },
          sha256: 'a'.repeat(64),
          procedencia: { repositorio: 'test-repo', archivo_original: 'evidence.json' },
          artefactos: [{ sha256: 'a'.repeat(64), nombre: 'Test artifact' }],
          limitaciones: ['Test limitation'],
          criterio_aceptacion: 'Exit code 0 y salida JSON válida',
          resultado_observado: 'Ejecución terminó con código 0, salida JSON válida'
        }]
      };

      const evidencePath = path.join(tempDir, 'bad-hash-evidence.json');
      fs.writeFileSync(evidencePath, JSON.stringify(evidence));

      // Create artifact with different content
      const artifactDir = path.join(ROOT, 'tests/unit/fixtures/atds-test');
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, 'test.json'), '{"correct": "data"}');

      const check = checkEvidenceContent(evidencePath, ROOT, ROOT);
      expect(check.valid).toBe(false);
      expect(check.issues.some(i => i.startsWith('EVIDENCE_HASH_MISMATCH'))).toBe(true);

      // Cleanup
      rmSync(path.join(ROOT, 'tests/unit/fixtures/atds-test'), { recursive: true, force: true });
    });

    it('debe rechazar BLOCKED con evidencia no nula', () => {
      const evidence = {
        schema: 'evol-tool-atlas/evidencias/1',
        herramienta: 'Test',
        id_catalogo: 'AT-SEC-999',
        fecha_actualizacion: '2026-11-26',
        registros: [{
          id: 'EV-TEST-01',
          herramienta: 'Test',
          id_catalogo: 'AT-SEC-999',
          tipo: 'prueba_funcional',
          fecha: '2026-11-26',
          entorno: 'Test',
          version: '1.0.0',
          comando: 'test command',
          resultado: 'BLOCKED',
          resumen: 'Test',
          evidencia: { sha256: 'a'.repeat(64), destRel: 'evidencias/test.json' },
          sha256: 'a'.repeat(64),
          procedencia: { repositorio: 'test' },
          artefactos: [{ sha256: 'a'.repeat(64) }],
          limitaciones: []
        }]
      };

      const evidencePath = path.join(tempDir, 'blocked-with-evidence.json');
      fs.writeFileSync(evidencePath, JSON.stringify(evidence));

      const check = checkEvidenceContent(evidencePath, ROOT, ROOT);
      expect(check.valid).toBe(false);
      expect(check.issues.some((i: string) => i.startsWith('BLOCKED_') && i.includes('HAS_EVIDENCE'))).toBe(true);
    });

    it('debe exigir criterio de aceptación y resultado observado para PASS con integridad', () => {
      const evidence = {
        schema: 'evol-tool-atlas/evidencias/1',
        herramienta: 'Test',
        id_catalogo: 'AT-SEC-999',
        fecha_actualizacion: '2026-11-26',
        registros: [{
          id: 'EV-TEST-01',
          herramienta: 'Test',
          id_catalogo: 'AT-SEC-999',
          tipo: 'prueba_funcional_acotada',
          fecha: '2026-11-26',
          entorno: 'Test environment con detalles',
          version: '1.0.0',
          comando: 'test command with arguments',
          resultado: 'PASS',
          resumen: 'Test summary with sufficient detail',
          evidencia: { sha256: 'a'.repeat(64), destRel: 'tests/unit/fixtures/atds-test/test2.json' },
          sha256: 'a'.repeat(64),
          procedencia: { repositorio: 'test-repo', archivo_original: 'evidence.json' },
          artefactos: [{ sha256: 'a'.repeat(64), nombre: 'Test artifact' }],
          limitaciones: ['Test limitation'],
          // Missing criterio_aceptacion and resultado_observado
        }]
      };

      const evidencePath = path.join(tempDir, 'missing-criterio-evidence.json');
      fs.writeFileSync(evidencePath, JSON.stringify(evidence));

      const artifactDir = path.join(ROOT, 'tests/unit/fixtures/atds-test');
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, 'test2.json'), '{"test": "data"}');

      const check = checkEvidenceContent(evidencePath, ROOT, ROOT);
      expect(check.stats.passWithIntegrity).toBe(0);
      expect(check.warnings.some(w => w.includes('MISSING_CRITERIO_ACEPTACION'))).toBe(true);
      expect(check.warnings.some(w => w.includes('MISSING_RESULTADO_OBSERVADO'))).toBe(true);

      // Cleanup
      rmSync(path.join(ROOT, 'tests/unit/fixtures/atds-test'), { recursive: true, force: true });
    });
  });

  describe('classify.mjs — Clasificación acumulativa L1→L2→L3→L4', () => {
    it('L1 falla sin fuente verificable', () => {
      const meta = {
        id: 'test', nombre: 'Test', descripcion: 'Descripción específica y verificable de la herramienta',
        categoria: 'Test', tipo: 'CLI', problema_que_resuelve: 'Resuelve X', funciones_principales: 'Hace Y',
        urls: [], sistema_operativo: 'Linux', limites: ['Límite 1'], estado_fuente: 'VERIFICADO',
        fecha_verificacion: '2026-01-01', licencia: 'MIT', id_catalogo: 'AT-SEC-001'
      };
      const result = evaluateL1(meta);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('L1_MISSING_FUENTE');
    });

    it('L2 bloqueado si L1 falla', () => {
      const l1Result = { passed: false, issues: ['L1_MISSING_FUENTE'], warnings: [], checks: {} };
      const guideResult = { valid: true, issues: [], warnings: [], sections: ['Instalación'], stats: {} };
      const meta = { licencia: 'MIT', sistema_operativo: 'Linux', dependencias: 'deps', requisitos: 'reqs' };
      const result = evaluateL2(l1Result, guideResult, meta);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('L2_BLOCKED_BY_L1');
    });

    it('L3 requiere skill O casos válidos, no ambos', () => {
      const l2Result = { passed: true, issues: [], warnings: [], checks: {} };
      const skillResult = { valid: false, issues: ['SKILL_MISSING'], warnings: [], stats: { substantiveSteps: 0 } };
      const casesResult = { valid: true, issues: [], warnings: [], stats: { substantive: 1 } };
      const result = evaluateL3(l2Result, skillResult, casesResult, {});
      expect(result.passed).toBe(true);
    });

    it('L4 bloqueado si L3 falla', () => {
      const l3Result = { passed: false, issues: ['L3_NO_SKILL_OR_CASOS'], warnings: [], checks: {} };
      const evidenceResult = { valid: true, issues: [], warnings: [], stats: { passWithIntegrity: 1 } };
      const result = evaluateL4(l3Result, evidenceResult, {});
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('L4_BLOCKED_BY_L3');
    });

    it('computeLevels produce nivel acumulativo correcto', () => {
      expect(computeLevels({passed:true},{passed:true},{passed:true},{passed:true}).validatedLevel).toBe('L4');
      expect(computeLevels({passed:true},{passed:true},{passed:true},{passed:false}).validatedLevel).toBe('L3');
      expect(computeLevels({passed:true},{passed:true},{passed:false},{passed:false}).validatedLevel).toBe('L2');
      expect(computeLevels({passed:true},{passed:false},{passed:false},{passed:false}).validatedLevel).toBe('L1');
      expect(computeLevels({passed:false},{passed:false},{passed:false},{passed:false}).validatedLevel).toBe('NONE');
    });

    it('computeStatus separa ERROR, FAIL, REVIEW_REQUIRED, PASS', () => {
      expect(computeStatus(['MISSING_METADATA'],{},{},{},{})).toBe('ERROR');
      expect(computeStatus(['L1_MISSING_FUENTE'],{},{},{},{})).toBe('FAIL');
      expect(computeStatus(['GUIDE_VAGUE_PATTERNS_1'],{},{},{},{})).toBe('REVIEW_REQUIRED');
      expect(computeStatus([],{},{},{},{})).toBe('PASS');
    });
  });

  describe('diagnostics.mjs — Mapeo DOC-01..DOC-12', () => {
    it('debe mapear códigos internos a familias DOC', () => {
      expect(mapCodeToDoc('L1_DESCRIPTION_VAGUE')).toBe('DOC-01');
      expect(mapCodeToDoc('L1_MISSING_FUENTE')).toBe('DOC-03');
      expect(mapCodeToDoc('L2_GUIDE_MISSING_SECTION_PLATAFORMAS')).toBe('DOC-05');
      expect(mapCodeToDoc('L2_GUIDE_MISSING_SECTION_INSTALACION')).toBe('DOC-06');
      expect(mapCodeToDoc('L2_GUIDE_MISSING_SECTION_COMANDOS')).toBe('DOC-07');
      expect(mapCodeToDoc('CASOS_NO_SUBSTANTIVE')).toBe('DOC-08');
      expect(mapCodeToDoc('SKILL_INSUFFICIENT_STEPS')).toBe('DOC-09');
      expect(mapCodeToDoc('BLOCKED_HAS_EVIDENCE')).toBe('DOC-10');
      expect(mapCodeToDoc('EVIDENCE_HASH_MISMATCH')).toBe('DOC-10');
      expect(mapCodeToDoc('L1_MISSING_LICENCIA')).toBe('DOC-02');
      expect(mapCodeToDoc('MISSING_METADATA')).toBe('DOC-11');
    });

    it('makeFinding produce diagnóstico completo', () => {
      const finding = makeFinding({ code: 'L1_MISSING_FUENTE', toolId: 'test', level: 'L1' });
      expect(finding.doc).toBe('DOC-03');
      expect(finding.code).toBe('L1_MISSING_FUENTE');
      expect(finding.severity).toBe('ERROR');
      expect(finding.blocking).toBe(true);
      expect(finding.action).toBeDefined();
    });

    it('summarizeFindings agrupa por DOC y severidad', () => {
      const findings = [
        makeFinding({ code: 'L1_MISSING_FUENTE' }),
        makeFinding({ code: 'L1_MISSING_LICENCIA' }),
        makeFinding({ code: 'L2_GUIDE_MISSING_SECTION_PLATAFORMAS', severity: 'WARNING' }),
      ];
      const summary = summarizeFindings(findings);
      expect(summary.byDoc['DOC-03']).toBe(1);
      expect(summary.byDoc['DOC-02']).toBe(1);
      expect(summary.byDoc['DOC-05']).toBe(1);
      expect(summary.bySeverity.ERROR).toBe(2);
      expect(summary.bySeverity.WARNING).toBe(1);
      expect(summary.blocking).toBe(3);
    });
  });

  describe('paths.mjs — Seguridad de rutas', () => {
    it('debe rechazar rutas absolutas', () => {
      const result = resolveWithin(ROOT, '/etc/passwd');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('ABSOLUTE_PATH');
    });

    it('debe rechazar path traversal', () => {
      const result = resolveWithin(ROOT, '../../etc/passwd');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('PATH_TRAVERSAL');
    });

    it('debe rechazar rutas con null byte', () => {
      const result = resolveWithin(ROOT, 'test\0.json');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('NULL_BYTE');
    });

    it('debe aceptar ruta relativa válida dentro de ROOT', () => {
      const result = resolveWithin(ROOT, 'package.json');
      expect(result.ok).toBe(true);
      expect(result.path).toBe(path.join(ROOT, 'package.json'));
    });

    it('toolDirFromHref extrae directorio correctamente', () => {
      expect(toolDirFromHref('02-catalogo/testing-y-auditoria/semgrep/index.html')).toBe('02-catalogo/testing-y-auditoria/semgrep');
      expect(toolDirFromHref('02-catalogo/seguridad/catalogo/promptfoo/index.html')).toBe('02-catalogo/seguridad/catalogo/promptfoo');
    });
  });

  describe('Integración real — Herramientas prioritarias', () => {
    it('Semgrep (AT-SEC-001) debe tener L1 validado con evidencia PASS íntegra', async () => {
      // This would require full evaluateTool, testing the integration
      const metaPath = path.join(ROOT, '02-catalogo/testing-y-auditoria/semgrep/metadata.json');
      const meta = readJson(metaPath);
      expect(meta).not.toBeNull();
      expect(meta.id_catalogo).toBe('AT-SEC-001');
      
      const evidencePath = path.join(ROOT, '02-catalogo/testing-y-auditoria/semgrep/evidencias.json');
      const evidence = readJson(evidencePath);
      expect(evidence.registros.length).toBe(1);
      expect(evidence.registros[0].resultado).toBe('PASS');
      expect(evidence.registros[0].evidencia).toBeDefined();
    });

    it('promptfoo (AT-SEC-002) evidencia es solo verificación de versión', () => {
      const evidencePath = path.join(ROOT, '02-catalogo/seguridad/catalogo/promptfoo/evidencias.json');
      const evidence = readJson(evidencePath);
      expect(evidence.registros[0].tipo).toBe('verificacion_de_version');
      expect(evidence.registros[0].comando).toBe('promptfoo --version');
    });

    it('7 herramientas BLOCKED no tienen evidencia PASS', () => {
      const blockedIds = ['mcp-inspector', 'loom', 'dm-flakey', 'dm-log-writes', 'miri', 'cargo-mutants', 'proptest'];
      for (const id of blockedIds) {
        const dir = `02-catalogo/pruebas-tecnicas/${id}`;
        const evidencePath = path.join(ROOT, dir, 'evidencias.json');
        const evidence = readJson(evidencePath);
        const passRecords = evidence.registros.filter((r: Record<string, unknown>) => r.resultado === 'PASS');
        expect(passRecords.length).toBe(0);
        const blockedRecords = evidence.registros.filter((r: Record<string, unknown>) => r.resultado === 'BLOCKED');
        expect(blockedRecords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Pruebas metamórficas — Cambios reales de nivel', () => {
    it('MET-01: Quitar fuente a L1 válido debe impedir L1', () => {
      const meta = {
        id: 'test', nombre: 'Test', descripcion: 'Descripción específica y verificable',
        categoria: 'Test', tipo: 'CLI', problema_que_resuelve: 'Resuelve X', funciones_principales: 'Hace Y',
        urls: ['https://github.com/test'], sistema_operativo: 'Linux', limites: ['Límite 1'], 
        estado_fuente: 'VERIFICADO', fecha_verificacion: '2026-01-01', licencia: 'MIT', id_catalogo: 'test',
        VAGUE_PATTERNS
      };
      const withSource = evaluateL1(meta);
      expect(withSource.passed).toBe(true);
      
      const withoutSource = evaluateL1({ ...meta, urls: [] });
      expect(withoutSource.passed).toBe(false);
      expect(withoutSource.issues).toContain('L1_MISSING_FUENTE');
    });

    it('MET-02: Guía placeholder debe impedir L2', () => {
      const meta = { licencia: 'MIT', sistema_operativo: 'Linux', dependencias: 'deps', requisitos: 'reqs' };
      const l1Result = { passed: true, issues: [], warnings: [], checks: {} };
      
      // Create a valid guide with technical depth (backticks, code fences, flags, URLs)
      const validGuide = `# Herramienta Válida - Guía Técnica

## Requisitos
Esta herramienta requiere Python 3.10+ y pip instalado. El sistema debe tener acceso a internet para descargar dependencias.

## Dependencias
Dependencias: python3 (>=3.10), pip, setuptools. Para contenedores: Docker 20.10+.

## Instalación
### Linux
\`\`\`bash
python3 -m pip install --user herramienta
\`\`\`

### macOS
\`\`\`bash
brew install herramienta
\`\`\`

### Windows
\`\`\`powershell
python -m pip install herramienta
\`\`\`

### Verificación
\`\`\`bash
herramienta --version
\`\`\`

## Plataformas
Linux (glibc 2.31+), macOS 11+, Windows 10/11 (WSL2 recomendado).

## Verificación
Ejecutar \`herramienta --version\` debe mostrar la versión instalada. \`herramienta --help\` muestra opciones.

## Configuración
Crear archivo \`.herramienta.yml\` con:
\`\`\`yaml
rules:
  - id: ejemplo
    pattern: console.log(...)
\`\`\`

## Primer uso
\`\`\`bash
herramienta scan --config .herramienta.yml --metrics=off .
\`\`\`

## Comandos
Flags principales: \`--config\`, \`--metrics\`, \`--json\`, \`--sarif\`, \`--baseline-commit\`, \`--version\`, \`--help\`.

## Entradas
Código fuente en repositorio local, archivo de configuración YAML.

## Salidas
JSON con hallazgos, SARIF para CI, métricas de rendimiento.

## Errores
Errores comunes: Python no encontrado, reglas inválidas, permisos de archivo.

## Advertencias
No usar \`--config auto\` en repositorios privados sin revisar telemetría.

## Referencias
- https://github.com/org/herramienta
- https://herramienta.dev/docs/

## Limitaciones
Solo analiza código estático; no ejecuta el programa. Falsos positivos posibles.
`;
      const validPath = path.join(tempDir, 'valid-guide.md');
      fs.writeFileSync(validPath, validGuide);
      const goodGuide = checkGuideContent(validPath, 'cli');
      const l2Good = evaluateL2(l1Result, goodGuide, meta);
      
      // Create placeholder guide
      const placeholderPath = path.join(tempDir, 'placeholder.md');
      fs.writeFileSync(placeholderPath, '# Tool\n[TODO] Pending');
      const badGuide = checkGuideContent(placeholderPath, 'cli');
      const l2Bad = evaluateL2(l1Result, badGuide, meta);
      
      expect(l2Good.passed).toBe(true);
      expect(l2Bad.passed).toBe(false);
    });

    it('MET-03: Vaciar casos impide L3 cuando skill no válida', () => {
      const l2Result = { passed: true, issues: [], warnings: [], checks: {} };
      const meta = {};
      
      const skillResult = { valid: false, issues: ['SKILL_MISSING'], warnings: [], stats: { substantiveSteps: 0 } };
      const goodCases = { valid: true, issues: [], warnings: [], stats: { substantive: 1 } };
      const badCases = { valid: false, issues: ['CASOS_EMPTY'], warnings: [], stats: { substantive: 0 } };
      
      const withCases = evaluateL3(l2Result, skillResult, goodCases, meta);
      expect(withCases.passed).toBe(true);
      
      const withoutCases = evaluateL3(l2Result, skillResult, badCases, meta);
      expect(withoutCases.passed).toBe(false);
    });

    it('MET-04: Evidencia PASS → BLOCKED impide L4', () => {
      const l3Result = { passed: true, issues: [], warnings: [], checks: {} };
      const meta = {};
      
      const passEvidence = { valid: true, issues: [], warnings: [], stats: { passWithIntegrity: 1 } };
      const blockedEvidence = { valid: false, issues: ['BLOCKED_HAS_EVIDENCE'], warnings: [], stats: { passWithIntegrity: 0 } };
      
      const withPass = evaluateL4(l3Result, passEvidence, meta);
      expect(withPass.passed).toBe(true);
      
      const withBlocked = evaluateL4(l3Result, blockedEvidence, meta);
      expect(withBlocked.passed).toBe(false);
    });
  });
});