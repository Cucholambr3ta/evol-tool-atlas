import type { AtdsLevel, ToolStatus } from './types.d.mts';
import type { Finding } from './diagnostics.d.mts';
import type { RecordIntegrity } from './evidence.d.mts';

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
  evidenceRefs: Array<{ id: string; sha256: string; destRel: string }>;
  evidenceIntegrity: RecordIntegrity[];
  checkedFiles: string[];
  limitations: string[];
}

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
export function evaluateTool(tool: CatalogTool, options?: { root?: string }): ToolEvaluation;
export function evaluateStrict(result: Pick<ToolEvaluation, 'validatedLevel' | 'findings'>, minLevel?: string | null): StrictResult;
export function resolveTargets(tools: CatalogTool[], targets: string[], root?: string): Array<{ target: string; tool: CatalogTool }>;
