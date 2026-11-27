import { el } from '../lib/dom';

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page. */
  href?: string;
}

/**
 * Breadcrumb trail (A11Y-04): a navigation landmark with an ordered list; the
 * last item is the current page. Keeps the existing `.breadcrumbs` look.
 */
export function renderBreadcrumbs(items: BreadcrumbItem[]): HTMLElement {
  const last = items.length - 1;
  return el(
    'nav',
    { className: 'breadcrumbs', attrs: { 'aria-label': 'Ruta de navegación' } },
    el(
      'ol',
      { className: 'breadcrumbs-list' },
      ...items.map((item, i) =>
        el(
          'li',
          null,
          i === last || !item.href
            ? el('span', { text: item.label, attrs: i === last ? { 'aria-current': 'page' } : {} })
            : el('a', { attrs: { href: item.href }, text: item.label }),
        ),
      ),
    ),
  );
}
