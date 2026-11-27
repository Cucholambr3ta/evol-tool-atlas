/**
 * ROUTER-01 — hashes malformados producen una ruta inválida recuperable.
 */
import { describe, expect, it } from 'vitest';
import { parseHashRoute } from '../../src/lib/router';

describe('ROUTER-01: parseHashRoute nunca lanza', () => {
  const malformed = [
    '#/herramienta/%',
    '#/herramienta/%ZZ',
    '#/herramienta/%E0%A4%A',
    '#/herramienta/%C3',
    '#/categoria/%',
    '#/categoria/%FF%FE',
  ];
  for (const hash of malformed) {
    it(`devuelve "invalid" para ${hash}`, () => {
      let route: ReturnType<typeof parseHashRoute> | undefined;
      expect(() => {
        route = parseHashRoute(hash);
      }).not.toThrow();
      expect(route?.name).toBe('invalid');
      if (route?.name === 'invalid') {
        expect(route.reason).toBe('MALFORMED_ENCODING');
        expect(route.path.length).toBeGreaterThan(0);
      }
    });
  }

  it('rechaza segmentos de longitud extrema', () => {
    const route = parseHashRoute(`#/herramienta/${'a'.repeat(5000)}`);
    expect(route.name).toBe('invalid');
    if (route.name === 'invalid') expect(route.reason).toBe('SEGMENT_TOO_LONG');
  });

  it('conserva rutas Unicode válidas', () => {
    const route = parseHashRoute('#/herramienta/%C3%B1and%C3%BA');
    expect(route).toEqual({ name: 'tool', id: 'ñandú' });
    const cat = parseHashRoute('#/categoria/an%C3%A1lisis?page=2');
    expect(cat.name).toBe('category');
    if (cat.name === 'category') {
      expect(cat.slug).toBe('análisis');
      expect(cat.page).toBe(2);
    }
  });

  it('conserva la búsqueda con caracteres codificados', () => {
    const route = parseHashRoute('#/buscar?q=%C3%B1&cat=all&page=3');
    expect(route).toMatchObject({ name: 'search', q: 'ñ', page: 3 });
  });

  it('una consulta con escape incompleto no rompe la búsqueda', () => {
    expect(() => parseHashRoute('#/buscar?q=%')).not.toThrow();
  });

  it('las rutas conocidas siguen resolviendo igual', () => {
    expect(parseHashRoute('')).toEqual({ name: 'dashboard' });
    expect(parseHashRoute('#/categorias')).toEqual({ name: 'categories' });
    expect(parseHashRoute('#/herramienta/semgrep')).toEqual({ name: 'tool', id: 'semgrep' });
    expect(parseHashRoute('#/no-existe').name).toBe('not-found');
  });
});
