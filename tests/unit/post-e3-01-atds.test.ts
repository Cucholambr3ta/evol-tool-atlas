/**
 * Estabilización post-E3-01 — motor ATDS (ATDS-ROB-01/02, ATDS-11..15, ATDS-L3-01).
 *
 * Importa los módulos de producción y los ejecuta sobre fixtures escritas en
 * os.tmpdir. El catálogo real solo se lee.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkEvidenceContent, commandScope, isVersionOnlyCommand } from '../../scripts/lib/atds/evidence.mjs';
import { evaluateTool, evaluateToolSafe } from '../../scripts/lib/atds/evaluate.mjs';
import type { CatalogTool } from '../../scripts/lib/atds/evaluate.mjs';
import { writeFixtureTool } from '../../scripts/atds-fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'scripts', 'validate-atds.mjs');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

let tmp = '';
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atds-post-e3-01-'));
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

type Json = Record<string, unknown>;
let n = 0;

/** A fixture L4 tool built in tmp; `mutate` edits evidencias.json (and may write extra files). */
async function buildL4(mutate: (doc: Json, root: string, toolDir: string) => void = () => {}) {
  const { CLI_GUIDE } = await import('../../scripts/atds-fixtures.mjs');
  const root = path.join(tmp, `l4-${++n}`);
  const tool = writeFixtureTool(root, { id: `fx-l4-${n}`, expected: 'L4', guide: CLI_GUIDE, skill: true, cases: true, evidence: {} }) as CatalogTool;
  const toolDir = path.posix.dirname(tool.href);
  const evPath = path.join(root, toolDir, 'evidencias.json');
  const doc = JSON.parse(fs.readFileSync(evPath, 'utf8')) as Json;
  mutate(doc, root, toolDir);
  fs.writeFileSync(evPath, JSON.stringify(doc));
  return { root, tool, toolDir, evPath, result: evaluateTool(tool, { root }) };
}

const rec = (doc: Json) => (doc.registros as Json[])[0] as Json;

describe('ATDS-ROB-01/02: esquema de evidencias.json', () => {
  const write = (name: string, content: string) => {
    const dir = path.join(tmp, `rob-${name}`);
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'evidencias.json');
    fs.writeFileSync(p, content);
    return p;
  };

  it('registros: [null] no detiene la evaluación y se diagnostica con su posición', () => {
    const p = write('null', JSON.stringify({ registros: [null] }));
    let r: ReturnType<typeof checkEvidenceContent> | undefined;
    expect(() => { r = checkEvidenceContent(p, tmp, tmp); }).not.toThrow();
    expect(r?.schemaStatus).toBe('INVALID_SCHEMA');
    expect(r?.issues).toContain('EVIDENCE_SCHEMA_RECORD_0_NOT_OBJECT');
    expect(r?.valid).toBe(false);
  });

  it('registros: {} no es una lista vacía', () => {
    const r = checkEvidenceContent(write('obj', JSON.stringify({ registros: {} })), tmp, tmp);
    expect(r.schemaStatus).toBe('INVALID_SCHEMA');
    expect(r.issues).toContain('EVIDENCE_SCHEMA_REGISTROS_NOT_ARRAY');
    expect(r.valid).toBe(false);
  });

  it('distingue archivo inexistente, sintaxis inválida, sin registros y lista legítimamente vacía', () => {
    expect(checkEvidenceContent(path.join(tmp, 'no-existe.json'), tmp, tmp).schemaStatus).toBe('MISSING_FILE');
    expect(checkEvidenceContent(write('syntax', '{registros: ['), tmp, tmp).schemaStatus).toBe('INVALID_JSON');
    expect(checkEvidenceContent(write('nokey', '{}'), tmp, tmp).issues).toContain('EVIDENCE_SCHEMA_MISSING_REGISTROS');
    expect(checkEvidenceContent(write('root', '[]'), tmp, tmp).issues).toContain('EVIDENCE_SCHEMA_ROOT_NOT_OBJECT');
    const empty = checkEvidenceContent(write('empty', JSON.stringify({ registros: [] })), tmp, tmp);
    expect(empty.schemaStatus).toBe('EMPTY');
    expect(empty.valid).toBe(true);
  });

  it('REPORT continúa con el resto del catálogo y STRICT no se rompe', async () => {
    const { CLI_GUIDE } = await import('../../scripts/atds-fixtures.mjs');
    const root = path.join(tmp, 'rob-cli');
    const bad = writeFixtureTool(root, { id: 'fx-null', expected: 'L3', guide: CLI_GUIDE, skill: true, cases: true });
    const good = writeFixtureTool(root, { id: 'fx-ok', expected: 'L3', guide: CLI_GUIDE, skill: true, cases: true });
    fs.writeFileSync(path.join(root, path.posix.dirname(bad.href), 'evidencias.json'), JSON.stringify({ registros: [null, {}] }));
    fs.writeFileSync(path.join(root, 'catalogo.json'), JSON.stringify({ categorias: [{ id: 1 }], herramientas: [bad, good] }));
    const report = spawnSync(process.execPath, [CLI, '--report', '--root', root], { encoding: 'utf8' });
    expect(report.status).toBe(0);
    const out = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'atds-validation.json'), 'utf8'));
    expect(out.report.tools).toHaveLength(2);
    const badEntry = out.report.tools.find((t: { id: string }) => t.id === 'fx-null');
    expect(badEntry.level).toBe('L3');
    expect(badEntry.evidenceSchemaStatus).toBe('INVALID_SCHEMA');
    expect(badEntry.issues.some((i: string) => i.startsWith('L4_EVIDENCE_SCHEMA_RECORD_0'))).toBe(true);
    const strict = spawnSync(process.execPath, [CLI, '--strict', '--root', root, '--targets', 'fx-null', '--min-level', 'L3'], { encoding: 'utf8' });
    expect(strict.status).toBe(0);
    const strictL4 = spawnSync(process.execPath, [CLI, '--strict', '--root', root, '--targets', 'fx-null', '--min-level', 'L4'], { encoding: 'utf8' });
    expect(strictL4.status).toBe(1);
  });

  it('evaluateToolSafe convierte una excepción inesperada en un hallazgo estructural', () => {
    // A corrupt catalogue entry (null) makes evaluateTool throw a TypeError.
    expect(() => evaluateTool(null as unknown as CatalogTool)).toThrow(TypeError);
    const r = evaluateToolSafe(null as unknown as CatalogTool);
    expect(r.status).toBe('ERROR');
    expect(r.issues).toEqual(['EVALUATION_ERROR']);
    expect(r.validatedLevel).toBe('NONE');
    expect(r.findings[0]?.level).toBe('STRUCT');
  });
});

describe('ATDS-11: identidad experimental inequívoca', () => {
  it('la fixture L4 íntegra sigue en L4 con referencias verificadas', async () => {
    const { result } = await buildL4();
    expect(result.validatedLevel).toBe('L4');
    expect(result.verifiedEvidenceRefs).toHaveLength(1);
    expect(result.evidenceRefs).toHaveLength(1);
  });

  it.each([
    ['id ausente', (d: Json) => { delete rec(d).id; }, 'MISSING_ID'],
    ['id provisional', (d: Json) => { rec(d).id = 'PENDIENTE'; }, 'PROVISIONAL_ID'],
    ['herramienta ausente', (d: Json) => { delete rec(d).herramienta; }, 'MISSING_TOOL_IDENTITY'],
    ['herramienta incorrecta', (d: Json) => { rec(d).herramienta = 'Otra herramienta'; }, 'TOOL_MISMATCH'],
    ['id_catalogo incorrecto', (d: Json) => { rec(d).id_catalogo = 'AT-OTRA-999'; }, 'ID_CATALOGO_MISMATCH'],
    ['id_catalogo ausente', (d: Json) => { delete rec(d).id_catalogo; }, 'MISSING_ID_CATALOGO'],
  ])('%s → bloqueo L4', async (_name, mutate, code) => {
    const { result } = await buildL4(mutate);
    expect(result.validatedLevel).toBe('L3');
    expect(result.issues.some((i) => i.startsWith('L4_') && i.endsWith(code))).toBe(true);
    expect(result.verifiedEvidenceRefs).toEqual([]);
    expect(result.evidenceRefs).toEqual([]);
  });

  it('IDs duplicados → bloqueo L4', async () => {
    const { result } = await buildL4((d) => {
      const r = rec(d);
      d.registros = [r, { ...r, resultado: 'FAIL' }];
    });
    expect(result.validatedLevel).toBe('L3');
    expect(result.issues.some((i) => i.includes('EVIDENCE_DUPLICATE_ID_'))).toBe(true);
  });
});

describe('ATDS-12: tipos de prueba', () => {
  it('PASS con tipo desconocido no acredita L4', async () => {
    const { result } = await buildL4((d) => { rec(d).tipo = 'escaneo_acotado'; });
    expect(result.validatedLevel).toBe('L3');
    expect(result.issues.some((i) => i.includes('UNKNOWN_TEST_TYPE'))).toBe(true);
  });

  it('otro sin justificación no acredita L4; con justificación suficiente sí', async () => {
    const without = await buildL4((d) => { rec(d).tipo = 'otro'; });
    expect(without.result.validatedLevel).toBe('L3');
    expect(without.result.issues.some((i) => i.endsWith('OTHER_TYPE_WITHOUT_JUSTIFICATION'))).toBe(true);
    const withJ = await buildL4((d) => {
      rec(d).tipo = 'otro';
      rec(d).justificacion_tipo = 'Prueba diferencial de salida contra un corpus sintético fijado por hash, no encaja en los tipos estándar.';
    });
    expect(withJ.result.validatedLevel).toBe('L4');
  });
});

describe('ATDS-13: pruebas de versión', () => {
  it.each([
    'fx-cli --version',
    'env fx-cli --version',
    'env -i PATH=/usr/bin fx-cli --version',
    'LANG=C /usr/local/bin/fx-cli -V',
    'command fx-cli --version',
    'command -v fx-cli',
    'which fx-cli && fx-cli --version',
    'timeout 10 fx-cli version 2>&1 | head -n1',
    'sudo -u nobody fx-cli --version > out.txt',
  ])('"%s" solo acredita versión/disponibilidad', (cmd) => {
    expect(commandScope(cmd)).toBe('version');
    expect(isVersionOnlyCommand(cmd)).toBe(true);
  });

  it.each([
    'fx-cli scan --disable-version-check --json src/',
    'env fx-cli scan --config rules.yml src/',
    'fx-cli --version && fx-cli scan src/',
    'fx-cli check-version-compat src/',
  ])('"%s" no es solo de versión', (cmd) => {
    expect(commandScope(cmd)).toBe('other');
  });

  it('PASS funcional con env ... --version no acredita L4', async () => {
    const { result } = await buildL4((d) => { rec(d).comando = 'env FX_HOME=/tmp fx-cli --version'; });
    expect(result.validatedLevel).toBe('L3');
    expect(result.issues.some((i) => i.endsWith('VERSION_CHECK_AS_FUNCTIONAL'))).toBe(true);
  });
});

describe('ATDS-14: pertenencia de artefactos', () => {
  it('artefacto ajeno con SHA-256 correcto → rechazo', async () => {
    const { result } = await buildL4((d, root) => {
      const foreignDir = path.join(root, 'fixtures', 'otra-ficha', 'evidencias');
      fs.mkdirSync(foreignDir, { recursive: true });
      fs.writeFileSync(path.join(foreignDir, 'ajeno.log'), 'contenido ajeno');
      const arts = rec(d).artefactos as Json[];
      arts[1] = { nombre: 'Registro de ejecución', sha256: sha('contenido ajeno'), destRel: 'fixtures/otra-ficha/evidencias/ajeno.log' };
    });
    expect(result.validatedLevel).toBe('L3');
    expect(result.evidenceIntegrity[0]?.artifacts.some((a) => a.status === 'FOREIGN_ARTIFACT')).toBe(true);
    expect(result.issues.some((i) => i.includes('ARTIFACT_FOREIGN'))).toBe(true);
  });

  it('una excepción documentada, aprobada y vigente acepta la ubicación histórica; vencida no', async () => {
    const make = async (vence: string) => {
      let foreignRel = '';
      let foreignSha = '';
      let toolId = '';
      const built = await buildL4((d, root) => {
        const foreignDir = path.join(root, 'historico');
        fs.mkdirSync(foreignDir, { recursive: true });
        fs.writeFileSync(path.join(foreignDir, 'log.txt'), 'historico');
        foreignRel = 'historico/log.txt';
        foreignSha = sha('historico');
        const arts = rec(d).artefactos as Json[];
        arts[1] = { nombre: 'Registro de ejecución', sha256: foreignSha, destRel: foreignRel };
      });
      toolId = built.tool.id;
      const policy = path.join(built.root, 'excepciones.json');
      fs.writeFileSync(policy, JSON.stringify({
        exceptions: [{ id: 'EXC-1', herramienta: toolId, ruta: foreignRel, sha256: foreignSha, motivo: 'Artefacto histórico copiado antes de la política de procedencia.', aprobado_por: 'propietario', vence }],
      }));
      return evaluateTool(built.tool, { root: built.root, provenanceExceptionsPath: policy, today: '2026-11-27' });
    };
    const ok = await make('2027-01-01');
    expect(ok.validatedLevel).toBe('L4');
    expect(ok.warnings.some((w) => w.includes('ARTIFACT_HISTORICAL_LOCATION'))).toBe(true);
    const expired = await make('2026-01-01');
    expect(expired.validatedLevel).toBe('L3');
  });
});

describe('ATDS-15: evidencia declarada frente a acreditada', () => {
  it('artefacto secundario corrupto: declarada, no verificada', async () => {
    const { result } = await buildL4((_d, root, toolDir) => {
      fs.appendFileSync(path.join(root, toolDir, 'evidencias', 'ejecucion.log'), 'alterado');
    });
    expect(result.validatedLevel).toBe('L3');
    expect(result.declaredEvidenceRefs).toHaveLength(1);
    expect(result.declaredEvidenceRefs[0]?.integrityVerified).toBe(false);
    expect(result.verifiedEvidenceRefs).toEqual([]);
    expect(result.evidenceRefs).toEqual([]);
  });

  it('integridad parcial (artefacto sin ruta) no se presenta como verificada', async () => {
    const { result } = await buildL4((d) => {
      (rec(d).artefactos as Json[]).push({ nombre: 'Binario', sha256: 'b'.repeat(64) });
    });
    expect(result.declaredEvidenceRefs[0]?.integrityVerified).toBe(false);
    expect(result.verifiedEvidenceRefs).toEqual([]);
  });

  it('las evidencias históricas reales no se presentan como acreditadas', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8')) as { herramientas: CatalogTool[] };
    for (const id of ['semgrep', 'cargo-audit', 'gitleaks', 'promptfoo', 'cargo-fuzz']) {
      const tool = catalog.herramientas.find((t) => t.id === id);
      if (!tool) throw new Error(id);
      const r = evaluateTool(tool);
      expect(r.verifiedEvidenceRefs).toEqual([]);
      expect(r.evidenceRefs).toEqual([]);
      expect(r.declaredEvidenceRefs.every((ref) => ref.integrityVerified === false)).toBe(true);
    }
  });
});

describe('ATDS-L3-01: recursos opcionales y lote E3-01', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8')) as { herramientas: CatalogTool[] };
  const real = (id: string) => {
    const t = catalog.herramientas.find((x) => x.id === id);
    if (!t) throw new Error(id);
    return t;
  };

  it.each(['threat-dragon', 'sagan', 'nfcutils', 'secure-delete'])('%s mantiene L3 sin anunciar FAIL de skill', (id) => {
    const r = evaluateTool(real(id));
    expect(r.validatedLevel).toBe('L3');
    expect(r.checks.L3_SKILL).toBe('ABSENT_OPTIONAL');
    expect(r.checks.L3_CASOS).toBe('PASS');
    expect(r.warnings.some((w) => w.startsWith('L3_SKILL_'))).toBe(false);
    expect(r.resources.skill.present).toBe(false);
    expect(r.resources.cases).toEqual({ present: true, valid: true });
  });

  it('una skill presente pero deficiente se informa como FAIL no bloqueante', async () => {
    const { CLI_GUIDE } = await import('../../scripts/atds-fixtures.mjs');
    const root = path.join(tmp, 'l3-skill-bad');
    const tool = writeFixtureTool(root, { id: 'fx-l3-skill', expected: 'L3', guide: CLI_GUIDE, cases: true });
    fs.writeFileSync(path.join(root, path.posix.dirname(tool.href), 'SKILL.md'), '# skill\n[TODO]');
    const r = evaluateTool(tool, { root });
    expect(r.validatedLevel).toBe('L3');
    expect(r.checks.L3_SKILL).toBe('FAIL');
    expect(r.warnings.some((w) => w.startsWith('L3_SKILL_'))).toBe(true);
  });

  it('threat-dragon sin GUIA.md pierde L3', () => {
    const root = path.join(tmp, 'td-sin-guia');
    const tool = real('threat-dragon');
    const dir = path.posix.dirname(tool.href);
    fs.cpSync(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
    fs.rmSync(path.join(root, dir, 'GUIA.md'));
    expect(evaluateTool(tool, { root }).validatedLevel).not.toBe('L3');
  });

  it('las políticas E2 y E3-01 siguen aprobando', () => {
    for (const policy of ['atds-strict-policy.json', 'atds-lote-e3-01-policy.json']) {
      const r = spawnSync(process.execPath, [CLI, '--strict', '--policy', path.join(ROOT, 'scripts', policy)], { encoding: 'utf8' });
      expect(r.status).toBe(0);
    }
  });
});

describe('ATDS-PUBLISH-01: fixtures negativas L4 del gate', () => {
  it('cada fixture negativa queda en L3 con el validador real', async () => {
    const { buildFixtureRoot, NEGATIVE_L4_FIXTURE_SPECS } = await import('../../scripts/atds-fixtures.mjs');
    const root = path.join(tmp, 'neg-root');
    fs.mkdirSync(root, { recursive: true });
    const tools = buildFixtureRoot(root, NEGATIVE_L4_FIXTURE_SPECS);
    for (const t of tools) {
      const r = evaluateTool(t, { root });
      expect(r.validatedLevel, t.id).toBe('L3');
      expect(r.candidateLevel, t.id).toBe('L4');
    }
  });
});
