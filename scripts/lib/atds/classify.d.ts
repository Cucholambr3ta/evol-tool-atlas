export interface L1Result {
  passed: boolean;
  issues: string[];
  warnings: string[];
  checks: Record<string, 'PASS' | 'FAIL'>;
  score: number;
}

export interface L2Result {
  passed: boolean;
  issues: string[];
  warnings: string[];
  checks: Record<string, 'PASS' | 'FAIL' | 'BLOCKED'>;
}

export interface L3Result {
  passed: boolean;
  issues: string[];
  warnings: string[];
  checks: Record<string, 'PASS' | 'FAIL' | 'BLOCKED'>;
}

export interface L4Result {
  passed: boolean;
  issues: string[];
  warnings: string[];
  checks: Record<string, 'PASS' | 'FAIL' | 'BLOCKED'>;
  evidenceRefs: Array<{ id: string; sha256: string; destRel: string }>;
}

export function evaluateL1(normalizedMeta: Record<string, unknown>): L1Result;
export function evaluateL2(l1Result: L1Result, guideResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown> }, normalizedMeta: Record<string, unknown>): L2Result;
export function evaluateL3(l2Result: L2Result, skillResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown> }, casesResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown> }, normalizedMeta: Record<string, unknown>): L3Result;
export function evaluateL4(l3Result: L3Result, evidenceResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown>; records: Array<Record<string, unknown>> }, normalizedMeta: Record<string, unknown>): L4Result;
export function computeLevels(l1Result: L1Result, l2Result: L2Result, l3Result: L3Result, l4Result: L4Result): { candidateLevel: string; validatedLevel: string };
export function computeStatus(issues: string[], l1Result: L1Result, l2Result: L2Result, l3Result: L3Result, l4Result: L4Result): 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' | 'ERROR';
