import type { CheckResultBase } from './types.d.mts';

export interface CasesCheckResult extends CheckResultBase {
  cases: Array<Record<string, unknown>>;
  stats: { total: number; substantive: number };
}
export function checkCasesContent(casesPath: string): CasesCheckResult;
