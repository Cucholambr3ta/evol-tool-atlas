export interface CasesCheckResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  cases: Array<Record<string, unknown>>;
  stats: {
    total: number;
    substantive: number;
  };
}
export function checkCasesContent(casesPath: string): CasesCheckResult;
