import { el } from '../lib/dom';
import { createFineLineIcon, type IconName } from '../lib/icons';

export function renderStatePanel(options: {
  icon: IconName;
  title: string;
  description: string;
  actions?: HTMLElement[];
}): HTMLElement {
  return el(
    'section',
    {
      className: 'state-panel',
      attrs: { role: 'status', 'aria-live': 'polite' },
    },
    createFineLineIcon(options.icon),
    el('h2', { text: options.title }),
    el('p', { text: options.description }),
    options.actions && options.actions.length > 0
      ? el('div', { className: 'pill-row', attrs: { 'data-state-actions': 'true' } }, ...options.actions)
      : null,
  );
}

export function renderLoadingState(label = 'Cargando datos documentales…'): HTMLElement {
  return renderStatePanel({
    icon: 'refresh',
    title: 'Cargando',
    description: label,
  });
}

export function renderOfflineUnavailableState(detail?: string): HTMLElement {
  return renderStatePanel({
    icon: 'offline',
    title: 'Contenido no disponible sin conexión',
    description:
      detail ??
      'Este recurso aún no está almacenado en la caché offline del dispositivo. Conéctate a Internet o descarga el paquete completo desde el Centro offline.',
    actions: [
      el('a', {
        className: 'btn btn-primary',
        attrs: { href: '#/offline' },
        text: 'Abrir Centro offline',
      }),
      el('a', {
        className: 'btn',
        attrs: { href: '#/' },
        text: 'Ir al inicio',
      }),
    ],
  });
}

export function renderErrorState(message: string, onRetry?: () => void): HTMLElement {
  const actions: HTMLElement[] = [
    el('a', {
      className: 'btn',
      attrs: { href: '#/' },
      text: 'Volver al inicio',
    }),
  ];
  if (onRetry) {
    actions.unshift(
      el(
        'button',
        {
          className: 'btn btn-primary',
          attrs: { type: 'button' },
          on: { click: onRetry },
        },
        createFineLineIcon('refresh'),
        'Reintentar',
      ),
    );
  }
  return renderStatePanel({
    icon: 'error',
    title: 'No se pudo cargar esta vista',
    description: message,
    actions,
  });
}
