import fs from 'node:fs';
import path from 'node:path';
import { mapCodeToDoc } from './diagnostics.mjs';

function buildToolReport(tool, result) {
  const { 
    validatedLevel, candidateLevel, status, checks, issues, warnings, 
    evidenceRefs, limitations = [] 
  } = result;
  
  return {
    id: tool.id,
    category: tool.cat,
    level: validatedLevel,
    candidateLevel,
    status,
    checks,
    issues,
    warnings,
    evidenceRefs,
    checkedFiles: result.checkedFiles || [],
    limitations,
  };
}

function buildSummary(report) {
  const summary = {
    totalTools: report.totals.tools,
    levels: report.levels,
    toolsWithIssues: report.issues.length,
    issueCounts: {},
    docCounts: {},
    statusCounts: { PASS: 0, FAIL: 0, REVIEW_REQUIRED: 0, ERROR: 0 },
  };
  
  for (const e of report.issues) {
    summary.statusCounts[e.status] = (summary.statusCounts[e.status] || 0) + 1;
    for (const i of e.issues) {
      summary.issueCounts[i] = (summary.issueCounts[i] || 0) + 1;
    }
  }
  
  for (const tool of report.tools) {
    for (const i of tool.issues) {
      // Map to DOC
      const doc = i.startsWith('L1_') || i.startsWith('L2_') || i.startsWith('L3_') || i.startsWith('L4_') 
        ? mapCodeToDoc(i) : 'DOC-02';
      summary.docCounts[doc] = (summary.docCounts[doc] || 0) + 1;
    }
  }
  
  return summary;
}

function writeReport(root, report) {
  const reportsDir = path.join(root, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, 'atds-validation.json'), 
    JSON.stringify({ summary: report.summary, report }, null, 2)
  );
  console.log(`Report: reports/atds-validation.json`);
}

export { buildToolReport, buildSummary, writeReport };