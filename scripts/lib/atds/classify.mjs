import { makeFinding, mapCodeToDoc } from './diagnostics.mjs';

function evaluateL1(normalizedMeta) {
  const issues = [];
  const warnings = [];
  const checks = {};
  
  const l1Checks = {
    id: { check: () => normalizedMeta.id && normalizedMeta.id !== '' },
    nombre: { check: () => normalizedMeta.nombre && normalizedMeta.nombre !== '' },
    descripcion: { 
      check: () => normalizedMeta.descripcion && 
        normalizedMeta.descripcion.trim().length > 20 &&
        !normalizedMeta.descripcion.includes('Herramienta de') // Too generic
    },
    categoria: { check: () => normalizedMeta.categoria && normalizedMeta.categoria !== '' },
    tipo: { check: () => normalizedMeta.tipo && normalizedMeta.tipo !== '' },
    problema: { check: () => normalizedMeta.problema_que_resuelve && normalizedMeta.problema_que_resuelve !== '' },
    funciones: { check: () => normalizedMeta.funciones_principales && normalizedMeta.funciones_principales !== '' },
    fuente: { check: () => normalizedMeta.urls && normalizedMeta.urls.length > 0 },
    plataformas: { check: () => normalizedMeta.sistema_operativo && normalizedMeta.sistema_operativo !== '' },
    limitaciones: { check: () => Array.isArray(normalizedMeta.limites) && normalizedMeta.limites.length > 0 },
    estado: { check: () => normalizedMeta.estado_fuente && normalizedMeta.estado_fuente !== '' },
    fecha_verificacion: { check: () => normalizedMeta.fecha_verificacion && normalizedMeta.fecha_verificacion !== '' },
    licencia: { check: () => normalizedMeta.licencia && normalizedMeta.licencia !== '' },
  };
  
  let passed = 0;
  for (const [key, { check }] of Object.entries(l1Checks)) {
    const ok = check();
    checks[`L1_${key.toUpperCase()}`] = ok ? 'PASS' : 'FAIL';
    if (!ok) {
      issues.push(`L1_MISSING_${key.toUpperCase()}`);
    } else {
      passed++;
    }
  }
  
  // Vague description check
  if (normalizedMeta.descripcion) {
    const vagueCount = normalizedMeta.VAGUE_PATTERNS ? 
      normalizedMeta.VAGUE_PATTERNS.filter(p => p.test(normalizedMeta.descripcion)).length : 0;
    if (vagueCount > 0) {
      issues.push('L1_DESCRIPTION_VAGUE');
    }
  }
  
  // Verify identity consistency - id is tool name, id_catalogo is AT-SEC-XXX
  // They are different identifiers, just check both are present and non-empty
  if (normalizedMeta.id && normalizedMeta.id_catalogo) {
    // Optional: warn if they look inconsistent but don't block
  }
  
  return { 
    passed: issues.length === 0, 
    issues, 
    warnings, 
    checks, 
    score: passed 
  };
}

function evaluateL2(l1Result, guideResult, normalizedMeta) {
  if (!l1Result.passed) {
    return { passed: false, issues: ['L2_BLOCKED_BY_L1'], warnings: [], checks: { L2_GUIA: 'BLOCKED' } };
  }
  
  const issues = [...l1Result.issues];
  const warnings = [...l1Result.warnings];
  const checks = { ...l1Result.checks };
  
  checks.L2_GUIA = guideResult.valid ? 'PASS' : 'FAIL';
  
  issues.push(...guideResult.issues.map(i => `L2_${i}`));
  warnings.push(...guideResult.warnings.map(w => `L2_${w}`));
  
  // Meta checks for L2
  const l2MetaChecks = {
    licencia: () => normalizedMeta.licencia && normalizedMeta.licencia !== '',
    sistema_operativo: () => normalizedMeta.sistema_operativo && normalizedMeta.sistema_operativo !== '',
    dependencias: () => normalizedMeta.dependencias && normalizedMeta.dependencias !== '',
    requisitos: () => normalizedMeta.requisitos && normalizedMeta.requisitos !== '',
  };
  
  for (const [key, check] of Object.entries(l2MetaChecks)) {
    const ok = check();
    checks[`L2_${key.toUpperCase()}`] = ok ? 'PASS' : 'FAIL';
    if (!ok) {
      issues.push(`L2_MISSING_${key.toUpperCase()}`);
    }
  }
  
  return { 
    passed: issues.filter(i => i.startsWith('L2_')).length === 0, 
    issues, 
    warnings, 
    checks 
  };
}

function evaluateL3(l2Result, skillResult, casesResult, normalizedMeta) {
  if (!l2Result.passed) {
    return { passed: false, issues: ['L3_BLOCKED_BY_L2'], warnings: [], checks: { L3_SKILL: 'BLOCKED', L3_CASOS: 'BLOCKED' } };
  }
  
  const issues = [...l2Result.issues];
  const warnings = [...l2Result.warnings];
  const checks = { ...l2Result.checks };
  
  checks.L3_SKILL = skillResult.valid ? 'PASS' : 'FAIL';
  checks.L3_CASOS = casesResult.valid ? 'PASS' : 'FAIL';
  
  // Need at least one valid path: skill OR cases
  const hasValidSkill = skillResult.valid;
  const hasValidCases = casesResult.valid && casesResult.stats.substantive > 0;
  
  if (hasValidCases) {
    // Cases path is valid - only cases issues matter for L3 blocking
    issues.push(...casesResult.issues.map(i => `L3_${i}`));
    warnings.push(...casesResult.warnings.map(w => `L3_${w}`));
    // Skill issues are informational only when cases are valid
    warnings.push(...skillResult.issues.map(i => `L3_SKILL_${i}`));
    warnings.push(...skillResult.warnings.map(w => `L3_SKILL_${w}`));
  } else if (hasValidSkill) {
    // Skill path is valid - only skill issues matter for L3 blocking
    issues.push(...skillResult.issues.map(i => `L3_${i}`));
    warnings.push(...skillResult.warnings.map(w => `L3_${w}`));
    // Cases issues are informational only when skill is valid
    warnings.push(...casesResult.issues.map(i => `L3_CASOS_${i}`));
    warnings.push(...casesResult.warnings.map(w => `L3_CASOS_${w}`));
  } else {
    // Neither path valid - all issues are blocking
    issues.push(...skillResult.issues.map(i => `L3_${i}`));
    warnings.push(...skillResult.warnings.map(w => `L3_${w}`));
    issues.push(...casesResult.issues.map(i => `L3_${i}`));
    warnings.push(...casesResult.warnings.map(w => `L3_${w}`));
    issues.push('L3_NO_SKILL_OR_CASOS');
  }
  
  return { 
    passed: issues.filter(i => i.startsWith('L3_')).length === 0, 
    issues, 
    warnings, 
    checks 
  };
}

function evaluateL4(l3Result, evidenceResult, normalizedMeta) {
  if (!l3Result.passed) {
    return { passed: false, issues: ['L4_BLOCKED_BY_L3'], warnings: [], checks: { L4_EVIDENCIA: 'BLOCKED' } };
  }
  
  const issues = [...l3Result.issues];
  const warnings = [...l3Result.warnings];
  const checks = { ...l3Result.checks };
  
  const l4EvidenceOk = evidenceResult.valid && evidenceResult.stats.passWithIntegrity > 0;
  checks.L4_EVIDENCIA = l4EvidenceOk ? 'PASS' : 'FAIL';
  
  issues.push(...evidenceResult.issues.map(i => `L4_${i}`));
  warnings.push(...evidenceResult.warnings.map(w => `L4_${w}`));
  
  if (!l4EvidenceOk) {
    issues.push('L4_INSUFFICIENT_EVIDENCE');
  }
  
  // Identity cross-check between evidence and metadata
  if (evidenceResult.records && Array.isArray(evidenceResult.records)) {
    for (const r of evidenceResult.records) {
      if (r.resultado === 'PASS') {
        if (r.id_catalogo !== normalizedMeta.id_catalogo && normalizedMeta.id_catalogo) {
          issues.push(`L4_EVIDENCE_ID_MISMATCH_${r.id}`);
        }
        if (r.herramienta && r.herramienta.toLowerCase() !== normalizedMeta.id.toLowerCase() &&
            r.herramienta.toLowerCase() !== normalizedMeta.nombre.toLowerCase()) {
          warnings.push(`L4_EVIDENCE_NAME_MISMATCH_${r.id}`);
        }
      }
    }
  }
  
  const evidenceRefs = (evidenceResult.records && Array.isArray(evidenceResult.records))
    ? evidenceResult.records
        .filter(r => r.resultado === 'PASS' && r.evidencia)
        .map(r => ({ id: r.id, sha256: r.evidencia.sha256, destRel: r.evidencia.destRel }))
    : [];
  
  return { 
    passed: issues.filter(i => i.startsWith('L4_')).length === 0, 
    issues, 
    warnings, 
    checks,
    evidenceRefs
  };
}

function computeLevels(l1Result, l2Result, l3Result, l4Result) {
  const candidateLevel = l4Result.passed ? 'L4' : l3Result.passed ? 'L3' : l2Result.passed ? 'L2' : l1Result.passed ? 'L1' : 'NONE';
  
  // Validated level considers only blocking issues at each level
  const validatedLevel = candidateLevel; // Same for now, but structure allows difference
  
  return { candidateLevel, validatedLevel };
}

function computeStatus(issues, l1Result, l2Result, l3Result, l4Result) {
  // Separate structural/blocking from informational
  const blockingIssues = issues.filter(i => 
    i.startsWith('L1_') || i.startsWith('L2_') || i.startsWith('L3_') || i.startsWith('L4_')
  );
  
  // Check for structural issues
  const structuralIssues = issues.filter(i => 
    i === 'MISSING_METADATA' || i === 'INVALID_METADATA_JSON' || i === 'MISSING_TOOL_DIR' ||
    i === 'PATH_ESCAPE' || i === 'PATH_TRAVERSAL' || i === 'ABSOLUTE_PATH' ||
    i === 'NULL_BYTE' || i === 'SYMLINK_ESCAPE' || i === 'L1_ID_MISMATCH' ||
    i === 'INVALID_CASOS_USO_JSON' || i === 'INVALID_EVIDENCIAS_JSON'
  );
  
  if (structuralIssues.length > 0) return 'ERROR';
  if (blockingIssues.length > 0) return 'FAIL';
  if (issues.length > 0) return 'REVIEW_REQUIRED';
  return 'PASS';
}

export { 
  evaluateL1, 
  evaluateL2, 
  evaluateL3, 
  evaluateL4, 
  computeLevels, 
  computeStatus 
};