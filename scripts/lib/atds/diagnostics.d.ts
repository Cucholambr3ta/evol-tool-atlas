export interface Finding {
  doc: string;
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  level: 'L1' | 'L2' | 'L3' | 'L4' | 'STRUCT';
  toolId: string | null;
  file: string | null;
  field: string | null;
  message: string;
  action: string;
  blocking: boolean;
  evidence?: unknown;
}

export function makeFinding(input: {
  code: string;
  level?: 'L1' | 'L2' | 'L3' | 'L4' | 'STRUCT';
  toolId?: string | null;
  file?: string | null;
  field?: string | null;
  message?: string;
  action?: string;
  severity?: 'ERROR' | 'WARNING' | 'INFO';
  blocking?: boolean;
  doc?: string;
  evidence?: unknown;
}): Finding;

export function mapCodeToDoc(code: string): string;
export function summarizeFindings(findings: Finding[]): {
  byDoc: Record<string, number>;
  bySeverity: Record<string, number>;
  total: number;
  blocking: number;
};
export function isStructuralCode(code: string): boolean;
