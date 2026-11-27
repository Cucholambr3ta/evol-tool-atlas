import { el, formatNumber, withBase } from './lib/dom';
import { loadCatalogIndex, loadCategoryShard, loadToolDetail, OfflineUnavailableError } from './lib/data';
import { getFavoritesPersistence, subscribeFavorites } from './lib/favorites';
import { createFineLineIcon } from './lib/icons';
import { getOfflineStatus } from './lib/offline';
import { applySwUpdate, getPwaState, initPwa, promptInstall, subscribePwa } from './lib/pwa';
import { buildHashUrl, navigate, parseHashRoute, type Route } from './lib/router';
import { normalizeText } from './lib/search';
import { cycleThemePreference, initTheme, subscribeTheme } from './lib/theme';
import { renderErrorState, renderLoadingState, renderOfflineUnavailableState, renderStatePanel } from './components/states';
import { renderAboutView } from './views/about';
import { renderCategoriesExplorerView, renderCategoryDetailView } from './views/categories';
import { renderDashboardView } from './views/dashboard';
import { renderFavoritesView } from './views/favorites';
import { renderOfflineView } from './views/offline';
import { renderSearchView } from './views/search';
import { renderToolDetailView } from './views/tool-detail';
import type { CatalogIndex } from './types/catalog';

const THEME_LABELS = {
  system: 'Tema: Sistema',
  light: 'Tema: Claro',
  dark: 'Tema: Oscuro',
} as const;

export function mountApp(rootEl: HTMLElement): void {
  initTheme();
  initPwa();

  let catalogIndex: CatalogIndex | null = null;
  let routeToken = 0;
  let drawerOpen = false;
  let sidebarCatFilter = '';

  const skipLink = el('a', {
    className: 'skip-link',
    attrs: { href: '#main-content' },
    text: 'Saltar al contenido principal',
  });

  const menuBtn = el(
    'button',
    {
      className: 'btn btn-icon mobile-menu-btn',
      attrs: {
        type: 'button',
        'aria-label': 'Abrir menú de navegación y categorías',
        'aria-expanded': 'false',
        'aria-controls': 'atlas-sidebar',
      },
    },
    createFineLineIcon('menu'),
  );

  const brandLauncher = el(
    'a',
    {
      className: 'brand-launcher',
      attrs: { href: '#/', 'aria-label': 'Evol Tool Atlas — Inicio' },
    },
    el('img', {
      className: 'evol-o-mark',
      attrs: { src: withBase('assets/brand/o.svg'), alt: '' },
    }),
    el(
      'span',
      { className: 'brand-title-group' },
      el('span', { className: 'brand-app-name', text: 'Evol Tool Atlas' }),
      el('span', { className: 'brand-app-sub', text: 'Catálogo documental Evol OS' }),
    ),
  );

  const topSearchInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      placeholder: 'Buscar herramienta o categoría (/)…',
      'aria-label': 'Buscador global de herramientas',
      autocomplete: 'off',
    },
  });

  const topSearchForm = el(
    'form',
    {
      className: 'topbar-search',
      on: {
        submit: (ev) => {
          ev.preventDefault();
          navigate(buildHashUrl('/buscar', { q: topSearchInput.value.trim() }));
        },
      },
    },
    topSearchInput,
    el(
      'button',
      {
        className: 'btn btn-icon',
        attrs: { type: 'submit', 'aria-label': 'Ejecutar búsqueda' },
      },
      createFineLineIcon('search'),
    ),
  );

  const favBadge = el('span', { className: 'badge-count', text: '0' });
  const favLink = el(
    'a',
    {
      className: 'btn btn-sm',
      attrs: { href: '#/favoritos', 'aria-label': 'Favoritos (0) — ver herramientas favoritas' },
    },
    createFineLineIcon('favorite'),
    el('span', { text: 'Favoritos' }),
    favBadge,
  );

  const offlinePillText = el('span', { text: 'En línea' });
  const offlineIconHost = el('span', null, createFineLineIcon('online'));
  const offlineLink = el(
    'a',
    {
      className: 'btn btn-sm',
      attrs: { href: '#/offline', 'aria-label': 'En línea — estado de disponibilidad sin conexión' },
    },
    offlineIconHost,
    offlinePillText,
  );

  const themeBtnText = el('span', { text: 'Tema: Sistema' });
  const themeBtn = el(
    'button',
    {
      className: 'btn btn-sm',
      attrs: { type: 'button', 'aria-label': 'Tema: Sistema — cambiar tema visual (Sistema, Claro, Oscuro)' },
      on: {
        click: () => {
          cycleThemePreference();
        },
      },
    },
    createFineLineIcon('theme'),
    themeBtnText,
  );

  const installBtn = el(
    'button',
    {
      className: 'btn btn-primary btn-sm',
      attrs: { type: 'button', hidden: true },
      on: {
        click: () => {
          void promptInstall();
        },
      },
    },
    createFineLineIcon('grid'),
    'Instalar app',
  );

  const topbar = el(
    'header',
    { className: 'topbar' },
    el(
      'div',
      { className: 'topbar-inner' },
      el('div', { className: 'topbar-left' }, menuBtn, brandLauncher),
      topSearchForm,
      el('div', { className: 'topbar-actions' }, favLink, offlineLink, themeBtn, installBtn),
    ),
  );

  // System banners (Offline + SW Update)
  const offlineBanner = el(
    'div',
    { className: 'system-banner', attrs: { role: 'status', hidden: true } },
    el(
      'div',
      { className: 'system-banner-inner' },
      el(
        'div',
        { className: 'system-banner-msg' },
        createFineLineIcon('offline'),
        el('span', {
          text: 'Modo sin conexión activo. Puedes consultar las vistas precargadas y cualquier ficha descargada en caché.',
        }),
      ),
      el('a', { className: 'btn btn-sm', attrs: { href: '#/offline' }, text: 'Centro offline' }),
    ),
  );

  const updateBanner = el(
    'div',
    { className: 'system-banner', attrs: { role: 'status', hidden: true } },
    el(
      'div',
      { className: 'system-banner-inner' },
      el(
        'div',
        { className: 'system-banner-msg' },
        createFineLineIcon('update'),
        el('span', {
          text: 'Hay una nueva versión de Evol Tool Atlas lista para activarse sin perder tus favoritos.',
        }),
      ),
      el(
        'button',
        {
          className: 'btn btn-primary btn-sm',
          attrs: { type: 'button' },
          on: {
            click: () => {
              void applySwUpdate();
            },
          },
        },
        'Actualizar ahora',
      ),
    ),
  );

  // FAV-01: never promise persistence the browser did not grant.
  const favStorageText = el('span', { text: '' });
  const favStorageBanner = el(
    'div',
    { className: 'system-banner', attrs: { role: 'status', hidden: true, 'data-favorites-persistence': 'session-only' } },
    el('div', { className: 'system-banner-inner' }, el('div', { className: 'system-banner-msg' }, createFineLineIcon('warning'), favStorageText)),
  );

  const systemBanners = el('div', { className: 'system-banners' }, offlineBanner, updateBanner, favStorageBanner);

  // Sidebar + Drawer
  const sidebarCloseBtn = el(
    'button',
    {
      className: 'btn btn-icon btn-sm sidebar-close-btn',
      attrs: { type: 'button', 'aria-label': 'Cerrar menú lateral' },
    },
    createFineLineIcon('close'),
  );

  const navLinks: Array<{ key: string; href: string; label: string; icon: Parameters<typeof createFineLineIcon>[0]; badge?: HTMLElement }> = [
    { key: 'dashboard', href: '#/', label: 'Inicio', icon: 'home' },
    { key: 'categories', href: '#/categorias', label: 'Categorías (49)', icon: 'security' },
    { key: 'search', href: '#/buscar', label: 'Buscador', icon: 'search' },
    { key: 'favorites', href: '#/favoritos', label: 'Favoritos', icon: 'favorite', badge: el('span', { className: 'badge-count', text: '0' }) },
    { key: 'offline', href: '#/offline', label: 'Uso sin conexión', icon: 'download' },
    { key: 'about', href: '#/acerca', label: 'Política documental', icon: 'info' },
  ];

  const navLinkEls = new Map<string, HTMLAnchorElement>();
  const sidebarPrimaryNav = el(
    'nav',
    { className: 'sidebar-nav-primary', attrs: { 'aria-label': 'Navegación principal' } },
    ...navLinks.map((item) => {
      const a = el(
        'a',
        { className: 'sidebar-nav-link', attrs: { href: item.href } },
        el('span', { className: 'sidebar-nav-link-main' }, createFineLineIcon(item.icon), item.label),
        item.badge ?? null,
      );
      navLinkEls.set(item.key, a);
      return a;
    }),
  );

  const sidebarFilterInput = el('input', {
    className: 'input',
    attrs: {
      type: 'search',
      placeholder: 'Ir a categoría…',
      'aria-label': 'Filtrar lista rápida de categorías',
      autocomplete: 'off',
    },
  });

  const sidebarCatsList = el('nav', {
    className: 'sidebar-cats-list',
    attrs: { 'aria-label': 'Acceso rápido a las 49 categorías' },
  });

  const sidebar = el(
    'aside',
    {
      id: 'atlas-sidebar',
      className: 'sidebar',
      attrs: { 'aria-label': 'Panel lateral de navegación' },
    },
    el(
      'div',
      { className: 'sidebar-header' },
      el('strong', { text: 'Navegación' }),
      sidebarCloseBtn,
    ),
    sidebarPrimaryNav,
    el('div', { className: 'sidebar-cats-filter' }, sidebarFilterInput),
    sidebarCatsList,
  );

  const backdrop = el('div', {
    className: 'drawer-backdrop',
    attrs: { 'aria-hidden': 'true' },
  });

  const mainContent = el('main', {
    id: 'main-content',
    className: 'main-content',
    attrs: { tabindex: '-1' },
  });

  const footer = el(
    'footer',
    { className: 'app-footer' },
    el(
      'div',
      { className: 'app-footer-inner' },
      el('span', {
        text: 'Evol Tool Atlas · Sistema visual oficial Evol OS (Minimal line art) · Documentación estática sin ejecución ni telemetría.',
      }),
      el(
        'div',
        { className: 'pill-row' },
        el('a', { attrs: { href: '#/acerca' }, text: 'Política documental' }),
        el('a', { attrs: { href: '#/offline' }, text: 'Centro offline' }),
        el('a', { attrs: { href: withBase('catalogo.json'), target: '_blank', rel: 'noopener noreferrer' }, text: 'catalogo.json' }),
      ),
    ),
  );

  const shell = el(
    'div',
    { className: 'app-shell' },
    skipLink,
    topbar,
    systemBanners,
    el('div', { className: 'workspace-grid' }, sidebar, mainContent),
    backdrop,
    footer,
  );

  rootEl.replaceChildren(shell);

  // A11Y-01: on narrow screens the sidebar is an overlay drawer. While open, the
  // rest of the page is inert (not focusable, hidden from assistive tech), focus
  // moves into the drawer and stays there, and Escape / backdrop / close button
  // close it and return focus to the menu button. It is not announced as a dialog.
  const backgroundRegions = (): HTMLElement[] => [skipLink, topbar, systemBanners, mainContent, footer];
  const isOverlayLayout = () => getComputedStyle(menuBtn).display !== 'none';

  const focusableIn = (root: HTMLElement): HTMLElement[] =>
    Array.from(
      root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter((n) => !n.hidden && n.offsetParent !== null);

  const setDrawerOpen = (next: boolean, options: { restoreFocus?: boolean } = {}) => {
    const wasOpen = drawerOpen;
    drawerOpen = next;
    sidebar.classList.toggle('is-open', next);
    backdrop.classList.toggle('is-visible', next);
    menuBtn.setAttribute('aria-expanded', String(next));
    const modal = next && isOverlayLayout();
    for (const region of backgroundRegions()) region.inert = modal;
    if (modal) {
      sidebarCloseBtn.focus();
    } else if (wasOpen && options.restoreFocus) {
      menuBtn.focus();
    }
  };

  menuBtn.addEventListener('click', () => setDrawerOpen(!drawerOpen, { restoreFocus: true }));
  sidebarCloseBtn.addEventListener('click', () => setDrawerOpen(false, { restoreFocus: true }));
  backdrop.addEventListener('click', () => setDrawerOpen(false, { restoreFocus: true }));

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && drawerOpen) {
      ev.preventDefault();
      setDrawerOpen(false, { restoreFocus: true });
      return;
    }
    if (ev.key === 'Tab' && drawerOpen && isOverlayLayout()) {
      const items = focusableIn(sidebar);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (!sidebar.contains(document.activeElement)) {
        ev.preventDefault();
        first.focus();
      } else if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
      return;
    }
    if (ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const active = document.activeElement;
      const isInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;
      if (!isInput && !drawerOpen) {
        ev.preventDefault();
        topSearchInput.focus();
        topSearchInput.select();
      }
    }
  });

  const refreshSidebarCategories = (activeSlug?: string) => {
    if (!catalogIndex) return;
    const norm = normalizeText(sidebarCatFilter);
    const items = catalogIndex.categories.filter((c) => {
      if (!norm) return true;
      return normalizeText(c.name).includes(norm) || normalizeText(c.slug).includes(norm);
    });
    sidebarCatsList.replaceChildren(
      ...items.map((cat) => {
        const href = buildHashUrl(`/categoria/${encodeURIComponent(cat.slug)}`);
        const a = el(
          'a',
          {
            className: 'sidebar-cat-item',
            attrs: {
              href,
              ...(activeSlug === cat.slug ? { 'aria-current': 'page' } : {}),
            },
          },
          el('span', { className: 'sidebar-cat-name', text: `${String(cat.number).padStart(2, '0')} · ${cat.name}` }),
          el('span', { className: 'sidebar-cat-count', text: formatNumber(cat.admitted) }),
        );
        a.addEventListener('click', () => setDrawerOpen(false));
        return a;
      }),
    );
  };

  let currentActiveCatSlug: string | undefined;

  sidebarFilterInput.addEventListener('input', () => {
    sidebarCatFilter = sidebarFilterInput.value;
    refreshSidebarCategories(currentActiveCatSlug);
  });

  const refreshOfflinePill = async () => {
    const pwa = getPwaState();
    const st = await getOfflineStatus();
    offlineIconHost.replaceChildren(createFineLineIcon(pwa.isOnline ? 'online' : 'offline'));
    if (!pwa.isOnline) {
      offlinePillText.textContent = st.isComplete ? 'Sin conexión (listo)' : 'Sin conexión';
    } else if (st.isComplete) {
      offlinePillText.textContent = 'Offline listo';
    } else if (st.cachedCount > 0) {
      offlinePillText.textContent = `Offline ${Math.round((st.cachedCount / Math.max(1, st.totalCount)) * 100)}%`;
    } else {
      offlinePillText.textContent = 'En línea';
    }
    offlineLink.setAttribute('aria-label', `${offlinePillText.textContent} — estado de disponibilidad sin conexión`);
  };

  subscribeTheme((pref) => {
    themeBtnText.textContent = THEME_LABELS[pref];
    themeBtn.setAttribute('aria-label', `${THEME_LABELS[pref]} — cambiar tema visual (Sistema, Claro, Oscuro)`);
  });

  subscribeFavorites((favs, persistence) => {
    favStorageBanner.hidden = persistence === 'persistent';
    if (persistence !== 'persistent') {
      const { reason } = getFavoritesPersistence();
      favStorageText.textContent = `Favoritos guardados solo durante esta sesión: ${reason ?? 'el almacenamiento local no está disponible.'} Se perderán al cerrar la pestaña.`;
    }
    const label = formatNumber(favs.length);
    favBadge.textContent = label;
    favLink.setAttribute('aria-label', `Favoritos (${label}) — ver herramientas favoritas`);
    const sideFavBadge = navLinks.find((l) => l.key === 'favorites')?.badge;
    if (sideFavBadge) sideFavBadge.textContent = label;
  });

  subscribePwa((pwa) => {
    offlineBanner.hidden = pwa.isOnline;
    updateBanner.hidden = !pwa.needRefresh;
    installBtn.hidden = !pwa.canInstall;
    void refreshOfflinePill();
  });

  const updateActiveNav = (route: Route) => {
    for (const [key, linkEl] of navLinkEls.entries()) {
      const isCurrent =
        (route.name === 'dashboard' && key === 'dashboard') ||
        (route.name === 'categories' && key === 'categories') ||
        (route.name === 'search' && key === 'search') ||
        (route.name === 'favorites' && key === 'favorites') ||
        (route.name === 'offline' && key === 'offline') ||
        (route.name === 'about' && key === 'about');
      if (isCurrent) {
        linkEl.setAttribute('aria-current', 'page');
      } else {
        linkEl.removeAttribute('aria-current');
      }
    }
    currentActiveCatSlug = route.name === 'category' ? route.slug : undefined;
    refreshSidebarCategories(currentActiveCatSlug);
  };

  // UX-01: one place decides focus and scroll after every view change.
  let previousRouteKey: string | null = null;
  const routeKey = (r: Route): string =>
    r.name === 'tool' ? `tool:${r.id}` : r.name === 'category' ? `category:${r.slug}` : r.name;

  const describeFocus = (node: Element | null): string | null => {
    if (!(node instanceof HTMLElement) || !mainContent.contains(node)) return null;
    return node.getAttribute('aria-label') ?? node.getAttribute('name') ?? (node.id || null);
  };

  const settleView = (route: Route, focusKey: string | null) => {
    const key = routeKey(route);
    const changed = key !== previousRouteKey;
    const first = previousRouteKey === null;
    previousRouteKey = key;
    const saved = (history.state as { atlasScrollY?: unknown } | null)?.atlasScrollY;
    if (typeof saved === 'number') window.scrollTo({ top: saved });
    else if (changed) window.scrollTo({ top: 0 });
    if (changed && !first) {
      const heading = mainContent.querySelector<HTMLElement>('h1') ?? mainContent;
      if (heading !== mainContent) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    } else if (focusKey) {
      // Same view re-rendered (filters, search): keep the user's place.
      const again = Array.from(mainContent.querySelectorAll<HTMLElement>('[aria-label], [name], [id]')).find(
        (n) => n.getAttribute('aria-label') === focusKey || n.getAttribute('name') === focusKey || n.id === focusKey,
      );
      again?.focus({ preventScroll: true });
    }
  };

  let scrollSaveTimer = 0;
  window.addEventListener('scroll', () => {
    window.clearTimeout(scrollSaveTimer);
    scrollSaveTimer = window.setTimeout(() => {
      const state = (history.state as Record<string, unknown> | null) ?? {};
      history.replaceState({ ...state, atlasScrollY: window.scrollY }, '');
    }, 150);
  }, { passive: true });

  const renderCurrentRoute = async () => {
    const token = ++routeToken;
    const focusKey = describeFocus(document.activeElement);
    const route = parseHashRoute(window.location.hash);
    setDrawerOpen(false);
    updateActiveNav(route);

    if (route.name === 'search') {
      topSearchInput.value = route.q;
    }

    mainContent.replaceChildren(renderLoadingState());

    try {
      if (route.name === 'offline') {
        document.title = 'Centro offline · Evol Tool Atlas';
        mainContent.replaceChildren(renderOfflineView(() => void refreshOfflinePill()));
        settleView(route, focusKey);
        return;
      }

      if (!catalogIndex) {
        catalogIndex = await loadCatalogIndex();
        if (token !== routeToken) return;
        refreshSidebarCategories(currentActiveCatSlug);
      }

      const handleFavoriteChange = () => {
        // Keep header/sidebar badges synced via subscribeFavorites automatically
      };

      if (route.name === 'dashboard') {
        document.title = 'Evol Tool Atlas · Catálogo documental';
        mainContent.replaceChildren(renderDashboardView(catalogIndex, handleFavoriteChange));
      } else if (route.name === 'categories') {
        document.title = 'Categorías · Evol Tool Atlas';
        mainContent.replaceChildren(renderCategoriesExplorerView(catalogIndex));
      } else if (route.name === 'category' && !catalogIndex.categories.some((c) => c.slug === route.slug)) {
        // Unknown slug: answer from the index instead of fetching a shard that does
        // not exist (the host would return the SPA shell, not JSON).
        document.title = 'Categoría no encontrada · Evol Tool Atlas';
        mainContent.replaceChildren(
          renderStatePanel({
            headingLevel: 1,
            icon: 'warning',
            title: 'Categoría no encontrada',
            description: `No existe ninguna categoría con el identificador "${route.slug}".`,
            actions: [
              el('a', { className: 'btn btn-primary', attrs: { href: '#/categorias' }, text: 'Ver las 49 categorías' }),
              el('a', { className: 'btn', attrs: { href: '#/' }, text: 'Volver al inicio' }),
            ],
          }),
        );
      } else if (route.name === 'category') {
        const shard = await loadCategoryShard(route.slug);
        if (token !== routeToken) return;
        document.title = `${shard.category.name} · Evol Tool Atlas`;
        mainContent.replaceChildren(
          renderCategoryDetailView(catalogIndex, shard, route, handleFavoriteChange),
        );
      } else if (route.name === 'search') {
        document.title = route.q ? `Buscar "${route.q}" · Evol Tool Atlas` : 'Buscador · Evol Tool Atlas';
        mainContent.replaceChildren(renderSearchView(catalogIndex, route, handleFavoriteChange));
      } else if (route.name === 'tool') {
        const detail = await loadToolDetail(route.id);
        if (token !== routeToken) return;
        if (!detail) {
          document.title = 'Ficha no encontrada · Evol Tool Atlas';
          mainContent.replaceChildren(
            renderStatePanel({
              headingLevel: 1,
              icon: 'warning',
              title: 'Ficha no encontrada',
              description: `No existe ninguna herramienta admitida con el identificador "${route.id}".`,
              actions: [
                el('a', { className: 'btn btn-primary', attrs: { href: '#/buscar' }, text: 'Ir al buscador' }),
                el('a', { className: 'btn', attrs: { href: '#/' }, text: 'Volver al inicio' }),
              ],
            }),
          );
          settleView(route, focusKey);
          return;
        }
        document.title = `${detail.name} · Evol Tool Atlas`;
        mainContent.replaceChildren(renderToolDetailView(detail, handleFavoriteChange));
      } else if (route.name === 'favorites') {
        document.title = 'Favoritos · Evol Tool Atlas';
        mainContent.replaceChildren(renderFavoritesView(catalogIndex, handleFavoriteChange));
      } else if (route.name === 'about') {
        document.title = 'Política documental · Evol Tool Atlas';
        mainContent.replaceChildren(renderAboutView(catalogIndex));
      } else if (route.name === 'invalid') {
        document.title = 'Ruta no válida · Evol Tool Atlas';
        mainContent.replaceChildren(
          renderStatePanel({
            headingLevel: 1,
            icon: 'warning',
            title: 'Ruta no válida',
            description:
              route.reason === 'SEGMENT_TOO_LONG'
                ? 'La dirección contiene un identificador demasiado largo para corresponder a una ficha o categoría.'
                : 'La dirección contiene caracteres codificados de forma incorrecta y no puede interpretarse.',
            actions: [
              el('a', { className: 'btn btn-primary', attrs: { href: '#/' }, text: 'Volver al inicio' }),
              el('a', { className: 'btn', attrs: { href: '#/buscar' }, text: 'Ir al buscador' }),
            ],
          }),
        );
      } else {
        document.title = 'Página no encontrada · Evol Tool Atlas';
        mainContent.replaceChildren(
          renderStatePanel({
            headingLevel: 1,
            icon: 'warning',
            title: 'Ruta no encontrada',
            description: `La ruta "${route.path}" no corresponde a una vista del atlas.`,
            actions: [
              el('a', { className: 'btn btn-primary', attrs: { href: '#/' }, text: 'Volver al inicio' }),
            ],
          }),
        );
      }
      settleView(route, focusKey);
    } catch (err) {
      if (token !== routeToken) return;
      if (err instanceof OfflineUnavailableError) {
        document.title = 'Sin conexión · Evol Tool Atlas';
        mainContent.replaceChildren(renderOfflineUnavailableState(err.message, 1));
      } else {
        document.title = 'Error · Evol Tool Atlas';
        const msg = err instanceof Error ? err.message : 'Error inesperado al cargar la vista.';
        mainContent.replaceChildren(renderErrorState(msg, () => void safeRender(), 1));
      }
      settleView(route, focusKey);
    }
  };

  // Never leave a rejected navigation promise unhandled (ROUTER-01).
  const safeRender = () =>
    renderCurrentRoute().catch((err: unknown) => {
      document.title = 'Error · Evol Tool Atlas';
      mainContent.replaceChildren(
        renderErrorState(err instanceof Error ? err.message : 'Error inesperado al cargar la vista.', () => void safeRender(), 1),
      );
    });

  for (const link of navLinkEls.values()) {
    link.addEventListener('click', () => setDrawerOpen(false));
  }

  window.addEventListener('hashchange', () => {
    void safeRender();
  });

  void safeRender();
}
