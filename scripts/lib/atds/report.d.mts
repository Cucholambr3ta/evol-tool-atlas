import type { AtdsLevel, Severity, ToolStatus } from './types.d.mts';
import type { Finding } from './diagnostics.d.mts';
import type { DeclaredEvidenceRef, EvidenceRef, EvidenceSchemaStatus, RecordIntegrity } from './evidence.d.mts';
import type { CatalogTool, ResourceState, ToolEvaluation } from './evaluate.d.mts';

export interface ToolReportEntry {
  id: string;
  category: number | undefined;
  level: AtdsLevel;
  candidateLevel: AtdsLevel;
  status: ToolStatus;
  reviewRequired: boolean;
  checks: Record<string, string>;
  issues: string[];
  warnings: string[];
  findings: Finding[];
  evidenceRefs: EvidenceRef[];
  declaredEvidenceRefs: DeclaredEvidenceRef[];
  verifiedEvidenceRefs: EvidenceRef[];
  evidenceSchemaStatus: EvidenceSchemaStatus | 'NOT_EVALUATED';
  resources: Record<string, ResourceState> | null;
  evidenceIntegrity: RecordIntegrity[];
  checkedFiles: string[];
  limitations: string[];
}

export interface ReportSummary {
  totalTools: number;
  totalCategories: number;
  levels: Record<AtdsLevel, number>;
  candidateLevels: Record<AtdsLevel, number>;
  statusCounts: Record<ToolStatus, number>;
  statusSemantics: string;
  toolsWithIssues: number;
  reviewRequired: number;
  findings: { total: number; blocking: number; byDoc: Record<string, number>; bySeverity: Record<Severity, number> };
  doc12: { toolsWithLinksNotChecked: number; note: string };
  issueCounts: Record<string, number>;
}

export interface ValidationReport {
  generatedAt: string;
  totals: { tools: number; categories: number };
  tools: ToolReportEntry[];
  summary?: ReportSummary;
}

export function buildToolReport(tool: CatalogTool, result: ToolEvaluation): ToolReportEntry;
export function buildSummary(report: Pick<ValidationReport, 'totals' | 'tools'>): ReportSummary;
export function writeReport(root: string, report: ValidationReport, relPath?: string): string;
