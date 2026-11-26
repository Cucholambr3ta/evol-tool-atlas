export interface ToolReportEntry {
  id: string;
  category: string;
  level: string;
  candidateLevel: string;
  status: string;
  checks: Record<string, string>;
  issues: string[];
  warnings: string[];
  evidenceRefs: Array<{ id: string; sha256: string; destRel: string }>;
  checkedFiles: string[];
  limitations: string[];
}

export function buildToolReport(tool: { id: string; cat: string }, result: { 
  validatedLevel: string; 
  candidateLevel: string; 
  status: string; 
  checks: Record<string, string>; 
  issues: string[]; 
  warnings: string[]; 
  evidenceRefs: Array<{ id: string; sha256: string; destRel: string }>; 
  checkedFiles: string[]; 
  limitations: string[];
}, toolDir: string): ToolReportEntry;

export function buildSummary(report: { 
  totals: { tools: number; categories: number }; 
  levels: Record<string, number>; 
  issues: ToolReportEntry[]; 
  tools: ToolReportEntry[]; 
}): {
  totalTools: number;
  levels: Record<string, number>;
  toolsWithIssues: number;
  issueCounts: Record<string, number>;
  docCounts: Record<string, number>;
  statusCounts: Record<string, number>;
};

export function writeReport(root: string, report: { summary: unknown; report: unknown }): void;
