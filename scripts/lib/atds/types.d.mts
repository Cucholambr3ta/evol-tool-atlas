/** Shared ATDS v1 types (declaration-only module). */
export type AtdsLevel = 'NONE' | 'L1' | 'L2' | 'L3' | 'L4';
export type ToolType = 'cli' | 'gui' | 'api/sdk' | 'service/infra' | 'other';
export type Severity = 'ERROR' | 'WARNING' | 'INFO';
export type FindingLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'STRUCT';
export type CheckState = 'PASS' | 'FAIL' | 'BLOCKED';
export type ToolStatus = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' | 'ERROR';

export interface CheckResultBase {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface LevelResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
  checks: Record<string, CheckState>;
}
