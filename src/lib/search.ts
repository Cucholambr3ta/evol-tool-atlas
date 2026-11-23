import type { EvidenceGroup, SearchParams, ToolSummary } from '../types/catalog';

export interface SearchResult {
  items: ToolSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const EVIDENCE_RANK: Record<EvidenceGroup, number> = {
  verificada: 3,
  expediente: 2,
  historica: 1,
};

function scoreMatch(tool: ToolSummary, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = normalizeText(tool.name);
  const id = normalizeText(tool.id);
  const cat = normalizeText(tool.categoryName);
  const desc = normalizeText(tool.description);
  const ev = normalizeText(tool.evidenceStatus);

  let score = 0;
  for (const token of tokens) {
    let matched = false;
    if (name === token || id === token) {
      score += 100;
      matched = true;
    } else if (name.startsWith(token) || id.startsWith(token)) {
      score += 60;
      matched = true;
    } else if (name.includes(token) || id.includes(token)) {
      score += 40;
      matched = true;
    }
    if (cat.includes(token)) {
      score += 15;
      matched = true;
    }
    if (desc.includes(token)) {
      score += 12;
      matched = true;
    }
    if (ev.includes(token)) {
      score += 5;
      matched = true;
    }
    if (!matched) {
      return -1;
    }
  }
  return score;
}

export function filterAndSortTools(
  tools: ToolSummary[],
  params: SearchParams,
  favoriteIds: Set<string>,
): SearchResult {
  const normalizedQuery = normalizeText(params.query);
  const tokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

  const matched: Array<{ tool: ToolSummary; score: number }> = [];

  for (const tool of tools) {
    if (params.categorySlug && params.categorySlug !== 'all' && tool.categorySlug !== params.categorySlug) {
      continue;
    }
    if (params.evidenceGroup !== 'all' && tool.evidenceGroup !== params.evidenceGroup) {
      continue;
    }
    if (params.favoritesOnly && !favoriteIds.has(tool.id)) {
      continue;
    }
    const score = scoreMatch(tool, tokens);
    if (score < 0) continue;
    matched.push({ tool, score });
  }

  matched.sort((a, b) => {
    if (params.sort === 'name-asc') {
      return a.tool.name.localeCompare(b.tool.name, 'es');
    }
    if (params.sort === 'name-desc') {
      return b.tool.name.localeCompare(a.tool.name, 'es');
    }
    if (params.sort === 'evidence') {
      const rankDiff = EVIDENCE_RANK[b.tool.evidenceGroup] - EVIDENCE_RANK[a.tool.evidenceGroup];
      if (rankDiff !== 0) return rankDiff;
      return a.tool.name.localeCompare(b.tool.name, 'es');
    }
    // Relevance default: query score descending, then evidence, then name
    if (b.score !== a.score) return b.score - a.score;
    const rankDiff = EVIDENCE_RANK[b.tool.evidenceGroup] - EVIDENCE_RANK[a.tool.evidenceGroup];
    if (rankDiff !== 0) return rankDiff;
    return a.tool.name.localeCompare(b.tool.name, 'es');
  });

  const total = matched.length;
  const pageSize = Math.max(1, params.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, params.page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = matched.slice(start, start + pageSize).map((m) => m.tool);

  return {
    items,
    total,
    page: safePage,
    totalPages,
  };
}
