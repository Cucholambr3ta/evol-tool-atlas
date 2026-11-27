import { el } from '../lib/dom';
import { createFineLineIcon, type IconName } from '../lib/icons';

/**
 * A11Y-03: a state that replaces a whole view (404, invalid route, load error,
 * offline-unavailable) is that view's main heading (h1); a state inside a view
 * keeps h2. Errors are announced as alerts, other states politely.
 */
export function renderStatePanel(options: {
  icon: IconName;
  title: string;
  description: string;
  actions?: HTMLElement[];
  headingLevel?: 1 | 2;
  tone?: 'status' | 'alert';
}): HTMLElement {
  const tone = options.tone ?? 'status';
  return el(
    'section',
    {
      className: 'state-panel',
      attrs: tone === 'alert' ? { role: 'alert' } : { role: 'status', 'aria-live': 'polite' },
    },
    createFineLineIcon(options.icon),
    el(options.headingLevel === 1 ? 'h1' : 'h2', { text: options.title }),
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

export function renderOfflineUnavailableState(detail?: string, headingLevel: 1 | 2 = 2): HTMLElement {
  return renderStatePanel({
    headingLevel,
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

export function renderErrorState(message: string, onRetry?: () => void, headingLevel: 1 | 2 = 2): HTMLElement {
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
    headingLevel,
    tone: 'alert',
    icon: 'error',
    title: 'No se pudo cargar esta vista',
    description: message,
    actions,
  });
}
