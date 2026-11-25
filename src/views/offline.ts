import { el, formatNumber } from '../lib/dom';
import { createFineLineIcon } from '../lib/icons';
import {
  clearOfflineCatalog,
  downloadCatalogOffline,
  formatBytes,
  getOfflineStatus,
  type OfflineProgress,
  type OfflineStatus,
} from '../lib/offline';
import { getPwaState, promptInstall } from '../lib/pwa';

export function renderOfflineView(onStatusUpdated: () => void): HTMLElement {
  const container = el('div', { className: 'detail-stack' });

  let abortController: AbortController | null = null;
  let lastFailedUrls: string[] = [];
  let isDownloading = false;

  const statusGrid = el('section', { className: 'kpi-grid' });
  const progressSection = el('section', { className: 'surface-window' });
  const progressBar = el('progress', {
    className: 'evol-progress',
    attrs: { max: '100', value: '0' },
  });
  const progressText = el('p', {
    className: 'section-subtitle',
    attrs: { 'aria-live': 'polite' },
    text: 'Comprobando estado del almacenamiento offline…',
  });
  const feedbackBox = el('div');

  const downloadBtn = el(
    'button',
    {
      className: 'btn btn-primary',
      attrs: { type: 'button' },
    },
    createFineLineIcon('download'),
    'Guardar catálogo completo para uso sin conexión',
  );

  const cancelBtn = el(
    'button',
    {
      className: 'btn',
      attrs: { type: 'button', disabled: true },
    },
    createFineLineIcon('cancel'),
    'Cancelar descarga',
  );

  const retryBtn = el(
    'button',
    {
      className: 'btn',
      attrs: { type: 'button', hidden: true },
    },
    createFineLineIcon('refresh'),
    'Reintentar fallidos',
  );

  const refreshBtn = el(
    'button',
    {
      className: 'btn',
      attrs: { type: 'button' },
    },
    createFineLineIcon('refresh'),
    'Actualizar estado',
  );

  const clearBtn = el(
    'button',
    {
      className: 'btn',
      attrs: { type: 'button' },
    },
    createFineLineIcon('trash'),
    'Borrar copia offline',
  );

  const installBtn = el(
    'button',
    {
      className: 'btn',
      attrs: { type: 'button', hidden: true },
    },
    createFineLineIcon('grid'),
    'Instalar aplicación',
  );

  const renderKpis = (st: OfflineStatus) => {
    const pwa = getPwaState();
    installBtn.hidden = !pwa.canInstall;

    statusGrid.replaceChildren(
      el(
        'article',
        { className: 'card' },
        el('span', { className: 'kpi-label', text: 'Conectividad' }),
        el('span', { className: 'kpi-value', text: pwa.isOnline ? 'En línea' : 'Sin conexión' }),
        el('span', {
          className: 'kpi-sub',
          text: pwa.swRegistered ? 'Service Worker activo' : 'Service Worker pendiente',
        }),
      ),
      el(
        'article',
        { className: 'card' },
        el('span', { className: 'kpi-label', text: 'Recursos offline' }),
        el('span', {
          className: 'kpi-value',
          text: `${formatNumber(st.cachedCount)} / ${formatNumber(st.totalCount)}`,
        }),
        el('span', {
          className: 'kpi-sub',
          text: st.isComplete
            ? 'Catálogo documental completo disponible sin red'
            : 'App shell lista; catálogo bajo demanda o descarga completa',
        }),
      ),
      el(
        'article',
        { className: 'card' },
        el('span', { className: 'kpi-label', text: 'Almacenamiento usado' }),
        el('span', { className: 'kpi-value', text: formatBytes(st.usageBytes) }),
        el('span', {
          className: 'kpi-sub',
          text: `Cuota estimada: ${formatBytes(st.quotaBytes)}`,
        }),
      ),
      el(
        'article',
        { className: 'card' },
        el('span', { className: 'kpi-label', text: 'Modo de ejecución' }),
        el('span', {
          className: 'kpi-value',
          text: pwa.isStandalone ? 'Standalone' : 'Navegador',
        }),
        el('span', {
          className: 'kpi-sub',
          text: 'Tus favoritos en localStorage se conservan siempre',
        }),
      ),
    );

    if (!isDownloading) {
      const pct = st.totalCount > 0 ? Math.round((st.cachedCount / st.totalCount) * 100) : 0;
      progressBar.max = Math.max(1, st.totalCount);
      progressBar.value = st.cachedCount;
      progressText.textContent = st.isComplete
        ? `Catálogo completo guardado (${formatNumber(st.cachedCount)} de ${formatNumber(st.totalCount)} archivos · 100%).`
        : `${formatNumber(st.cachedCount)} de ${formatNumber(st.totalCount)} archivos guardados (${pct}%).`;
      downloadBtn.disabled = !st.supported || !pwa.isOnline;
      clearBtn.disabled = st.cachedCount === 0;
    }
  };

  const refreshStatus = async () => {
    const st = await getOfflineStatus();
    renderKpis(st);
    onStatusUpdated();
  };

  const handleProgress = (prog: OfflineProgress) => {
    const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
    progressBar.max = Math.max(1, prog.total);
    progressBar.value = prog.completed;

    if (prog.currentPhase === 'preparing') {
      progressText.textContent = 'Preparando lista de categorías, fichas HTML e informes…';
    } else if (prog.currentPhase === 'downloading') {
      progressText.textContent = `Guardando catálogo offline: ${formatNumber(prog.completed)} / ${formatNumber(prog.total)} (${pct}%) · omitidos ya en caché: ${formatNumber(prog.skipped)}.`;
    } else if (prog.currentPhase === 'complete') {
      progressText.textContent = `Descarga completada: ${formatNumber(prog.total)} recursos listos para consulta sin conexión.`;
    } else if (prog.currentPhase === 'cancelled') {
      progressText.textContent = prog.errorMessage ?? 'Descarga cancelada.';
    } else if (prog.currentPhase === 'error') {
      progressText.textContent = prog.errorMessage ?? 'Se produjeron errores durante la descarga.';
    }

    lastFailedUrls = prog.failedUrls;
    retryBtn.hidden = prog.failedUrls.length === 0 || isDownloading;
    feedbackBox.replaceChildren();
    if (prog.errorMessage && prog.currentPhase !== 'downloading') {
      feedbackBox.append(
        el(
          'div',
          { className: 'notice-box' },
          createFineLineIcon(prog.currentPhase === 'cancelled' ? 'info' : 'warning'),
          el('div', null, el('p', { text: prog.errorMessage })),
        ),
      );
    } else if (prog.currentPhase === 'complete') {
      feedbackBox.append(
        el(
          'div',
          { className: 'notice-box' },
          createFineLineIcon('success'),
          el('div', null, el('p', { text: 'Todas las categorías y las 2.137 fichas están disponibles sin conexión.' })),
        ),
      );
    }
  };

  const startDownload = async (onlyUrls?: string[]) => {
    if (isDownloading) return;
    isDownloading = true;
    abortController = new AbortController();
    downloadBtn.disabled = true;
    clearBtn.disabled = true;
    retryBtn.hidden = true;
    cancelBtn.disabled = false;

    try {
      await downloadCatalogOffline(handleProgress, abortController.signal, onlyUrls);
    } finally {
      isDownloading = false;
      abortController = null;
      cancelBtn.disabled = true;
      await refreshStatus();
    }
  };

  downloadBtn.addEventListener('click', () => {
    void startDownload();
  });

  retryBtn.addEventListener('click', () => {
    if (lastFailedUrls.length > 0) {
      void startDownload(lastFailedUrls);
    }
  });

  cancelBtn.addEventListener('click', () => {
    abortController?.abort();
  });

  refreshBtn.addEventListener('click', () => {
    void refreshStatus();
  });

  clearBtn.addEventListener('click', async () => {
    await clearOfflineCatalog();
    lastFailedUrls = [];
    retryBtn.hidden = true;
    feedbackBox.replaceChildren(
      el(
        'div',
        { className: 'notice-box' },
        createFineLineIcon('info'),
        el('div', null, el('p', { text: 'Copia offline del catálogo eliminada. Tus favoritos locales siguen intactos.' })),
      ),
    );
    await refreshStatus();
  });

  installBtn.addEventListener('click', () => {
    void promptInstall();
  });

  progressSection.append(
    el('h2', { text: 'Paquete completo sin conexión' }),
    el('p', {
      className: 'section-subtitle',
      text: 'Durante la instalación inicial solo se precarga la aplicación esencial y el índice de búsqueda para instalar rápido y respetar cuotas. Desde aquí puedes guardar las 49 categorías, las 2.137 fichas JSON/HTML y el informe de cierre para consultarlos sin red.',
    }),
    el('div', { className: 'progress-wrap' }, progressBar, progressText),
    el('div', { className: 'pill-row' }, downloadBtn, cancelBtn, retryBtn, refreshBtn, clearBtn, installBtn),
    feedbackBox,
  );

  container.append(
    el(
      'header',
      { className: 'surface-window' },
      el('div', { className: 'breadcrumbs' }, el('a', { attrs: { href: '#/' }, text: 'Inicio' }), '/', el('span', { text: 'Centro offline' })),
      el('h1', { text: 'Disponibilidad sin conexión y PWA' }),
      el('p', {
        className: 'section-subtitle',
        text: 'Control explícito de caché offline, progreso, cancelación, recuperación ante errores e instalación independiente.',
      }),
    ),
    statusGrid,
    progressSection,
  );

  void refreshStatus();
  return container;
}
