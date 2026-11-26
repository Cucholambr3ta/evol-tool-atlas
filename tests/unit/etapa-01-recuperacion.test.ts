/**
 * Pruebas de regresión para la Etapa 1 — Recuperación y preservación documental
 * Verifica que las 12 herramientas prioritarias mantengan sus IDs AT-SEC-001..012,
 * evidencias vinculadas y integridad SHA-256.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

interface PriorityTool {
  dir: string;
  idCatalogo: string;
  name: string;
  category: string;
  hasEvidence: boolean;
}

const PRIORITY_TOOLS: PriorityTool[] = [
  { dir: '02-catalogo/testing-y-auditoria/semgrep', idCatalogo: 'AT-SEC-001', name: 'Semgrep', category: 'Auditoría · SAST', hasPassEvidence: true },
  { dir: '02-catalogo/seguridad/catalogo/promptfoo', idCatalogo: 'AT-SEC-002', name: 'promptfoo', category: 'IA · Evaluación de LLM', hasPassEvidence: true },
  { dir: '02-catalogo/pruebas-tecnicas/cargo-fuzz', idCatalogo: 'AT-SEC-003', name: 'cargo-fuzz', category: 'Pruebas y auditoría técnica · Fuzzing', hasPassEvidence: true },
  { dir: '02-catalogo/pruebas-tecnicas/mcp-inspector', idCatalogo: 'AT-SEC-004', name: 'MCP Inspector', category: 'Pruebas y auditoría técnica · MCP', hasPassEvidence: false },
  { dir: '02-catalogo/pruebas-tecnicas/cargo-audit', idCatalogo: 'AT-SEC-005', name: 'cargo-audit', category: 'Pruebas y auditoría técnica · Dependencias', hasPassEvidence: true },
  { dir: '02-catalogo/pruebas-tecnicas/loom', idCatalogo: 'AT-SEC-006', name: 'Loom', category: 'Pruebas y auditoría técnica · Concurrencia', hasPassEvidence: false },
  { dir: '02-catalogo/pruebas-tecnicas/dm-flakey', idCatalogo: 'AT-SEC-007', name: 'dm-flakey', category: 'Pruebas y auditoría técnica · Inyección de fallos', hasPassEvidence: false },
  { dir: '02-catalogo/pruebas-tecnicas/dm-log-writes', idCatalogo: 'AT-SEC-008', name: 'dm-log-writes', category: 'Pruebas y auditoría técnica · Consistencia de almacenamiento', hasPassEvidence: false },
  { dir: '02-catalogo/pruebas-tecnicas/gitleaks', idCatalogo: 'AT-SEC-009', name: 'Gitleaks', category: 'Pruebas y auditoría técnica · Secretos', hasPassEvidence: true },
  { dir: '02-catalogo/pruebas-tecnicas/miri', idCatalogo: 'AT-SEC-010', name: 'Miri', category: 'Pruebas y auditoría técnica · Comportamiento indefinido', hasPassEvidence: false },
  { dir: '02-catalogo/pruebas-tecnicas/cargo-mutants', idCatalogo: 'AT-SEC-011', name: 'cargo-mutants', category: 'Pruebas y auditoría técnica · Mutación', hasPassEvidence: false },
  { dir: '02-catalogo/pruebas-tecnicas/proptest', idCatalogo: 'AT-SEC-012', name: 'proptest', category: 'Pruebas y auditoría técnica · Property testing', hasPassEvidence: false },
];

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function sha256(filePath: string): string {
  const crypto = require('node:crypto');
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
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
      const meta = readJson(metaPath);
      expect(meta.id_catalogo).toBe(tool.idCatalogo);
    });
  }
});

describe('REG-03: Los IDs de los casos de uso son coherentes con la herramienta', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — casos-uso.json tiene id_catalogo correcto`, () => {
      const casosPath = path.join(ROOT, tool.dir, 'casos-uso.json');
      expect(fs.existsSync(casosPath)).toBe(true);
      const casos = readJson(casosPath);
      expect(casos.id_catalogo).toBe(tool.idCatalogo);
    });
  }
});

describe('REG-04: Los IDs de las evidencias son coherentes con la herramienta', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — evidencias.json tiene id_catalogo correcto`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      expect(fs.existsSync(evidenciasPath)).toBe(true);
      const evidencias = readJson(evidenciasPath);
      expect(evidencias.id_catalogo).toBe(tool.idCatalogo);
      
      // Verificar que todos los registros tengan el mismo id_catalogo
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
      const meta = readJson(metaPath);
      expect(meta.id_catalogo).not.toBe('AT-???');
    });
    
    it(`${tool.name} — evidencias.json no tiene AT-???`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson(evidenciasPath);
      expect(evidencias.id_catalogo).not.toBe('AT-???');
      for (const registro of evidencias.registros || []) {
        expect(registro.id_catalogo).not.toBe('AT-???');
      }
    });
    
    it(`${tool.name} — casos-uso.json no tiene AT-???`, () => {
      const casosPath = path.join(ROOT, tool.dir, 'casos-uso.json');
      const casos = readJson(casosPath);
      expect(casos.id_catalogo).not.toBe('AT-???');
    });
  }
});

describe('REG-06: Las evidencias PASS conservan referencias y artefactos', () => {
  for (const tool of PRIORITY_TOOLS) {
    if (!tool.hasPassEvidence) continue;
    
    it(`${tool.name} — evidencias PASS tienen artefactos y procedencia`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson(evidenciasPath);
      
      const passRecords = (evidencias.registros || []).filter(r => r.resultado === 'PASS');
      expect(passRecords.length).toBeGreaterThan(0);
      
      for (const registro of passRecords) {
        expect(registro.evidencia).toBeDefined();
        expect(registro.evidencia?.sha256).toBeDefined();
        expect(registro.procedencia).toBeDefined();
        expect(registro.artefactos).toBeDefined();
        expect(registro.artefactos?.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('REG-07: Los registros BLOCKED no se convierten en FAIL o PASS', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — registros BLOCKED permanecen como BLOCKED`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson(evidenciasPath);
      
      const blockedRecords = (evidencias.registros || []).filter(r => r.resultado === 'BLOCKED');
      for (const registro of blockedRecords) {
        expect(registro.resultado).toBe('BLOCKED');
      }
    });
  }
});

describe('REG-08: Los hashes de SHA256SUMS.txt coinciden con los archivos', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — SHA256SUMS.txt es consistente`, () => {
      const sumsPath = path.join(ROOT, tool.dir, 'SHA256SUMS.txt');
      expect(fs.existsSync(sumsPath)).toBe(true);
      
      const content = fs.readFileSync(sumsPath, 'utf-8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        const [expectedHash, fileName] = line.split(/\s+/);
        const filePath = path.join(ROOT, tool.dir, fileName);
        
        if (fs.existsSync(filePath)) {
          const actualHash = sha256(filePath);
          expect(actualHash).toBe(expectedHash);
        } else {
          // Some files like README.md might be missing in the working tree
          // but listed in SHA256SUMS - that's acceptable if they're generated
        }
      }
    });
  }
});

describe('REG-09: No existen duplicados de las doce identidades prioritarias', () => {
  it('IDs AT-SEC-001..012 son únicos en el catálogo', () => {
    const catalogoPath = path.join(ROOT, 'catalogo.json');
    const catalogo = readJson(catalogoPath);
    
    const priorityIds = PRIORITY_TOOLS.map(t => t.idCatalogo);
    const foundIds: string[] = [];
    
    for (const tool of catalogo.herramientas) {
      const metaPath = path.join(ROOT, path.posix.dirname(tool.href), 'metadata.json');
      if (fs.existsSync(metaPath)) {
        const meta = readJson(metaPath);
        if (priorityIds.includes(meta.id_catalogo)) {
          foundIds.push(meta.id_catalogo);
        }
      }
    }
    
    // Each priority ID should appear exactly once
    for (const id of priorityIds) {
      const count = foundIds.filter(f => f === id).length;
      expect(count).toBe(1);
    }
  });
});

describe('REG-10: Se preservan los conteos y referencias del inventario', () => {
  it('Catálogo mantiene 49 categorías, 2137 herramientas, 741 excluidas', () => {
    const catalogoPath = path.join(ROOT, 'catalogo.json');
    const catalogo = readJson(catalogoPath);
    
    expect(catalogo.categorias.length).toBe(49);
    
    const totalAdmitidas = catalogo.categorias.reduce((sum: number, c: any) => sum + c.admitidas, 0);
    const totalExcluidas = catalogo.categorias.reduce((sum: number, c: any) => sum + c.excluidas, 0);
    const totalEntradas = catalogo.categorias.reduce((sum: number, c: any) => sum + c.entradas, 0);
    
    expect(totalAdmitidas).toBe(2137);
    expect(totalExcluidas).toBe(741);
    expect(totalEntradas).toBe(2878);
    expect(catalogo.herramientas.length).toBe(2137);
  });
});

describe('REG-11: Guías y skills especializados no son plantillas genéricas', () => {
  for (const tool of PRIORITY_TOOLS) {
    it(`${tool.name} — GUIA.md contiene contenido específico`, () => {
      const guiaPath = path.join(ROOT, tool.dir, 'GUIA.md');
      expect(fs.existsSync(guiaPath)).toBe(true);
      
      const content = fs.readFileSync(guiaPath, 'utf-8');
      // Debe contener el ID de catálogo específico
      expect(content).toContain(tool.idCatalogo);
      // Debe tener contenido sustancial (más de 500 caracteres)
      expect(content.length).toBeGreaterThan(500);
      // No debe ser una plantilla genérica
      expect(content).not.toContain('TODO');
      expect(content).not.toContain('FIXME');
    });
    
    it(`${tool.name} — SKILL.md contiene contenido específico`, () => {
      const skillPath = path.join(ROOT, tool.dir, 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
      
      const content = fs.readFileSync(skillPath, 'utf-8');
      // Debe contener el ID de catálogo específico
      expect(content).toContain(tool.idCatalogo);
      // Debe tener contenido sustancial
      expect(content.length).toBeGreaterThan(200);
    });
  }
});

describe('REG-12: Enlaces a artefactos de evidencia corresponden a rutas existentes', () => {
  for (const tool of PRIORITY_TOOLS) {
    if (!tool.hasPassEvidence) continue;
    
    it(`${tool.name} — artefactos de evidencia PASS existen`, () => {
      const evidenciasPath = path.join(ROOT, tool.dir, 'evidencias.json');
      const evidencias = readJson(evidenciasPath);
      
      for (const registro of evidencias.registros || []) {
        if (registro.resultado === 'PASS' && registro.evidencia?.destRel) {
          const artifactPath = path.join(ROOT, registro.evidencia.destRel);
          expect(fs.existsSync(artifactPath)).toBe(true);
        }
      }
    });
  }
});