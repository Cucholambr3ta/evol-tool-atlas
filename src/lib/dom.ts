export function getBasePath(): string {
  const envBase = import.meta.env?.BASE_URL ?? '/';
  return envBase.endsWith('/') ? envBase : `${envBase}/`;
}

export function withBase(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '');
  return `${getBasePath()}${clean}`;
}

export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeCatalogPath(relPath: string | null | undefined): relPath is string {
  if (!relPath) return false;
  const trimmed = relPath.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\')) {
    return false;
  }
  return /^(02-catalogo|05-referencias|skills)\/[a-z0-9._/-]+$/i.test(trimmed) ||
    trimmed === 'catalogo.json' ||
    trimmed === 'SHA256SUMS.txt';
}

export type ChildInput = Node | string | number | null | undefined | false;

export interface ElementProps {
  className?: string;
  id?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  text?: string;
  on?: Partial<Record<keyof HTMLElementEventMap, (ev: Event) => void>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElementProps | null,
  ...children: ChildInput[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) {
    if (props.className) node.className = props.className;
    if (props.id) node.id = props.id;
    if (props.text !== undefined) node.textContent = props.text;
    if (props.attrs) {
      for (const [k, v] of Object.entries(props.attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (v === true) {
          node.setAttribute(k, '');
        } else {
          node.setAttribute(k, String(v));
        }
      }
    }
    if (props.on) {
      for (const [eventName, handler] of Object.entries(props.on)) {
        if (handler) {
          node.addEventListener(eventName, handler);
        }
      }
    }
  }
  appendChildren(node, children);
  return node;
}

export function appendChildren(parent: HTMLElement | DocumentFragment, children: ChildInput[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }
}

export function clearEl(node: Element): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function formatNumber(n: number): string {
  const [intPart = '0', decPart] = String(n).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${grouped},${decPart}` : grouped;
}

export function formatFactValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'No especificado';
  if (val === true) return 'Sí';
  if (val === false) return 'No';
  return String(val);
}
