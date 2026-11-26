import { el, formatNumber, isSafeCatalogPath, withBase } from '../lib/dom';
import { getFavoriteIds } from '../lib/favorites';
import { createFineLineIcon } from '../lib/icons';
import { buildHashUrl, navigate, type Route } from '../lib/router';
import { filterAndSortTools, normalizeText } from '../lib/search';
import { renderCategoryCard, renderPagination, renderToolCard } from '../components/cards';
import { renderStatePanel } from '../components/states';
import type { CatalogIndex, CategoryShard, EvidenceGroup } from '../types/catalog';

export function renderCategoriesExplorerView(index: CatalogIndex): HTMLElement {
  const container = el('div', { className: 'detail-stack' });
  let filterText = '';
  let sortMode = 'number';

  const searchInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      placeholder: 'Filtrar las 49 categorías por nombre o identificador…',
      'aria-label': 'Filtrar categorías',
      autocomplete: 'off',
    },
  });

  const sortSelect = el(
    'select',
    {
      className: 'select',
      attrs: { 'aria-label': 'Ordenar categorías' },
    },
    el('option', { attrs: { value: 'number' }, text: 'Orden original (01–49)' }),
    el('option', { attrs: { value: 'name' }, text: 'Alfabético (A–Z)' }),
    el('option', { attrs: { value: 'admitted-desc' }, text: 'Más fichas admitidas' }),
    el('option', { attrs: { value: 'excluded-desc' }, text: 'Más entradas excluidas' }),
  );

  const countLabel = el('p', { className: 'section-subtitle', attrs: { 'aria-live': 'polite' } });
  const grid = el('div', { className: 'cards-grid' });

  const renderGrid = () => {
    const norm = normalizeText(filterText);
    const filtered = index.categories.filter((c) => {
      if (!norm) return true;
      return (
        normalizeText(c.name).includes(norm) ||
        normalizeText(c.slug).includes(norm) ||
        String(c.number).includes(norm)
      );
    });

    filtered.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'es');
      if (sortMode === 'admitted-desc') return b.admitted - a.admitted || a.number - b.number;
      if (sortMode === 'excluded-desc') return b.excluded - a.excluded || a.number - b.number;
      return a.number - b.number;
    });

    countLabel.textContent = `Mostrando ${formatNumber(filtered.length)} de ${formatNumber(index.categories.length)} categorías.`;
    grid.replaceChildren();
    if (filtered.length === 0) {
      grid.append(
        renderStatePanel({
          icon: 'search',
          title: 'Ninguna categoría coincide',
          description: 'Prueba con otro término o limpia el filtro actual.',
          actions: [
            el(
              'button',
              {
                className: 'btn btn-primary',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    filterText = '';
                    searchInput.value = '';
                    renderGrid();
                  },
                },
              },
              'Mostrar todas las categorías',
            ),
          ],
        }),
      );
      return;
    }
    for (const cat of filtered) {
      grid.append(renderCategoryCard(cat));
    }
  };

  searchInput.addEventListener('input', () => {
    filterText = searchInput.value;
    renderGrid();
  });

  sortSelect.addEventListener('change', () => {
    sortMode = sortSelect.value;
    renderGrid();
  });

  container.append(
    el(
      'header',
      { className: 'surface-window' },
      el('div', { className: 'breadcrumbs' }, el('a', { attrs: { href: '#/' }, text: 'Inicio' }), '/', el('span', { text: 'Categorías' })),
      el('h1', { text: `Explorador de ${formatNumber(index.categories.length)} categorías` }),
      el('p', {
        className: 'section-subtitle',
        text: `Conteos derivados directamente del índice documental: ${formatNumber(index.totals.admitted)} fichas admitidas y ${formatNumber(index.totals.excluded)} entradas excluidas de ${formatNumber(index.totals.totalEntries)} registros.`,
      }),
    ),
    el('div', { className: 'controls-bar' }, searchInput, sortSelect),
    countLabel,
    grid,
  );

  renderGrid();
  return container;
}

export function renderCategoryDetailView(
  index: CatalogIndex,
  shard: CategoryShard,
  route: Extract<Route, { name: 'category' }>,
  onFavoriteChange: () => void,
): HTMLElement {
  const cat = shard.category;
  const container = el('div', { className: 'detail-stack' });

  const headerActions: HTMLElement[] = [];
  if (isSafeCatalogPath(cat.htmlHref)) {
    headerActions.push(
      el(
        'a',
        {
          className: 'btn btn-sm',
          attrs: { href: withBase(cat.htmlHref), target: '_blank', rel: 'noopener noreferrer' },
        },
        createFineLineIcon('docOpen'),
        'Abrir índice HTML original',
      ),
    );
  }
  if (isSafeCatalogPath(cat.validationJsonHref)) {
    headerActions.push(
      el(
        'a',
        {
          className: 'btn btn-sm',
          attrs: { href: withBase(cat.validationJsonHref), target: '_blank', rel: 'noopener noreferrer' },
        },
        createFineLineIcon('evidence'),
        'VALIDACION.json',
      ),
    );
  }

  const header = el(
    'header',
    { className: 'surface-window' },
    el(
      'div',
      { className: 'breadcrumbs' },
      el('a', { attrs: { href: '#/' }, text: 'Inicio' }),
      '/',
      el('a', { attrs: { href: '#/categorias' }, text: 'Categorías' }),
      '/',
      el('span', { text: cat.name }),
    ),
    el(
      'div',
      { className: 'detail-header' },
      el(
        'div',
        null,
        el('span', {
          className: 'kpi-label',
          text: `Categoría ${String(cat.number).padStart(2, '0')} · ${cat.slug}`,
        }),
        el('h1', { className: 'detail-title', text: cat.name }),
      ),
      el('div', { className: 'pill-row' }, ...headerActions),
    ),
    el(
      'div',
      { className: 'pill-row' },
      el('span', { className: 'pill pill-accent', text: `${formatNumber(cat.admitted)} fichas admitidas` }),
      el('span', { className: 'pill pill-muted', text: `${formatNumber(cat.excluded)} excluidas` }),
      el('span', { className: 'pill', text: `${formatNumber(cat.totalEntries)} registros de origen` }),
    ),
  );

  // Use index summaries for fast filtering within this category
  const catSummaries = index.tools.filter((t) => t.categorySlug === cat.slug);

  let q = route.q;
  let ev = route.evidence as EvidenceGroup | 'all';
  let sort = (route.sort || 'name-asc') as 'relevance' | 'name-asc' | 'name-desc' | 'evidence';
  let favOnly = false;
  let page = route.page;

  const qInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      value: q,
      placeholder: `Buscar dentro de ${cat.name}…`,
      'aria-label': `Buscar en categoría ${cat.name}`,
      autocomplete: 'off',
    },
  });

  const evSelect = el(
    'select',
    { className: 'select', attrs: { 'aria-label': 'Filtrar por nivel de evidencia' } },
    el('option', { attrs: { value: 'all' }, text: 'Toda la evidencia' }),
    el('option', { attrs: { value: 'verificada' }, text: 'Fuente verificada / revalidada' }),
    el('option', { attrs: { value: 'expediente' }, text: 'Expediente documental' }),
    el('option', { attrs: { value: 'historica' }, text: 'Referencia histórica' }),
  );
  evSelect.value = ev;

  const sortSelect = el(
    'select',
    { className: 'select', attrs: { 'aria-label': 'Ordenar herramientas' } },
    el('option', { attrs: { value: 'name-asc' }, text: 'Nombre (A–Z)' }),
    el('option', { attrs: { value: 'name-desc' }, text: 'Nombre (Z–A)' }),
    el('option', { attrs: { value: 'evidence' }, text: 'Nivel de evidencia' }),
  );
  sortSelect.value = sort;

  const favCheckbox = el('input', {
    attrs: { type: 'checkbox' },
  });

  const favToggle = el(
    'label',
    { className: 'check-label' },
    favCheckbox,
    'Solo favoritos',
  );

  const countEl = el('p', { className: 'section-subtitle', attrs: { 'aria-live': 'polite' } });
  const resultsHost = el('div');

  const updateList = () => {
    const res = filterAndSortTools(
      catSummaries,
      {
        query: q,
        categorySlug: cat.slug,
        evidenceGroup: ev,
        favoritesOnly: favOnly,
        sort,
        page,
        pageSize: 36,
      },
      getFavoriteIds(),
    );

    countEl.textContent = `Mostrando ${formatNumber(res.items.length)} de ${formatNumber(res.total)} fichas en ${cat.name}.`;
    resultsHost.replaceChildren();

    if (res.items.length === 0) {
      resultsHost.append(
        renderStatePanel({
          icon: 'search',
          title: 'Sin resultados en esta categoría',
          description: 'Ninguna ficha coincide con los filtros seleccionados.',
          actions: [
            el(
              'button',
              {
                className: 'btn btn-primary',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    q = '';
                    ev = 'all';
                    favOnly = false;
                    page = 1;
                    qInput.value = '';
                    evSelect.value = 'all';
                    favCheckbox.checked = false;
                    updateList();
                  },
                },
              },
              'Limpiar filtros',
            ),
          ],
        }),
      );
      return;
    }

    const grid = el(
      'div',
      { className: 'cards-grid' },
      ...res.items.map((tool) => renderToolCard(tool, { onFavoriteChange })),
    );
    resultsHost.append(grid);

    const pag = renderPagination(res.page, res.totalPages, (nextPage) => {
      page = nextPage;
      navigate(
        buildHashUrl(`/categoria/${encodeURIComponent(cat.slug)}`, {
          q,
          ev,
          sort,
          page: nextPage,
        }),
      );
    });
    if (pag) resultsHost.append(pag);
  };

  qInput.addEventListener('input', () => {
    q = qInput.value;
    page = 1;
    updateList();
  });
  evSelect.addEventListener('change', () => {
    ev = evSelect.value as EvidenceGroup | 'all';
    page = 1;
    updateList();
  });
  sortSelect.addEventListener('change', () => {
    sort = sortSelect.value as typeof sort;
    page = 1;
    updateList();
  });
  favCheckbox.addEventListener('change', () => {
    favOnly = favCheckbox.checked;
    page = 1;
    updateList();
  });

  container.append(
    header,
    el('div', { className: 'controls-bar' }, qInput, evSelect, sortSelect, favToggle),
    countEl,
    resultsHost,
  );

  if (shard.excludedEntries.length > 0) {
    const exclRows = shard.excludedEntries.map((ex) =>
      el(
        'tr',
        null,
        el('td', { className: 'mono', text: ex.name }),
        el('td', { text: ex.reason }),
        el('td', { text: ex.evidenceDate ?? '—' }),
      ),
    );
    const exclDetails = el(
      'details',
      { className: 'surface-window' },
      el('summary', {
        text: `Ver ${formatNumber(shard.excludedEntries.length)} entradas excluidas del índice navegable`,
      }),
      shard.exclusionRule
        ? el('p', { className: 'section-subtitle', text: `Criterio: ${shard.exclusionRule}` })
        : null,
      el(
        'div',
        { className: 'table-wrap' },
        el(
          'table',
          { className: 'evol-table' },
          el(
            'thead',
            null,
            el('tr', null, el('th', { text: 'Entrada' }), el('th', { text: 'Motivo de exclusión' }), el('th', { text: 'Fecha' })),
          ),
          el('tbody', null, ...exclRows),
        ),
      ),
    );
    container.append(exclDetails);
  }

  updateList();
  return container;
}
