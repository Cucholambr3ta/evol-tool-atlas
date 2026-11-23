export type Route =
  | { name: 'dashboard' }
  | { name: 'categories' }
  | { name: 'category'; slug: string; page: number; q: string; evidence: string; sort: string }
  | { name: 'search'; q: string; cat: string; evidence: string; fav: boolean; sort: string; page: number }
  | { name: 'tool'; id: string }
  | { name: 'favorites' }
  | { name: 'offline' }
  | { name: 'about' }
  | { name: 'not-found'; path: string };

export function parseHashRoute(rawHash: string): Route {
  const cleaned = rawHash.replace(/^#/, '') || '/';
  const [rawPath = '/', rawQuery = ''] = cleaned.split('?');
  const pathParts = rawPath.split('/').filter(Boolean);
  const query = new URLSearchParams(rawQuery);

  if (pathParts.length === 0) {
    return { name: 'dashboard' };
  }

  const head = pathParts[0];
  if (head === 'categorias') {
    return { name: 'categories' };
  }
  if (head === 'categoria' && pathParts[1]) {
    return {
      name: 'category',
      slug: decodeURIComponent(pathParts[1]),
      page: Math.max(1, Number(query.get('page') ?? '1') || 1),
      q: query.get('q') ?? '',
      evidence: query.get('ev') ?? 'all',
      sort: query.get('sort') ?? 'name-asc',
    };
  }
  if (head === 'buscar') {
    return {
      name: 'search',
      q: query.get('q') ?? '',
      cat: query.get('cat') ?? 'all',
      evidence: query.get('ev') ?? 'all',
      fav: query.get('fav') === '1',
      sort: query.get('sort') ?? 'relevance',
      page: Math.max(1, Number(query.get('page') ?? '1') || 1),
    };
  }
  if (head === 'herramienta' && pathParts[1]) {
    return {
      name: 'tool',
      id: decodeURIComponent(pathParts[1]),
    };
  }
  if (head === 'favoritos') {
    return { name: 'favorites' };
  }
  if (head === 'offline') {
    return { name: 'offline' };
  }
  if (head === 'acerca') {
    return { name: 'about' };
  }
  return { name: 'not-found', path: rawPath };
}

export function buildHashUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const norm = path.startsWith('/') ? path : `/${path}`;
  if (!params) return `#${norm}`;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === false || v === 'all') continue;
    if (v === true) {
      sp.set(k, '1');
    } else {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `#${norm}?${qs}` : `#${norm}`;
}

export function navigate(hashUrl: string): void {
  const normalized = hashUrl.startsWith('#') ? hashUrl : `#${hashUrl}`;
  if (window.location.hash === normalized) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = normalized;
}
