import { el, formatNumber } from '../lib/dom';
import { renderBreadcrumbs } from '../components/breadcrumbs';
import { clearFavorites, getFavorites, getFavoritesPersistence, removeFavorite } from '../lib/favorites';
import { createFineLineIcon } from '../lib/icons';
import { buildHashUrl } from '../lib/router';
import { normalizeText } from '../lib/search';
import { renderToolCard } from '../components/cards';
import { renderStatePanel } from '../components/states';
import type { CatalogIndex } from '../types/catalog';

export function renderFavoritesView(
  index: CatalogIndex,
  onFavoriteChange: () => void,
): HTMLElement {
  const container = el('div', { className: 'detail-stack' });
  const toolById = new Map(index.tools.map((t) => [t.id, t]));

  let filterQ = '';
  let confirmClear = false;

  const filterInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      placeholder: 'Filtrar tus favoritos guardados…',
      'aria-label': 'Filtrar favoritos',
      autocomplete: 'off',
    },
  });

  const clearBtn = el(
    'button',
    {
      className: 'btn',
      attrs: { type: 'button' },
      on: {
        click: () => {
          if (!confirmClear) {
            confirmClear = true;
            clearBtn.textContent = 'Confirmar vaciado de favoritos';
            return;
          }
          clearFavorites();
          confirmClear = false;
          onFavoriteChange();
          renderBody();
        },
      },
    },
    createFineLineIcon('trash'),
    'Vaciar favoritos',
  );

  const exportBtn = el(
    'button',
    {
      className: 'btn',
      attrs: { type: 'button' },
      on: {
        click: () => {
          const favs = getFavorites();
          const blob = new Blob([JSON.stringify(favs, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'evol-tool-atlas-favoritos.json';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
      },
    },
    createFineLineIcon('docOpen'),
    'Exportar JSON',
  );

  const countText = el('p', { className: 'section-subtitle', attrs: { 'aria-live': 'polite' } });
  const listHost = el('div');

  const renderBody = () => {
    const favorites = getFavorites();
    const norm = normalizeText(filterQ);
    const filtered = favorites.filter((f) => {
      if (!norm) return true;
      return (
        normalizeText(f.name).includes(norm) ||
        normalizeText(f.id).includes(norm) ||
        normalizeText(f.categoryName).includes(norm)
      );
    });

    clearBtn.disabled = favorites.length === 0;
    exportBtn.disabled = favorites.length === 0;
    const n = favorites.length;
    const where = getFavoritesPersistence().status === 'persistent'
      ? 'localmente en este navegador'
      : 'solo durante esta sesión (el almacenamiento local no está disponible)';
    countText.textContent = `${formatNumber(n)} ficha${n === 1 ? '' : 's'} guardada${n === 1 ? '' : 's'} ${where}, sin cuentas ni envío a terceros.`;

    listHost.replaceChildren();
    if (favorites.length === 0) {
      listHost.append(
        renderStatePanel({
          icon: 'favorite',
          title: 'Todavía no tienes favoritos guardados',
          description:
            'Marca cualquier herramienta en el explorador o en su ficha para tener acceso rápido aquí, incluso sin conexión.',
          actions: [
            el('a', {
              className: 'btn btn-primary',
              attrs: { href: '#/categorias' },
              text: 'Explorar categorías',
            }),
            el('a', {
              className: 'btn',
              attrs: { href: '#/buscar' },
              text: 'Ir al buscador',
            }),
          ],
        }),
      );
      return;
    }

    if (filtered.length === 0) {
      listHost.append(
        renderStatePanel({
          icon: 'search',
          title: 'Ningún favorito coincide con el filtro',
          description: 'Limpia el texto de filtrado para ver todos tus favoritos.',
        }),
      );
      return;
    }

    const cards = filtered.map((fav) => {
      const summary = toolById.get(fav.id);
      if (summary) {
        return renderToolCard(summary, {
          onFavoriteChange: () => {
            onFavoriteChange();
            renderBody();
          },
        });
      }
      return el(
        'article',
        { className: 'card tool-card' },
        el(
          'div',
          null,
          el(
            'h3',
            { className: 'tool-card-title' },
            el('a', {
              attrs: { href: buildHashUrl(`/herramienta/${encodeURIComponent(fav.id)}`) },
              text: fav.name,
            }),
          ),
          el('p', { className: 'tool-card-desc', text: fav.categoryName }),
        ),
        el(
          'button',
          {
            className: 'btn btn-sm',
            attrs: { type: 'button' },
            on: {
              click: () => {
                removeFavorite(fav.id);
                onFavoriteChange();
                renderBody();
              },
            },
          },
          'Quitar',
        ),
      );
    });

    listHost.append(el('div', { className: 'cards-grid' }, ...cards));
  };

  filterInput.addEventListener('input', () => {
    filterQ = filterInput.value;
    renderBody();
  });

  container.append(
    el(
      'header',
      { className: 'surface-window' },
      renderBreadcrumbs([{ label: 'Inicio', href: '#/' }, { label: 'Favoritos' }]),
      el('h1', { text: 'Favoritos locales' }),
      countText,
    ),
    el('div', { className: 'controls-bar' }, filterInput, exportBtn, clearBtn),
    listHost,
  );

  renderBody();
  return container;
}
