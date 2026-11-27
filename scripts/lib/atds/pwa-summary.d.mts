import type { ToolEvaluation } from './evaluate.d.mts';

export const ATDS_SUMMARY_SCHEMA: string;
export function contentRevision(root: string, toolDir: string): string;
export interface PwaAtdsSummary {
  schema: string;
  candidateLevel: ToolEvaluation['candidateLevel'];
  validatedLevel: ToolEvaluation['validatedLevel'];
  status: ToolEvaluation['status'];
  reviewRequired: boolean;
  blockingCount: number;
  warningCount: number;
  findings: Array<{ code: string; doc: string; level: string; severity: string; blocking: boolean }>;
  resources: Array<{ kind: string; file: string; href: string | null; present: boolean; valid: boolean; check: string }>;
  evidence: {
    schemaStatus: string;
    records: Array<{
      id: string;
      resultado: string;
      integrity: 'VERIFICADA' | 'NO_ACREDITADA' | 'NO_APLICA';
      reasons: string[];
      artifacts: Array<{ nombre: string | null; path: string | null; role: string; status: string; href: string | null }>;
    } & Record<string, unknown>>;
    pendientes: string[];
    verifiedCount: number;
    declaredCount: number;
  } | null;
  contentRevision: string;
}
export function buildAtdsSummary(tool: { id: string; href: string }, result: ToolEvaluation, root: string): PwaAtdsSummary;
