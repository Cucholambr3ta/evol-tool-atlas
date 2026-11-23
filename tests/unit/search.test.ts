import { describe, expect, it } from 'vitest';
import { filterAndSortTools, normalizeText } from '../../src/lib/search';
import type { ToolSummary } from '../../src/types/catalog';

const SAMPLE_TOOLS: ToolSummary[] = [
  {
    id: 'semgrep',
    name: 'Semgrep',
    categoryNumber: 24,
    categorySlug: 'auditoria-codigo',
    categoryName: 'Auditoría de código',
    description: 'Análisis estático basado en patrones y reglas.',
    evidenceStatus: 'FUENTE_Y_RELEASE_VERIFICADOS',
    evidenceGroup: 'verificada',
    origin: 'entrega_anterior',
    htmlHref: '02-catalogo/testing-y-auditoria/semgrep/index.html',
    revalidated20261122: true,
    historicalFlag: false,
  },
  {
    id: 'bluediving',
    name: 'bluediving',
    categoryNumber: 22,
    categorySlug: 'bluetooth',
    categoryName: 'Bluetooth',
    description: 'A Bluetooth penetration testing suite.',
    evidenceStatus: 'REFERENCIA_HISTORICA_NO_APROBADA',
    evidenceGroup: 'historica',
    origin: 'entrega_anterior',
    htmlHref: '02-catalogo/seguridad/catalogo/bluediving/index.html',
    revalidated20261122: false,
    historicalFlag: true,
  },
  {
    id: 'firmware-mod-kit',
    name: 'Firmware Mod Kit',
    categoryNumber: 1,
    categorySlug: 'firmware',
    categoryName: 'Firmware',
    description: 'Colección histórica de scripts para firmware.',
    evidenceStatus: 'REPOSITORIO_HISTORICO_ACCESIBLE',
    evidenceGroup: 'historica',
    origin: 'entrega_anterior',
    htmlHref: '02-catalogo/seguridad/catalogo/firmware-mod-kit/index.html',
    revalidated20261122: false,
    historicalFlag: true,
  },
  {
    id: 'nmap',
    name: 'nmap',
    categoryNumber: 46,
    categorySlug: 'reconocimiento',
    categoryName: 'Reconocimiento',
    description: 'Utility for network discovery and security auditing.',
    evidenceStatus: 'FUENTE_COMPROBADA_EN_EXPEDIENTE_2026-11-21',
    evidenceGroup: 'expediente',
    origin: 'entrega_46_48',
    htmlHref: '02-catalogo/seguridad/catalogo/nmap/index.html',
    revalidated20261122: false,
    historicalFlag: false,
  },
];

describe('search and filtering', () => {
  it('normalizes Spanish accents and casing', () => {
    expect(normalizeText('  Auditoría de Código  ')).toBe('auditoria de codigo');
  });

  it('matches accent-insensitively and ranks exact/prefix matches first', () => {
    const res = filterAndSortTools(
      SAMPLE_TOOLS,
      {
        query: 'analisis estatico',
        categorySlug: 'all',
        evidenceGroup: 'all',
        favoritesOnly: false,
        sort: 'relevance',
        page: 1,
        pageSize: 20,
      },
      new Set(),
    );
    expect(res.total).toBe(1);
    expect(res.items[0]?.id).toBe('semgrep');
  });

  it('filters by category, evidenceGroup, and favoritesOnly', () => {
    const favs = new Set(['bluediving', 'semgrep']);
    const res = filterAndSortTools(
      SAMPLE_TOOLS,
      {
        query: '',
        categorySlug: 'bluetooth',
        evidenceGroup: 'historica',
        favoritesOnly: true,
        sort: 'name-asc',
        page: 1,
        pageSize: 20,
      },
      favs,
    );
    expect(res.total).toBe(1);
    expect(res.items[0]?.id).toBe('bluediving');
  });

  it('paginates deterministically', () => {
    const res = filterAndSortTools(
      SAMPLE_TOOLS,
      {
        query: '',
        categorySlug: 'all',
        evidenceGroup: 'all',
        favoritesOnly: false,
        sort: 'name-asc',
        page: 2,
        pageSize: 2,
      },
      new Set(),
    );
    expect(res.totalPages).toBe(2);
    expect(res.page).toBe(2);
    expect(res.items.map((t) => t.id)).toEqual(['nmap', 'semgrep']);
  });
});
