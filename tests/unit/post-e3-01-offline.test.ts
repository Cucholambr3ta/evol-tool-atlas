/**
 * Fase 3 — OFF-01..04, FAV-01, DATA-02, OFF-VERIFY-01.
 * La lógica offline se ejecuta contra un CacheStorage en memoria con la misma API
 * que usa el navegador; las pruebas de navegador real están en tests/e2e.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildOfflineManifest } from '../../scripts/lib/offline-manifest.mjs';
import { compareCatalogIndexShards, verifyManifestAgainstDist } from '../../scripts/lib/atlas-consistency.mjs';
import {
  cacheNameForVersion,
  clearOfflineCatalog,
  downloadCatalogOffline,
  getOfflineStatus,
  readOfflineState,
  resetOfflineManifestForTests,
  verifyOfflineIntegrity,
  type OfflineProgress,
} from '../../src/lib/offline';
import {
  getFavorites,
  getFavoritesPersistence,
  resetFavoritesCacheForTests,
  toggleFavorite,
} from '../../src/lib/favorites';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
let tmp = '';
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-offline-'));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

// ---------------------------------------------------------------------------
describe('OFF-02/03: manifiesto offline determinista', () => {
  const setup = () => {
    const root = fs.mkdtempSync(path.join(tmp, 'm-'));
    const pub = path.join(root, 'public');
    fs.mkdirSync(path.join(pub, 'data', 'categories'), { recursive: true });
    fs.mkdirSync(path.join(root, '02-catalogo', 'c', 't'), { recursive: true });
    fs.writeFileSync(path.join(pub, 'data', 'categories', 'c.json'), '{"tools":[]}');
    fs.writeFileSync(path.join(root, '02-catalogo', 'c', 't', 'index.html'), '<p>t</p>');
    fs.writeFileSync(path.join(root, '02-catalogo', 'c', 't', 'GUIA.md'), '# guía');
    const items = [
      { url: 'data/categories/c.json', kind: 'shard' },
      { url: '02-catalogo/c/t/index.html', kind: 'tool-html' },
      { url: '02-catalogo/c/t/GUIA.md', kind: 'tool-resource' },
      { url: '02-catalogo/c/t/GUIA.md', kind: 'tool-resource' },
    ];
    return { root, pub, items };
  };

  it('deduplica, incluye SHA-256 y tamaño, y es byte a byte reproducible', () => {
    const { root, pub, items } = setup();
    const a = buildOfflineManifest({ root, publicDir: pub, items });
    const b = buildOfflineManifest({ root, publicDir: pub, items });
    expect(a.totalFiles).toBe(3);
    expect(a.items.find((i) => i.url.endsWith('GUIA.md'))?.sha256).toBe(sha('# guía'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).not.toHaveProperty('generatedAt');
  });

  it('un cambio de GUIA.md sin cambiar el número de herramientas produce otra revisión', () => {
    const { root, pub, items } = setup();
    const before = buildOfflineManifest({ root, publicDir: pub, items });
    fs.appendFileSync(path.join(root, '02-catalogo', 'c', 't', 'GUIA.md'), '\nNueva sección.');
    const after = buildOfflineManifest({ root, publicDir: pub, items });
    expect(after.totalFiles).toBe(before.totalFiles);
    expect(after.revision).not.toBe(before.revision);
  });

  it('rechaza recursos inexistentes y URL no publicables', () => {
    const { root, pub } = setup();
    expect(() => buildOfflineManifest({ root, publicDir: pub, items: [{ url: '02-catalogo/c/t/falta.md', kind: 'x' }] })).toThrow(/inexistente/);
    expect(() => buildOfflineManifest({ root, publicDir: pub, items: [{ url: 'package.json', kind: 'x' }] })).toThrow(/no permitida/);
    expect(() => buildOfflineManifest({ root, publicDir: pub, items: [{ url: '02-catalogo/../package.json', kind: 'x' }] })).toThrow();
  });

  it('el manifiesto real cubre los recursos que la interfaz enlaza', () => {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'offline-manifest.json'), 'utf8')) as { items: Array<{ url: string; kind: string }>; revision: string };
    const urls = new Set(m.items.map((i) => i.url));
    expect(urls.size).toBe(m.items.length);
    const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'catalog-index.json'), 'utf8')) as { tools: Array<{ id: string; htmlHref: string; categorySlug: string }>; categories: Array<{ slug: string; htmlHref: string }> };
    for (const t of index.tools) {
      const dir = t.htmlHref.replace(/index\.html$/, '');
      expect(urls.has(t.htmlHref), t.id).toBe(true);
      expect(urls.has(`${dir}metadata.json`), t.id).toBe(true);
    }
    for (const c of index.categories) {
      expect(urls.has(`data/categories/${c.slug}.json`)).toBe(true);
      expect(urls.has(c.htmlHref)).toBe(true);
    }
    for (const ref of ['catalogo.json', 'SHA256SUMS.txt', 'skills/atlas-catalog-curator/SKILL.md', 'docs/atds/ATDS-v1.md', '05-referencias/auditoria-v2.3.2/INFORME-FINAL.json']) {
      expect(urls.has(ref), ref).toBe(true);
    }
    expect(m.revision).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ---------------------------------------------------------------------------
describe('DATA-02: igualdad exacta catálogo/índice/fragmentos', () => {
  type T = { id: string; name: string; categorySlug: string; htmlHref: string };
  const base = () => {
    const tools: T[] = [
      { id: 'a', name: 'A', categorySlug: 'x', htmlHref: '02-catalogo/x/a/index.html' },
      { id: 'b', name: 'B', categorySlug: 'x', htmlHref: '02-catalogo/x/b/index.html' },
      { id: 'c', name: 'C', categorySlug: 'y', htmlHref: '02-catalogo/y/c/index.html' },
      { id: 'd', name: 'D', categorySlug: 'y', htmlHref: '02-catalogo/y/d/index.html' },
    ];
    const catalog = {
      categorias: [{ numero: 1, slug: 'x' }, { numero: 2, slug: 'y' }],
      herramientas: tools.map((t) => ({ id: t.id, cat: t.categorySlug === 'x' ? 1 : 2, href: t.htmlHref })),
    };
    const index = { categories: [{ number: 1, slug: 'x', admitted: 2 }, { number: 2, slug: 'y', admitted: 2 }], tools };
    const shards = new Map([
      ['x', { category: { slug: 'x' }, tools: tools.filter((t) => t.categorySlug === 'x').map((t) => ({ ...t })) }],
      ['y', { category: { slug: 'y' }, tools: tools.filter((t) => t.categorySlug === 'y').map((t) => ({ ...t })) }],
    ]);
    return { catalog, index, shards };
  };

  it('datos coherentes → sin errores', () => {
    expect(compareCatalogIndexShards(base())).toEqual([]);
  });

  it('intercambio entre fragmentos del mismo tamaño → detectado', () => {
    const d = base();
    const x = d.shards.get('x');
    const y = d.shards.get('y');
    if (!x || !y) throw new Error('fixture');
    const tmpTool = x.tools[0];
    const other = y.tools[0];
    if (!tmpTool || !other) throw new Error('fixture');
    x.tools[0] = { ...other, categorySlug: 'x' };
    y.tools[0] = { ...tmpTool, categorySlug: 'y' };
    expect(compareCatalogIndexShards(d).some((e) => e.includes('pero el índice la asigna'))).toBe(true);
  });

  it('duplicación compensada (mismo conteo) → detectada', () => {
    const d = base();
    const x = d.shards.get('x');
    if (!x || !x.tools[0]) throw new Error('fixture');
    x.tools[1] = { ...x.tools[0] };
    const errors = compareCatalogIndexShards(d);
    expect(errors.some((e) => e.includes('repetida'))).toBe(true);
    expect(errors.some((e) => e.includes('ausente de todos los fragmentos: b'))).toBe(true);
  });

  it('ID cambiado conservando el conteo → detectado', () => {
    const d = base();
    const y = d.shards.get('y');
    if (!y || !y.tools[1]) throw new Error('fixture');
    y.tools[1].id = 'z';
    expect(compareCatalogIndexShards(d).length).toBeGreaterThan(0);
  });

  it('herramienta movida de categoría en el índice → detectada contra catalogo.json', () => {
    const d = base();
    const t = d.index.tools[0];
    if (t) t.categorySlug = 'y';
    expect(compareCatalogIndexShards(d).some((e) => e.includes('Categoría distinta para a'))).toBe(true);
  });

  it('los datos generados reales son exactamente coherentes', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalogo.json'), 'utf8'));
    const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'catalog-index.json'), 'utf8'));
    const shards = new Map<string, { category: { slug: string }; tools: T[] }>(
      index.categories.map((c: { slug: string }) => [c.slug, JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'categories', `${c.slug}.json`), 'utf8'))]),
    );
    expect(compareCatalogIndexShards({ catalog, index, shards })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('OFF-VERIFY-01: manifiesto frente al build publicado', () => {
  it('detecta archivo faltante, contenido distinto y symlink fuera de dist/', () => {
    const dist = fs.mkdtempSync(path.join(tmp, 'dist-'));
    const outside = path.join(tmp, 'fuera.txt');
    fs.writeFileSync(outside, 'fuera');
    fs.mkdirSync(path.join(dist, '02-catalogo'), { recursive: true });
    fs.writeFileSync(path.join(dist, '02-catalogo', 'ok.html'), 'ok');
    fs.writeFileSync(path.join(dist, '02-catalogo', 'mal.html'), 'alterado');
    fs.symlinkSync(outside, path.join(dist, '02-catalogo', 'enlace.html'));
    const manifest = {
      items: [
        { url: '02-catalogo/ok.html', sha256: sha('ok') },
        { url: '02-catalogo/mal.html', sha256: sha('original') },
        { url: '02-catalogo/falta.html', sha256: sha('x') },
        { url: '02-catalogo/enlace.html', sha256: sha('fuera') },
      ],
    };
    const errors = verifyManifestAgainstDist({ manifest, distDir: dist });
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/SHA-256 distinto.*mal\.html/);
    expect(errors.join('\n')).toMatch(/ausente en dist\/: 02-catalogo\/falta\.html/);
    expect(errors.join('\n')).toMatch(/fuera de dist\/: 02-catalogo\/enlace\.html/);
  });
});

// ---------------------------------------------------------------------------
describe('FAV-01: persistencia real de favoritos', () => {
  const entry = { id: 'semgrep', name: 'Semgrep', categorySlug: 'auditoria-codigo', categoryName: 'Auditoría de código' };
  afterEach(() => {
    vi.unstubAllGlobals();
    resetFavoritesCacheForTests();
  });

  it('localStorage bloqueado (el acceso lanza SecurityError) → solo sesión, sin excepción', () => {
    const win = {};
    Object.defineProperty(win, 'localStorage', { get: () => { throw new DOMException('denied', 'SecurityError'); } });
    vi.stubGlobal('window', win);
    resetFavoritesCacheForTests();
    expect(() => toggleFavorite(entry)).not.toThrow();
    expect(getFavorites().map((f) => f.id)).toEqual(['semgrep']);
    expect(getFavoritesPersistence().status).toBe('session-only');
  });

  it('cuota excedida → solo sesión con motivo; al recuperarse vuelve a persistente', () => {
    let full = true;
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (full) throw new DOMException('full', 'QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => store.delete(k),
    };
    vi.stubGlobal('window', { localStorage: storage });
    resetFavoritesCacheForTests();
    toggleFavorite(entry);
    expect(getFavoritesPersistence()).toEqual({ status: 'session-only', reason: 'El almacenamiento local está lleno.' });
    expect(store.size).toBe(0);
    full = false;
    toggleFavorite({ ...entry, id: 'gitleaks', name: 'Gitleaks' });
    expect(getFavoritesPersistence().status).toBe('persistent');
    expect(JSON.parse(store.get('evol-tool-atlas:favorites:v1') ?? '[]')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// OFF-01/03/04: offline storage logic against an in-memory CacheStorage.

class MemCache {
  store = new Map<string, Response>();
  failPut: ((url: string) => Error | null) | null = null;
  private key(r: RequestInfo | URL): string {
    const u = typeof r === 'string' ? r : r instanceof URL ? r.href : r.url;
    return new URL(u, 'http://atlas.test').href;
  }
  async match(r: RequestInfo | URL) {
    const hit = this.store.get(this.key(r));
    return hit ? hit.clone() : undefined;
  }
  async put(r: RequestInfo | URL, res: Response) {
    const err = this.failPut?.(this.key(r));
    if (err) throw err;
    this.store.set(this.key(r), res.clone());
  }
  async delete(r: RequestInfo | URL) {
    return this.store.delete(this.key(r));
  }
  async keys() {
    return [...this.store.keys()].map((url) => ({ url }));
  }
}

class MemCacheStorage {
  caches = new Map<string, MemCache>();
  async open(name: string) {
    let c = this.caches.get(name);
    if (!c) {
      c = new MemCache();
      this.caches.set(name, c);
    }
    return c;
  }
  async has(name: string) {
    return this.caches.has(name);
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
  async keys() {
    return [...this.caches.keys()];
  }
}

function makeManifest(files: Record<string, string>) {
  const items = Object.entries(files).map(([url, body]) => ({ url, kind: 'tool-html', sha256: sha(body), bytes: body.length }));
  const revision = sha(items.map((i) => `${i.url}\t${i.sha256}\n`).sort().join(''));
  return { schema: 'evol-tool-atlas/offline-manifest/2', revision, version: revision.slice(0, 16), totalFiles: items.length, totalBytes: 0, items };
}

describe('OFF-01/03/04: almacenamiento offline por revisión', () => {
  let storage: MemCacheStorage;
  let server: Record<string, string>;
  let manifest: ReturnType<typeof makeManifest>;
  let failing: Set<string>;

  const serve = (files: Record<string, string>) => {
    server = { ...files };
    manifest = makeManifest(files);
    resetOfflineManifestForTests();
  };

  beforeEach(() => {
    storage = new MemCacheStorage();
    failing = new Set();
    vi.stubGlobal('caches', storage);
    vi.stubGlobal('self', { location: { origin: 'http://atlas.test' } });
    vi.stubGlobal('fetch', async (url: string) => {
      const rel = String(url).replace(/^\//, '');
      if (rel === 'data/offline-manifest.json') return new Response(JSON.stringify(manifest), { status: 200 });
      if (failing.has(rel)) return new Response('no', { status: 500 });
      const body = server[rel];
      return body === undefined ? new Response('404', { status: 404 }) : new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });
    serve({ '02-catalogo/a.html': 'A', '02-catalogo/b.html': 'B', '02-catalogo/c.html': 'C' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetOfflineManifestForTests();
  });

  const run = (only?: string[]) => {
    const events: OfflineProgress[] = [];
    return downloadCatalogOffline((p) => events.push(p), new AbortController().signal, only).then((final) => ({ final, events }));
  };

  it('perfil limpio: ninguna copia', async () => {
    const st = await getOfflineStatus();
    expect(st).toMatchObject({ availability: 'none', cachedCount: 0, totalCount: 3, isComplete: false });
  });

  it('descarga completa: contadores coherentes, puntero y estado completo', async () => {
    const { final } = await run();
    expect(final).toMatchObject({ currentPhase: 'complete', total: 3, processed: 3, succeeded: 3, alreadyCached: 0, failed: 0, cancelled: 0 });
    expect((await readOfflineState())?.activeRevision).toBe(manifest.revision);
    expect(await getOfflineStatus()).toMatchObject({ availability: 'complete', isComplete: true, cachedCount: 3 });
  });

  it('descarga parcial: un fallo impide declarar completo y no mueve el puntero', async () => {
    failing.add('02-catalogo/b.html');
    const { final } = await run();
    expect(final).toMatchObject({ currentPhase: 'error', succeeded: 2, failed: 1, processed: 3 });
    expect(final.failedUrls).toEqual(['02-catalogo/b.html']);
    expect(await readOfflineState()).toBeNull();
    expect((await getOfflineStatus()).availability).toBe('partial');
    failing.clear();
    const retry = await run(final.failedUrls);
    expect(retry.final).toMatchObject({ currentPhase: 'complete', succeeded: 1, total: 1 });
    expect((await getOfflineStatus()).isComplete).toBe(true);
  });

  it('SHA-256 distinto del manifiesto → fallo de integridad, no se guarda', async () => {
    server['02-catalogo/c.html'] = 'C alterado';
    const { final } = await run();
    expect(final.integrityFailures).toEqual(['02-catalogo/c.html']);
    expect(final.currentPhase).toBe('error');
    const cache = await storage.open(cacheNameForVersion(manifest.version));
    expect(await cache.match('/02-catalogo/c.html')).toBeUndefined();
  });

  it('cancelación: cuenta lo no procesado y conserva lo guardado', async () => {
    const ctrl = new AbortController();
    const events: OfflineProgress[] = [];
    ctrl.abort();
    const final = await downloadCatalogOffline((p) => events.push(p), ctrl.signal);
    expect(final.currentPhase).toBe('cancelled');
    expect(final.processed + final.cancelled).toBe(final.total);
    expect(await readOfflineState()).toBeNull();
  });

  it('cuota agotada: error explícito y la revisión anterior completa se conserva', async () => {
    await run();
    const oldRevision = manifest.revision;
    serve({ '02-catalogo/a.html': 'A2', '02-catalogo/b.html': 'B', '02-catalogo/c.html': 'C' });
    const newCache = await storage.open(cacheNameForVersion(manifest.version));
    newCache.failPut = () => new DOMException('full', 'QuotaExceededError');
    const { final } = await run();
    expect(final).toMatchObject({ currentPhase: 'error', quotaExceeded: true });
    expect((await readOfflineState())?.activeRevision).toBe(oldRevision);
    expect(await storage.has(cacheNameForVersion(oldRevision.slice(0, 16)))).toBe(true);
    expect((await getOfflineStatus()).availability).toBe('stale');
  });

  it('revisión nueva: dos fases — la anterior solo se borra al completar la nueva', async () => {
    await run();
    const oldName = cacheNameForVersion(manifest.version);
    serve({ '02-catalogo/a.html': 'A', '02-catalogo/b.html': 'B', '02-catalogo/c.html': 'C, guía actualizada' });
    expect((await getOfflineStatus()).availability).toBe('stale');
    failing.add('02-catalogo/c.html');
    await run();
    expect(await storage.has(oldName)).toBe(true);
    failing.clear();
    const { final } = await run();
    expect(final).toMatchObject({ currentPhase: 'complete', alreadyCached: 2, succeeded: 1 });
    expect(await storage.has(oldName)).toBe(false);
    expect((await readOfflineState())?.activeRevision).toBe(manifest.revision);
  });

  it('corrupción controlada: la verificación elimina lo dañado, retira el puntero y una descarga repara', async () => {
    await run();
    const cache = await storage.open(cacheNameForVersion(manifest.version));
    await cache.put('/02-catalogo/b.html', new Response('dañado'));
    const report = await verifyOfflineIntegrity();
    expect(report.corrupted).toEqual(['02-catalogo/b.html']);
    expect((await getOfflineStatus()).isComplete).toBe(false);
    const { final } = await run();
    expect(final).toMatchObject({ currentPhase: 'complete', succeeded: 1, alreadyCached: 2 });
    expect((await verifyOfflineIntegrity()).corrupted).toEqual([]);
  });

  it('borrado: elimina copias y puntero sin tocar otras cachés', async () => {
    await run();
    await storage.open('workbox-precache-v2');
    await clearOfflineCatalog();
    expect(await storage.keys()).toEqual(['workbox-precache-v2']);
    expect((await getOfflineStatus()).availability).toBe('none');
  });
});
