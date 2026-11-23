import { describe, expect, it } from 'vitest';
import { isSafeCatalogPath, isSafeHttpUrl } from '../../src/lib/dom';

describe('URL and path security validators', () => {
  it('accepts only http and https URLs', () => {
    expect(isSafeHttpUrl('https://github.com/semgrep/semgrep')).toBe(true);
    expect(isSafeHttpUrl('http://example.org/project')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });

  it('accepts only safe relative catalog and reference paths', () => {
    expect(isSafeCatalogPath('02-catalogo/testing-y-auditoria/semgrep/index.html')).toBe(true);
    expect(isSafeCatalogPath('05-referencias/auditoria-v2.3.2/INFORME-FINAL.json')).toBe(true);
    expect(isSafeCatalogPath('catalogo.json')).toBe(true);
    expect(isSafeCatalogPath('../secrets.txt')).toBe(false);
    expect(isSafeCatalogPath('/etc/passwd')).toBe(false);
    expect(isSafeCatalogPath('02-catalogo/../../etc/passwd')).toBe(false);
    expect(isSafeCatalogPath('javascript:alert(1)')).toBe(false);
  });
});
