import { el, formatNumber, isSafeCatalogPath, withBase } from '../lib/dom';
import { createFineLineIcon } from '../lib/icons';
import type { CatalogIndex } from '../types/catalog';

export function renderAboutView(index: CatalogIndex): HTMLElement {
  const container = el('div', { className: 'detail-stack' });

  const evidenceRows = Object.entries(index.evidenceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) =>
      el(
        'tr',
        null,
        el('td', { className: 'mono', text: status }),
        el('td', { text: formatNumber(count) }),
      ),
    );

  container.append(
    el(
      'header',
      { className: 'surface-window' },
      el('div', { className: 'breadcrumbs' }, el('a', { attrs: { href: '#/' }, text: 'Inicio' }), '/', el('span', { text: 'Política documental' })),
      el('h1', { text: 'Política documental, seguridad e identidad EVOL' }),
      el('p', {
        className: 'section-subtitle',
        text: `Atlas documental edición ${index.date} · ${formatNumber(index.totals.categories)} categorías · ${formatNumber(index.totals.admitted)} fichas admitidas · ${formatNumber(index.totals.excluded)} entradas excluidas.`,
      }),
    ),
    el(
      'section',
      { className: 'notice-box' },
      createFineLineIcon('info'),
      el(
        'div',
        null,
        el('h2', { text: 'Separación estricta entre documentación y ejecución' }),
        el('p', {
          text: 'Evol Tool Atlas es un catálogo de consulta estática. No descarga binarios, no instala paquetes, no ejecuta herramientas ni transmite telemetría o datos personales.',
        }),
      ),
    ),
    el(
      'section',
      { className: 'surface-window' },
      el('h2', { text: 'Distribución real de evidencia documental' }),
      el('p', {
        className: 'section-subtitle',
        text: 'Las etiquetas reflejan el alcance documental de cada ficha sin equiparar referencias históricas con releases actuales verificados.',
      }),
      el(
        'div',
        { className: 'table-wrap' },
        el(
          'table',
          { className: 'evol-table' },
          el('thead', null, el('tr', null, el('th', { text: 'Estado de evidencia' }), el('th', { text: 'Fichas' }))),
          el('tbody', null, ...evidenceRows),
        ),
      ),
      isSafeCatalogPath('05-referencias/auditoria-v2.3.2/INFORME-FINAL.json')
        ? el(
            'p',
            null,
            el('a', {
              className: 'btn btn-sm',
              attrs: {
                href: withBase('05-referencias/auditoria-v2.3.2/INFORME-FINAL.json'),
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              text: 'Consultar INFORME-FINAL.json',
            }),
          )
        : null,
    ),
    el(
      'section',
      { className: 'surface-window' },
      el('h2', { text: 'Identidad visual y licencias' }),
      el('p', {
        text: 'Interfaz alineada con el sistema oficial Evol OS Minimal line art (paleta cálida #f6f3ed / #191b1e, acento #365568, bordes #9b8793 / #a98a9f, iconografía Fine Line y glifo O institucional). Tipografías locales Manrope y Atkinson Hyperlegible bajo licencia SIL Open Font License 1.1.',
      }),
    ),
  );

  return container;
}
