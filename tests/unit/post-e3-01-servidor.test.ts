/**
 * SEC-DEV-01 (middleware estático del servidor dev), SEC-WEB-01 (cabeceras del hosting)
 * y QA-03 (base path único). Las pruebas ejecutan el middleware de producción contra
 * un repositorio de prueba en os.tmpdir con symlinks hacia fuera de las raíces.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDevStaticMiddleware, resolveDevStaticRequest } from '../../scripts/lib/dev-static.mjs';
import {
  APP_CSP_HEADER,
  APP_CSP_META,
  DOCUMENT_CSP_HEADER,
  createSecurityHeadersMiddleware,
  policyForPath,
} from '../../scripts/lib/security-headers.mjs';
import { DEFAULT_BASE_PATH, normalizeBasePath, resolveBasePath } from '../../scripts/lib/base-path.mjs';

const BASE = '/evol-tool-atlas/';
let root = '';
let outside = '';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-devstatic-'));
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-outside-'));
  fs.mkdirSync(path.join(root, '02-catalogo', 'seguridad', 'tool'), { recursive: true });
  fs.mkdirSync(path.join(root, '05-referencias'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'atds'), { recursive: true });
  fs.writeFileSync(path.join(root, '02-catalogo', 'seguridad', 'tool', 'index.html'), '<p>ficha</p>');
  fs.writeFileSync(path.join(root, '02-catalogo', 'seguridad', 'tool', 'metadata.json'), '{"id":"tool"}');
  fs.writeFileSync(path.join(root, 'catalogo.json'), '{}');
  fs.writeFileSync(path.join(root, 'docs', 'atds', 'ATDS-v1.md'), '# ATDS');
  fs.writeFileSync(path.join(root, 'docs', 'atds', 'INTERNO.md'), 'no publicar');
  fs.writeFileSync(path.join(root, 'package.json'), '{"secret":true}');
  fs.writeFileSync(path.join(outside, 'secreto.txt'), 'fuera');
  fs.symlinkSync(path.join(outside, 'secreto.txt'), path.join(root, '02-catalogo', 'enlace.txt'));
  fs.symlinkSync(outside, path.join(root, '02-catalogo', 'dir-enlace'));
  fs.symlinkSync(path.join(root, 'package.json'), path.join(root, '05-referencias', 'pkg.json'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

interface FakeResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  ended: Promise<void>;
}

function request(url: string): Promise<{ next: boolean; res: FakeResponse }> {
  const mw = createDevStaticMiddleware(BASE, root);
  return new Promise((resolve) => {
    let resolveEnd: () => void = () => {};
    const ended = new Promise<void>((r) => {
      resolveEnd = r;
    });
    const chunks: Buffer[] = [];
    const fake = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      ended,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      write(chunk: Buffer | string) {
        chunks.push(Buffer.from(chunk));
        return true;
      },
      end(chunk?: Buffer | string) {
        if (chunk) chunks.push(Buffer.from(chunk));
        this.body = Buffer.concat(chunks).toString('utf8');
        resolveEnd();
        return this;
      },
      on() {
        return this;
      },
      once() {
        return this;
      },
      emit() {
        return true;
      },
    };
    let calledNext = false;
    mw({ url } as IncomingMessage, fake as unknown as ServerResponse, () => {
      calledNext = true;
      resolveEnd();
    });
    void ended.then(() => resolve({ next: calledNext, res: fake }));
  });
}

describe('SEC-DEV-01: middleware estático del servidor dev', () => {
  it('sirve una ficha legítima y su metadata', async () => {
    const html = await request(`${BASE}02-catalogo/seguridad/tool/index.html`);
    expect(html.next).toBe(false);
    expect(html.res.statusCode).toBe(200);
    expect(html.res.body).toBe('<p>ficha</p>');
    const dir = await request(`${BASE}02-catalogo/seguridad/tool/`);
    expect(dir.res.body).toBe('<p>ficha</p>');
    const meta = await request(`${BASE}02-catalogo/seguridad/tool/metadata.json?x=1`);
    expect(meta.res.headers['content-type']).toContain('application/json');
  });

  it('sirve los archivos sueltos autorizados', async () => {
    expect((await request(`${BASE}catalogo.json`)).res.statusCode).toBe(200);
    expect((await request(`${BASE}docs/atds/ATDS-v1.md`)).res.body).toBe('# ATDS');
  });

  it('deja pasar las rutas que no pertenecen al catálogo', async () => {
    expect((await request(`${BASE}src/main.ts`)).next).toBe(true);
    expect((await request(`${BASE}`)).next).toBe(true);
  });

  const adversarial: Array<[string, number]> = [
    // Traversal reproduced against the original middleware: it served package.json.
    [`${BASE}02-catalogo/../package.json`, 403],
    [`${BASE}02-catalogo/seguridad/../../package.json`, 403],
    [`${BASE}05-referencias/./../package.json`, 403],
    [`${BASE}02-catalogo/..%2fpackage.json`, 403],
    [`${BASE}02-catalogo/%2e%2e/package.json`, 403],
    [`${BASE}02-catalogo/%252e%252e/package.json`, 403],
    [`${BASE}02-catalogo/..\\package.json`, 403],
    [`${BASE}02-catalogo/%5c..%5cpackage.json`, 403],
    [`${BASE}02-catalogo//etc/passwd`, 403],
    [`${BASE}02-catalogo/%00.html`, 403],
    [`${BASE}02-catalogo/%`, 403],
    [`${BASE}02-catalogo/enlace.txt`, 403],
    [`${BASE}02-catalogo/dir-enlace/secreto.txt`, 403],
    [`${BASE}05-referencias/pkg.json`, 403],
    [`${BASE}docs/atds/INTERNO.md`, 403],
    [`${BASE}docs/../package.json`, 403],
    [`${BASE}02-catalogo/no-existe.html`, 404],
  ];
  for (const [url, status] of adversarial) {
    it(`rechaza ${url} con ${status}`, async () => {
      const r = await request(url);
      expect(r.next).toBe(false);
      expect(r.res.statusCode).toBe(status);
      expect(r.res.body).not.toContain('secret');
      expect(r.res.body).not.toContain('fuera');
      expect(r.res.body).not.toContain(root);
    });
  }

  it('el resolvedor no devuelve nunca un archivo fuera de las raíces', () => {
    const r = resolveDevStaticRequest(`${BASE}02-catalogo/../package.json`, BASE, root);
    expect(r.kind).toBe('reject');
  });
});

describe('SEC-WEB-01: cabeceras del hosting real (vite preview)', () => {
  it('la SPA recibe la CSP de la app con frame-ancestors', () => {
    expect(policyForPath(`${BASE}`, BASE)).toBe('APP');
    expect(policyForPath(`${BASE}data/catalog-index.json`, BASE)).toBe('APP');
    expect(APP_CSP_HEADER).toContain("frame-ancestors 'none'");
    expect(APP_CSP_HEADER).toContain("script-src 'self'");
    expect(APP_CSP_HEADER).not.toContain('unsafe');
  });

  it('la meta CSP no incluye frame-ancestors (los navegadores lo ignoran en meta)', () => {
    expect(APP_CSP_META).not.toContain('frame-ancestors');
  });

  it('las páginas estáticas reciben una política sin scripts', () => {
    for (const p of ['02-catalogo/x/index.html', '05-referencias/a.json', 'skills/s/SKILL.md', 'docs/atds/ATDS-v1.md']) {
      expect(policyForPath(`${BASE}${p}`, BASE)).toBe('DOCUMENT');
    }
    expect(DOCUMENT_CSP_HEADER).toContain("script-src 'none'");
    expect(DOCUMENT_CSP_HEADER).toContain("default-src 'none'");
    expect(DOCUMENT_CSP_HEADER).toContain("frame-ancestors 'none'");
    expect(DOCUMENT_CSP_HEADER).not.toContain("'unsafe-eval'");
  });

  it('el middleware aplica las cabeceras a cada respuesta', () => {
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => { headers[k] = v; } } as unknown as ServerResponse;
    let next = false;
    createSecurityHeadersMiddleware(BASE)({ url: `${BASE}02-catalogo/a/index.html` } as IncomingMessage, res, () => { next = true; });
    expect(next).toBe(true);
    expect(headers['Content-Security-Policy']).toBe(DOCUMENT_CSP_HEADER);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
  });
});

describe('QA-03: base path único', () => {
  it('normaliza las variantes', () => {
    expect(resolveBasePath({})).toBe(DEFAULT_BASE_PATH);
    expect(normalizeBasePath('/')).toBe('/');
    expect(normalizeBasePath('atlas')).toBe('/atlas/');
    expect(normalizeBasePath('/a//b')).toBe('/a/b/');
  });
  it('rechaza valores peligrosos', () => {
    expect(() => normalizeBasePath('/../x/')).toThrow();
    expect(() => normalizeBasePath('https://evil.example/')).toThrow();
    expect(() => normalizeBasePath('/a?b')).toThrow();
  });
});
