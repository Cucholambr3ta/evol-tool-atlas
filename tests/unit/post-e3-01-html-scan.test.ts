/**
 * SEC-STATIC-01 — escaneo estructural del HTML histórico.
 */
import { describe, expect, it } from 'vitest';
import { scanHtml, tokenizeTags } from '../../scripts/lib/html-scan.mjs';

const scan = (html: string, local = true) => scanHtml(html, { file: 'x.html', resolveLocal: () => local });
const doc = (body: string) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`;

describe('SEC-STATIC-01: tokenizador', () => {
  it('respeta comillas, comentarios y texto de <style>', () => {
    const tags = tokenizeTags('<!-- <script> --><a title="a > b" href=\'x.html\'>k</a><style>p{content:"<iframe>"}</style>');
    expect(tags.map((t) => t.name)).toEqual(['a', 'style']);
    expect(tags[0]?.attrs).toEqual([{ name: 'title', value: 'a > b' }, { name: 'href', value: 'x.html' }]);
  });
});

describe('SEC-STATIC-01: reglas bloqueantes', () => {
  it('documento limpio no bloquea', () => {
    const r = scan(doc('<a href="../otra/index.html">x</a><a href="https://ejemplo.org" target="_blank" rel="noopener noreferrer">y</a>'));
    expect(r.blocking).toEqual([]);
  });

  it.each([
    ['<script>alert(1)</script>', 'elemento <script>'],
    ['<SCRIPT src="a.js"></SCRIPT>', 'elemento <script>'],
    ['<iframe src="x"></iframe>', 'elemento <iframe>'],
    ['<base href="https://evil.example/">', 'elemento <base>'],
    ['<img src=x onerror=alert(1)>', 'atributo de evento onerror'],
    ['<a href="javascript:alert(1)">x</a>', 'esquema javascript'],
    ['<a href="jav&#x61;script:alert(1)">x</a>', 'esquema javascript'],
    ['<a href=" &#106;avascript:alert(1)">x</a>', 'esquema javascript'],
    ['<a href="data:text/html,x">x</a>', 'esquema data'],
    ['<img src="https://tracker.example/p.gif">', 'recurso remoto incrustado'],
    ['<img src="//tracker.example/p.gif">', 'recurso remoto incrustado'],
    ['<link rel="stylesheet" href="https://cdn.example/a.css">', '<link> remoto'],
    ['<meta http-equiv="refresh" content="0;url=https://x">', 'refresh'],
    ['<div style="background:url(https://x/y.png)">x</div>', 'style con url()'],
  ])('%s → bloquea (%s)', (html, expected) => {
    expect(scan(doc(html)).blocking.join(' | ')).toContain(expected);
  });

  it('enlace interno roto bloquea', () => {
    expect(scan(doc('<a href="no-existe.html">x</a>'), false).blocking.join()).toContain('enlace interno roto');
  });

  it('registra como advertencia los estilos en línea y target=_blank sin noopener', () => {
    const r = scan(doc('<style>p{}</style><a href="https://x.org" target="_blank">x</a>'));
    expect(r.blocking).toEqual([]);
    expect(r.advisory.join()).toContain('sin rel=noopener');
    expect(r.advisory.join()).toContain('estilos en línea');
  });
});
