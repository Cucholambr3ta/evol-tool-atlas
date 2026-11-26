import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_RE = /(^|\s)(TODO|FIXME)(\s|$|[.,;:])|\[PENDIENTE\]|\[TODO\]|\bPLACEHOLDER\b/i;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function checkCasesContent(casesPath) {
  if (!fs.existsSync(casesPath)) {
    return { valid: false, issues: ['MISSING_CASOS_USO'], warnings: [], cases: [], stats: { total: 0, substantive: 0 } };
  }
  const data = readJson(casesPath);
  if (!data) {
    return { valid: false, issues: ['INVALID_CASOS_USO_JSON'], warnings: [], cases: [], stats: { total: 0, substantive: 0 } };
  }
  const issues = [];
  const warnings = [];
  const cases = data.casos || [];
  
  if (!Array.isArray(cases) || cases.length === 0) {
    issues.push('CASOS_EMPTY');
    return { valid: false, issues, warnings, cases: [], stats: { total: 0, substantive: 0 } };
  }
  
  let substantiveCount = 0;
  
  for (const c of cases) {
    const hasObjective = c.objetivo && String(c.objetivo).trim().length > 30 && !PLACEHOLDER_RE.test(c.objetivo);
    const hasSteps = Array.isArray(c.pasos) && c.pasos.length >= 3 && 
                     c.pasos.every(s => typeof s === 'string' && s.trim().length > 10 && !PLACEHOLDER_RE.test(s));
    const hasPrereqs = Array.isArray(c.prerequisitos) && c.prerequisitos.length >= 1 &&
                       c.prerequisitos.every(p => typeof p === 'string' && p.trim().length > 3);
    const hasExpected = c.resultado_esperado && String(c.resultado_esperado).trim().length > 15 && !PLACEHOLDER_RE.test(c.resultado_esperado);
    
    const isSubstantive = hasObjective && hasSteps && hasPrereqs && hasExpected;
    
    if (isSubstantive) {
      substantiveCount++;
    }
    
    if (!hasObjective) issues.push(`CASO_${c.id}_MISSING_OBJECTIVE`);
    if (!hasSteps) issues.push(`CASO_${c.id}_INSUFFICIENT_STEPS`);
    if (!hasPrereqs) issues.push(`CASO_${c.id}_MISSING_PREREQS`);
    if (!hasExpected) issues.push(`CASO_${c.id}_MISSING_EXPECTED`);
  }
  
  if (substantiveCount === 0) {
    issues.push('CASOS_NO_SUBSTANTIVE');
  } else if (substantiveCount < cases.length) {
    warnings.push(`CASOS_PARTIAL_${substantiveCount}_OF_${cases.length}`);
  }
  
  // Check for ID consistency
  const ids = new Set();
  for (const c of cases) {
    if (c.id) {
      if (ids.has(c.id)) issues.push(`CASOS_DUPLICATE_ID_${c.id}`);
      ids.add(c.id);
    }
  }
  
  return { 
    valid: issues.length === 0, 
    issues, 
    warnings, 
    cases, 
    stats: { total: cases.length, substantive: substantiveCount } 
  };
}

export { checkCasesContent };