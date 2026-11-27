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
  /** Explicit date the source was contrasted (ATDS-UI-05), or null. Replaces revalidated20261122. */
  sourceCheckedOn: string | null;
  historicalFlag: boolean;
  /** ATDS validated level, computed at build time by the official validator. */
  atdsLevel: AtdsLevel;
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

export interface TechnicalResource {
  label: string;
  href: string;
  kind: 'guide' | 'skill' | 'use-cases' | 'evidence' | string;
}

export interface UseCaseSummary {
  id: string;
  titulo: string;
  objetivo: string;
  /** Recorded state, e.g. "propuesto_no_ejecutado"; null when the sheet records none. */
  estado: string | null;
  evidenciaRequerida: string[];
  riesgo: string;
}

export type AtdsLevel = 'NONE' | 'L1' | 'L2' | 'L3' | 'L4';
export type AtdsStatus = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' | 'ERROR';
export type AtdsCheckState = 'PASS' | 'FAIL' | 'BLOCKED' | 'ABSENT_OPTIONAL' | 'ABSENT';

export interface AtdsResource {
  kind: 'metadata' | 'guide' | 'skill' | 'cases' | 'evidence';
  file: string;
  /** Present on disk: a link exists. Presence is not validity or certification. */
  href: string | null;
  present: boolean;
  /** The validator's controls for this resource pass. */
  valid: boolean;
  check: AtdsCheckState | string;
}

export interface AtdsArtifact {
  nombre: string | null;
  path: string | null;
  role: 'primary' | 'artifact';
  status: string;
  /** Only set for files inside the sheet's directory that exist. */
  href: string | null;
}

export interface AtdsEvidenceRecord {
  id: string;
  resultado: 'PASS' | 'FAIL' | 'BLOCKED' | 'INCONCLUSIVE' | string;
  tipo: string | null;
  objetivo: string | null;
  alcance: 'functional' | 'version' | 'none';
  version: string | null;
  entorno: string | null;
  fecha: string | null;
  criterio: string | null;
  observado: string | null;
  resumen: string | null;
  limitaciones: string[];
  /** VERIFICADA only when the validator demonstrated integrity, identity, type and scope. */
  integrity: 'VERIFICADA' | 'NO_ACREDITADA' | 'NO_APLICA';
  reasons: string[];
  artifacts: AtdsArtifact[];
}

export interface AtdsEvidence {
  schemaStatus: 'MISSING_FILE' | 'INVALID_JSON' | 'INVALID_SCHEMA' | 'EMPTY' | 'OK' | 'NOT_EVALUATED';
  records: AtdsEvidenceRecord[];
  pendientes: string[];
  verifiedCount: number;
  declaredCount: number;
}

export interface AtdsFindingSummary {
  code: string;
  doc: string;
  level: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  blocking: boolean;
}

export interface AtdsSummary {
  schema: string;
  candidateLevel: AtdsLevel;
  validatedLevel: AtdsLevel;
  status: AtdsStatus;
  reviewRequired: boolean;
  blockingCount: number;
  warningCount: number;
  findings: AtdsFindingSummary[];
  resources: AtdsResource[];
  evidence: AtdsEvidence | null;
  contentRevision: string;
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
  technicalResources: TechnicalResource[];
  useCases: UseCaseSummary[];
  historicalFlag: boolean;
  sourceCheckedOn: string | null;
  atds: AtdsSummary;
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
  kind: 'shard' | 'report' | 'category-html' | 'category-validation' | 'tool-html' | 'tool-resource' | 'evidence-artifact' | 'reference' | string;
  sha256: string;
  bytes: number;
}

/** Deterministic manifest (OFF-03): `revision` is derived from every item's SHA-256. */
export interface OfflineManifest {
  schema: string;
  revision: string;
  /** First 16 hex characters of `revision`; names the cache of this revision. */
  version: string;
  totalFiles: number;
  totalBytes: number;
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
