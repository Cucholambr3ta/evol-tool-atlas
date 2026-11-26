import fs from 'node:fs';
import path from 'node:path';
import { summarizeFindings } from './diagnostics.mjs';

function buildToolReport(tool, result, toolDir) {
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

function mapCodeToDoc(code) {
  if (code.startsWith('L1_MISSING_FUENTE') || code.startsWith('L1_SOURCE')) return 'DOC-03';
  if (code.startsWith('L1_DESCRIPTION_VAGUE') || code.startsWith('L1_DESCRIPTION_GENERIC')) return 'DOC-01';
  if (code.startsWith('L1_MISSING_PLATAFORMAS') || code.startsWith('L2_GUIDE_MISSING_SECTION_PLATAFORMAS')) return 'DOC-05';
  if (code.includes('VERSION') || code.includes('VERSI')) return 'DOC-04';
  if (code.includes('INSTALACION') || code.includes('INSTALL') || code.startsWith('L2_GUIDE_MISSING_SECTION_INSTALACI')) return 'DOC-06';
  if (code.includes('COMANDOS') || code.includes('COMMAND') || code.startsWith('L2_GUIDE_MISSING_SECTION_COMANDOS')) return 'DOC-07';
  if (code.startsWith('L3_CASOS') || code.startsWith('CASO_')) return 'DOC-08';
  if (code.startsWith('L3_SKILL') || code.startsWith('SKILL_')) return 'DOC-09';
  if (code.startsWith('BLOCKED_') || code.startsWith('EVIDENCE_') || code.startsWith('L4_')) return 'DOC-10';
  if (code.startsWith('L2_GUIDE') || code.startsWith('L1_') || code.startsWith('L3_')) return 'DOC-02';
  if (code.startsWith('MISSING_') || code.startsWith('INVALID_') || code.startsWith('L1_ID_') || code.startsWith('PATH_')) return 'DOC-11';
  return 'DOC-02';
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