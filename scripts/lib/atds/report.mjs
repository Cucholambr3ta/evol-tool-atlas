import fs from 'node:fs';
import path from 'node:path';
import { summarizeFindings } from './diagnostics.mjs';

function buildToolReport(tool, result) {
  return {
    id: tool.id,
    category: tool.cat,
    level: result.validatedLevel,
    candidateLevel: result.candidateLevel,
    status: result.status,
    reviewRequired: Boolean(result.reviewRequired),
    checks: result.checks,
    // `issues`/`warnings` are kept as plain codes for existing consumers;
    // `findings` carries the structured DOC diagnostics for the same codes.
    issues: result.issues,
    warnings: result.warnings,
    findings: result.findings || [],
    evidenceRefs: result.evidenceRefs || [],
    evidenceIntegrity: result.evidenceIntegrity || [],
    checkedFiles: result.checkedFiles || [],
    limitations: result.limitations || [],
  };
}

function buildSummary(report) {
  const statusCounts = { PASS: 0, FAIL: 0, REVIEW_REQUIRED: 0, ERROR: 0 };
  const candidateLevels = { NONE: 0, L1: 0, L2: 0, L3: 0, L4: 0 };
  const levels = { NONE: 0, L1: 0, L2: 0, L3: 0, L4: 0 };
  const issueCounts = {};
  const allFindings = [];
  let reviewRequired = 0;
  let linksNotChecked = 0;

  for (const tool of report.tools) {
    statusCounts[tool.status] = (statusCounts[tool.status] || 0) + 1;
    levels[tool.level] = (levels[tool.level] || 0) + 1;
    candidateLevels[tool.candidateLevel] = (candidateLevels[tool.candidateLevel] || 0) + 1;
    if (tool.reviewRequired) reviewRequired++;
    for (const i of tool.issues) issueCounts[i] = (issueCounts[i] || 0) + 1;
    for (const f of tool.findings) {
      allFindings.push(f);
      if (f.code === 'DOC12_LINKS_NOT_CHECKED') linksNotChecked++;
    }
  }

  const f = summarizeFindings(allFindings);
  return {
    totalTools: report.totals.tools,
    totalCategories: report.totals.categories,
    levels,
    candidateLevels,
    statusCounts,
    statusSemantics: 'Estado frente al contrato completo L1–L4: FAIL indica requisitos bloqueantes pendientes en algún nivel, no un error del validador.',
    toolsWithIssues: report.tools.filter((t) => t.issues.length > 0 || t.warnings.length > 0).length,
    reviewRequired,
    findings: {
      total: f.total,
      blocking: f.blocking,
      byDoc: f.byDoc,
      bySeverity: f.bySeverity,
    },
    doc12: {
      toolsWithLinksNotChecked: linksNotChecked,
      note: 'No se realiza verificación de red: los enlaces se identifican pero no se comprueban; ningún enlace se informa como roto.',
    },
    issueCounts,
  };
}

function writeReport(root, report, relPath = path.join('reports', 'atds-validation.json')) {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ summary: report.summary, report }, null, 2));
  return target;
}

export { buildToolReport, buildSummary, writeReport };
