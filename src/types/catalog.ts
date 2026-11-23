export type EvidenceGroup = 'verificada' | 'expediente' | 'historica';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface CategorySummary {
  number: number;
  slug: string;
  name: string;
  admitted: number;
  excluded: number;
  totalEntries: number;
  htmlHref: string;
  validationJsonHref: string;
  validationMdHref: string;
  originGroup: string;
  zipName: string;
}

export interface ToolSummary {
  id: string;
  name: string;
  categoryNumber: number;
  categorySlug: string;
  categoryName: string;
  description: string;
  evidenceStatus: string;
  evidenceGroup: EvidenceGroup;
  origin: string;
  htmlHref: string;
  revalidated20261122: boolean;
  historicalFlag: boolean;
}

export interface CatalogIndex {
  project: string;
  sourceLabel: string;
  date: string;
  globalWarning: string;
  featuredCriterion: string;
  featuredIds: string[];
  totals: {
    categories: number;
    admitted: number;
    excluded: number;
    totalEntries: number;
  };
  evidenceCounts: Record<string, number>;
  categories: CategorySummary[];
  tools: ToolSummary[];
}

export interface ExternalReference {
  label: string;
  url: string;
}

export interface ToolDetail {
  id: string;
  name: string;
  categoryNumber: number;
  categorySlug: string;
  categoryName: string;
  description: string;
  editorialNote: string | null;
  useCaseEvol: string | null;
  sourceUrl: string | null;
  referenceVersion: string | null;
  historicalVersion: string | null;
  evidenceStatus: string;
  evidenceGroup: EvidenceGroup;
  evidenceDetail: string | null;
  operationalStatus: string | null;
  maintenanceStatus: string | null;
  cachyosTested: boolean | string | null;
  cachyosInstalled: boolean | string | null;
  license: string | null;
  verificationDate: string | null;
  reviewDate: string | null;
  warnings: string[];
  conditions: string[];
  externalReferences: ExternalReference[];
  htmlHref: string;
  metadataHref: string;
  readmeHref: string | null;
  historicalFlag: boolean;
  revalidated20261122: boolean;
  rawMetadata: Record<string, unknown>;
}

export interface ExcludedEntry {
  name: string;
  reason: string;
  sourceType: string | null;
  evidenceDate: string | null;
}

export interface CategoryShard {
  category: CategorySummary;
  exclusionRule: string | null;
  limits: string[];
  excludedEntries: ExcludedEntry[];
  tools: ToolDetail[];
}

export interface OfflineManifestItem {
  url: string;
  kind: 'shard' | 'report' | 'category-html' | 'tool-html';
}

export interface OfflineManifest {
  version: string;
  generatedAt: string;
  totalFiles: number;
  items: OfflineManifestItem[];
}

export interface FavoriteEntry {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  addedAt: string;
}

export interface SearchParams {
  query: string;
  categorySlug: string;
  evidenceGroup: EvidenceGroup | 'all';
  favoritesOnly: boolean;
  sort: 'relevance' | 'name-asc' | 'name-desc' | 'evidence';
  page: number;
  pageSize: number;
}
