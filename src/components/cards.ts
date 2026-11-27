import { el, formatNumber } from '../lib/dom';
import { plural } from '../lib/labels';
import { createFineLineIcon } from '../lib/icons';
import { buildHashUrl } from '../lib/router';
import { isFavorite, toggleFavorite } from '../lib/favorites';
import type { CategorySummary, EvidenceGroup, ToolSummary } from '../types/catalog';

const EVIDENCE_GROUP_LABELS: Record<EvidenceGroup, string> = {
  verificada: 'Fuente verificada / revalidada',
  expediente: 'Expediente documental',
  historica: 'Referencia histórica',
};

export function evidenceGroupLabel(group: EvidenceGroup): string {
  return EVIDENCE_GROUP_LABELS[group];
}

export function renderToolCard(
  tool: ToolSummary,
  options?: { onFavoriteChange?: () => void },
): HTMLElement {
  let favActive = isFavorite(tool.id);

  const favBtn = el(
    'button',
    {
      className: 'btn btn-icon btn-sm',
      attrs: {
        type: 'button',
        'aria-pressed': String(favActive),
        'aria-label': favActive
          ? `Quitar ${tool.name} de favoritos`
          : `Guardar ${tool.name} en favoritos`,
        title: favActive ? 'Quitar de favoritos' : 'Añadir a favoritos',
      },
      on: {
        click: () => {
          favActive = toggleFavorite({
            id: tool.id,
            name: tool.name,
            categorySlug: tool.categorySlug,
            categoryName: tool.categoryName,
          });
          favBtn.setAttribute('aria-pressed', String(favActive));
          favBtn.setAttribute(
            'aria-label',
            favActive
              ? `Quitar ${tool.name} de favoritos`
              : `Guardar ${tool.name} en favoritos`,
          );
          options?.onFavoriteChange?.();
        },
      },
    },
    createFineLineIcon('favorite'),
  );

  const detailHref = buildHashUrl(`/herramienta/${encodeURIComponent(tool.id)}`);
  const catHref = buildHashUrl(`/categoria/${encodeURIComponent(tool.categorySlug)}`);

  const badgeClass = tool.evidenceGroup === 'verificada' ? 'pill pill-accent' : 'pill pill-muted';

  return el(
    'article',
    {
      className: 'card card-interactive tool-card',
      attrs: { 'data-tool-id': tool.id },
    },
    el(
      'div',
      null,
      el(
        'div',
        { className: 'tool-card-head' },
        el(
          'h3',
          { className: 'tool-card-title' },
          el('a', { attrs: { href: detailHref }, text: tool.name }),
        ),
        favBtn,
      ),
      el('p', {
        className: 'tool-card-desc',
        text: tool.description || 'Ficha documental sin descripción en el registro de origen.',
      }),
    ),
    el(
      'div',
      { className: 'tool-card-footer' },
      el(
        'div',
        { className: 'pill-row' },
        el('a', {
          className: 'pill',
          attrs: { href: catHref },
          text: tool.categoryName,
        }),
        el('span', {
          className: badgeClass,
          text: evidenceGroupLabel(tool.evidenceGroup),
        }),
      ),
      el('a', {
        className: 'btn btn-sm',
        attrs: { href: detailHref },
        text: 'Ver ficha',
      }),
    ),
  );
}

export function renderCategoryCard(category: CategorySummary): HTMLElement {
  const catHref = buildHashUrl(`/categoria/${encodeURIComponent(category.slug)}`);
  const numLabel = `Categoría ${String(category.number).padStart(2, '0')}`;

  return el(
    'article',
    {
      className: 'card card-interactive tool-card',
      attrs: { 'data-category-slug': category.slug },
    },
    el(
      'div',
      null,
      el('span', { className: 'kpi-label', text: numLabel }),
      el(
        'h3',
        { className: 'tool-card-title' },
        el('a', { attrs: { href: catHref }, text: category.name }),
      ),
    ),
    el(
      'div',
      { className: 'tool-card-footer' },
      el(
        'div',
        { className: 'pill-row' },
        el('span', {
          className: 'pill pill-accent',
          text: `${formatNumber(category.admitted)} ${plural(category.admitted, 'ficha', 'fichas')}`,
        }),
        el('span', {
          className: 'pill pill-muted',
          text: `${formatNumber(category.excluded)} excluidas`,
        }),
      ),
      el('a', {
        className: 'btn btn-sm',
        attrs: { href: catHref },
        text: 'Explorar',
      }),
    ),
  );
}

export function renderPagination(
  page: number,
  totalPages: number,
  onPageChange: (nextPage: number) => void,
): HTMLElement | null {
  if (totalPages <= 1) return null;

  return el(
    'nav',
    {
      className: 'pagination',
      attrs: { 'aria-label': 'Paginación de resultados' },
    },
    el(
      'button',
      {
        className: 'btn',
        attrs: { type: 'button', disabled: page <= 1 },
        on: { click: () => onPageChange(page - 1) },
      },
      createFineLineIcon('prev'),
      'Anterior',
    ),
    el('span', {
      className: 'pill pill-muted',
      text: `Página ${formatNumber(page)} de ${formatNumber(totalPages)}`,
    }),
    el(
      'button',
      {
        className: 'btn',
        attrs: { type: 'button', disabled: page >= totalPages },
        on: { click: () => onPageChange(page + 1) },
      },
      'Siguiente',
      createFineLineIcon('next'),
    ),
  );
}
