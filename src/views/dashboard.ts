import { el, formatNumber, withBase } from '../lib/dom';
import { createFineLineIcon } from '../lib/icons';
import { buildHashUrl, navigate } from '../lib/router';
import { renderCategoryCard, renderToolCard } from '../components/cards';
import type { CatalogIndex } from '../types/catalog';

function createFineLineCurve(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 780 34');
  svg.setAttribute('class', 'hero-curve');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0 24 C120 24 140 5 260 5 S430 32 545 19 S680 6 780 14');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.4');
  path.setAttribute('fill', 'none');
  svg.appendChild(path);
  return svg;
}

export function renderDashboardView(
  index: CatalogIndex,
  onFavoriteChange: () => void,
): HTMLElement {
  const container = el('div', { className: 'detail-stack' });

  const searchInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      placeholder: 'Buscar por herramienta, descripción o categoría (ej. semgrep, firmware, nmap)…',
      'aria-label': 'Buscar en Evol Tool Atlas',
      autocomplete: 'off',
    },
  });

  const searchForm = el(
    'form',
    {
      className: 'hero-search-form',
      on: {
        submit: (ev) => {
          ev.preventDefault();
          const q = searchInput.value.trim();
          navigate(buildHashUrl('/buscar', { q }));
        },
      },
    },
    searchInput,
    el(
      'button',
      { className: 'btn btn-primary', attrs: { type: 'submit' } },
      createFineLineIcon('search'),
      'Buscar en el atlas',
    ),
    el('a', {
      className: 'btn',
      attrs: { href: '#/offline' },
      text: 'Preparar uso offline',
    }),
  );

  const hero = el(
    'section',
    { className: 'hero-window' },
    el(
      'div',
      { className: 'hero-brand-row' },
      el('img', {
        className: 'evol-wordmark-hero',
        attrs: {
          src: withBase('assets/brand/evol.svg'),
          alt: 'Evol',
        },
      }),
      el(
        'div',
        { className: 'pill-row' },
        el('span', { className: 'pill pill-accent', text: `Edición ${index.date}` }),
        el('span', { className: 'pill', text: 'Documentación estática · Sin ejecución' }),
      ),
    ),
    el('h1', { className: 'hero-title', text: 'Evol Tool Atlas' }),
    el('p', {
      className: 'hero-lead',
      text: 'Catálogo documental de herramientas de seguridad, auditoría y análisis para Evol OS, organizado en 48 categorías con preservación íntegra de fichas y acceso offline.',
    }),
    createFineLineCurve(),
    searchForm,
  );

  const kpiGrid = el(
    'section',
    { className: 'kpi-grid', attrs: { 'aria-label': 'Resumen cuantitativo del catálogo' } },
    el(
      'article',
      { className: 'card' },
      el('span', { className: 'kpi-label', text: 'Categorías' }),
      el('span', { className: 'kpi-value', text: formatNumber(index.totals.categories) }),
      el('span', { className: 'kpi-sub', text: 'Índices navegables verificados' }),
    ),
    el(
      'article',
      { className: 'card' },
      el('span', { className: 'kpi-label', text: 'Fichas admitidas' }),
      el('span', { className: 'kpi-value', text: formatNumber(index.totals.admitted) }),
      el('span', { className: 'kpi-sub', text: 'Con procedencia documental trazada' }),
    ),
    el(
      'article',
      { className: 'card' },
      el('span', { className: 'kpi-label', text: 'Entradas excluidas' }),
      el('span', { className: 'kpi-value', text: formatNumber(index.totals.excluded) }),
      el('span', { className: 'kpi-sub', text: 'Documentadas en auditoría, fuera del índice' }),
    ),
    el(
      'article',
      { className: 'card' },
      el('span', { className: 'kpi-label', text: 'Registros analizados' }),
      el('span', { className: 'kpi-value', text: formatNumber(index.totals.totalEntries) }),
      el('span', { className: 'kpi-sub', text: 'Corpus total de referencia documental' }),
    ),
  );

  const notice = el(
    'section',
    { className: 'notice-box', attrs: { 'aria-label': 'Alcance de la validación documental' } },
    createFineLineIcon('info'),
    el(
      'div',
      null,
      el('h2', { text: 'Validación documental, no operativa' }),
      el('p', {
        text: `${index.globalWarning} La inclusión de una ficha no certifica instalación, mantenimiento activo, licencia compatible ni funcionamiento en CachyOS. Esta PWA nunca descarga, instala ni ejecuta software del catálogo.`,
      }),
    ),
  );

  container.append(hero, kpiGrid, notice);

  const toolById = new Map(index.tools.map((t) => [t.id, t]));
  const featuredTools = index.featuredIds
    .map((id) => toolById.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  if (featuredTools.length > 0) {
    container.append(
      el(
        'section',
        null,
        el(
          'div',
          { className: 'section-header' },
          el('h2', { text: 'Fichas con verificación de fuente reciente' }),
          el('a', {
            className: 'btn btn-sm',
            attrs: { href: buildHashUrl('/buscar', { ev: 'verificada' }) },
            text: 'Ver todas las verificadas',
          }),
        ),
        el('p', { className: 'section-subtitle', text: index.featuredCriterion }),
        el(
          'div',
          { className: 'cards-grid' },
          ...featuredTools.map((tool) => renderToolCard(tool, { onFavoriteChange })),
        ),
      ),
    );
  }

  container.append(
    el(
      'section',
      null,
      el(
        'div',
        { className: 'section-header' },
        el('h2', { text: `Explorar ${formatNumber(index.categories.length)} categorías` }),
        el('a', {
          className: 'btn btn-sm',
          attrs: { href: '#/categorias' },
          text: 'Abrir explorador completo',
        }),
      ),
      el(
        'div',
        { className: 'cards-grid' },
        ...index.categories.map((cat) => renderCategoryCard(cat)),
      ),
    ),
  );

  return container;
}
