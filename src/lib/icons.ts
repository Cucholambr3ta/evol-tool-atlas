import menuRaw from '../assets/icons/actions/application-menu-symbolic.svg?raw';
import bookmarkRaw from '../assets/icons/actions/bookmark-new-symbolic.svg?raw';
import cancelRaw from '../assets/icons/actions/dialog-cancel-symbolic.svg?raw';
import docOpenRaw from '../assets/icons/actions/document-open-symbolic.svg?raw';
import clearRaw from '../assets/icons/actions/edit-clear-symbolic.svg?raw';
import findRaw from '../assets/icons/actions/edit-find-symbolic.svg?raw';
import homeRaw from '../assets/icons/actions/go-home-symbolic.svg?raw';
import nextRaw from '../assets/icons/actions/go-next-symbolic.svg?raw';
import prevRaw from '../assets/icons/actions/go-previous-symbolic.svg?raw';
import linkRaw from '../assets/icons/actions/insert-link-symbolic.svg?raw';
import closeRaw from '../assets/icons/actions/tab-close-symbolic.svg?raw';
import trashRaw from '../assets/icons/actions/user-trash-empty-symbolic.svg?raw';
import filterRaw from '../assets/icons/actions/view-filter-symbolic.svg?raw';
import refreshRaw from '../assets/icons/actions/view-refresh-symbolic.svg?raw';
import sortRaw from '../assets/icons/actions/view-sort-ascending-symbolic.svg?raw';
import securityCatRaw from '../assets/icons/categories/applications-security-symbolic.svg?raw';
import favoriteRaw from '../assets/icons/emblems/emblem-favorite-symbolic.svg?raw';
import evidenceRaw from '../assets/icons/evol-intelligence/evol-evidence-symbolic.svg?raw';
import appGridRaw from '../assets/icons/shell/evol-shell-app-grid-symbolic.svg?raw';
import themeRaw from '../assets/icons/shell/evol-shell-brightness-symbolic.svg?raw';
import sidebarRaw from '../assets/icons/shell/evol-shell-sidebar-symbolic.svg?raw';
import errorRaw from '../assets/icons/status/dialog-error-symbolic.svg?raw';
import infoRaw from '../assets/icons/status/dialog-information-symbolic.svg?raw';
import successRaw from '../assets/icons/status/dialog-success-symbolic.svg?raw';
import warningRaw from '../assets/icons/status/dialog-warning-symbolic.svg?raw';
import downloadRaw from '../assets/icons/status/evol-anim-download-symbolic.svg?raw';
import onlineRaw from '../assets/icons/status/network-connected-symbolic.svg?raw';
import offlineRaw from '../assets/icons/status/network-offline-symbolic.svg?raw';
import updateRaw from '../assets/icons/status/software-update-available-symbolic.svg?raw';

export const ICON_RAW_MAP = {
  menu: menuRaw,
  bookmark: bookmarkRaw,
  cancel: cancelRaw,
  docOpen: docOpenRaw,
  clear: clearRaw,
  search: findRaw,
  home: homeRaw,
  next: nextRaw,
  prev: prevRaw,
  link: linkRaw,
  close: closeRaw,
  trash: trashRaw,
  filter: filterRaw,
  refresh: refreshRaw,
  sort: sortRaw,
  security: securityCatRaw,
  favorite: favoriteRaw,
  evidence: evidenceRaw,
  grid: appGridRaw,
  theme: themeRaw,
  sidebar: sidebarRaw,
  error: errorRaw,
  info: infoRaw,
  success: successRaw,
  warning: warningRaw,
  download: downloadRaw,
  online: onlineRaw,
  offline: offlineRaw,
  update: updateRaw,
} as const;

export type IconName = keyof typeof ICON_RAW_MAP;

export function createFineLineIcon(name: IconName, className = 'evol-icon'): SVGSVGElement {
  const raw = ICON_RAW_MAP[name]
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<title[\s\S]*?<\/title>/gi, '');
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const root = doc.documentElement;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', root.getAttribute('viewBox') ?? '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tagName = (child as Element).tagName.toLowerCase();
    if (tagName === 'title' || tagName === 'script' || tagName === 'style') continue;
    const imported = document.importNode(child, true);
    svg.appendChild(imported);
  }

  return svg;
}
