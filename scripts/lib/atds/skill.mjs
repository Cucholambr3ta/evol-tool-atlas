import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_RE = /(^|\s)(TODO|FIXME)(\s|$|[.,;:])|\[PENDIENTE\]|\[TODO\]|\bPLACEHOLDER\b/i;

const REQUIRED_SKILL_SECTIONS = [
  { key: 'name:', patterns: ['name:', 'name :', '## name', '## Name', '# name', '# Name'] },
  { key: 'description:', patterns: ['description:', 'description :', '## description', '## Description', '# description', '# Description'] },
  { key: 'Cuándo usar', patterns: ['Cuándo usar', 'cuándo usar', 'Cuando usar', '## Cuándo usar', '## cuando usar'] },
  { key: 'Entradas mínimas', patterns: ['Entradas mínimas', 'entradas mínimas', 'Entradas minimas', '## Entradas'] },
  { key: 'Procedimiento', patterns: ['Procedimiento', 'procedimiento', '## Procedimiento', 'Pasos', 'pasos'] },
  { key: 'Salidas esperadas', patterns: ['Salidas esperadas', 'salidas esperadas', '## Salidas', 'Resultados'] },
  { key: 'Guardrails', patterns: ['Guardrails', 'guardrails', 'Guardrails obligatorios', '## Guardrails'] },
  { key: 'Evidencia', patterns: ['Evidencia', 'evidencia', 'Evidencia y trazabilidad', '## Evidencia'] },
  { key: 'Referencias', patterns: ['Referencias', 'referencias', '## Referencias'] },
];

function extractSectionContent(content, patterns) {
  const lines = content.split('\n');
  let inSection = false;
  let result = [];
  
  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      const header = headerMatch[1].trim();
      if (inSection) break;
      if (patterns.some(p => header.toLowerCase().includes(p.toLowerCase()))) {
        inSection = true;
        continue;
      }
    }
    // Also check YAML frontmatter
    if (!inSection && patterns.some(p => line.trim().startsWith(p))) {
      inSection = true;
      result.push(line);
      continue;
    }
    if (inSection) {
      result.push(line);
    }
  }
  
  return result.join('\n').trim();
}

function countSubstantiveSteps(procedimientoContent) {
  if (!procedimientoContent) return 0;
  const lines = procedimientoContent.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+[\.\)]\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^(\d+[\.\)]|[-*])\s+/, '');
      if (text.length > 10 && !PLACEHOLDER_RE.test(text) && !/^(paso|step|todo|pendiente)/i.test(text)) {
        count++;
      }
    }
  }
  return count;
}

function checkSkillContent(skillPath) {
  if (!fs.existsSync(skillPath)) {
    return { valid: false, issues: ['MISSING_SKILL'], warnings: [], sections: [], stats: { numberedSteps: 0, substantiveSteps: 0 } };
  }
  const content = fs.readFileSync(skillPath, 'utf8');
  const issues = [];
  const warnings = [];
  const sections = [];
  
  let foundSections = 0;
  let substantiveSections = 0;
  
  for (const sec of REQUIRED_SKILL_SECTIONS) {
    const found = sec.patterns.some(p => content.includes(p));
    if (found) {
      foundSections++;
      sections.push(sec.key);
      const sectionContent = extractSectionContent(content, sec.patterns);
      if (sectionContent.length > 50 && !PLACEHOLDER_RE.test(sectionContent)) {
        substantiveSections++;
      } else {
        issues.push(`SKILL_SECTION_GENERIC_${sec.key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
      }
    } else {
      issues.push(`SKILL_MISSING_SECTION_${sec.key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
    }
  }
  
  if (PLACEHOLDER_RE.test(content)) {
    issues.push('SKILL_CONTAINS_PLACEHOLDERS');
  }
  
  const procedimientoContent = extractSectionContent(content, REQUIRED_SKILL_SECTIONS.find(s => s.key === 'Procedimiento').patterns);
  const numberedSteps = (content.match(/^\d+[\.\)]\s+/gm) || []).length;
  const substantiveSteps = countSubstantiveSteps(procedimientoContent);
  
  if (substantiveSteps < 3) {
    if (numberedSteps < 3) {
      issues.push('SKILL_INSUFFICIENT_STEPS');
    } else {
      issues.push('SKILL_STEPS_NOT_SUBSTANTIVE');
    }
  }
  
  return { 
    valid: issues.length === 0, 
    issues, 
    warnings, 
    sections, 
    stats: { numberedSteps, substantiveSteps, foundSections, substantiveSections } 
  };
}

export { checkSkillContent, REQUIRED_SKILL_SECTIONS };