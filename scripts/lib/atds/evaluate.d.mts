import type { AtdsLevel, ToolStatus } from './types.d.mts';
import type { Finding } from './diagnostics.d.mts';
import type { DeclaredEvidenceRef, EvidenceRef, EvidenceSchemaStatus, RecordIntegrity } from './evidence.d.mts';

export interface CatalogTool { id: string; href: string; cat?: number; name?: string }

export interface ToolEvaluation {
  toolId: string;
  toolDir: string;
  catalogId: string | null;
  validatedLevel: AtdsLevel;
  candidateLevel: AtdsLevel;
  status: ToolStatus;
  reviewRequired: boolean;
  checks: Record<string, string>;
  issues: string[];
  warnings: string[];
  findings: Finding[];
  /** Only references whose integrity accredits L4 (ATDS-15). */
  evidenceRefs: EvidenceRef[];
  declaredEvidenceRefs: DeclaredEvidenceRef[];
  verifiedEvidenceRefs: EvidenceRef[];
  evidenceIntegrity: RecordIntegrity[];
  evidenceSchemaStatus: EvidenceSchemaStatus | 'NOT_EVALUATED';
  resources: Record<'metadata' | 'guide' | 'skill' | 'cases' | 'evidence', ResourceState>;
  checkedFiles: string[];
  limitations: string[];
}

export interface ResourceState { present: boolean; valid: boolean }

export interface EvaluateOptions { root?: string; provenanceExceptionsPath?: string; today?: string }

export interface StrictResult {
  inScope: true;
  passed: boolean;
  currentLevel: AtdsLevel;
  requiredLevel: AtdsLevel;
  belowMinimum: boolean;
  blockingIssues: number;
  issues: string[];
  excludedHigherLevelIssues: number;
  explanation: string;
}

export class OperationalError extends Error {}
export function evaluateTool(tool: CatalogTool, options?: EvaluateOptions): ToolEvaluation;
export function evaluateToolSafe(tool: CatalogTool, options?: EvaluateOptions): ToolEvaluation;
export function evaluateStrict(result: Pick<ToolEvaluation, 'validatedLevel' | 'findings'>, minLevel?: string | null): StrictResult;
export function resolveTargets(tools: CatalogTool[], targets: string[], root?: string): Array<{ target: string; tool: CatalogTool }>;
