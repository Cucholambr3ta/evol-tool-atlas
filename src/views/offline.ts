import { el, formatNumber } from '../lib/dom';
import { createFineLineIcon } from '../lib/icons';
import { plural } from '../lib/labels';
import {
  clearOfflineCatalog,
  downloadCatalogOffline,
  formatBytes,
  getOfflineStatus,
  verifyOfflineIntegrity,
  type OfflineProgress,
  type OfflineStatus,
} from '../lib/offline';
import { getPwaState, promptInstall } from '../lib/pwa';
import { renderBreadcrumbs } from '../components/breadcrumbs';

const AVAILABILITY_TEXT: Record<OfflineStatus['availability'], string> = {
  unsupported: 'Este navegador no ofrece Cache Storage: no hay copia offline posible.',
  none: 'Sin copia offline del catálogo. La app esencial y el índice de búsqueda sí funcionan sin red.',
  partial: 'Copia parcial: no todos los recursos de esta revisión están guardados.',
  complete: 'Catálogo documental completo disponible sin red (revisión verificada por SHA-256).',
  stale: 'Hay una copia completa de una revisión anterior; se conserva hasta completar la nueva.',
};

/** Announce progress at most at every 25 % step, plus phase changes (A11Y-02). */
function announceStep(pct: number): number {
  return Math.floor(pct / 25);
}

export function renderOfflineView(onStatusUpdated: () => void): HTMLElement {
  const container = el('div', { className: 'detail-stack' });

  let abortController: AbortController | null = null;
  let lastFailedUrls: string[] = [];
  let isBusy = false;
  let lastAnnouncedStep = -1;
  let lastAnnouncedPhase = '';

  const statusGrid = el('section', { className: 'kpi-grid', attrs: { 'aria-label': 'Estado offline' } });
  const progressSection = el('section', { className: 'surface-window', attrs: { 'aria-labelledby': 'offline-pkg-title' } });
  const progressLabel = el('span', { id: 'offline-progress-label', className: 'kpi-label', text: 'Progreso de la copia offline' });
  const progressText = el('p', {
    id: 'offline-progress-detail',
    className: 'section-subtitle',
    text: 'Comprobando estado del almacenamiento offline…',
  });
  const progressBar = el('progress', {
    className: 'evol-progress',
    attrs: {
      max: '100',
      value: '0',
      'aria-labelledby': 'offline-progress-label',
      'aria-describedby': 'offline-progress-detail',
    },
  });
  // Moderated live region: phase changes and 25 % steps only, not every item.
  const liveRegion = el('p', { className: 'sr-only', attrs: { 'aria-live': 'polite', role: 'status' } });
  const feedbackBox = el('div');

  const announce = (text: string) => {
    liveRegion.textContent = text;
  };

  const downloadBtn = el('button', { className: 'btn btn-primary', attrs: { type: 'button' } }, createFineLineIcon('download'), 'Guardar catálogo completo para uso sin conexión');
  const cancelBtn = el('button', { className: 'btn', attrs: { type: 'button', disabled: true } }, createFineLineIcon('cancel'), 'Cancelar descarga');
  const retryBtn = el('button', { className: 'btn', attrs: { type: 'button', hidden: true } }, createFineLineIcon('refresh'), 'Reintentar fallidos');
  const refreshBtn = el('button', { className: 'btn', attrs: { type: 'button' } }, createFineLineIcon('refresh'), 'Actualizar estado');
  const verifyBtn = el('button', { className: 'btn', attrs: { type: 'button' } }, createFineLineIcon('evidence'), 'Verificar integridad');
  const clearBtn = el('button', { className: 'btn', attrs: { type: 'button' } }, createFineLineIcon('trash'), 'Borrar copia offline');
  const installBtn = el('button', { className: 'btn', attrs: { type: 'button', hidden: true } }, createFineLineIcon('grid'), 'Instalar aplicación');

  // OFF-05: accessible confirmation before deleting (native modal dialog: focus
  // containment, Escape and focus restoration are handled by the browser).
  const confirmBtn = el('button', { className: 'btn btn-primary', attrs: { type: 'button' } }, 'Borrar copia offline');
  const keepBtn = el('button', { className: 'btn', attrs: { type: 'button', autofocus: true } }, 'Cancelar');
  const confirmDialog = el(
    'dialog',
    { className: 'surface-window confirm-dialog', attrs: { 'aria-labelledby': 'offline-clear-title', 'aria-describedby': 'offline-clear-desc' } },
    el('h2', { id: 'offline-clear-title', text: '¿Borrar la copia offline?' }),
    el('p', {
      id: 'offline-clear-desc',
      text: 'Se eliminarán todas las revisiones del catálogo guardadas en este navegador y la caché de consulta. Tus favoritos no se borran. Necesitarás conexión para volver a descargarlas.',
    }),
    el('div', { className: 'pill-row' }, keepBtn, confirmBtn),
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
        el('span', { className: 'kpi-sub', text: pwa.swRegistered ? 'Service Worker activo' : 'Service Worker pendiente' }),
      ),
      el(
        'article',
        { className: 'card', attrs: { 'data-offline-availability': st.availability } },
        el('span', { className: 'kpi-label', text: 'Recursos offline' }),
        el('span', { className: 'kpi-value', text: `${formatNumber(st.cachedCount)} / ${formatNumber(st.totalCount)}` }),
        el('span', { className: 'kpi-sub', text: AVAILABILITY_TEXT[st.availability] }),
        st.revision ? el('span', { className: 'kpi-sub mono', text: `Revisión ${st.revision.slice(0, 12)}` }) : null,
      ),
      el(
        'article',
        { className: 'card' },
        el('span', { className: 'kpi-label', text: 'Almacenamiento usado' }),
        el('span', { className: 'kpi-value', text: formatBytes(st.usageBytes) }),
        el('span', { className: 'kpi-sub', text: `Cuota estimada: ${formatBytes(st.quotaBytes)}` }),
      ),
      el(
        'article',
        { className: 'card' },
        el('span', { className: 'kpi-label', text: 'Modo de ejecución' }),
        el('span', { className: 'kpi-value', text: pwa.isStandalone ? 'Standalone' : 'Navegador' }),
        el('span', { className: 'kpi-sub', text: 'Los favoritos se guardan aparte y no dependen de esta copia' }),
      ),
    );

    if (!isBusy) {
      const pct = st.totalCount > 0 ? Math.round((st.cachedCount / st.totalCount) * 100) : 0;
      progressBar.max = Math.max(1, st.totalCount);
      progressBar.value = st.cachedCount;
      progressText.textContent = st.isComplete
        ? `Catálogo completo guardado y verificado (${formatNumber(st.cachedCount)} de ${formatNumber(st.totalCount)} archivos).`
        : `${formatNumber(st.cachedCount)} de ${formatNumber(st.totalCount)} archivos de la revisión actual guardados (${pct} %).`;
      downloadBtn.disabled = !st.supported || !pwa.isOnline || st.isComplete;
      clearBtn.disabled = st.availability === 'none' || st.availability === 'unsupported';
      verifyBtn.disabled = st.cachedCount === 0;
    }
  };

  const refreshStatus = async () => {
    const st = await getOfflineStatus();
    renderKpis(st);
    onStatusUpdated();
  };

  const setBusy = (busy: boolean) => {
    isBusy = busy;
    downloadBtn.disabled = busy;
    clearBtn.disabled = busy;
    verifyBtn.disabled = busy;
    if (busy) retryBtn.hidden = true;
  };

  const handleProgress = (prog: OfflineProgress) => {
    const pct = prog.total > 0 ? Math.round((prog.processed / prog.total) * 100) : 0;
    progressBar.max = Math.max(1, prog.total);
    progressBar.value = prog.processed;

    if (prog.currentPhase === 'preparing') {
      progressText.textContent = 'Preparando la lista de categorías, fichas, recursos e informes…';
    } else if (prog.currentPhase === 'downloading') {
      progressText.textContent = `Procesados ${formatNumber(prog.processed)} de ${formatNumber(prog.total)} (${pct} %): ${formatNumber(prog.succeeded)} guardados, ${formatNumber(prog.alreadyCached)} ya estaban guardados, ${formatNumber(prog.failed)} fallidos.`;
      const step = announceStep(pct);
      if (step !== lastAnnouncedStep) {
        lastAnnouncedStep = step;
        announce(`Descarga offline al ${step * 25} %.`);
      }
    } else if (prog.currentPhase === 'complete') {
      progressText.textContent = `Descarga completada y verificada: ${formatNumber(prog.total)} recursos (${formatNumber(prog.succeeded)} nuevos, ${formatNumber(prog.alreadyCached)} ya guardados).`;
    } else {
      const counts = `${formatNumber(prog.succeeded)} guardados, ${formatNumber(prog.alreadyCached)} ya guardados, ${formatNumber(prog.failed)} fallidos, ${formatNumber(prog.cancelled)} sin procesar.`;
      // The explanation is in the notice below; the progress line keeps only the counts.
      progressText.textContent = `${prog.currentPhase === 'cancelled' ? 'Detenida' : 'Terminada con incidencias'}: ${counts}`;
    }
    // Final phases are announced by the role=status/alert notice below.
    if (prog.currentPhase !== lastAnnouncedPhase && prog.currentPhase !== 'downloading') {
      lastAnnouncedPhase = prog.currentPhase;
      if (prog.currentPhase === 'preparing') announce('Preparando la descarga offline.');
    }

    lastFailedUrls = prog.failedUrls;
    feedbackBox.replaceChildren();
    if (prog.errorMessage && prog.currentPhase !== 'downloading') {
      feedbackBox.append(
        el('div', { className: 'notice-box', attrs: { role: prog.currentPhase === 'cancelled' ? 'status' : 'alert' } },
          createFineLineIcon(prog.currentPhase === 'cancelled' ? 'info' : 'warning'),
          el('div', null, el('p', { text: prog.errorMessage }))),
      );
    } else if (prog.currentPhase === 'complete') {
      feedbackBox.append(
        el('div', { className: 'notice-box', attrs: { role: 'status' } },
          createFineLineIcon('success'),
          el('div', null, el('p', { text: 'Todas las categorías y las 2.137 fichas están disponibles sin conexión.' }))),
      );
    }
  };

  const startDownload = async (onlyUrls?: string[]) => {
    if (isBusy) return;
    setBusy(true);
    lastAnnouncedStep = -1;
    lastAnnouncedPhase = '';
    abortController = new AbortController();
    cancelBtn.disabled = false;
    let result: OfflineProgress | null = null;
    try {
      result = await downloadCatalogOffline(handleProgress, abortController.signal, onlyUrls);
    } finally {
      abortController = null;
      cancelBtn.disabled = true;
      setBusy(false);
      await refreshStatus();
      // The final message stays visible after the status refresh.
      if (result) handleProgress(result);
      retryBtn.hidden = lastFailedUrls.length === 0;
    }
  };

  downloadBtn.addEventListener('click', () => void startDownload());
  retryBtn.addEventListener('click', () => {
    if (lastFailedUrls.length > 0) void startDownload(lastFailedUrls);
  });
  cancelBtn.addEventListener('click', () => abortController?.abort());
  refreshBtn.addEventListener('click', () => void refreshStatus());

  verifyBtn.addEventListener('click', async () => {
    if (isBusy) return;
    setBusy(true);
    announce('Verificando la integridad de la copia offline.');
    try {
      const report = await verifyOfflineIntegrity((checked, total) => {
        progressBar.max = Math.max(1, total);
        progressBar.value = checked;
        progressText.textContent = `Verificando SHA-256: ${formatNumber(checked)} de ${formatNumber(total)}.`;
      });
      const n = report.corrupted.length;
      const msg = n === 0
        ? `Integridad comprobada: ${formatNumber(report.checked - report.missing)} archivos coinciden con el manifiesto${report.missing > 0 ? `; faltan ${formatNumber(report.missing)}` : ''}.`
        : `Se ${plural(n, 'eliminó', 'eliminaron')} ${formatNumber(n)} ${plural(n, 'archivo dañado', 'archivos dañados')}. Vuelve a guardar el catálogo para repararlos.`;
      // The notice has its own status/alert role; no second announcement.
      feedbackBox.replaceChildren(
        el('div', { className: 'notice-box', attrs: { role: n === 0 ? 'status' : 'alert' } }, createFineLineIcon(n === 0 ? 'success' : 'warning'), el('div', null, el('p', { text: msg }))),
      );
    } catch (err) {
      feedbackBox.replaceChildren(
        el('div', { className: 'notice-box', attrs: { role: 'alert' } }, createFineLineIcon('warning'), el('div', null, el('p', { text: err instanceof Error ? err.message : 'No se pudo verificar la integridad.' }))),
      );
    } finally {
      setBusy(false);
      await refreshStatus();
    }
  });

  clearBtn.addEventListener('click', () => {
    if (typeof confirmDialog.showModal === 'function') confirmDialog.showModal();
  });
  keepBtn.addEventListener('click', () => confirmDialog.close('cancel'));
  confirmBtn.addEventListener('click', () => confirmDialog.close('confirm'));
  confirmDialog.addEventListener('close', async () => {
    const confirmed = confirmDialog.returnValue === 'confirm';
    confirmDialog.returnValue = '';
    clearBtn.focus();
    if (!confirmed) return;
    await clearOfflineCatalog();
    lastFailedUrls = [];
    retryBtn.hidden = true;
    const msg = 'Copia offline del catálogo eliminada. Tus favoritos locales siguen intactos.';
    feedbackBox.replaceChildren(
      el('div', { className: 'notice-box', attrs: { role: 'status' } }, createFineLineIcon('info'), el('div', null, el('p', { text: msg }))),
    );
    await refreshStatus();
  });

  installBtn.addEventListener('click', () => void promptInstall());

  progressSection.append(
    el('h2', { id: 'offline-pkg-title', text: 'Paquete completo sin conexión' }),
    el('p', {
      className: 'section-subtitle',
      text: 'Durante la instalación solo se precarga la aplicación esencial y el índice de búsqueda. Desde aquí puedes guardar las 49 categorías, las 2.137 fichas con sus metadatos y recursos, y los informes para consultarlos sin red. Cada archivo se comprueba con su SHA-256; una revisión nueva no sustituye a la anterior hasta estar completa.',
    }),
    el('div', { className: 'progress-wrap' }, progressLabel, progressBar, progressText, liveRegion),
    el('div', { className: 'pill-row' }, downloadBtn, cancelBtn, retryBtn, refreshBtn, verifyBtn, clearBtn, installBtn),
    feedbackBox,
    confirmDialog,
  );

  container.append(
    el(
      'header',
      { className: 'surface-window' },
      renderBreadcrumbs([{ label: 'Inicio', href: '#/' }, { label: 'Centro offline' }]),
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
