/**
 * Etapa 3 · Lote E3-01 — control focalizado de las cuatro fichas enriquecidas.
 *
 * Usa el validador ATDS v1 de producción. Comprueba no regresión frente a la
 * política del lote, integridad de metadatos, ausencia de URLs ficticias,
 * correspondencia entre fuentes y referencias, ausencia de evidencias
 * fabricadas y manifiestos SHA-256 coherentes.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { evaluateTool, evaluateStrict } from '../../scripts/lib/atds/evaluate.mjs';
import { levelRank } from '../../scripts/lib/atds/classify.mjs';
import { isPlaceholderUrl, isVerifiedValue, normalizeMetadata } from '../../scripts/lib/atds/normalize.mjs';
import type { CatalogTool } from '../../scripts/lib/atds/evaluate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = <T>(rel: string): T => JSON.parse(read(rel)) as T;
const sha = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex');

interface Catalog { herramientas: CatalogTool[]; categorias: Array<{ numero: number; admitidas: number }> }
interface Policy { targets: Record<string, string> }
interface SourceRecord { dato: string; fuente: string; url: string; tipo: string; fecha_consulta: string; estado: string }
interface Meta {
  id: string;
  nombre: string;
  fuentes_oficiales: Record<string, string>;
  registro_fuentes: SourceRecord[];
  nivel_atds_e3_01: { inicial: string };
  [k: string]: unknown;
}
interface Cases { casos: Array<{ id: string; estado: string; referencias: string[] }> }

const catalog = json<Catalog>('catalogo.json');
const policy = json<Policy>('scripts/atds-lote-e3-01-policy.json');
const LOT = ['threat-dragon', 'sagan', 'nfcutils', 'secure-delete'] as const;
const tool = (id: string): CatalogTool => {
  const t = catalog.herramientas.find((x) => x.id === id);
  if (!t) throw new Error(`missing ${id}`);
  return t;
};
const dirOf = (id: string): string => path.posix.dirname(tool(id).href);
/** Text of the guide's `## Referencias` section (where sources are cited). */
const referencesSection = (guide: string): string => {
  const m = /^## Referencias\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(guide);
  return m?.[1] ?? '';
};
const urlsIn = (text: string): string[] => (text.match(/https?:\/\/[^\s)<>"'`,]+/g) || []).map((u) => u.replace(/[.;:]+$/, ''));

describe('E3-01 — alcance y orden del lote', () => {
  it('la política cubre exactamente las cuatro fichas autorizadas', () => {
    expect(Object.keys(policy.targets).sort()).toEqual([...LOT].sort());
  });

  it('las cuatro fichas pertenecen a categorías con una sola herramienta (2, 3, 4 y 5)', () => {
    expect(LOT.map((id) => tool(id).cat)).toEqual([2, 3, 4, 5]);
    for (const n of [2, 3, 4, 5]) {
      expect(catalog.herramientas.filter((t) => t.cat === n)).toHaveLength(1);
      expect(catalog.categorias.find((c) => c.numero === n)?.admitidas).toBe(1);
    }
  });

  it('catalogo.json no cambió (hash del manifiesto raíz)', () => {
    const line = read('SHA256SUMS.txt').split('\n').find((l) => l.endsWith('  catalogo.json'));
    expect(line?.split(/\s+/)[0]).toBe(sha(fs.readFileSync(path.join(ROOT, 'catalogo.json'))));
  });
});

describe.each(LOT)('E3-01 — %s', (id) => {
  const dir = dirOf(id);
  const meta = json<Meta>(`${dir}/metadata.json`);
  const guide = read(`${dir}/GUIA.md`);
  const cases = json<Cases>(`${dir}/casos-uso.json`);
  const result = evaluateTool(tool(id));

  it('no regresión: el nivel validado alcanza el de la política del lote', () => {
    const required = policy.targets[id] ?? 'L3';
    expect(levelRank(result.validatedLevel)).toBeGreaterThanOrEqual(levelRank(required));
    expect(evaluateStrict(result, required).passed).toBe(true);
  });

  it('registra el nivel inicial NONE y no alcanza L4', () => {
    expect(meta.nivel_atds_e3_01.inicial).toBe('NONE');
    expect(result.validatedLevel).not.toBe('L4');
  });

  it('identidad estable: id y nombre coinciden con el catálogo; no se inventa id_catalogo', () => {
    expect(meta.id).toBe(id);
    expect(meta.nombre).toBe(tool(id).name);
    expect(meta).not.toHaveProperty('id_catalogo');
  });

  it('campos L1/L2 con valores verificados', () => {
    const n = normalizeMetadata(meta, dir);
    for (const v of [n.descripcion, n.categoria, n.tipo, n.problema_que_resuelve, n.funciones_principales, n.sistema_operativo, n.licencia, n.estado_fuente, n.fecha_verificacion, n.dependencias, n.requisitos]) {
      expect(isVerifiedValue(v)).toBe(true);
    }
  });

  it('ninguna URL ficticia presentada como fuente (metadatos, referencias de la guía, casos)', () => {
    const all = [...normalizeMetadata(meta, dir).urls, ...urlsIn(referencesSection(guide)), ...meta.registro_fuentes.map((r) => r.url), ...cases.casos.flatMap((c) => c.referencias)];
    expect(all.length).toBeGreaterThan(0);
    for (const u of all) expect(isPlaceholderUrl(u), u).toBe(false);
  });

  it('cada fuente oficial aparece en las referencias de la guía', () => {
    for (const u of Object.values(meta.fuentes_oficiales)) expect(guide, u).toContain(u);
  });

  it('las referencias de los casos están en la guía o en el registro de fuentes', () => {
    const known = new Set([...urlsIn(guide), ...meta.registro_fuentes.map((r) => r.url), ...Object.values(meta.fuentes_oficiales)]);
    for (const c of cases.casos) for (const u of c.referencias) expect(known.has(u), `${c.id}: ${u}`).toBe(true);
  });

  it('registro de fuentes completo y fechado', () => {
    expect(meta.registro_fuentes.length).toBeGreaterThan(0);
    for (const r of meta.registro_fuentes) {
      for (const k of ['dato', 'fuente', 'url', 'tipo', 'fecha_consulta', 'estado'] as const) expect(r[k], k).toBeTruthy();
      expect(r.fecha_consulta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('sin evidencias experimentales fabricadas: no hay evidencias.json y los casos no constan como ejecutados', () => {
    expect(fs.existsSync(path.join(ROOT, dir, 'evidencias.json'))).toBe(false);
    for (const c of cases.casos) expect(c.estado).toBe('propuesto_no_ejecutado');
    expect(guide).toMatch(/no se (ejecutó|descargó|compiló)|Nada (de esta guía )?se ejecutó/i);
  });

  it('SHA256SUMS.txt cubre y coincide con todos los archivos de la ficha', () => {
    const lines = read(`${dir}/SHA256SUMS.txt`).trim().split('\n');
    const listed = new Map(lines.map((l) => { const [h, f] = l.split(/\s+/); return [f, h] as const; }));
    const files = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f !== 'SHA256SUMS.txt');
    expect([...listed.keys()].sort()).toEqual(files.sort());
    for (const f of files) expect(listed.get(f), f).toBe(sha(fs.readFileSync(path.join(ROOT, dir, f))));
  });
});
