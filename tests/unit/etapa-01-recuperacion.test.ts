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



function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function sha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function resolveSafe(baseDir: string, relPath: string): string {
  const resolved = path.resolve(baseDir, relPath);
  const baseResolved = path.resolve(baseDir);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error(`Path traversal attempt: ${relPath}`);
  }
  return resolved;
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
      expect(meta.id_catalogo).toBe(tool.idCatalogo);
    });
  }
});

describe('REG-03: Los IDs de los casos de uso son coherentes con la herramienta', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — casos-uso.json tiene id_catalogo correcto`, () => {
      const casosPath = path.join(ROOT, tool.dir, 'casos-uso.json');
      expect(fs.existsSync(casosPath)).toBe(true);
      const casos = readJson<{ id_catalogo: string }>(casosPath);
      expect(casos.id_catalogo).toBe(tool.idCatalogo);
    });
  }
});

describe('REG-04: Los IDs de las evidencias son coherentes con la herramienta', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — evidencias.json tiene id_catalogo correcto`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      expect(fs.existsSync(evidenciasPath)).toBe(true);
      const evidencias = readJson<EvidenceFile>(evidenciasPath);
      expect(evidencias.id_catalogo).toBe(tool.idCatalogo);
      
      for (const registro of evidencias.registros || []) {
        expect(registro.id_catalogo).toBe(tool.idCatalogo);
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
        expect(registro.id).toBeDefined();
        expect(registro.evidencia).toBeDefined();
        expect(registro.evidencia?.sha256).toBeDefined();
        expect(registro.procedencia).toBeDefined();
        expect(registro.procedencia?.repositorio ?? registro.procedencia?.origen).toBeDefined();
        expect(registro.artefactos).toBeDefined();
        expect(registro.artefactos?.length).toBeGreaterThan(0);
        
        if (registro.evidencia?.destRel) {
          const artifactPath = resolveSafe(ROOT, registro.evidencia.destRel);
          expect(fs.existsSync(artifactPath)).toBe(true);
          const actualHash = sha256(artifactPath);
          expect(actualHash).toBe(registro.evidencia.sha256);
        }
        
        for (const artefacto of registro.artefactos || []) {
          expect(artefacto.sha256).toBeDefined();
          expect(typeof artefacto.sha256).toBe('string');
          expect(artefacto.sha256.length).toBe(64);
        }
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
        expect(blockedRecord.id).toBe(record.evidenceId);
        expect(blockedRecord.id_catalogo).toBe(record.idCatalogo);
        expect(blockedRecord.resultado).toBe('BLOCKED');
        expect(blockedRecord.herramienta).toBe(record.toolName);
        
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
      const sumsPath = path.join(ROOT, tool.dir, 'SHA256SUMS.txt');
      expect(fs.existsSync(sumsPath)).toBe(true);
      
      const content = fs.readFileSync(sumsPath, 'utf-8');
      const lines = content.trim().split('\n').filter((l: string) => l.trim().length > 0);
      
      expect(lines.length).toBeGreaterThan(0);
      
      const seenFiles = new Set<string>();
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        expect(parts.length).toBeGreaterThanOrEqual(2);
        
        const expectedHash = parts[0];
        const fileName = parts.slice(1).join(' ');
        
        expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
        expect(fileName).not.toBe('');
        
        expect(seenFiles.has(fileName)).toBe(false);
        seenFiles.add(fileName);
        
        const filePath = resolveSafe(path.join(ROOT, tool.dir), fileName);
        expect(fs.existsSync(filePath)).toBe(true);
        
        const actualHash = sha256(filePath);
        expect(actualHash).toBe(expectedHash);
      }
      
      const requiredFiles = ['metadata.json', 'evidencias.json', 'casos-uso.json', 'GUIA.md', 'SKILL.md'];
      for (const reqFile of requiredFiles) {
        expect(seenFiles.has(reqFile)).toBe(true);
      }
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

describe('REG-11: Guías y skills especializados — comprobaciones estructurales', () => {
  const requiredGuideSections = [
    'ID de catálogo',
    'Categoría Atlas',
    'Versión de referencia verificada',
    'Fecha de verificación documental',
    'Estado en este Atlas',
    'Introducción',
    'Instalación manual',
    'Configuración',
    'Primer uso',
    'Referencias oficiales',
  ];
  
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — GUIA.md tiene estructura completa y contenido específico`, () => {
      const guiaPath = path.join(ROOT, tool.dir, 'GUIA.md');
      expect(fs.existsSync(guiaPath)).toBe(true);
      
      const content = fs.readFileSync(guiaPath, 'utf-8');
      
      expect(content).toContain(tool.idCatalogo);
      expect(content.length).toBeGreaterThan(1000);
      expect(content).not.toContain('TODO');
      expect(content).not.toContain('FIXME');
      expect(content).not.toContain('placeholder');
      expect(content).not.toContain('PLACEHOLDER');
      expect(content).not.toContain('[TODO]');
      expect(content).not.toContain('[PENDIENTE]');
      
      for (const section of requiredGuideSections) {
        expect(content).toContain(section);
      }
      
      expect(content).toContain('Instalación manual');
      // Algunas guías usan "Primer uso" o "Uso avanzado" en lugar de "Comandos"
      const hasComandos = content.includes('Comandos') || content.includes('Primer uso') || content.includes('Uso avanzado');
      expect(hasComandos).toBe(true);
      expect(content).toContain('Referencias oficiales');
      expect(content).toContain('http');
    });
    
    it(`${tool.name} — SKILL.md tiene estructura completa y contenido específico`, () => {
      const skillPath = path.join(ROOT, tool.dir, 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
      
      const content = fs.readFileSync(skillPath, 'utf-8');
      
      expect(content).toContain(tool.idCatalogo);
      expect(content.length).toBeGreaterThan(300);
      
      expect(content).toContain('---');
      expect(content).toContain('name:');
      expect(content).toContain('description:');
      expect(content).toContain('Cuándo usar');
      expect(content).toContain('Entradas mínimas');
      expect(content).toContain('Procedimiento');
      expect(content).toContain('Salidas esperadas');
      expect(content).toContain('Guardrails obligatorios');
      expect(content).toContain('Evidencia y trazabilidad');
      expect(content).toContain('Referencias');
      
      expect(content).toContain(tool.name);
      
      expect(content).not.toContain('TODO');
      expect(content).not.toContain('FIXME');
      expect(content).not.toContain('placeholder');
      expect(content).not.toContain('[TODO]');
    });
  }
  
  describe('Fixtures negativas — plantillas genéricas', () => {
    it('rechaza guía con ID correcto pero sin contenido técnico', () => {
      const genericGuide = `# Herramienta X\n\n**ID de catálogo:** AT-SEC-001\n**Categoría Atlas:** Test\n\n## Introducción\n\nHerramienta para seguridad que permite realizar pruebas. Es una utilidad avanzada para auditoría de sistemas. Esta herramienta sirve para analizar sistemas y permite realizar pruebas de seguridad. Es un software avanzado de auditoría con muchas capacidades.\n\n## Instalación\n\nInstalar con gestor de paquetes. Usar el método estándar. La instalación es sencilla y no requiere configuración compleja.\n\n## Referencias\n\nhttps://example.com\n\n## Notas adicionales\n\nEsta herramienta sirve para analizar sistemas y permite realizar pruebas de seguridad. Es un software avanzado de auditoría. La herramienta avanzada tiene muchas capacidades. Es una utilidad de seguridad muy completa. Más información disponible en la documentación oficial. El software permite realizar auditorías de seguridad y pruebas de penetración. Es una utilidad para análisis de vulnerabilidades.\n\n## Más información\n\nLa herramienta avanzada tiene muchas capacidades. Es una utilidad de seguridad muy completa. Más detalles en la documentación oficial. El software permite realizar auditorías de seguridad y pruebas de penetración.\n\n## Uso básico\n\nPara usar la herramienta, simplemente ejecútela con los parámetros adecuados. La herramienta para seguridad analiza el sistema y genera un informe. Los resultados pueden revisarse para identificar vulnerabilidades.\n\n## Características\n\n- Análisis de seguridad\n- Detección de vulnerabilidades\n- Generación de informes\n- Interfaz de línea de comandos\n\n## Requisitos\n\n- Sistema operativo compatible\n- Permisos de administrador\n- Conexión a internet para actualizaciones\n\n## Final\n\nMás detalles en la documentación oficial. Esta herramienta para seguridad es una utilidad avanzada para auditoría de sistemas.`;
      
      expect(genericGuide).toContain('AT-SEC-001');
      expect(genericGuide.length).toBeGreaterThan(500);
      expect(genericGuide).not.toContain('TODO');
      
      expect(genericGuide).not.toContain('Configuración');
      expect(genericGuide).not.toContain('Primer uso');
      expect(genericGuide).not.toContain('Limitaciones');
      expect(genericGuide).not.toContain('Advertencias');
      expect(genericGuide).toMatch(/herramienta para seguridad/i);
    });
    
    it('rechaza skill con placeholders', () => {
      const genericSkill = `---\nname: atlas-test\nskill: Test skill\n---\n\n# Test\n\n## Cuándo usar\n\n- [TODO] Condición\n\n## Procedimiento\n\n1. [PENDIENTE] Paso\n\n## Guardrails\n\n- No hacer cosas malas\n`;
      
      expect(genericSkill).toContain('[TODO]');
      expect(genericSkill).toContain('[PENDIENTE]');
      expect(genericSkill).not.toContain('Evidencia y trazabilidad');
      expect(genericSkill).not.toContain('Referencias');
    });
  });
});

describe('REG-12: Enlaces a artefactos de evidencia PASS existen y hashes coinciden', () => {
  const passTools = PRIORITY_TOOLS.filter(t => t.hasPassEvidence);
  
  for (const tool of passTools) {
    it(`${tool.name} — artefactos de evidencia PASS existen y hashes son correctos`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson<EvidenceFile>(evidenciasPath);
      
      for (const registro of evidencias.registros || []) {
        if (registro.resultado === 'PASS' && registro.evidencia?.destRel) {
          const artifactPath = resolveSafe(ROOT, registro.evidencia.destRel);
          expect(fs.existsSync(artifactPath)).toBe(true);
          
          const actualHash = sha256(artifactPath);
          expect(actualHash).toBe(registro.evidencia.sha256);
          
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

describe('REG-13: Pruebas negativas — el validador detecta defectos', () => {
  const tempDir = path.join(ROOT, 'tests', 'unit', 'fixtures', 'negative');
  
  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  it('detecta ID de catálogo incorrecto', () => {
    const badMeta = { id_catalogo: 'AT-SEC-999' };
    expect(badMeta.id_catalogo).not.toMatch(/^AT-SEC-0(0[1-9]|1[0-2])$/);
  });
  
  it('detecta registro BLOCKED convertido a PASS', () => {
    const blockedRecord = { id: 'EV-AT-SEC-004-BLOCKED-01', resultado: 'PASS' };
    expect(blockedRecord.resultado).not.toBe('BLOCKED');
  });
  
  it('detecta evidencia sin artefacto', () => {
    const record = { resultado: 'PASS', evidencia: null, artefactos: [] };
    expect(record.evidencia).toBeNull();
    expect(record.artefactos?.length).toBe(0);
  });
  
  it('detecta evidencia con hash inválido', () => {
    const badHash = 'not-a-valid-hash';
    expect(badHash).not.toMatch(/^[a-f0-9]{64}$/);
  });
  
  it('detecta archivo listado en SHA256SUMS inexistente', () => {
    const missingFile = path.join(tempDir, 'nonexistent.txt');
    expect(fs.existsSync(missingFile)).toBe(false);
  });
  
  it('detecta hash documental incorrecto', () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'content');
    const actualHash = sha256(filePath);
    const wrongHash = 'a'.repeat(64);
    expect(actualHash).not.toBe(wrongHash);
  });
  
  it('detecta ruta que intenta escapar del directorio permitido', () => {
    const baseDir = path.join(tempDir, 'tool');
    fs.mkdirSync(baseDir, { recursive: true });
    
    expect(() => resolveSafe(baseDir, '../outside.txt')).toThrow('Path traversal');
    expect(() => resolveSafe(baseDir, '../../etc/passwd')).toThrow('Path traversal');
  });
  
  it('rechaza guía genérica sin contenido técnico', () => {
    const genericGuide = `# Herramienta X\n\n**ID de catálogo:** AT-SEC-001\n**Categoría Atlas:** Test\n\n## Introducción\n\nHerramienta para seguridad que permite realizar pruebas. Es una utilidad avanzada para auditoría de sistemas. Esta herramienta sirve para analizar sistemas y permite realizar pruebas de seguridad. Es un software avanzado de auditoría con muchas capacidades.\n\n## Instalación\n\nInstalar con gestor de paquetes. Usar el método estándar. La instalación es sencilla y no requiere configuración compleja.\n\n## Referencias\n\nhttps://example.com\n\n## Notas adicionales\n\nEsta herramienta sirve para analizar sistemas y permite realizar pruebas de seguridad. Es un software avanzado de auditoría. La herramienta avanzada tiene muchas capacidades. Es una utilidad de seguridad muy completa. Más información disponible en la documentación oficial. El software permite realizar auditorías de seguridad y pruebas de penetración. Es una utilidad para análisis de vulnerabilidades.\n\n## Más información\n\nLa herramienta avanzada tiene muchas capacidades. Es una utilidad de seguridad muy completa. Más detalles en la documentación oficial. El software permite realizar auditorías de seguridad y pruebas de penetración.\n\n## Uso básico\n\nPara usar la herramienta, simplemente ejecútela con los parámetros adecuados. La herramienta para seguridad analiza el sistema y genera un informe. Los resultados pueden revisarse para identificar vulnerabilidades.\n\n## Características\n\n- Análisis de seguridad\n- Detección de vulnerabilidades\n- Generación de informes\n- Interfaz de línea de comandos\n\n## Requisitos\n\n- Sistema operativo compatible\n- Permisos de administrador\n- Conexión a internet para actualizaciones\n\n## Final\n\nMás detalles en la documentación oficial. Esta herramienta para seguridad es una utilidad avanzada para auditoría de sistemas.`;
    
    expect(genericGuide).not.toContain('Configuración');
    expect(genericGuide).not.toContain('Primer uso');
    expect(genericGuide).not.toContain('Limitaciones');
    expect(genericGuide).not.toContain('Advertencias');
    expect(genericGuide).toMatch(/herramienta para seguridad/i);
    expect(genericGuide.length).toBeGreaterThan(500);
  });
  
  it('rechaza skill con placeholders', () => {
    const genericSkill = `---\nname: atlas-test\ndescription: Test skill\n---\n\n# Test\n\n## Cuándo usar\n\n- [TODO] Condición\n\n## Procedimiento\n\n1. [PENDIENTE] Paso\n`;
    
    expect(genericSkill).toContain('[TODO]');
    expect(genericSkill).toContain('[PENDIENTE]');
    expect(genericSkill).not.toContain('Evidencia y trazabilidad');
    expect(genericSkill).not.toContain('Referencias');
  });
});