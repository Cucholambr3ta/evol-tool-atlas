/**
 * Transferencia operativa Claude Code → OpenCode: la skill canónica y su punto de
 * entrada OpenCode son válidos y solo citan comandos y archivos que existen.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANONICAL = 'skills/atlas-catalog-curator/SKILL.md';
const OPENCODE = '.opencode/skills/atlas-catalog-curator/SKILL.md';
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function frontmatter(md: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m || !m[1]) throw new Error('sin frontmatter');
  return Object.fromEntries(
    m[1].split('\n').map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
}

describe('Agent Skills: frontmatter válido', () => {
  for (const rel of [CANONICAL, OPENCODE]) {
    it(`${rel}`, () => {
      const fm = frontmatter(read(rel));
      expect(Object.keys(fm).sort()).toEqual(['description', 'name']);
      expect(fm.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(fm.name).toBe(path.basename(path.dirname(rel)));
      expect((fm.description ?? '').length).toBeGreaterThan(20);
      expect((fm.description ?? '').length).toBeLessThanOrEqual(1024);
    });
  }

  it('el punto de entrada OpenCode remite a la canónica sin duplicar el procedimiento', () => {
    const entry = read(OPENCODE);
    expect(entry).toContain(CANONICAL);
    expect(entry).toContain('docs/atds/METODOLOGIA-ENRIQUECIMIENTO-INCREMENTAL.md');
    expect(entry.split('\n').length).toBeLessThan(40);
    expect(read(CANONICAL).split('\n').length).toBeGreaterThan(80);
  });

  it('sin rutas absolutas del equipo ni dependencias de un agente concreto', () => {
    for (const rel of [CANONICAL, OPENCODE]) {
      const md = read(rel);
      expect(md).not.toMatch(/\/home\/|\/mnt\/|\/Users\/|C:\\/);
      expect(md).not.toMatch(/\.claude\/|CLAUDE\.md|mcp__/);
    }
  });
});

describe('La skill solo cita comandos y archivos existentes', () => {
  const docs = [CANONICAL, OPENCODE, 'docs/atds/METODOLOGIA-ENRIQUECIMIENTO-INCREMENTAL.md'];
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it('cada "npm run <script>" existe en package.json', () => {
    for (const rel of docs) {
      for (const m of read(rel).matchAll(/npm run ([a-z0-9:-]+)/g)) {
        expect(pkg.scripts, `${rel}: npm run ${m[1]}`).toHaveProperty(m[1] ?? '');
      }
    }
  });

  it('cada "node scripts/…" y archivo del repositorio citado existe', () => {
    const cited = new Set<string>();
    for (const rel of docs) {
      const md = read(rel);
      for (const m of md.matchAll(/node (scripts\/[\w./-]+\.mjs)/g)) cited.add(m[1] ?? '');
      for (const m of md.matchAll(/`((?:docs|scripts|skills|reports\/etapas)\/[\w./-]+\.(?:md|mjs|json))`/g)) cited.add(m[1] ?? '');
    }
    const missing = [...cited].filter((p) => !p.includes('<') && !p.includes('*') && !fs.existsSync(path.join(ROOT, p)));
    expect(missing).toEqual([]);
    expect(cited.has('scripts/atlas-next-batch.mjs')).toBe(true);
  });
});

describe('Planificador del siguiente lote (solo lectura)', () => {
  it('propone E3-02 por orden ascendente, excluye E3-01 y no modifica archivos', () => {
    const before = fs.statSync(path.join(ROOT, 'catalogo.json')).mtimeMs;
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'atlas-next-batch.mjs'), '--json'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const plan = JSON.parse(r.stdout) as {
      lote: string;
      modo: string;
      lotes_aprobados: Array<{ lote: string; herramientas: string[] }>;
      categorias_pendientes_en_orden: Array<{ slug: string; efectivas: number }>;
      propuesta: { tipo: string; total: number; herramientas: Array<{ id: string }> };
    };
    expect(plan.modo).toMatch(/solo lectura/);
    expect(plan.lote).toBe('E3-02');
    expect(plan.lotes_aprobados.map((l) => l.lote)).toEqual(['E3-01']);
    const slugs = plan.categorias_pendientes_en_orden.map((c) => c.slug);
    for (const done of ['modelado-amenazas', 'ids', 'nfc', 'anti-forense']) expect(slugs).not.toContain(done);
    const counts = plan.categorias_pendientes_en_orden.map((c) => c.efectivas);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
    expect(plan.propuesta.tipo).toBe('lote');
    expect(plan.propuesta.total).toBeLessThanOrEqual(6);
    expect(plan.propuesta.herramientas.map((h) => h.id)).toEqual(['sherlocked', 'vbsmin', 'logkeys', 'python-keylogger']);
    expect(fs.statSync(path.join(ROOT, 'catalogo.json')).mtimeMs).toBe(before);
  });
});
