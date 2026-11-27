import type { FindingLevel, Severity } from './types.d.mts';

export const DOC_DEFINITIONS: Record<string, { title: string; action: string }>;

export interface Finding {
  doc: string;
  code: string;
  severity: Severity;
  level: FindingLevel;
  toolId: string | null;
  file: string | null;
  field: string | null;
  message: string;
  action: string;
  blocking: boolean;
  evidence?: unknown;
}

export interface FindingInput {
  code: string;
  level?: FindingLevel;
  toolId?: string | null;
  file?: string | null;
  field?: string | null;
  message?: string;
  action?: string;
  severity?: Severity;
  blocking?: boolean;
  doc?: string;
  evidence?: unknown;
}

export function mapCodeToDoc(code: string): string;
export function levelOfCode(code: string): FindingLevel | 'INFO';
export function findingFromCode(code: string, ctx: { severity: Severity; toolId?: string | null; toolDir?: string | null }): Finding;
export function makeFinding(input: FindingInput): Finding;
export function summarizeFindings(findings: Finding[]): {
  byDoc: Record<string, number>;
  bySeverity: Record<Severity, number>;
  total: number;
  blocking: number;
};
export function isStructuralCode(code: string): boolean;
