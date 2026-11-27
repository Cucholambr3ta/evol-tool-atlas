import { el, formatNumber } from '../lib/dom';
import { renderBreadcrumbs } from '../components/breadcrumbs';
import { getFavoriteIds } from '../lib/favorites';
import { createFineLineIcon } from '../lib/icons';
import { buildHashUrl, navigate, type Route } from '../lib/router';
import { filterAndSortTools } from '../lib/search';
import { renderPagination, renderToolCard } from '../components/cards';
import { renderStatePanel } from '../components/states';
import type { CatalogIndex, EvidenceGroup } from '../types/catalog';

export function renderSearchView(
  index: CatalogIndex,
  route: Extract<Route, { name: 'search' }>,
  onFavoriteChange: () => void,
): HTMLElement {
  const container = el('div', { className: 'detail-stack' });

  const qInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      value: route.q,
      placeholder: 'Buscar herramienta, descripción o categoría…',
      'aria-label': 'Término de búsqueda global',
      autocomplete: 'off',
    },
  });

  const catSelect = el(
    'select',
    { className: 'select', attrs: { 'aria-label': 'Filtrar por categoría' } },
    el('option', { attrs: { value: 'all' }, text: 'Todas las categorías (49)' }),
    ...index.categories.map((c) =>
      el('option', {
        attrs: { value: c.slug },
        text: `${String(c.number).padStart(2, '0')} · ${c.name} (${c.admitted})`,
      }),
    ),
  );
  catSelect.value = route.cat || 'all';

  const evSelect = el(
    'select',
    { className: 'select', attrs: { 'aria-label': 'Filtrar por evidencia' } },
    el('option', { attrs: { value: 'all' }, text: 'Toda la evidencia' }),
    el('option', { attrs: { value: 'verificada' }, text: 'Fuente verificada / revalidada' }),
    el('option', { attrs: { value: 'expediente' }, text: 'Expediente documental' }),
    el('option', { attrs: { value: 'historica' }, text: 'Referencia histórica' }),
  );
  evSelect.value = route.evidence || 'all';

  const sortSelect = el(
    'select',
    { className: 'select', attrs: { 'aria-label': 'Ordenar resultados' } },
    el('option', { attrs: { value: 'relevance' }, text: 'Relevancia' }),
    el('option', { attrs: { value: 'name-asc' }, text: 'Nombre (A–Z)' }),
    el('option', { attrs: { value: 'name-desc' }, text: 'Nombre (Z–A)' }),
    el('option', { attrs: { value: 'evidence' }, text: 'Evidencia documental' }),
  );
  sortSelect.value = route.sort || 'relevance';

  const favCheckbox = el('input', { attrs: { type: 'checkbox', checked: route.fav } });
  const favToggle = el('label', { className: 'check-label' }, favCheckbox, 'Solo favoritos');

  const submitSearch = (nextPage = 1) => {
    navigate(
      buildHashUrl('/buscar', {
        q: qInput.value.trim(),
        cat: catSelect.value,
        ev: evSelect.value,
        fav: favCheckbox.checked,
        sort: sortSelect.value,
        page: nextPage > 1 ? nextPage : undefined,
      }),
    );
  };

  const controlsForm = el(
    'form',
    {
      className: 'controls-bar',
      on: {
        submit: (ev) => {
          ev.preventDefault();
          submitSearch(1);
        },
      },
    },
    qInput,
    catSelect,
    evSelect,
    sortSelect,
    favToggle,
    el(
      'button',
      { className: 'btn btn-primary', attrs: { type: 'submit' } },
      createFineLineIcon('search'),
      'Aplicar',
    ),
    el(
      'button',
      {
        className: 'btn',
        attrs: { type: 'button' },
        on: {
          click: () => navigate('#/buscar'),
        },
      },
      createFineLineIcon('clear'),
      'Limpiar',
    ),
  );

  catSelect.addEventListener('change', () => submitSearch(1));
  evSelect.addEventListener('change', () => submitSearch(1));
  sortSelect.addEventListener('change', () => submitSearch(1));
  favCheckbox.addEventListener('change', () => submitSearch(1));

  const res = filterAndSortTools(
    index.tools,
    {
      query: route.q,
      categorySlug: route.cat || 'all',
      evidenceGroup: (route.evidence || 'all') as EvidenceGroup | 'all',
      favoritesOnly: route.fav,
      sort: (route.sort || 'relevance') as 'relevance' | 'name-asc' | 'name-desc' | 'evidence',
      page: route.page,
      pageSize: 36,
    },
    getFavoriteIds(),
  );

  const summaryLine = el('p', {
    className: 'section-subtitle',
    attrs: { 'aria-live': 'polite' },
    text: `${formatNumber(res.total)} resultado${res.total === 1 ? '' : 's'} en ${formatNumber(index.totals.admitted)} fichas admitidas.`,
  });

  container.append(
    el(
      'header',
      { className: 'surface-window' },
      renderBreadcrumbs([{ label: 'Inicio', href: '#/' }, { label: 'Buscador global' }]),
      el('h1', { text: 'Buscador del catálogo' }),
      summaryLine,
    ),
    controlsForm,
  );

  if (res.items.length === 0) {
    container.append(
      renderStatePanel({
        icon: 'search',
        title: 'Búsqueda sin resultados',
        description:
          'No se encontraron fichas admitidas que coincidan con la consulta y los filtros activos.',
        actions: [
          el('a', {
            className: 'btn btn-primary',
            attrs: { href: '#/buscar' },
            text: 'Restablecer búsqueda',
          }),
          el('a', {
            className: 'btn',
            attrs: { href: '#/categorias' },
            text: 'Explorar categorías',
          }),
        ],
      }),
    );
    return container;
  }

  container.append(
    el(
      'div',
      { className: 'cards-grid' },
      ...res.items.map((tool) => renderToolCard(tool, { onFavoriteChange })),
    ),
  );

  const pag = renderPagination(res.page, res.totalPages, (nextPage) => submitSearch(nextPage));
  if (pag) container.append(pag);

  return container;
}
