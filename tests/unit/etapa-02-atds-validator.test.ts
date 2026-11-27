/**
 * Etapa 2 — Validador ATDS v1: pruebas de regresión (E2-R3).
 *
 * Todas las pruebas importan los módulos de producción y los ejecutan sobre
 * fixtures escritas en un directorio temporal exclusivo (os.tmpdir), nunca
 * dentro del repositorio. El catálogo real solo se lee.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { normalizeMetadata, isVerifiedValue, isPlaceholderUrl, collectUrls, VAGUE_PATTERNS } from '../../scripts/lib/atds/normalize.mjs';
import { checkGuideContent } from '../../scripts/lib/atds/guide.mjs';
import { checkSkillContent } from '../../scripts/lib/atds/skill.mjs';
import { checkCasesContent } from '../../scripts/lib/atds/cases.mjs';
import { checkEvidenceContent } from '../../scripts/lib/atds/evidence.mjs';
import { evaluateL1, evaluateL2, evaluateL3, evaluateL4, computeLevels, computeStatus, parseLevel } from '../../scripts/lib/atds/classify.mjs';
import { makeFinding, mapCodeToDoc, summarizeFindings, findingFromCode } from '../../scripts/lib/atds/diagnostics.mjs';
import { resolveWithin, toolDirFromHref } from '../../scripts/lib/atds/paths.mjs';
import { evaluateTool, evaluateStrict, resolveTargets, OperationalError } from '../../scripts/lib/atds/evaluate.mjs';
import { buildToolReport, buildSummary } from '../../scripts/lib/atds/report.mjs';
import type { CatalogTool, ToolEvaluation } from '../../scripts/lib/atds/evaluate.mjs';
import type { EvidenceRecord } from '../../scripts/lib/atds/evidence.mjs';
import {
  buildFixtureRoot, writeFixtureTool, writeFixtureEvidence, fixtureMetadata, FIXTURE_SPECS,
  CLI_GUIDE, GUI_GUIDE, API_GUIDE, REPETITIVE_GUIDE, PROSE_ONLY_GUIDE, BRIEF_CLI_GUIDE, SKILL_MD,
} from '../../scripts/atds-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'validate-atds.mjs');

interface Catalog { herramientas: CatalogTool[]; categorias: unknown[] }
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8')) as Catalog;
const realTool = (id: string): CatalogTool => {
  const t = catalog.herramientas.find((x) => x.id === id);
  if (!t) throw new Error(`missing ${id}`);
  return t;
};
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

let tmp: string;
let fxRoot: string;
let fxTools: CatalogTool[];
const fx = (id: string): CatalogTool => {
  const t = fxTools.find((x) => x.id === id);
  if (!t) throw new Error(`missing fixture ${id}`);
  return t;
};
const writeTmp = (name: string, content: string): string => {
  const p = path.join(tmp, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
};

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'etapa-02-atds-'));
  fxRoot = path.join(tmp, 'fixture-root');
  fs.mkdirSync(fxRoot);
  fxTools = buildFixtureRoot(fxRoot);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('normalize.mjs', () => {
  it('extrae URLs sin duplicados', () => {
    const urls = collectUrls({
      fuentes_oficiales: { repo: 'https://github.com/org/repo' },
      fuentes_consultadas: ['https://github.com/org/repo', 'https://pypi.org/project/x/'],
      referencias_oficiales: [{ url: 'https://docs.org.dev' }],
      upstream: 'https://upstream.dev',
    });
    expect(urls).toEqual(['https://github.com/org/repo', 'https://pypi.org/project/x/', 'https://docs.org.dev', 'https://upstream.dev']);
  });

  it.each([
    'NO_VERIFICADA', 'NO_VERIFICADO', 'PENDIENTE', 'NO_DETERMINADO', 'DESCONOCIDO', 'N/A', 'TBD', 'POR_DEFINIR',
    'no verificada', ' Pendiente ', 'n/a', 'tbd', 'Por definir', 'no-determinado', 'Desconocido', 'NO_VERIFICADA_EN_HOST',
    '', '   ', '-', null, undefined, [], ['PENDIENTE'], {},
  ])('isVerifiedValue rechaza marcador provisional %j', (v) => {
    expect(isVerifiedValue(v)).toBe(false);
  });

  it.each(['MIT', 'LGPL-2.1', '  Apache-2.0  ', 'Linux, macOS', ['Linux'], '2026-11-22'])('isVerifiedValue acepta %j', (v) => {
    expect(isVerifiedValue(v)).toBe(true);
  });

  it('isPlaceholderUrl detecta hosts de ejemplo', () => {
    expect(isPlaceholderUrl('https://example.com')).toBe(true);
    expect(isPlaceholderUrl('https://docs.example.org/x')).toBe(true);
    expect(isPlaceholderUrl('http://localhost:8080')).toBe(true);
    expect(isPlaceholderUrl('https://github.com/semgrep/semgrep')).toBe(false);
  });

  it('clasifica tipos de herramienta', () => {
    const n = (tipo: string) => normalizeMetadata({ tipo }, 'x/y').toolType;
    expect(n('CLI / analizador estático (SAST)')).toBe('cli');
    expect(n('Aplicación de modelado (desktop)')).toBe('gui');
    expect(n('SDK / librería de análisis')).toBe('api/sdk');
    expect(n('Servicio de tunneling')).toBe('service/infra');
    expect(n('Herramienta de seguridad')).toBe('other');
  });
});

describe('E2-R3-05 — L1 no acredita valores provisionales', () => {
  const base = () => fixtureMetadata('l1-probe');
  const l1 = (raw: Record<string, unknown>) => {
    const m = normalizeMetadata(raw, 'fixtures/l1-probe');
    m.VAGUE_PATTERNS = VAGUE_PATTERNS;
    return evaluateL1(m);
  };
  const REQUIRED = ['id', 'nombre', 'descripcion', 'categoria', 'tipo', 'problema_que_resuelve', 'funciones_principales', 'sistema_operativo', 'estado_fuente', 'fecha_verificacion', 'licencia'];
  const MARKERS: unknown[] = ['NO_VERIFICADA', 'pendiente', 'N/A', 'TBD', 'Por definir', 'DESCONOCIDO', '', null];

  it('la ficha base es L1', () => {
    expect(l1(base()).passed).toBe(true);
  });

  for (const field of REQUIRED) {
    it(`metamórfica: ${field} provisional degrada L1 y restaurarlo lo recupera`, () => {
      for (const marker of MARKERS) {
        const degraded: Record<string, unknown> = { ...base(), [field]: marker };
        // Retirar un requisito incluye sus alternativas históricas documentadas.
        if (field === 'id') degraded.id_catalogo = '';
        if (field === 'funciones_principales' && (marker === '' || marker === null)) degraded.descripcion = '';
        const r = l1(degraded);
        expect(r.passed, `${field}=${JSON.stringify(marker)}`).toBe(false);
      }
      expect(l1(base()).passed).toBe(true);
    });
  }

  it('limitaciones provisionales no cuentan', () => {
    const r = l1({ ...base(), limites: ['PENDIENTE', 'N/A'] });
    expect(r.passed).toBe(false);
    expect(r.issues).toContain('L1_UNVERIFIED_LIMITACIONES');
  });

  it('licencia NO_VERIFICADA produce L1_UNVERIFIED_LICENCIA', () => {
    expect(l1({ ...base(), licencia: 'NO_VERIFICADA' }).issues).toContain('L1_UNVERIFIED_LICENCIA');
  });

  it('fuente example.com no demuestra fuente oficial', () => {
    const r = l1({ ...base(), upstream: 'https://example.com/tool' });
    expect(r.passed).toBe(false);
    expect(r.issues).toContain('L1_SOURCE_PLACEHOLDER_ONLY');
  });

  it('sin fuente → L1_MISSING_FUENTE; fuente identificada ≠ contrastada', () => {
    const noSource = { ...base() } as Record<string, unknown>;
    delete noSource.upstream;
    expect(l1(noSource).issues).toContain('L1_MISSING_FUENTE');
    const notContrasted = l1({ ...base(), estado_fuente: 'PENDIENTE' });
    expect(notContrasted.checks.L1_FUENTE_IDENTIFICADA).toBe('PASS');
    expect(notContrasted.checks.L1_FUENTE_CONTRASTADA).toBe('FAIL');
    expect(l1(base()).checks.L1_FUENTE_CONTRASTADA).toBe('PASS');
  });

  it('fecha de verificación inexistente en calendario se rechaza', () => {
    expect(l1({ ...base(), fecha_verificacion: '2026-02-30' }).issues).toContain('L1_INVALID_FECHA_VERIFICACION');
  });
});

describe('E2-R3-09 — Profundidad técnica L2', () => {
  const guide = (name: string, content: string, type: Parameters<typeof checkGuideContent>[1]) => checkGuideContent(writeTmp(`guides/${name}.md`, content), type);

  it('guía CLI válida aprueba', () => {
    const r = guide('cli', CLI_GUIDE, 'cli');
    expect(r.issues).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('guía GUI válida aprueba sin flags CLI', () => {
    const r = guide('gui', GUI_GUIDE, 'gui');
    expect(r.issues).toEqual([]);
    expect(r.stats).toMatchObject({ cliFlags: 0 });
  });

  it('guía API válida aprueba con solicitud/respuesta y sin comandos de terminal', () => {
    expect(API_GUIDE).not.toMatch(/```(bash|sh|shell)/);
    const r = guide('api', API_GUIDE, 'api/sdk');
    expect(r.issues).toEqual([]);
  });

  it('API sin ejemplo de respuesta se rechaza', () => {
    const r = guide('api-noresp', API_GUIDE.replace(/## Respuestas[\s\S]*?## Errores/, '## Respuestas\nDevuelve la información solicitada en el formato habitual del servicio.\n\n## Errores'), 'api/sdk');
    expect(r.issues).toContain('GUIDE_NO_RESPONSE_EXAMPLE');
  });

  it('GUI sin pasos ordenados se rechaza', () => {
    const r = guide('gui-nosteps', GUI_GUIDE.replace(/^\d\. /gm, '- '), 'gui');
    expect(r.issues).toContain('GUIDE_NO_ORDERED_PROCEDURE');
  });

  it('todas las secciones con contenido repetitivo se rechaza', () => {
    const r = guide('rep', REPETITIVE_GUIDE, 'cli');
    expect(r.valid).toBe(false);
    expect(r.issues).toContain('GUIDE_REPETITIVE_CONTENT');
  });

  it('guía extensa sin procedimiento real se rechaza', () => {
    const r = guide('prose', PROSE_ONLY_GUIDE, 'cli');
    expect(r.stats).toMatchObject({ foundSections: 14, substantiveSections: 14 });
    expect(r.issues).toEqual(['GUIDE_NO_EXECUTABLE_PROCEDURE']);
  });

  it('guía breve pero técnicamente suficiente aprueba', () => {
    expect(guide('brief', BRIEF_CLI_GUIDE, 'cli').issues).toEqual([]);
  });

  it('marcadores heurísticos insuficientes solo generan advertencias', () => {
    const r = guide('brief2', BRIEF_CLI_GUIDE, 'cli');
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('GUIDE_LOW_SIGNAL_'))).toBe(true);
  });

  it('guía con placeholders se rechaza', () => {
    expect(guide('ph', `${CLI_GUIDE}\n[TODO] completar`, 'cli').issues).toContain('GUIDE_CONTAINS_PLACEHOLDERS');
  });

  it('una palabra clave en el texto no cuenta como sección', () => {
    const r = guide('kw', CLI_GUIDE.replace('## Plataformas', '## Soporte'), 'cli');
    expect(r.issues).toContain('GUIDE_MISSING_SECTION_PLATAFORMAS');
  });

  it('metamórfica: guía placeholder impide L2 y la guía válida lo concede', () => {
    const l1Ok = { passed: true, issues: [], warnings: [], checks: {} };
    const meta = normalizeMetadata(fixtureMetadata('g'), 'x');
    expect(evaluateL2(l1Ok, guide('good', CLI_GUIDE, 'cli'), meta).passed).toBe(true);
    expect(evaluateL2(l1Ok, guide('bad', '# Tool\n[TODO] Pending', 'cli'), meta).passed).toBe(false);
  });
});

describe('skill.mjs y cases.mjs', () => {
  it('skill válida aprueba; con placeholders falla', () => {
    expect(checkSkillContent(writeTmp('skill-ok.md', SKILL_MD)).valid).toBe(true);
    expect(checkSkillContent(writeTmp('skill-ph.md', SKILL_MD.replace('Cuando se necesite', '[TODO] Cuando'))).issues).toContain('SKILL_CONTAINS_PLACEHOLDERS');
  });

  it('casos vacíos o incompletos fallan', () => {
    expect(checkCasesContent(writeTmp('c-empty.json', JSON.stringify({ casos: [] }))).issues).toContain('CASOS_EMPTY');
    const bad = checkCasesContent(writeTmp('c-bad.json', JSON.stringify({ casos: [{ id: 'CU-01', objetivo: '', pasos: [], prerequisitos: [], resultado_esperado: '' }] })));
    expect(bad.issues).toEqual(expect.arrayContaining(['CASO_CU-01_MISSING_OBJECTIVE', 'CASO_CU-01_INSUFFICIENT_STEPS', 'CASO_CU-01_MISSING_PREREQS', 'CASO_CU-01_MISSING_EXPECTED']));
  });
});

describe('E2-R3-03 — Integridad experimental L4 (todos los artefactos)', () => {
  let n = 0;
  /** Evidence root inside tmp with a valid record; `mutate` edits the record. */
  const evidence = (mutate: (r: EvidenceRecord, dir: string) => void = () => {}) => {
    const docRoot = path.join(tmp, `ev-${++n}`);
    const toolDir = 'fixtures/tool';
    fs.mkdirSync(path.join(docRoot, toolDir), { recursive: true });
    const meta = { nombre: 'Fixture tool', id_catalogo: 'AT-FX-TOOL' };
    const doc = writeFixtureEvidence(docRoot, toolDir, meta) as unknown as { registros: EvidenceRecord[] };
    const rec = doc.registros[0];
    if (!rec) throw new Error('no record');
    mutate(rec, path.join(docRoot, toolDir));
    const evPath = path.join(docRoot, toolDir, 'evidencias.json');
    fs.writeFileSync(evPath, JSON.stringify(doc));
    return checkEvidenceContent(evPath, docRoot, docRoot);
  };
  const artifacts = (r: EvidenceRecord) => r.artefactos ?? [];

  it('un artefacto válido', () => {
    const r = evidence((rec) => { rec.artefactos = artifacts(rec).slice(0, 1); });
    expect(r.issues).toEqual([]);
    expect(r.stats.passWithIntegrity).toBe(1);
  });

  it('varios artefactos válidos', () => {
    const r = evidence();
    expect(r.valid).toBe(true);
    expect(r.integrity[0]?.artifacts.map((a) => a.status)).toEqual(['VERIFIED', 'VERIFIED', 'VERIFIED']);
    expect(r.stats.passWithIntegrity).toBe(1);
  });

  it('principal correcto y secundario corrupto → rechazo', () => {
    const r = evidence((_rec, dir) => fs.appendFileSync(path.join(dir, 'evidencias', 'ejecucion.log'), 'x'));
    expect(r.integrity[0]?.artifacts[0]?.status).toBe('VERIFIED');
    expect(r.integrity[0]?.artifacts[2]?.status).toBe('HASH_MISMATCH');
    expect(r.stats.passWithIntegrity).toBe(0);
    expect(r.valid).toBe(false);
  });

  it('artefacto faltante → rechazo', () => {
    const r = evidence((_rec, dir) => fs.rmSync(path.join(dir, 'evidencias', 'ejecucion.log')));
    expect(r.issues.some((i) => i.includes('ARTIFACT_MISSING'))).toBe(true);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it.each(['../../etc/passwd', '/etc/passwd', 'fixtures/../../x'])('ruta insegura %s → rechazo', (bad) => {
    const r = evidence((rec) => {
      const a = artifacts(rec)[1];
      if (a) a.destRel = bad;
    });
    expect(r.issues.some((i) => i.includes('ARTIFACT_UNSAFE_PATH'))).toBe(true);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('symlink que escapa de la raíz → rechazo', () => {
    const outside = writeTmp('outside-secret.txt', 'secret');
    const r = evidence((rec, dir) => {
      fs.symlinkSync(outside, path.join(dir, 'evidencias', 'link.txt'));
      const a = artifacts(rec)[1];
      if (a) { a.destRel = 'fixtures/tool/evidencias/link.txt'; a.sha256 = sha('secret'); }
    });
    expect(r.integrity[0]?.artifacts[2]).toMatchObject({ status: 'UNSAFE_PATH', detail: 'SYMLINK_ESCAPE' });
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('hash malformado → rechazo', () => {
    const r = evidence((rec) => {
      const a = artifacts(rec)[1];
      if (a) a.sha256 = 'zz12';
    });
    expect(r.issues.some((i) => i.includes('ARTIFACT_MALFORMED_HASH'))).toBe(true);
  });

  it('artefactos duplicados → rechazo', () => {
    const r = evidence((rec) => { rec.artefactos = [...artifacts(rec), { ...artifacts(rec)[1] }]; });
    expect(r.issues.some((i) => i.includes('ARTIFACT_DUPLICATE'))).toBe(true);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('artefacto sin identidad → rechazo', () => {
    const r = evidence((rec) => {
      const a = artifacts(rec)[1];
      if (a) delete a.nombre;
    });
    expect(r.issues.some((i) => i.includes('ARTIFACT_NO_IDENTITY'))).toBe(true);
  });

  it('sin criterio de aceptación → no concede L4', () => {
    const r = evidence((rec) => { delete rec.criterio_aceptacion; });
    expect(r.issues.some((i) => i.endsWith('MISSING_CRITERIO_ACEPTACION'))).toBe(true);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('sin resultado observado → no concede L4', () => {
    const r = evidence((rec) => { delete rec.resultado_observado; });
    expect(r.issues.some((i) => i.endsWith('MISSING_RESULTADO_OBSERVADO'))).toBe(true);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('verificación de versión presentada como prueba funcional → rechazo', () => {
    const r = evidence((rec) => { rec.comando = 'fx-cli --version'; });
    expect(r.issues.some((i) => i.endsWith('VERSION_CHECK_AS_FUNCTIONAL'))).toBe(true);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('verificación de versión correctamente tipada no concede L4', () => {
    const r = evidence((rec) => { rec.tipo = 'verificacion_de_version'; rec.comando = 'fx-cli --version'; });
    expect(r.stats.versionOnlyCount).toBe(1);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('--disable-version-check no convierte un comando funcional en verificación de versión', () => {
    const r = evidence((rec) => { rec.comando = 'fx-cli scan --disable-version-check --json src/'; });
    expect(r.stats.versionOnlyCount).toBe(0);
    expect(r.stats.passWithIntegrity).toBe(1);
  });

  it('artefacto histórico sin ruta: limitación registrada, sin integridad atribuida', () => {
    const r = evidence((rec) => { rec.artefactos = [...artifacts(rec), { nombre: 'Binario', sha256: 'b'.repeat(64) }]; });
    expect(r.integrity[0]?.artifacts.at(-1)?.status).toBe('UNVERIFIABLE_NO_PATH');
    expect(r.limitations.length).toBe(1);
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it.each(['BLOCKED', 'FAIL', 'INCONCLUSIVE'])('%s no concede L4', (resultado) => {
    const r = evidence((rec) => {
      rec.resultado = resultado;
      if (resultado === 'BLOCKED') { rec.evidencia = null; rec.artefactos = []; rec.sha256 = null; }
    });
    expect(r.stats.passWithIntegrity).toBe(0);
  });

  it('BLOCKED con evidencia adjunta se rechaza', () => {
    const r = evidence((rec) => { rec.resultado = 'BLOCKED'; });
    expect(r.issues.some((i) => i.startsWith('BLOCKED_') && i.endsWith('_HAS_EVIDENCE'))).toBe(true);
  });

  it('evidencias históricas reales: hash principal íntegro, binario sin ruta no verificable', () => {
    const r = evaluateTool(realTool('semgrep'));
    const rec = r.evidenceIntegrity[0];
    expect(rec?.artifacts.map((a) => a.status)).toEqual(['VERIFIED', 'UNVERIFIABLE_NO_PATH', 'VERIFIED_VIA_PRIMARY']);
    expect(rec?.supportsL4).toBe(false);
  });
});

describe('E2-R3-04 — candidateLevel vs validatedLevel', () => {
  const custom = (id: string, spec: Partial<Parameters<typeof writeFixtureTool>[1]>, after?: (dir: string) => void): ToolEvaluation => {
    const root = path.join(tmp, `cand-${id}`);
    const tool = writeFixtureTool(root, { id, expected: 'NONE', ...spec });
    after?.(path.join(root, path.posix.dirname(tool.href)));
    return evaluateTool(tool, { root });
  };

  it('candidato L4 / validado L1 (guía insuficiente)', () => {
    const r = custom('c41', { guide: REPETITIVE_GUIDE, skill: true, cases: true, evidence: {} });
    expect([r.candidateLevel, r.validatedLevel]).toEqual(['L4', 'L1']);
  });

  it('candidato L3 / validado L2 (skill insuficiente, sin casos)', () => {
    const r = custom('c32', { guide: CLI_GUIDE, skill: true }, (dir) => fs.writeFileSync(path.join(dir, 'SKILL.md'), '# skill\n[TODO]'));
    expect([r.candidateLevel, r.validatedLevel]).toEqual(['L3', 'L2']);
  });

  it('candidato L2 / validado NONE (metadatos incompletos)', () => {
    const r = custom('c20', { guide: CLI_GUIDE, meta: { licencia: 'NO_VERIFICADA' } });
    expect([r.candidateLevel, r.validatedLevel]).toEqual(['L2', 'NONE']);
  });

  it('candidato L4 / validado L4 cuando todo se cumple', () => {
    const r = evaluateTool(fx('fx-l4'), { root: fxRoot });
    expect([r.candidateLevel, r.validatedLevel]).toEqual(['L4', 'L4']);
  });

  it('sin recursos → NONE / NONE', () => {
    const r = evaluateTool({ id: 'ghost', href: 'fixtures/ghost/index.html' }, { root: fxRoot });
    expect([r.candidateLevel, r.validatedLevel]).toEqual(['NONE', 'NONE']);
    expect(r.issues).toEqual(['MISSING_METADATA']);
    expect(r.status).toBe('ERROR');
  });

  it.each(FIXTURE_SPECS.map((s) => [s.id, s.expected] as const))('fixture %s alcanza %s', (id, expected) => {
    expect(evaluateTool(fx(id), { root: fxRoot }).validatedLevel).toBe(expected);
  });

  it('computeLevels: validado acumulativo, candidato por recursos', () => {
    const P = { passed: true };
    const F = { passed: false };
    const all = { metadata: true, guide: true, skillOrCases: true, evidencePass: true };
    expect(computeLevels(P, P, P, P, all)).toEqual({ candidateLevel: 'L4', validatedLevel: 'L4' });
    expect(computeLevels(P, F, P, P, all)).toEqual({ candidateLevel: 'L4', validatedLevel: 'L1' });
    expect(computeLevels(F, F, F, F, { metadata: true, guide: true })).toEqual({ candidateLevel: 'L2', validatedLevel: 'NONE' });
    expect(computeLevels(F, F, F, F, {})).toEqual({ candidateLevel: 'NONE', validatedLevel: 'NONE' });
  });

  it('validado nunca supera al candidato en el catálogo real (12 prioritarias)', () => {
    const rank = { NONE: 0, L1: 1, L2: 2, L3: 3, L4: 4 } as const;
    for (const id of ['semgrep', 'promptfoo', 'cargo-fuzz', 'mcp-inspector', 'cargo-audit', 'loom', 'dm-flakey', 'dm-log-writes', 'gitleaks', 'miri', 'cargo-mutants', 'proptest']) {
      const r = evaluateTool(realTool(id));
      expect(rank[r.validatedLevel]).toBeLessThanOrEqual(rank[r.candidateLevel]);
    }
  });

  it('L3 con casos válidos aunque la skill falle; L4 bloqueado si L3 falla', () => {
    const ok = { passed: true, issues: [], warnings: [], checks: {} };
    expect(evaluateL3(ok, { valid: false, issues: ['MISSING_SKILL'], warnings: [] }, { valid: true, issues: [], warnings: [], stats: { substantive: 1 } }).passed).toBe(true);
    const l4 = evaluateL4({ ...ok, passed: false }, { valid: true, issues: [], warnings: [], stats: { passWithIntegrity: 1 } }, {});
    expect(l4.issues).toContain('L4_BLOCKED_BY_L3');
  });

  it('computeStatus', () => {
    expect(computeStatus(['MISSING_METADATA'])).toBe('ERROR');
    expect(computeStatus(['L1_MISSING_FUENTE'])).toBe('FAIL');
    expect(computeStatus([], ['L4_EVIDENCE_X_ARTIFACT_UNVERIFIABLE_Y'])).toBe('REVIEW_REQUIRED');
    expect(computeStatus([])).toBe('PASS');
  });
});

describe('E2-R3-01 — Política STRICT', () => {
  const strictOf = (tool: CatalogTool, min: string, root?: string) => evaluateStrict(evaluateTool(tool, root ? { root } : {}), min);

  it('Semgrep L1 / mínimo L1 → PASS pese a L2–L4 incompletos', () => {
    const s = strictOf(realTool('semgrep'), 'L1');
    expect(s.currentLevel).toBe('L1');
    expect(s.passed).toBe(true);
    expect(s.excludedHigherLevelIssues).toBeGreaterThan(0);
  });

  it('Semgrep L1 / mínimo L2 → FAIL', () => {
    const s = strictOf(realTool('semgrep'), 'L2');
    expect(s.passed).toBe(false);
    expect(s.belowMinimum).toBe(true);
    expect(s.issues.every((c) => /^L[12]_/.test(c))).toBe(true);
  });

  it('promptfoo NONE / mínimo L1 → FAIL', () => {
    const s = strictOf(realTool('promptfoo'), 'L1');
    expect(s.currentLevel).toBe('NONE');
    expect(s.passed).toBe(false);
  });

  it.each([['fx-l1-l2-incompleto', 'L1'], ['fx-l2-cli', 'L2'], ['fx-l2-gui', 'L2'], ['fx-l2-api', 'L2'], ['fx-l3', 'L3'], ['fx-l4', 'L4']])('fixture %s / mínimo %s → PASS', (id, min) => {
    expect(strictOf(fx(id), min, fxRoot).passed).toBe(true);
  });

  it.each([['fx-none', 'L1'], ['fx-l1', 'L2'], ['fx-l2-cli', 'L3'], ['fx-l3', 'L4'], ['fx-l4-artefacto-corrupto', 'L4']])('fixture %s / mínimo %s → FAIL', (id, min) => {
    expect(strictOf(fx(id), min, fxRoot).passed).toBe(false);
  });

  it('errores estructurales bloquean cualquier política', () => {
    const r = evaluateTool(fx('fx-l1'), { root: fxRoot });
    const withStruct = { ...r, findings: [...r.findings, findingFromCode('INVALID_EVIDENCIAS_JSON', { severity: 'ERROR' })] };
    expect(evaluateStrict(withStruct, 'L1').passed).toBe(false);
    expect(evaluateStrict(withStruct, 'NONE').passed).toBe(false);
  });

  it('nivel inválido → error operacional', () => {
    const r = evaluateTool(realTool('semgrep'));
    expect(() => evaluateStrict(r, 'L9')).toThrow(OperationalError);
    expect(() => evaluateStrict(r, '')).toThrow(OperationalError);
    expect(parseLevel('l2')).toBe('L2');
    expect(parseLevel('L5')).toBeNull();
  });

  it('target inexistente → error operacional; id_catalogo resuelve', () => {
    expect(() => resolveTargets(catalog.herramientas, ['semgrep', 'no-existe'])).toThrow(OperationalError);
    expect(resolveTargets(catalog.herramientas, ['AT-SEC-001'])[0]?.tool.id).toBe('semgrep');
  });

  describe('CLI (códigos de salida reales)', () => {
    const cli = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' }).status;
    it('STRICT positivo → 0', () => expect(cli('--strict', '--targets', 'semgrep', '--min-level', 'L1')).toBe(0));
    it('STRICT negativo → 1', () => expect(cli('--strict', '--targets', 'semgrep', '--min-level', 'L2')).toBe(1));
    it('nivel inválido → 2', () => expect(cli('--strict', '--targets', 'semgrep', '--min-level', 'L9')).toBe(2));
    it('target inexistente → 2', () => expect(cli('--strict', '--targets', 'semgrep,no-existe')).toBe(2));
    it('fixture L4 por --root → 0', () => expect(cli('--strict', '--root', fxRoot, '--targets', 'fx-l4', '--min-level', 'L4')).toBe(0));
    it('política de no regresión del repositorio → 0', () => expect(cli('--strict', '--policy', path.join(ROOT, 'scripts', 'atds-strict-policy.json'))).toBe(0));
  });
});

describe('E2-R3-06 — Diagnósticos DOC estructurados', () => {
  it('mapea códigos a familias DOC', () => {
    expect(mapCodeToDoc('L1_DESCRIPTION_VAGUE')).toBe('DOC-01');
    expect(mapCodeToDoc('L1_MISSING_FUENTE')).toBe('DOC-03');
    expect(mapCodeToDoc('L1_SOURCE_PLACEHOLDER_ONLY')).toBe('DOC-03');
    expect(mapCodeToDoc('L1_MISSING_DESCRIPCION')).toBe('DOC-02');
    expect(mapCodeToDoc('L2_GUIDE_MISSING_SECTION_PLATAFORMAS')).toBe('DOC-05');
    expect(mapCodeToDoc('L2_GUIDE_MISSING_SECTION_INSTALACI_N')).toBe('DOC-06');
    expect(mapCodeToDoc('L2_GUIDE_SECTION_GENERIC_COMANDOS')).toBe('DOC-07');
    expect(mapCodeToDoc('L3_CASOS_NO_SUBSTANTIVE')).toBe('DOC-08');
    expect(mapCodeToDoc('L3_SKILL_INSUFFICIENT_STEPS')).toBe('DOC-09');
    expect(mapCodeToDoc('L4_EVIDENCE_EV-1_VERSION_CHECK_AS_FUNCTIONAL')).toBe('DOC-10');
    expect(mapCodeToDoc('L4_EVIDENCE_EV-1_SHA_INCONSISTENT')).toBe('DOC-11');
    expect(mapCodeToDoc('MISSING_METADATA')).toBe('DOC-11');
    expect(mapCodeToDoc('DOC12_LINKS_NOT_CHECKED')).toBe('DOC-12');
  });

  it('findingFromCode produce todos los campos', () => {
    const f = findingFromCode('L1_MISSING_FUENTE', { severity: 'ERROR', toolId: 'semgrep', toolDir: '02-catalogo/x/semgrep' });
    expect(f).toMatchObject({
      doc: 'DOC-03', code: 'L1_MISSING_FUENTE', severity: 'ERROR', level: 'L1', toolId: 'semgrep',
      file: '02-catalogo/x/semgrep/metadata.json', blocking: true,
    });
    expect(f.field).toContain('fuentes_oficiales');
    expect(f.message.length).toBeGreaterThan(0);
    expect(f.action.length).toBeGreaterThan(0);
  });

  it('cada hallazgo de una ficha real tiene los campos obligatorios', () => {
    const r = evaluateTool(realTool('semgrep'));
    expect(r.findings.length).toBeGreaterThan(0);
    for (const f of r.findings) {
      expect(f.doc).toMatch(/^DOC-(0[1-9]|1[0-2])$/);
      expect(['ERROR', 'WARNING', 'INFO']).toContain(f.severity);
      expect(['L1', 'L2', 'L3', 'L4', 'STRUCT']).toContain(f.level);
      expect(f.toolId).toBe('semgrep');
      expect(f.file).toBeTruthy();
      expect(f.action).toBeTruthy();
      expect(typeof f.blocking).toBe('boolean');
    }
    // `issues` sigue disponible por compatibilidad; los marcadores en cascada no se duplican como hallazgos.
    expect(r.issues).toContain('L3_BLOCKED_BY_L2');
    expect(r.findings.some((f) => f.code.includes('BLOCKED_BY'))).toBe(false);
  });

  it('DOC-12: enlaces identificados no comprobados, informativo y no bloqueante', () => {
    const f = evaluateTool(realTool('semgrep')).findings.find((x) => x.doc === 'DOC-12');
    expect(f).toMatchObject({ code: 'DOC12_LINKS_NOT_CHECKED', severity: 'INFO', blocking: false });
    expect(f?.message).toMatch(/sin comprobación de red/);
    expect(f?.message).toMatch(/no se afirma que estén vigentes ni rotos/);
  });

  it('el resumen expone niveles, estados, DOC, severidad, bloqueantes y revisión humana', () => {
    const tools = fxTools.map((t) => buildToolReport(t, evaluateTool(t, { root: fxRoot })));
    const s = buildSummary({ totals: { tools: tools.length, categories: 1 }, tools });
    expect(s.totalTools).toBe(FIXTURE_SPECS.length);
    expect(s.levels).toMatchObject({ NONE: 1, L1: 2, L2: 3, L3: 2, L4: 1 });
    expect(Object.values(s.statusCounts).reduce((a, b) => a + b, 0)).toBe(FIXTURE_SPECS.length);
    expect(s.findings.byDoc['DOC-12']).toBe(FIXTURE_SPECS.length);
    expect(s.findings.total).toBe(tools.reduce((a, t) => a + t.findings.length, 0));
    expect(s.findings.blocking).toBe(tools.reduce((a, t) => a + t.findings.filter((f) => f.blocking).length, 0));
    expect(typeof s.reviewRequired).toBe('number');
  });

  it('summarizeFindings agrupa por DOC y severidad', () => {
    const s = summarizeFindings([
      makeFinding({ code: 'L1_MISSING_FUENTE' }),
      makeFinding({ code: 'L1_MISSING_LICENCIA' }),
      makeFinding({ code: 'L2_GUIDE_MISSING_SECTION_PLATAFORMAS', severity: 'WARNING', blocking: false }),
    ]);
    expect(s.byDoc).toEqual({ 'DOC-03': 1, 'DOC-02': 1, 'DOC-05': 1 });
    expect(s.bySeverity).toMatchObject({ ERROR: 2, WARNING: 1 });
    expect(s.blocking).toBe(2);
  });
});

describe('paths.mjs — seguridad de rutas', () => {
  it.each([['/etc/passwd', 'ABSOLUTE_PATH'], ['../../etc/passwd', 'PATH_TRAVERSAL'], ['test\0.json', 'NULL_BYTE']] as const)('rechaza %j', (p, err) => {
    expect(resolveWithin(ROOT, p)).toEqual({ ok: false, error: err });
  });

  it('acepta ruta relativa válida', () => {
    expect(resolveWithin(ROOT, 'package.json')).toEqual({ ok: true, path: path.join(ROOT, 'package.json') });
  });

  it('toolDirFromHref', () => {
    expect(toolDirFromHref('02-catalogo/testing-y-auditoria/semgrep/index.html')).toBe('02-catalogo/testing-y-auditoria/semgrep');
  });
});

describe('E2-R3-07 — Las declaraciones .d.mts reflejan las exportaciones reales', () => {
  const modules = ['paths', 'normalize', 'guide', 'skill', 'cases', 'evidence', 'diagnostics', 'classify', 'evaluate', 'report'].map((m) => `lib/atds/${m}`).concat(['atds-fixtures']);
  it.each(modules)('%s', async (m) => {
    const decl = fs.readFileSync(path.join(ROOT, 'scripts', `${m}.d.mts`), 'utf8');
    const declared = [...decl.matchAll(/^export (?:const|function|class) (\w+)/gm)].map((x) => x[1]).sort();
    const real = Object.keys(await import(path.join(ROOT, 'scripts', `${m}.mjs`))).sort();
    expect(declared).toEqual(real);
  });
});

describe('Catálogo histórico — conservación', () => {
  it('2.137 herramientas y 49 categorías', () => {
    expect(catalog.herramientas.length).toBe(2137);
    expect(catalog.categorias.length).toBe(49);
  });

  it('5 evidencias PASS y 7 BLOCKED históricas', () => {
    let pass = 0;
    let blocked = 0;
    for (const id of ['semgrep', 'promptfoo', 'cargo-fuzz', 'mcp-inspector', 'cargo-audit', 'loom', 'dm-flakey', 'dm-log-writes', 'gitleaks', 'miri', 'cargo-mutants', 'proptest']) {
      const dir = toolDirFromHref(realTool(id).href);
      const ev = JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'evidencias.json'), 'utf8')) as { registros: EvidenceRecord[] };
      pass += ev.registros.filter((r) => r.resultado === 'PASS').length;
      blocked += ev.registros.filter((r) => r.resultado === 'BLOCKED').length;
    }
    expect([pass, blocked]).toEqual([5, 7]);
  });

  it('promptfoo: su evidencia es solo verificación de versión', () => {
    const r = evaluateTool(realTool('promptfoo'));
    expect(r.evidenceIntegrity[0]?.versionOnly).toBe(true);
  });
});
