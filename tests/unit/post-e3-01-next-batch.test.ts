/**
 * P1 de la auditoría del PR #4 — el planificador debe seguir el progreso por ID.
 * Una categoría solo se completa cuando todas sus herramientas admitidas figuran en
 * políticas de lotes aprobados; los sublotes no repiten ni omiten IDs.
 * NEXT-BATCH-02: los sufijos de sublote son extensibles (a … z, aa, ab, …).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatLotId, indexToSuffix, parseLotId, planNextBatch, suffixToIndex } from '../../scripts/lib/next-batch.mjs';
import type { BatchPlan } from '../../scripts/lib/next-batch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Synthetic catalogue: A (1 tool), B (8 tools), C (2 tools). */
function catalog() {
  const categorias = [
    { numero: 1, slug: 'a', nombre: 'A', admitidas: 1 },
    { numero: 2, slug: 'b', nombre: 'B', admitidas: 8 },
    { numero: 3, slug: 'c', nombre: 'C', admitidas: 2 },
  ];
  const herramientas = [
    { id: 'a1', cat: 1, href: '02-catalogo/a/a1/index.html' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `b${i + 1}`, cat: 2, href: `02-catalogo/b/b${i + 1}/index.html` })),
    { id: 'c1', cat: 3, href: '02-catalogo/c/c1/index.html' },
    { id: 'c2', cat: 3, href: '02-catalogo/c/c2/index.html' },
  ];
  return { categorias, herramientas };
}

/** Approve a plan's proposal as a new lot policy (what a merged PR would add). */
function approve(lots: Array<{ id: string; targets: Record<string, string> }>, plan: BatchPlan) {
  if (!plan.propuesta) throw new Error('sin propuesta');
  return [...lots, { id: plan.propuesta.lote, targets: Object.fromEntries(plan.propuesta.herramientas.map((h) => [h.id, 'L1'])) }];
}

describe('Identificadores de lote', () => {
  it('formato y análisis compatibles con la Metodología (E3-NN, E3-NNa)', () => {
    expect(formatLotId(2)).toBe('E3-02');
    expect(formatLotId(5, 'b')).toBe('E3-05b');
    expect(parseLotId('E3-05b')).toEqual({ number: 5, letter: 'b' });
    expect(parseLotId('e3-01')).toEqual({ number: 1, letter: '' });
    expect(parseLotId('E2')).toBeNull();
  });
});

describe('NEXT-BATCH-02 — sufijos de sublote extensibles (a … z, aa, ab, …)', () => {
  it('ordinal biyectivo en base 26, ida y vuelta, sin comparar caracteres sueltos', () => {
    const pairs: Array<[string, number]> = [['', 0], ['a', 1], ['b', 2], ['z', 26], ['aa', 27], ['ab', 28], ['az', 52], ['ba', 53], ['zz', 702], ['aaa', 703]];
    for (const [suffix, n] of pairs) {
      expect(suffixToIndex(suffix)).toBe(n);
      expect(indexToSuffix(n)).toBe(suffix);
    }
    for (let n = 0; n <= 2000; n++) expect(suffixToIndex(indexToSuffix(n))).toBe(n);
    expect(suffixToIndex('aa')).toBeGreaterThan(suffixToIndex('z'));
    expect(() => suffixToIndex('{')).toThrow();
    expect(() => indexToSuffix(-1)).toThrow();
  });

  it('parseLotId/formatLotId aceptan sufijos de varias letras y siguen siendo compatibles', () => {
    expect(parseLotId('E3-01')).toEqual({ number: 1, letter: '' });
    expect(parseLotId('E3-02a')).toEqual({ number: 2, letter: 'a' });
    expect(parseLotId('E3-02aa')).toEqual({ number: 2, letter: 'aa' });
    expect(parseLotId('e3-02AQ')).toEqual({ number: 2, letter: 'aq' });
    expect(parseLotId('E3-01{')).toBeNull();
    expect(formatLotId(2, 'aa')).toBe('E3-02aa');
    expect(() => formatLotId(2, '{')).toThrow();
  });

  // Catálogo sintético: A (1 herramienta) y una categoría grande G de n herramientas.
  const big = (n: number) => ({
    categorias: [
      { numero: 1, slug: 'a', nombre: 'A', admitidas: 1 },
      { numero: 2, slug: 'g', nombre: 'G', admitidas: n },
    ],
    herramientas: [
      { id: 'a1', cat: 1, href: '02-catalogo/a/a1/index.html' },
      ...Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, cat: 2, href: `02-catalogo/g/g${i + 1}/index.html` })),
    ],
  });

  for (const [n, sublots, lastLot, lastSize] of [
    [160, 27, 'E3-02aa', 4],
    [257, 43, 'E3-02aq', 5],
  ] as const) {
    it(`categoría de ${n}: ${sublots} sublotes E3-02a … ${lastLot}, transición z → aa, todos los IDs una sola vez`, () => {
      const cat = big(n);
      let lots: Array<{ id: string; targets: Record<string, string> }> = [];
      let plan = planNextBatch({ catalog: cat, lots, maxTools: 6 });
      expect(plan.propuesta).toMatchObject({ lote: 'E3-01', tipo: 'lote', total: 1 });
      lots = approve(lots, plan);

      const names: string[] = [];
      const ids: string[] = [];
      for (;;) {
        plan = planNextBatch({ catalog: cat, lots, maxTools: 6 });
        expect(plan.errors).toEqual([]);
        if (!plan.propuesta) break;
        expect(plan.propuesta.tipo).toBe('sublote');
        expect(plan.propuesta.total).toBeLessThanOrEqual(6);
        expect(parseLotId(plan.propuesta.lote)).not.toBeNull();
        names.push(plan.propuesta.lote);
        ids.push(...plan.propuesta.herramientas.map((h) => h.id));
        lots = approve(lots, plan);
        expect(names.length).toBeLessThanOrEqual(sublots);
      }

      expect(names).toHaveLength(sublots);
      expect(names.slice(0, 2)).toEqual(['E3-02a', 'E3-02b']);
      expect(names[25]).toBe('E3-02z');
      expect(names[26]).toBe('E3-02aa');
      expect(names.at(-1)).toBe(lastLot);
      expect(new Set(names).size).toBe(names.length);
      expect(names.map((x) => suffixToIndex(parseLotId(x)!.letter))).toEqual(Array.from({ length: sublots }, (_, i) => i + 1));
      expect(lots.at(-1)?.targets && Object.keys(lots.at(-1)!.targets)).toHaveLength(lastSize);
      expect(ids).toEqual(Array.from({ length: n }, (_, i) => `g${i + 1}`));
      expect(new Set(ids).size).toBe(n);
      expect(plan.herramientas_pendientes).toBe(0);
      expect(plan.categorias_completadas).toEqual(['a', 'g']);
    });
  }
});

describe('Progresión por ID: 8 herramientas → sublote de 6 → sublote de 2 → completada', () => {
  it('recorre el catálogo sin repetir ni omitir IDs', () => {
    const cat = catalog();
    let lots: Array<{ id: string; targets: Record<string, string> }> = [];

    // Orden ascendente: A (1), C (2), B (8). E3-01 = A + C; B no cabe y no se mezcla.
    let plan = planNextBatch({ catalog: cat, lots, maxTools: 6 });
    expect(plan.categorias_pendientes_en_orden.map((c) => c.slug)).toEqual(['a', 'c', 'b']);
    expect(plan.propuesta).toMatchObject({ lote: 'E3-01', tipo: 'lote', total: 3 });
    expect(plan.propuesta?.herramientas.map((h) => h.id)).toEqual(['a1', 'c1', 'c2']);
    lots = approve(lots, plan);

    // E3-02a: primer sublote de B con 6 herramientas.
    plan = planNextBatch({ catalog: cat, lots, maxTools: 6 });
    expect(plan.propuesta).toMatchObject({ lote: 'E3-02a', tipo: 'sublote', total: 6, restantes_en_categoria: 2, completa_la_categoria: false });
    const first = plan.propuesta?.herramientas.map((h) => h.id) ?? [];
    expect(first).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
    lots = approve(lots, plan);

    // B sigue pendiente (2 de 8) y va primero: E3-02b con las 2 restantes.
    plan = planNextBatch({ catalog: cat, lots, maxTools: 6 });
    expect(plan.categorias_pendientes_en_orden[0]).toMatchObject({ slug: 'b', completadas: 6, pendientes: 2 });
    expect(plan.categorias_completadas).not.toContain('b');
    expect(plan.propuesta).toMatchObject({ lote: 'E3-02b', tipo: 'sublote', total: 2, restantes_en_categoria: 0, completa_la_categoria: true });
    const second = plan.propuesta?.herramientas.map((h) => h.id) ?? [];
    expect(second).toEqual(['b7', 'b8']);
    expect(first.filter((id) => second.includes(id))).toEqual([]);
    expect([...first, ...second].sort()).toEqual(cat.herramientas.filter((t) => t.cat === 2).map((t) => t.id).sort());
    lots = approve(lots, plan);

    // B completada: todas las categorías procesadas.
    // Todo procesado: sin propuesta, cada ID exactamente una vez.
    plan = planNextBatch({ catalog: cat, lots, maxTools: 6 });
    expect(plan.propuesta).toBeNull();
    expect(plan.categorias_completadas).toEqual(['a', 'c', 'b']);
    expect(plan.herramientas_pendientes).toBe(0);
    const all = lots.flatMap((l) => Object.keys(l.targets));
    expect(all).toHaveLength(cat.herramientas.length);
    expect(new Set(all).size).toBe(cat.herramientas.length);
  });

  it('respeta un límite configurado distinto (3): B en E3-02a/b/c', () => {
    const cat = catalog();
    let lots: Array<{ id: string; targets: Record<string, string> }> = [{ id: 'E3-01', targets: { a1: 'L1', c1: 'L1', c2: 'L1' } }];
    const seen: string[] = [];
    for (const [lote, n] of [['E3-02a', 3], ['E3-02b', 3], ['E3-02c', 2]] as const) {
      const plan = planNextBatch({ catalog: cat, lots, maxTools: 3 });
      expect(plan.propuesta).toMatchObject({ lote, tipo: 'sublote', total: n });
      seen.push(...(plan.propuesta?.herramientas.map((h) => h.id) ?? []));
      lots = approve(lots, plan);
    }
    expect(seen).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']);
  });

  it('una categoría pequeña parcialmente cubierta sigue pendiente y se continúa primero', () => {
    const cat = catalog();
    const plan = planNextBatch({ catalog: cat, lots: [{ id: 'E3-01', targets: { a1: 'L1', c1: 'L1' } }], maxTools: 6 });
    expect(plan.categorias_pendientes_en_orden[0]).toMatchObject({ slug: 'c', completadas: 1, pendientes: 1 });
    expect(plan.categorias_completadas).toEqual(['a']);
    expect(plan.propuesta).toMatchObject({ lote: 'E3-01b', tipo: 'sublote', completa_la_categoria: true });
    expect(plan.propuesta?.herramientas.map((h) => h.id)).toEqual(['c2']);
  });

  it('políticas inconsistentes se informan como error, no se cuentan en silencio', () => {
    const cat = catalog();
    const plan = planNextBatch({ catalog: cat, lots: [{ id: 'E3-01', targets: { a1: 'L1', fantasma: 'L1' } }, { id: 'E3-02', targets: { a1: 'L1' } }] });
    expect(plan.errors.join(' | ')).toMatch(/inexistente: fantasma/);
    expect(plan.errors.join(' | ')).toMatch(/a1 figura en dos lotes/);
  });
});

describe('CLI real: progresión en una raíz temporal y resultado actual del repositorio', () => {
  let tmp = '';
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-next-batch-'));
    fs.mkdirSync(path.join(tmp, 'scripts', 'lib'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'scripts', 'atlas-next-batch.mjs'), path.join(tmp, 'scripts', 'atlas-next-batch.mjs'));
    fs.copyFileSync(path.join(ROOT, 'scripts', 'lib', 'next-batch.mjs'), path.join(tmp, 'scripts', 'lib', 'next-batch.mjs'));
    fs.writeFileSync(path.join(tmp, 'catalogo.json'), JSON.stringify(catalog()));
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const run = (root: string) => {
    const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'atlas-next-batch.mjs'), '--json'], { encoding: 'utf8' });
    return { status: r.status, plan: JSON.parse(r.stdout) as { lote: string | null; propuesta: { herramientas: Array<{ id: string }> } | null } };
  };
  const policy = (lote: string, ids: string[]) =>
    fs.writeFileSync(path.join(tmp, 'scripts', `atds-lote-${lote.toLowerCase()}-policy.json`), JSON.stringify({ targets: Object.fromEntries(ids.map((i) => [i, 'L1'])) }));

  it('escenario del hallazgo: tras E3-02a (6 de 8) propone E3-02b con b7 y b8, no otra categoría', () => {
    // C queda pendiente a propósito: la categoría empezada (B) se continúa primero.
    policy('E3-01', ['a1']);
    policy('E3-02a', ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
    const { status, plan } = run(tmp);
    expect(status).toBe(0);
    expect(plan.lote).toBe('E3-02b');
    expect(plan.propuesta?.herramientas.map((h) => h.id)).toEqual(['b7', 'b8']);
  });

  it('NEXT-BATCH-02: con E3-02a … E3-02z en disco propone E3-02aa con los IDs siguientes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-next-batch-aa-'));
    try {
      fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'scripts', 'atlas-next-batch.mjs'), path.join(dir, 'scripts', 'atlas-next-batch.mjs'));
      fs.copyFileSync(path.join(ROOT, 'scripts', 'lib', 'next-batch.mjs'), path.join(dir, 'scripts', 'lib', 'next-batch.mjs'));
      const n = 160;
      fs.writeFileSync(
        path.join(dir, 'catalogo.json'),
        JSON.stringify({
          categorias: [{ numero: 1, slug: 'g', nombre: 'G', admitidas: n }],
          herramientas: Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, cat: 1, href: `02-catalogo/g/g${i + 1}/index.html` })),
        }),
      );
      for (let k = 1; k <= 26; k++) {
        const ids = Array.from({ length: 6 }, (_, j) => `g${(k - 1) * 6 + j + 1}`);
        fs.writeFileSync(
          path.join(dir, 'scripts', `atds-lote-e3-02${indexToSuffix(k)}-policy.json`),
          JSON.stringify({ targets: Object.fromEntries(ids.map((i) => [i, 'L1'])) }),
        );
      }
      const { status, plan } = run(dir);
      expect(status).toBe(0);
      expect(plan.lote).toBe('E3-02aa');
      expect(plan.propuesta?.herramientas.map((h) => h.id)).toEqual(['g157', 'g158', 'g159', 'g160']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('repositorio real: E3-02 = sherlocked, vbsmin, logkeys, python-keylogger', () => {
    const { status, plan } = run(ROOT);
    expect(status).toBe(0);
    expect(plan.lote).toBe('E3-02');
    expect(plan.propuesta?.herramientas.map((h) => h.id)).toEqual(['sherlocked', 'vbsmin', 'logkeys', 'python-keylogger']);
  });
});
