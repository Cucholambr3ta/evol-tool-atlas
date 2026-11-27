/**
 * ATDS-UI-01..06 — contrato ATDS publicado para la PWA.
 * Comprueba los datos generados (public/data) contra el validador real y
 * fixtures temporales para los casos de integridad.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateTool } from '../../scripts/lib/atds/evaluate.mjs';
import type { CatalogTool } from '../../scripts/lib/atds/evaluate.mjs';
import { buildAtdsSummary, contentRevision } from '../../scripts/lib/atds/pwa-summary.mjs';
import { CLI_GUIDE, writeFixtureTool } from '../../scripts/atds-fixtures.mjs';
import { evidenceStatusLabel, plural, resourceStateLabel, useCaseStateLabel } from '../../src/lib/labels';
import type { CatalogIndex, CategoryShard, ToolDetail } from '../../src/types/catalog';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'public', 'data');

let index: CatalogIndex;
const details = new Map<string, ToolDetail>();
let tmp = '';

beforeAll(() => {
  index = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog-index.json'), 'utf8')) as CatalogIndex;
  for (const cat of index.categories) {
    const shard = JSON.parse(fs.readFileSync(path.join(DATA, 'categories', `${cat.slug}.json`), 'utf8')) as CategoryShard;
    for (const t of shard.tools) details.set(t.id, t);
  }
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atds-pwa-'));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('ATDS-UI-01: niveles oficiales en el índice y los fragmentos', () => {
  it('los niveles publicados coinciden con el validador para todo el catálogo', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8')) as { herramientas: CatalogTool[] };
    const counts: Record<string, number> = {};
    for (const t of catalog.herramientas) {
      const r = evaluateTool(t);
      const d = details.get(t.id);
      expect(d?.atds.validatedLevel, t.id).toBe(r.validatedLevel);
      expect(d?.atds.candidateLevel, t.id).toBe(r.candidateLevel);
      counts[r.validatedLevel] = (counts[r.validatedLevel] ?? 0) + 1;
    }
    expect(counts).toEqual({ NONE: 2124, L1: 9, L3: 4 });
  }, 120_000);

  it('el índice ligero lleva el mismo nivel validado que el fragmento', () => {
    for (const t of index.tools) expect(t.atdsLevel, t.id).toBe(details.get(t.id)?.atds.validatedLevel);
  });

  it.each(['threat-dragon', 'sagan', 'nfcutils', 'secure-delete'])('%s se publica con L3 y skill opcional ausente', (id) => {
    const a = details.get(id)?.atds;
    expect(a?.validatedLevel).toBe('L3');
    expect(a?.resources.find((r) => r.kind === 'skill')).toMatchObject({ present: false, href: null, check: 'ABSENT_OPTIONAL' });
  });

  it('la revisión de contenido es determinista y cambia al cambiar la guía', () => {
    const root = path.join(tmp, 'rev');
    const tool = writeFixtureTool(root, { id: 'fx-rev', expected: 'L2', guide: CLI_GUIDE });
    const dir = path.posix.dirname(tool.href);
    const a = contentRevision(root, dir);
    expect(contentRevision(root, dir)).toBe(a);
    fs.appendFileSync(path.join(root, dir, 'GUIA.md'), '\nCambio editorial.\n');
    expect(contentRevision(root, dir)).not.toBe(a);
  });
});

describe('ATDS-UI-02/04: presencia, validez y acreditación', () => {
  it('ninguna evidencia real se publica como acreditada', () => {
    for (const d of details.values()) {
      for (const r of d.atds.evidence?.records ?? []) expect(r.integrity, `${d.id}/${r.id}`).not.toBe('VERIFICADA');
    }
  });

  it('semgrep: artefacto principal enlazado, binario histórico sin enlace y registro no acreditado', () => {
    const rec = details.get('semgrep')?.atds.evidence?.records[0];
    expect(rec?.integrity).toBe('NO_ACREDITADA');
    expect(rec?.reasons).toContain('ARTEFACTOS_SIN_INTEGRIDAD_DEMOSTRADA');
    expect(rec?.artifacts.find((a) => a.status === 'UNVERIFIABLE_NO_PATH')?.href).toBeNull();
    expect(rec?.artifacts.find((a) => a.role === 'primary')?.href).toBe('02-catalogo/testing-y-auditoria/semgrep/evidencias/semgrep-prueba.json');
  });

  const summaryFor = (id: string, mutate: (root: string, dir: string) => void = () => {}) => {
    const root = path.join(tmp, id);
    const tool = writeFixtureTool(root, { id, expected: 'L4', guide: CLI_GUIDE, skill: true, cases: true, evidence: {} });
    mutate(root, path.posix.dirname(tool.href));
    return buildAtdsSummary(tool, evaluateTool(tool, { root }), root);
  };

  it('fixture L4 íntegra: VERIFICADA', () => {
    const s = summaryFor('fx-ui-ok');
    expect(s.validatedLevel).toBe('L4');
    expect(s.evidence?.records[0]?.integrity).toBe('VERIFICADA');
    expect(s.evidence?.verifiedCount).toBe(1);
  });

  it('artefacto secundario corrupto: NO_ACREDITADA aunque el enlace exista', () => {
    const s = summaryFor('fx-ui-corrupt', (root, dir) => fs.appendFileSync(path.join(root, dir, 'evidencias', 'ejecucion.log'), 'x'));
    const rec = s.evidence?.records[0];
    expect(rec?.integrity).toBe('NO_ACREDITADA');
    expect(rec?.artifacts.find((a) => a.status === 'HASH_MISMATCH')?.href).toBeTruthy();
    expect(s.evidence?.verifiedCount).toBe(0);
  });

  it('artefacto ajeno: nunca se enlaza fuera de la ficha', () => {
    const s = summaryFor('fx-ui-foreign', (root, dir) => {
      const other = path.join(root, 'fixtures', 'otra', 'evidencias');
      fs.mkdirSync(other, { recursive: true });
      fs.copyFileSync(path.join(root, dir, 'evidencias', 'ejecucion.log'), path.join(other, 'ejecucion.log'));
      const evPath = path.join(root, dir, 'evidencias.json');
      const doc = JSON.parse(fs.readFileSync(evPath, 'utf8'));
      doc.registros[0].artefactos[1].destRel = 'fixtures/otra/evidencias/ejecucion.log';
      fs.writeFileSync(evPath, JSON.stringify(doc));
    });
    const foreign = s.evidence?.records[0]?.artifacts.find((a) => a.status === 'FOREIGN_ARTIFACT');
    expect(foreign?.href).toBeNull();
  });
});

describe('ATDS-UI-03: estado individual de los casos', () => {
  it('los casos conservan el estado registrado y la ausencia no se infiere', () => {
    const cases = [...details.values()].flatMap((d) => d.useCases);
    expect(cases.length).toBe(44);
    expect(cases.every((c) => c.estado === 'propuesto_no_ejecutado')).toBe(true);
    expect(useCaseStateLabel(null)).toMatch(/no verificado/);
    expect(useCaseStateLabel('propuesto_no_ejecutado')).toBe('Propuesto · no ejecutado');
  });
});

describe('ATDS-UI-05: fechas de contraste explícitas', () => {
  it('cada fecha publicada aparece literalmente en la metadata o en el código de estado', () => {
    let withDate = 0;
    for (const t of index.tools) {
      if (t.sourceCheckedOn === null) continue;
      withDate++;
      const meta = fs.readFileSync(path.join(ROOT, path.posix.dirname(t.htmlHref), 'metadata.json'), 'utf8');
      expect(meta.includes(t.sourceCheckedOn) || t.evidenceStatus.endsWith(t.sourceCheckedOn), t.id).toBe(true);
    }
    expect(withDate).toBeGreaterThan(100);
    expect(index.tools.some((t) => 'revalidated20261122' in t)).toBe(false);
  });

  it('no se asigna 22-11-2026 a fichas con otra fecha registrada', () => {
    const t = index.tools.find((x) => x.evidenceStatus === 'FUENTE_Y_RELEASE_VERIFICADOS_2026-11-25');
    expect(t?.sourceCheckedOn).toBe('2026-11-25');
  });
});

describe('ATDS-UI-06 / UX-03: etiquetas y plurales', () => {
  it('los códigos se traducen sin afirmar comprobación de red', () => {
    for (const code of Object.keys(index.evidenceCounts)) {
      const l = evidenceStatusLabel(code);
      expect(l.label).not.toBe(code);
      expect(l.label.toLowerCase()).not.toMatch(/comprobado por red|enlace comprobado/);
    }
    expect(evidenceStatusLabel('EXPEDIENTE_URL_VERIFICADA_2026-11-21').label).toMatch(/no comprobada por el Atlas/);
    expect(evidenceStatusLabel('REVALIDADA_WEB_2026-11-22').date).toBe('2026-11-22');
  });

  it('estados de recurso distinguen presente, válido, opcional y pendiente', () => {
    expect(resourceStateLabel(true, true, 'PASS')).toMatch(/controles superados/);
    expect(resourceStateLabel(true, false, 'FAIL')).toMatch(/no superados/);
    expect(resourceStateLabel(false, false, 'ABSENT_OPTIONAL')).toMatch(/opcional/);
    expect(resourceStateLabel(false, false, 'FAIL')).toMatch(/pendiente/);
  });

  it('plurales', () => {
    expect(`1 ${plural(1, 'ficha', 'fichas')}`).toBe('1 ficha');
    expect(`2 ${plural(2, 'ficha', 'fichas')}`).toBe('2 fichas');
  });
});
