/**
 * Pruebas de regresión para la Etapa 1 — Recuperación y preservación documental
 * Verifica que las 12 herramientas prioritarias mantengan sus IDs AT-SEC-001..012,
 * evidencias vinculadas y integridad SHA-256.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

interface PriorityTool {
  dir: string;
  idCatalogo: string;
  name: string;
  category: string;
  hasPassEvidence: boolean;
  blockedEvidenceId: string | null;
}

const PRIORITY_TOOLS: PriorityTool[] = [
  { dir: '02-catalogo/testing-y-auditoria/semgrep', idCatalogo: 'AT-SEC-001', name: 'Semgrep', category: 'Auditoría · SAST', hasPassEvidence: true, blockedEvidenceId: null },
  { dir: '02-catalogo/seguridad/catalogo/promptfoo', idCatalogo: 'AT-SEC-002', name: 'promptfoo', category: 'IA · Evaluación de LLM', hasPassEvidence: true, blockedEvidenceId: null },
  { dir: '02-catalogo/pruebas-tecnicas/cargo-fuzz', idCatalogo: 'AT-SEC-003', name: 'cargo-fuzz', category: 'Pruebas y auditoría técnica · Fuzzing', hasPassEvidence: true, blockedEvidenceId: null },
  { dir: '02-catalogo/pruebas-tecnicas/mcp-inspector', idCatalogo: 'AT-SEC-004', name: 'MCP Inspector', category: 'Pruebas y auditoría técnica · MCP', hasPassEvidence: false, blockedEvidenceId: 'EV-AT-SEC-004-BLOCKED-01' },
  { dir: '02-catalogo/pruebas-tecnicas/cargo-audit', idCatalogo: 'AT-SEC-005', name: 'cargo-audit', category: 'Pruebas y auditoría técnica · Dependencias', hasPassEvidence: true, blockedEvidenceId: null },
  { dir: '02-catalogo/pruebas-tecnicas/loom', idCatalogo: 'AT-SEC-006', name: 'Loom', category: 'Pruebas y auditoría técnica · Concurrencia', hasPassEvidence: false, blockedEvidenceId: 'EV-AT-SEC-006-BLOCKED-01' },
  { dir: '02-catalogo/pruebas-tecnicas/dm-flakey', idCatalogo: 'AT-SEC-007', name: 'dm-flakey', category: 'Pruebas y auditoría técnica · Inyección de fallos', hasPassEvidence: false, blockedEvidenceId: 'EV-AT-SEC-007-BLOCKED-01' },
  { dir: '02-catalogo/pruebas-tecnicas/dm-log-writes', idCatalogo: 'AT-SEC-008', name: 'dm-log-writes', category: 'Pruebas y auditoría técnica · Consistencia de almacenamiento', hasPassEvidence: false, blockedEvidenceId: 'EV-AT-SEC-008-BLOCKED-01' },
  { dir: '02-catalogo/pruebas-tecnicas/gitleaks', idCatalogo: 'AT-SEC-009', name: 'Gitleaks', category: 'Pruebas y auditoría técnica · Secretos', hasPassEvidence: true, blockedEvidenceId: null },
  { dir: '02-catalogo/pruebas-tecnicas/miri', idCatalogo: 'AT-SEC-010', name: 'Miri', category: 'Pruebas y auditoría técnica · Comportamiento indefinido', hasPassEvidence: false, blockedEvidenceId: 'EV-AT-SEC-010-BLOCKED-01' },
  { dir: '02-catalogo/pruebas-tecnicas/cargo-mutants', idCatalogo: 'AT-SEC-011', name: 'cargo-mutants', category: 'Pruebas y auditoría técnica · Mutación', hasPassEvidence: false, blockedEvidenceId: 'EV-AT-SEC-011-BLOCKED-01' },
  { dir: '02-catalogo/pruebas-tecnicas/proptest', idCatalogo: 'AT-SEC-012', name: 'proptest', category: 'Pruebas y auditoría técnica · Property testing', hasPassEvidence: false, blockedEvidenceId: 'EV-AT-SEC-012-BLOCKED-01' },
];

interface CatalogCategory {
  admitidas: number;
  excluidas: number;
  entradas: number;
}

interface CatalogTool {
  href: string;
}

interface CatalogData {
  categorias: CatalogCategory[];
  herramientas: CatalogTool[];
}

interface EvidenceRecord {
  id: string;
  herramienta: string;
  id_catalogo: string;
  resultado: 'PASS' | 'FAIL' | 'BLOCKED' | 'INCONCLUSIVE';
  evidencia: { sha256: string; destRel: string } | null;
  procedencia: { origen?: string; repositorio?: string } | null;
  artefactos: { sha256: string }[] | null;
  sha256: string | null;
}

interface EvidenceFile {
  schema: string;
  herramienta: string;
  id_catalogo: string;
  registros: EvidenceRecord[];
}

interface MetadataFile {
  id_catalogo: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedFiles: string[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function sha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function resolveSafe(baseDir: string, relPath: string): string {
  // Check for symlinks in the path components before resolving
  const parts = relPath.split(path.sep);
  let currentPath = baseDir;
  
  for (const part of parts) {
    currentPath = path.join(currentPath, part);
    try {
      const stats = fs.lstatSync(currentPath);
      if (stats.isSymbolicLink()) {
        throw new Error(`Path traversal attempt (symlink): ${relPath}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Path traversal')) {
        throw e;
      }
      // File doesn't exist yet, continue checking
    }
  }
  
  const resolved = path.resolve(baseDir, relPath);
  const baseResolved = path.resolve(baseDir);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error(`Path traversal attempt: ${relPath}`);
  }
  return resolved;
}

/**
 * Valida un ID de catálogo AT-SEC-XXX
 */
function validateCatalogId(id: string, expectedId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedFiles: string[] = [];

  if (!id) {
    errors.push('MISSING_CATALOG_ID');
  } else if (id === 'AT-???') {
    errors.push('PLACEHOLDER_CATALOG_ID');
  } else if (!/^AT-SEC-0(0[1-9]|1[0-2])$/.test(id)) {
    errors.push(`INVALID_CATALOG_ID_FORMAT: ${id}`);
  } else if (id !== expectedId) {
    errors.push(`CATALOG_ID_MISMATCH: expected ${expectedId}, got ${id}`);
  }

  return { valid: errors.length === 0, errors, warnings, checkedFiles };
}

/**
 * Valida un registro de evidencia
 */
function validateEvidenceRecord(
  record: EvidenceRecord,
  _toolDir: string,
  expectedId: string,
  expectedTool: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedFiles: string[] = [];

  // Validar ID
  if (!record.id) {
    errors.push('MISSING_EVIDENCE_ID');
  }

  // Validar id_catalogo
  const idValidation = validateCatalogId(record.id_catalogo, expectedId);
  errors.push(...idValidation.errors);
  warnings.push(...idValidation.warnings);

  // Validar herramienta
  if (record.herramienta !== expectedTool) {
    errors.push(`TOOL_MISMATCH: expected ${expectedTool}, got ${record.herramienta}`);
  }

  // Validar resultado
  if (!['PASS', 'FAIL', 'BLOCKED', 'INCONCLUSIVE'].includes(record.resultado)) {
    errors.push(`INVALID_RESULT: ${record.resultado}`);
  }

  // Validar evidencia para PASS
  if (record.resultado === 'PASS') {
    if (!record.evidencia) {
      errors.push('MISSING_EVIDENCE_OBJECT');
    } else {
      if (!record.evidencia.sha256) {
        errors.push('MISSING_EVIDENCE_SHA256');
      } else if (!/^[a-f0-9]{64}$/.test(record.evidencia.sha256)) {
        errors.push('INVALID_EVIDENCE_SHA256_FORMAT');
      }
      if (!record.evidencia.destRel) {
        errors.push('MISSING_EVIDENCE_DESTREL');
      } else {
        try {
          // destRel is already relative to ROOT
          const artifactPath = resolveSafe(ROOT, record.evidencia.destRel);
          checkedFiles.push(artifactPath);
          if (!fs.existsSync(artifactPath)) {
            errors.push(`EVIDENCE_ARTIFACT_MISSING: ${artifactPath}`);
          } else {
            const actualHash = sha256(artifactPath);
            if (actualHash !== record.evidencia.sha256) {
              errors.push(`EVIDENCE_HASH_MISMATCH: expected ${record.evidencia.sha256}, got ${actualHash}`);
            }
          }
        } catch {
          errors.push(`UNSAFE_EVIDENCE_PATH: ${record.evidencia.destRel}`);
        }
      }
    }

    if (!record.procedencia?.repositorio && !record.procedencia?.origen) {
      errors.push('MISSING_PROCEDENCIA');
    }

    if (!record.artefactos || record.artefactos.length === 0) {
      errors.push('MISSING_ARTIFACTS');
    } else {
      for (const art of record.artefactos) {
        if (!art.sha256 || !/^[a-f0-9]{64}$/.test(art.sha256)) {
          errors.push('INVALID_ARTIFACT_SHA256');
        }
      }
    }
  }

  // Validar BLOCKED
  if (record.resultado === 'BLOCKED') {
    if (record.evidencia !== null) {
      errors.push('BLOCKED_SHOULD_HAVE_NULL_EVIDENCE');
    }
    if (record.artefactos && record.artefactos.length > 0) {
      errors.push('BLOCKED_SHOULD_HAVE_EMPTY_ARTIFACTS');
    }
    if (record.sha256 !== null) {
      errors.push('BLOCKED_SHOULD_HAVE_NULL_SHA256');
    }
  }

  // Validar PASS que parece BLOCKED (detección de conversión indebida)
  if (record.resultado === 'PASS') {
    const hasBlockedCharacteristics = 
      record.evidencia === null &&
      (!record.artefactos || record.artefactos.length === 0) &&
      record.sha256 === null;
    if (hasBlockedCharacteristics) {
      errors.push('PASS_RECORD_HAS_BLOCKED_CHARACTERISTICS');
    }
  }

  return { valid: errors.length === 0, errors, warnings, checkedFiles };
}

/**
 * Valida integridad SHA256SUMS.txt
 */
function validateSha256Manifest(toolDir: string, _toolName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedFiles: string[] = [];

  const sumsPath = path.join(ROOT, toolDir, 'SHA256SUMS.txt');
  if (!fs.existsSync(sumsPath)) {
    errors.push('MISSING_SHA256SUMS');
    return { valid: false, errors, warnings, checkedFiles };
  }

  const content = fs.readFileSync(sumsPath, 'utf-8');
  const lines = content.trim().split('\n').filter((l: string) => l.trim().length > 0);

  if (lines.length === 0) {
    errors.push('EMPTY_SHA256SUMS');
  }

  const seenFiles = new Set<string>();
  const requiredFiles = ['metadata.json', 'evidencias.json', 'casos-uso.json', 'GUIA.md', 'SKILL.md'];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) {
      errors.push(`MALFORMED_SHA256SUMS_LINE: ${line}`);
      continue;
    }

    const expectedHash = parts[0]!;
    const fileName = parts.slice(1).join(' ');

    if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
      errors.push(`INVALID_SHA256_IN_MANIFEST: ${expectedHash}`);
    }
    if (!fileName) {
      errors.push('EMPTY_FILENAME_IN_MANIFEST');
    }
    if (seenFiles.has(fileName)) {
      errors.push(`DUPLICATE_MANIFEST_ENTRY: ${fileName}`);
    }
    seenFiles.add(fileName);

    const filePath = resolveSafe(path.join(ROOT, toolDir), fileName);
    checkedFiles.push(filePath);

    if (!fs.existsSync(filePath)) {
      errors.push(`MANIFEST_FILE_MISSING: ${filePath}`);
    } else {
      const actualHash = sha256(filePath);
      if (actualHash !== expectedHash) {
        errors.push(`HASH_MISMATCH: ${fileName} expected ${expectedHash}, got ${actualHash}`);
      }
    }
  }

  for (const reqFile of requiredFiles) {
    if (!seenFiles.has(reqFile)) {
      errors.push(`MISSING_REQUIRED_FILE_IN_MANIFEST: ${reqFile}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, checkedFiles };
}

/**
 * Valida estructura de GUIA.md
 */
function validateGuideStructure(content: string, expectedId: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedFiles: string[] = [];

  // Secciones requeridas - aceptamos variaciones en los títulos
  const requiredSections = [
    { key: 'ID de catálogo', patterns: ['ID de catálogo'] },
    { key: 'Categoría Atlas', patterns: ['Categoría Atlas'] },
    { key: 'Versión de referencia verificada', patterns: ['Versión de referencia verificada'] },
    { key: 'Fecha de verificación documental', patterns: ['Fecha de verificación documental'] },
    { key: 'Estado en este Atlas', patterns: ['Estado en este Atlas'] },
    { key: 'Introducción', patterns: ['Introducción'] },
    { key: 'Instalación manual', patterns: ['Instalación manual'] },
    { key: 'Configuración', patterns: ['Configuración'] },
    { key: 'Primer uso', patterns: ['Primer uso', 'Uso básico', 'Uso avanzado'] },
    { key: 'Limitaciones', patterns: ['Limitaciones', 'limitaciones', 'alcance y limitaciones', 'limitaciones generales'] },
    { key: 'Advertencias', patterns: ['Advertencias', 'advertencias', 'Guardrails', 'Seguridad, alcance y limitaciones'] },
    { key: 'Referencias oficiales', patterns: ['Referencias oficiales'] },
  ];

  if (!content.includes(expectedId)) {
    errors.push(`GUIDE_MISSING_CATALOG_ID: ${expectedId}`);
  }
  if (content.length < 1000) {
    errors.push('GUIDE_TOO_SHORT');
  }
  if (content.includes('TODO') || content.includes('FIXME') || content.includes('[TODO]') || content.includes('[PENDIENTE]')) {
    errors.push('GUIDE_CONTAINS_PLACEHOLDERS');
  }
  if (content.toLowerCase().includes('placeholder')) {
    errors.push('GUIDE_CONTAINS_PLACEHOLDER_WORD');
  }

  for (const section of requiredSections) {
    const found = section.patterns.some(p => content.includes(p));
    if (!found) {
      errors.push(`GUIDE_MISSING_SECTION: ${section.key}`);
    }
  }

  // Verificar contenido técnico específico
  const hasComandos = content.includes('Comandos') || content.includes('Primer uso') || content.includes('Uso avanzado');
  if (!hasComandos) {
    errors.push('GUIDE_MISSING_COMANDOS_OR_EQUIVALENT');
  }
  if (!content.includes('Referencias oficiales')) {
    errors.push('GUIDE_MISSING_REFERENCIAS');
  }
  if (!content.includes('http')) {
    errors.push('GUIDE_MISSING_URLS');
  }

  // Detectar contenido genérico
  const genericPatterns = [
    /herramienta para seguridad/i,
    /sirve para analizar sistemas/i,
    /permite realizar pruebas/i,
    /software avanzado de auditoria/i,
    /herramienta avanzada/i,
    /utilidad de seguridad/i,
  ];
  for (const pattern of genericPatterns) {
    if (pattern.test(content)) {
      warnings.push(`GUIDE_GENERIC_PATTERN: ${pattern.source}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, checkedFiles };
}

/**
 * Valida estructura de SKILL.md
 */
function validateSkillStructure(content: string, expectedId: string, toolName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedFiles: string[] = [];

  if (!content.includes(expectedId)) {
    errors.push(`SKILL_MISSING_CATALOG_ID: ${expectedId}`);
  }
  if (content.length < 300) {
    errors.push('SKILL_TOO_SHORT');
  }
  if (content.includes('TODO') || content.includes('FIXME') || content.includes('[TODO]') || content.includes('[PENDIENTE]')) {
    errors.push('SKILL_CONTAINS_PLACEHOLDERS');
  }
  if (content.toLowerCase().includes('placeholder')) {
    errors.push('SKILL_CONTAINS_PLACEHOLDER_WORD');
  }

  const requiredSections = [
    '---',
    'name:',
    'description:',
    'Cuándo usar',
    'Entradas mínimas',
    'Procedimiento',
    'Salidas esperadas',
    'Guardrails obligatorios',
    'Evidencia y trazabilidad',
    'Referencias',
  ];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      errors.push(`SKILL_MISSING_SECTION: ${section}`);
    }
  }

  if (!content.includes(toolName)) {
    errors.push('SKILL_MISSING_TOOL_NAME');
  }

  return { valid: errors.length === 0, errors, warnings, checkedFiles };
}

describe('REG-01: Existen las doce herramientas prioritarias', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} (${tool.idCatalogo}) — directorio existe`, () => {
      const toolPath = path.join(ROOT, tool.dir);
      expect(fs.existsSync(toolPath)).toBe(true);
    });
  }
});

describe('REG-02: Cada herramienta tiene el id_catalogo correspondiente a AT-SEC-001..012', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — metadata.json tiene id_catalogo correcto`, () => {
      const metaPath = path.join(ROOT, tool.dir, 'metadata.json');
      expect(fs.existsSync(metaPath)).toBe(true);
      const meta = readJson<MetadataFile>(metaPath);
      const validation = validateCatalogId(meta.id_catalogo, tool.idCatalogo);
      expect(validation.valid).toBe(true);
      if (!validation.valid) {
        console.log('Validation errors:', validation.errors);
      }
    });
  }
});

describe('REG-03: Los IDs de los casos de uso son coherentes con la herramienta', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — casos-uso.json tiene id_catalogo correcto`, () => {
      const casosPath = path.join(ROOT, tool.dir, 'casos-uso.json');
      expect(fs.existsSync(casosPath)).toBe(true);
      const casos = readJson<{ id_catalogo: string }>(casosPath);
      const validation = validateCatalogId(casos.id_catalogo, tool.idCatalogo);
      expect(validation.valid).toBe(true);
    });
  }
});

describe('REG-04: Los IDs de las evidencias son coherentes con la herramienta', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — evidencias.json tiene id_catalogo correcto`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      expect(fs.existsSync(evidenciasPath)).toBe(true);
      const evidencias = readJson<EvidenceFile>(evidenciasPath);
      const validation = validateCatalogId(evidencias.id_catalogo, tool.idCatalogo);
      expect(validation.valid).toBe(true);

      for (const registro of evidencias.registros || []) {
        const recValidation = validateCatalogId(registro.id_catalogo, tool.idCatalogo);
        expect(recValidation.valid).toBe(true);
      }
    });
  }
});

describe('REG-05: No existen marcadores AT-??? en los registros normalizados', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — metadata.json no tiene AT-???`, () => {
      const metaPath = path.join(ROOT, tool.dir, 'metadata.json');
      const meta = readJson<MetadataFile>(metaPath);
      expect(meta.id_catalogo).not.toBe('AT-???');
    });

    it(`${tool.name} — evidencias.json no tiene AT-???`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson<EvidenceFile>(evidenciasPath);
      expect(evidencias.id_catalogo).not.toBe('AT-???');
      for (const registro of evidencias.registros || []) {
        expect(registro.id_catalogo).not.toBe('AT-???');
      }
    });

    it(`${tool.name} — casos-uso.json no tiene AT-???`, () => {
      const casosPath = path.join(ROOT, tool.dir, 'casos-uso.json');
      const casos = readJson<{ id_catalogo: string }>(casosPath);
      expect(casos.id_catalogo).not.toBe('AT-???');
    });
  }
});

describe('REG-06: Las evidencias PASS conservan referencias, artefactos y hashes correctos', () => {
  const passTools = PRIORITY_TOOLS.filter(t => t.hasPassEvidence);

  for (const tool of passTools) {
    it(`${tool.name} — evidencias PASS tienen artefactos, procedencia y hashes válidos`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson<EvidenceFile>(evidenciasPath);

      const passRecords = (evidencias.registros || []).filter(r => r.resultado === 'PASS');
      expect(passRecords.length).toBeGreaterThan(0);

      for (const registro of passRecords) {
        const validation = validateEvidenceRecord(registro, tool.dir, tool.idCatalogo, tool.name);
        if (!validation.valid) {
          console.log(`Validation failed for ${tool.name} ${registro.id}:`, validation.errors);
        }
        expect(validation.valid).toBe(true);
      }
    });
  }
});

describe('REG-07: Los siete registros BLOCKED históricos permanecen inalterados', () => {
  const blockedRecords = [
    { toolDir: '02-catalogo/pruebas-tecnicas/mcp-inspector', evidenceId: 'EV-AT-SEC-004-BLOCKED-01', toolName: 'MCP Inspector', idCatalogo: 'AT-SEC-004' },
    { toolDir: '02-catalogo/pruebas-tecnicas/loom', evidenceId: 'EV-AT-SEC-006-BLOCKED-01', toolName: 'Loom', idCatalogo: 'AT-SEC-006' },
    { toolDir: '02-catalogo/pruebas-tecnicas/dm-flakey', evidenceId: 'EV-AT-SEC-007-BLOCKED-01', toolName: 'dm-flakey', idCatalogo: 'AT-SEC-007' },
    { toolDir: '02-catalogo/pruebas-tecnicas/dm-log-writes', evidenceId: 'EV-AT-SEC-008-BLOCKED-01', toolName: 'dm-log-writes', idCatalogo: 'AT-SEC-008' },
    { toolDir: '02-catalogo/pruebas-tecnicas/miri', evidenceId: 'EV-AT-SEC-010-BLOCKED-01', toolName: 'Miri', idCatalogo: 'AT-SEC-010' },
    { toolDir: '02-catalogo/pruebas-tecnicas/cargo-mutants', evidenceId: 'EV-AT-SEC-011-BLOCKED-01', toolName: 'cargo-mutants', idCatalogo: 'AT-SEC-011' },
    { toolDir: '02-catalogo/pruebas-tecnicas/proptest', evidenceId: 'EV-AT-SEC-012-BLOCKED-01', toolName: 'proptest', idCatalogo: 'AT-SEC-012' },
  ];

  for (const record of blockedRecords) {
    it(`${record.toolName} — evidencia ${record.evidenceId} existe y permanece BLOCKED`, () => {
      const evidenciasPath = path.join(ROOT, record.toolDir, 'evidencias.json');
      expect(fs.existsSync(evidenciasPath)).toBe(true);
      const evidencias = readJson<EvidenceFile>(evidenciasPath);

      const blockedRecord = (evidencias.registros || []).find(r => r.id === record.evidenceId);
      expect(blockedRecord).toBeDefined();

      if (blockedRecord) {
        const validation = validateEvidenceRecord(blockedRecord, record.toolDir, record.idCatalogo, record.toolName);
        expect(validation.valid).toBe(true);
        expect(blockedRecord.resultado).toBe('BLOCKED');
        expect(blockedRecord.resultado).not.toBe('PASS');
        expect(blockedRecord.resultado).not.toBe('FAIL');
        expect(blockedRecord.artefactos).toEqual([]);
        expect(blockedRecord.evidencia).toBeNull();
        expect(blockedRecord.sha256).toBeNull();
      }
    });
  }

  it('No existen evidencias PASS o FAIL para herramientas que solo tienen BLOCKED', () => {
    const blockedOnlyTools = PRIORITY_TOOLS.filter(t => !t.hasPassEvidence && t.blockedEvidenceId);

    for (const tool of blockedOnlyTools) {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson<EvidenceFile>(evidenciasPath);

      const passRecords = (evidencias.registros || []).filter(r => r.resultado === 'PASS');
      const failRecords = (evidencias.registros || []).filter(r => r.resultado === 'FAIL');

      expect(passRecords.length).toBe(0);
      expect(failRecords.length).toBe(0);
    }
  });
});

describe('REG-08: Integridad SHA-256 completa — todos los archivos listados existen y coinciden', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — SHA256SUMS.txt válido y consistente`, () => {
      const validation = validateSha256Manifest(tool.dir, tool.name);
      if (!validation.valid) {
        console.log(`SHA256 validation failed for ${tool.name}:`, validation.errors);
      }
      expect(validation.valid).toBe(true);
    });
  }
});

describe('REG-09: No existen duplicados de las doce identidades prioritarias', () => {
  it('IDs AT-SEC-001..012 son únicos en el catálogo', () => {
    const catalogoPath = path.join(ROOT, 'catalogo.json');
    const catalogo = readJson<CatalogData>(catalogoPath);

    const priorityIds = PRIORITY_TOOLS.map(t => t.idCatalogo);
    const foundIds: string[] = [];

    for (const tool of catalogo.herramientas) {
      const metaPath = path.join(ROOT, path.posix.dirname(tool.href), 'metadata.json');
      if (fs.existsSync(metaPath)) {
        const meta = readJson<MetadataFile>(metaPath);
        if (priorityIds.includes(meta.id_catalogo)) {
          foundIds.push(meta.id_catalogo);
        }
      }
    }

    for (const id of priorityIds) {
      const count = foundIds.filter(f => f === id).length;
      expect(count).toBe(1);
    }
  });
});

describe('REG-10: Se preservan los conteos y referencias del inventario', () => {
  it('Catálogo mantiene 49 categorías, 2137 herramientas, 741 excluidas', () => {
    const catalogoPath = path.join(ROOT, 'catalogo.json');
    const catalogo = readJson<CatalogData>(catalogoPath);

    expect(catalogo.categorias.length).toBe(49);

    const totalAdmitidas = catalogo.categorias.reduce((sum: number, c: CatalogCategory) => sum + c.admitidas, 0);
    const totalExcluidas = catalogo.categorias.reduce((sum: number, c: CatalogCategory) => sum + c.excluidas, 0);
    const totalEntradas = catalogo.categorias.reduce((sum: number, c: CatalogCategory) => sum + c.entradas, 0);

    expect(totalAdmitidas).toBe(2137);
    expect(totalExcluidas).toBe(741);
    expect(totalEntradas).toBe(2878);
    expect(catalogo.herramientas.length).toBe(2137);
  });
});

describe('REG-11: Guías y skills especializados — comprobaciones estructurales con validadores compartidos', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — GUIA.md pasa validación estructural`, () => {
      const guiaPath = path.join(ROOT, tool.dir, 'GUIA.md');
      expect(fs.existsSync(guiaPath)).toBe(true);

      const content = fs.readFileSync(guiaPath, 'utf-8');
      const validation = validateGuideStructure(content, tool.idCatalogo);

      if (!validation.valid) {
        console.log(`Guide validation failed for ${tool.name}:`, validation.errors);
      }
      expect(validation.valid).toBe(true);
    });

    it(`${tool.name} — SKILL.md pasa validación estructural`, () => {
      const skillPath = path.join(ROOT, tool.dir, 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);

      const content = fs.readFileSync(skillPath, 'utf-8');
      const validation = validateSkillStructure(content, tool.idCatalogo, tool.name);

      if (!validation.valid) {
        console.log(`Skill validation failed for ${tool.name}:`, validation.errors);
      }
      expect(validation.valid).toBe(true);
    });
  }
});

describe('REG-12: Enlaces a artefactos de evidencia PASS existen y hashes coinciden', () => {
  const passTools = PRIORITY_TOOLS.filter(t => t.hasPassEvidence);

  for (const tool of passTools) {
    it(`${tool.name} — artefactos de evidencia PASS existen y hashes son correctos`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson<EvidenceFile>(evidenciasPath);

      for (const registro of evidencias.registros || []) {
        if (registro.resultado === 'PASS') {
          // REG-12 requiere que TODA evidencia PASS tenga destRel
          expect(registro.evidencia?.destRel).toBeDefined();
          expect(registro.evidencia?.destRel).not.toBe('');

          const artifactPath = resolveSafe(ROOT, registro.evidencia!.destRel);
          expect(fs.existsSync(artifactPath)).toBe(true);

          const actualHash = sha256(artifactPath);
          expect(actualHash).toBe(registro.evidencia!.sha256);

          const sumsPath = path.join(ROOT, tool.dir, 'SHA256SUMS.txt');
          const sumsContent = fs.readFileSync(sumsPath, 'utf-8');
          const toolDir = path.join(ROOT, tool.dir);
          const relativePath = path.relative(toolDir, artifactPath);
          const expectedLine = `${actualHash}  ${relativePath}`;
          expect(sumsContent).toContain(expectedLine);
        }
      }
    });
  }
});

/**
 * FIXTURES NEGATIVAS REALES - usan los mismos validadores que las pruebas reales
 */
describe('REG-13: Pruebas negativas — el validador detecta defectos reales', () => {
  let tempDir: string;

  beforeAll(() => {
    // Usar directorio temporal seguro y aislado
    tempDir = mkdtempSync(path.join(process.cwd(), 'tests-unit-negative-'));
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // NEG-01 — Identificador incorrecto
  it('NEG-01: detecta ID de catálogo incorrecto', () => {
    const badMeta = { id_catalogo: 'AT-SEC-999' };
    const validation = validateCatalogId(badMeta.id_catalogo, 'AT-SEC-001');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('INVALID_CATALOG_ID_FORMAT: AT-SEC-999');
  });

  // NEG-02 — Evidencia BLOCKED convertida a PASS
  it('NEG-02: detecta registro BLOCKED histórico convertido a PASS', () => {
    const blockedRecord: EvidenceRecord = {
      id: 'EV-AT-SEC-004-BLOCKED-01',
      herramienta: 'MCP Inspector',
      id_catalogo: 'AT-SEC-004',
      resultado: 'PASS', // ¡Incorrecto! Debería ser BLOCKED
      evidencia: null,
      procedencia: null,
      artefactos: [],
      sha256: null,
    };

    const validation = validateEvidenceRecord(blockedRecord, '02-catalogo/pruebas-tecnicas/mcp-inspector', 'AT-SEC-004', 'MCP Inspector');
    expect(validation.valid).toBe(false);
    // The validator detects PASS records that have BLOCKED characteristics
    expect(validation.errors.some(e => e.includes('PASS_RECORD_HAS_BLOCKED_CHARACTERISTICS'))).toBe(true);
  });

  // NEG-03 — Evidencia PASS sin artefacto
  it('NEG-03: detecta evidencia PASS sin artefacto', () => {
    const record: EvidenceRecord = {
      id: 'EV-TEST-001',
      herramienta: 'Test Tool',
      id_catalogo: 'AT-SEC-001',
      resultado: 'PASS',
      evidencia: { sha256: 'a'.repeat(64), destRel: 'evidencias/test.json' },
      procedencia: { repositorio: 'test-repo' },
      artefactos: [],
      sha256: 'a'.repeat(64),
    };

    const validation = validateEvidenceRecord(record, '02-catalogo/testing-y-auditoria/semgrep', 'AT-SEC-001', 'Semgrep');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('MISSING_ARTIFACTS');
  });

  // NEG-04 — SHA-256 incorrecto
  it('NEG-04: detecta evidencia con hash incorrecto', () => {
    // Create artifact in the correct location relative to ROOT
    const artifactDir = path.join(ROOT, 'tests', 'unit', 'fixtures', 'negative', 'test-tool');
    fs.mkdirSync(artifactDir, { recursive: true });
    const artifactPath = path.join(artifactDir, 'artifact.json');
    fs.writeFileSync(artifactPath, '{"test": "data"}');

    const record: EvidenceRecord = {
      id: 'EV-TEST-002',
      herramienta: 'Test Tool',
      id_catalogo: 'AT-SEC-001',
      resultado: 'PASS',
      evidencia: { sha256: 'b'.repeat(64), destRel: 'tests/unit/fixtures/negative/test-tool/artifact.json' },
      procedencia: { repositorio: 'test-repo' },
      artefactos: [{ sha256: 'b'.repeat(64) }],
      sha256: 'b'.repeat(64),
    };

    const validation = validateEvidenceRecord(record, '02-catalogo/testing-y-auditoria/semgrep', 'AT-SEC-001', 'Semgrep');
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('EVIDENCE_HASH_MISMATCH'))).toBe(true);
  });

  // NEG-05 — Archivo inexistente en manifiesto
  it('NEG-05: detecta archivo listado en SHA256SUMS inexistente', () => {
    const toolDir = path.join(tempDir, 'test-tool-missing');
    fs.mkdirSync(toolDir, { recursive: true });
    const sumsPath = path.join(toolDir, 'SHA256SUMS.txt');
    fs.writeFileSync(sumsPath, 'a'.repeat(64) + '  missing-file.json\n');

    const validation = validateSha256Manifest(path.relative(ROOT, toolDir), 'test-tool');
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('MANIFEST_FILE_MISSING'))).toBe(true);
  });

  // NEG-06 — Path traversal
  it('NEG-06: detecta ruta que intenta escapar del directorio permitido', () => {
    const baseDir = path.join(tempDir, 'safe-tool');
    fs.mkdirSync(baseDir, { recursive: true });

    expect(() => resolveSafe(baseDir, '../outside.txt')).toThrow('Path traversal');
    expect(() => resolveSafe(baseDir, '../../etc/passwd')).toThrow('Path traversal');

    // Verificar también enlaces simbólicos
    const symlinkPath = path.join(baseDir, 'symlink');
    fs.symlinkSync('/etc', symlinkPath);
    expect(() => resolveSafe(baseDir, 'symlink/passwd')).toThrow('Path traversal');
  });

  // NEG-07 — Guía genérica
  it('NEG-07: rechaza guía genérica sin contenido técnico', () => {
    const genericGuide = `# Herramienta X\n\n**ID de catálogo:** AT-SEC-001\n**Categoría Atlas:** Test\n\n## Introducción\n\nHerramienta para seguridad que permite realizar pruebas. Es una utilidad avanzada para auditoría de sistemas.\n\n## Instalación\n\nInstalar con gestor de paquetes. Usar el método estándar.\n\n## Referencias\n\nhttps://example.com\n`;

    const validation = validateGuideStructure(genericGuide, 'AT-SEC-001');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('GUIDE_MISSING_SECTION: Configuración');
    expect(validation.errors).toContain('GUIDE_MISSING_SECTION: Primer uso');
    expect(validation.errors).toContain('GUIDE_MISSING_SECTION: Limitaciones');
    expect(validation.errors).toContain('GUIDE_MISSING_SECTION: Advertencias');
    expect(validation.warnings.some(w => w.includes('GENERIC_PATTERN'))).toBe(true);
  });

  // NEG-08 — Skill con placeholders
  it('NEG-08: rechaza skill con placeholders', () => {
    const genericSkill = `---\nname: atlas-test\ndescription: Test skill\n---\n\n# Test\n\n## Cuándo usar\n\n- [TODO] Condición\n\n## Procedimiento\n\n1. [PENDIENTE] Paso\n\n## Guardrails\n\n- No hacer cosas malas\n`;

    const validation = validateSkillStructure(genericSkill, 'AT-SEC-001', 'Test Tool');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('SKILL_CONTAINS_PLACEHOLDERS');
  });

  // NEG-09 — Manifiesto duplicado
  it('NEG-09: detecta entrada duplicada en SHA256SUMS', () => {
    const toolDir = path.join(tempDir, 'duplicate-tool');
    fs.mkdirSync(toolDir, { recursive: true });
    const sumsPath = path.join(toolDir, 'SHA256SUMS.txt');
    const hash = 'a'.repeat(64);
    fs.writeFileSync(sumsPath, `${hash}  duplicate.json\n${hash}  duplicate.json\n`);

    const validation = validateSha256Manifest(path.relative(ROOT, toolDir), 'test-tool');
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('DUPLICATE_MANIFEST_ENTRY'))).toBe(true);
  });

  // NEG-10 — Hash malformado
  it('NEG-10: detecta SHA-256 malformado en manifiesto', () => {
    const toolDir = path.join(tempDir, 'bad-hash-tool');
    fs.mkdirSync(toolDir, { recursive: true });
    const sumsPath = path.join(toolDir, 'SHA256SUMS.txt');
    fs.writeFileSync(sumsPath, 'not-a-valid-hash  file.json\n');

    const validation = validateSha256Manifest(path.relative(ROOT, toolDir), 'test-tool');
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('INVALID_SHA256_IN_MANIFEST'))).toBe(true);
  });
});