/**
 * SEC-DATA-01 (contratos JSON en la frontera del fetch) y SEC-SVG-01 (iconos).
 * Usa los datos reales generados por `npm run generate:data` (public/data).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataContractError, validateCatalogIndex, validateCategoryShard } from '../../src/lib/contracts';
import { loadCatalogIndex, loadCategoryShard, resetDataCacheForTests } from '../../src/lib/data';
import type { CatalogIndex, CategoryShard } from '../../src/types/catalog';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'public', 'data');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let index: CatalogIndex;
let shard: CategoryShard;
beforeAll(() => {
  index = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog-index.json'), 'utf8')) as CatalogIndex;
  shard = JSON.parse(fs.readFileSync(path.join(DATA, 'categories', 'modelado-amenazas.json'), 'utf8')) as CategoryShard;
});

describe('SEC-DATA-01: contrato del índice', () => {
  it('el índice real cumple el contrato', () => {
    expect(validateCatalogIndex(index).tools).toHaveLength(2137);
  });

  const mutations: Array<[string, (i: CatalogIndex & Record<string, unknown>) => void]> = [
    ['raíz no objeto', (i) => { Object.setPrototypeOf(i, Array.prototype); }],
    ['sin tools', (i) => { delete (i as Partial<CatalogIndex>).tools; }],
    ['ID duplicado', (i) => { const a = i.tools[0]; const b = i.tools[1]; if (a && b) b.id = a.id; }],
    ['categoría inexistente', (i) => { const t = i.tools[0]; if (t) t.categorySlug = 'no-existe'; }],
    ['herramienta movida entre categorías', (i) => {
      const t = i.tools.find((x) => x.categorySlug !== i.tools[0]?.categorySlug);
      if (t && i.tools[0]) t.categorySlug = i.tools[0].categorySlug;
    }],
    ['ruta insegura', (i) => { const t = i.tools[0]; if (t) t.htmlHref = '../../etc/passwd'; }],
    ['tipo incorrecto', (i) => { const t = i.tools[0] as unknown as Record<string, unknown>; t.name = 42; }],
    ['totales incoherentes', (i) => { i.totals.admitted = 1; }],
    ['destacada inexistente', (i) => { i.featuredIds = ['fantasma']; }],
  ];
  for (const [name, mutate] of mutations) {
    it(`rechaza: ${name}`, () => {
      const bad = clone(index) as CatalogIndex & Record<string, unknown>;
      mutate(bad);
      const input = name === 'raíz no objeto' ? [] : bad;
      expect(() => validateCatalogIndex(input)).toThrow(DataContractError);
    });
  }
});

describe('SEC-DATA-01: contrato de los fragmentos por categoría', () => {
  it('el fragmento real cumple el contrato, también contra el índice', () => {
    expect(validateCategoryShard(shard, 'modelado-amenazas', index).tools[0]?.id).toBe('threat-dragon');
  });

  it('los 49 fragmentos reales cumplen el contrato contra el índice', () => {
    const failures: string[] = [];
    for (const cat of index.categories) {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'categories', `${cat.slug}.json`), 'utf8')) as unknown;
      try {
        validateCategoryShard(raw, cat.slug, index);
      } catch (e) {
        failures.push(`${cat.slug}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('rechaza un fragmento servido para otra categoría', () => {
    expect(() => validateCategoryShard(shard, 'otra', index)).toThrow(DataContractError);
  });

  it('rechaza una herramienta ajena al índice o duplicada', () => {
    const alien = clone(shard);
    const t = alien.tools[0];
    if (t) t.id = 'herramienta-fantasma';
    expect(() => validateCategoryShard(alien, 'modelado-amenazas', index)).toThrow(/no figura en el índice/);
    const dup = clone(shard);
    if (dup.tools[0]) dup.tools.push(clone(dup.tools[0]));
    expect(() => validateCategoryShard(dup, 'modelado-amenazas', index)).toThrow(DataContractError);
  });

  it('rechaza recursos con rutas fuera del catálogo', () => {
    const bad = clone(shard);
    const t = bad.tools[0];
    if (t) t.technicalResources = [{ label: 'x', href: 'https://evil.example/x', kind: 'guide' }];
    expect(() => validateCategoryShard(bad, 'modelado-amenazas', index)).toThrow(DataContractError);
  });
});

describe('SEC-DATA-01: el cargador produce errores recuperables', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDataCacheForTests();
  });

  it('JSON malformado → DataContractError, y un reintento posterior funciona', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return calls === 1
        ? new Response('{"project": ', { status: 200 })
        : new Response(JSON.stringify(index), { status: 200 });
    });
    await expect(loadCatalogIndex()).rejects.toBeInstanceOf(DataContractError);
    await expect(loadCatalogIndex()).resolves.toMatchObject({ totals: { admitted: 2137 } });
  });

  it('JSON válido pero incompatible → DataContractError (no un detalle engañoso)', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).includes('catalog-index')
        ? new Response(JSON.stringify(index), { status: 200 })
        : new Response(JSON.stringify({ ...shard, tools: [{ id: 'x' }] }), { status: 200 }));
    await expect(loadCategoryShard('modelado-amenazas')).rejects.toBeInstanceOf(DataContractError);
  });

  it('503 del service worker sigue siendo un error offline distinguible', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 503 }));
    await expect(loadCatalogIndex()).rejects.toMatchObject({ name: 'OfflineUnavailableError' });
  });
});

describe('SEC-SVG-01: iconos Fine Line versionados', () => {
  const ICON_DIR = path.join(ROOT, 'src', 'assets', 'icons');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.svg') ? [p] : [];
  });
  const ALLOWED_ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'title', 'desc', 'defs', 'style', 'clippath', 'lineargradient', 'radialgradient', 'stop', 'mask', 'use']);
  const icons = walk(ICON_DIR);

  it('hay iconos que validar', () => {
    expect(icons.length).toBeGreaterThanOrEqual(29);
  });

  for (const file of icons) {
    it(`${path.relative(ICON_DIR, file)} solo contiene SVG estático`, () => {
      const svg = fs.readFileSync(file, 'utf8');
      const tags = [...svg.matchAll(/<\s*([a-zA-Z][\w:-]*)/g)].map((m) => (m[1] ?? '').toLowerCase());
      for (const tag of tags) expect(ALLOWED_ELEMENTS, `elemento <${tag}>`).toContain(tag.replace(/^svg:/, ''));
      expect(svg).not.toMatch(/<\s*(script|foreignobject|iframe|object|embed|image|a|animate|set)\b/i);
      expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
      expect(svg).not.toMatch(/(href|src)\s*=\s*["'](?!#)/i);
      expect(svg).not.toMatch(/javascript:|data:|url\(\s*["']?(?!#)/i);
      expect(svg).not.toMatch(/@import|<!ENTITY|<!DOCTYPE/i);
    });
  }
});
