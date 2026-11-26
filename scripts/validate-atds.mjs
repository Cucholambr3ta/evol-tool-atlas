import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function isHttpUrl(v) {
  return typeof v === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(v.trim());
}

function collectUrls(meta) {
  const urls = [];
  if (meta.fuentes_oficiales && typeof meta.fuentes_oficiales === 'object') {
    for (const v of Object.values(meta.fuentes_oficiales)) if (isHttpUrl(v)) urls.push(v);
  }
  if (Array.isArray(meta.fuentes_consultadas)) for (const v of meta.fuentes_consultadas) if (isHttpUrl(v)) urls.push(v);
  if (Array.isArray(meta.referencias_oficiales)) for (const r of meta.referencias_oficiales) if (r && isHttpUrl(r.url)) urls.push(r.url);
  if (isHttpUrl(meta.sitio_oficial)) urls.push(meta.sitio_oficial);
  if (isHttpUrl(meta.repositorio)) urls.push(meta.repositorio);
  if (isHttpUrl(meta.upstream)) urls.push(meta.upstream);
  if (isHttpUrl(meta.sitio_web)) urls.push(meta.sitio_web);
  return [...new Set(urls)];
}

const VAGUE_PATTERNS = [
  /herramienta para seguridad/i,
  /sirve para analizar sistemas/i,
  /permite realizar pruebas/i,
  /software avanzado de auditoria/i,
  /herramienta avanzada/i,
  /utilidad de seguridad/i,
];

const UNVERIFIED_VALUES = new Set([
  'NO_VERIFICADA', 'NO_VERIFICADO', 'PENDIENTE', 'NO_DETERMINADO',
  'DESCONOCIDO', 'N/A', 'NA', 'TBD', 'POR_DEFINIR'
]);

function isVerifiedValue(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (s === '') return false;
  if (UNVERIFIED_VALUES.has(s.toUpperCase())) return false;
  return true;
}

function checkGuideContent(guidePath) {
  if (!fs.existsSync(guidePath)) {
    return { valid: false, issues: ['MISSING_GUIDA'], warnings: [], sections: [] };
  }
  const content = fs.readFileSync(guidePath, 'utf8');
  const issues = [];
  const warnings = [];
  const sections = [];

  // Required sections for L2
  const requiredSections = [
    { key: 'Requisitos', patterns: ['Requisitos', 'requisitos', 'Prerrequisitos', 'pre-requisitos'] },
    { key: 'Dependencias', patterns: ['Dependencias', 'dependencias', 'Dependencias del sistema'] },
    { key: 'Instalación', patterns: ['Instalación', 'instalación', 'Instalación manual', 'Instalación y configuración'] },
    { key: 'Plataformas', patterns: ['Plataformas', 'plataformas', 'Compatibilidad', 'Sistemas operativos'] },
    { key: 'Verificación', patterns: ['Verificación', 'verificación', 'Comprobar instalación', 'Validar instalación'] },
    { key: 'Configuración', patterns: ['Configuración', 'configuración', 'Configuración inicial'] },
    { key: 'Primer uso', patterns: ['Primer uso', 'primer uso', 'Uso básico', 'Ejemplo básico', 'Quick start', 'Iniciación'] },
    { key: 'Comandos', patterns: ['Comandos', 'comandos', 'Parámetros', 'Opciones', 'Flags', 'Argumentos'] },
    { key: 'Entradas', patterns: ['Entradas', 'entradas', 'Input', 'Entrada esperada'] },
    { key: 'Salidas', patterns: ['Salidas', 'salidas', 'Output', 'Resultado esperado', 'Salida esperada'] },
    { key: 'Errores', patterns: ['Errores', 'errores', 'Errores frecuentes', 'Solución de problemas', 'Troubleshooting'] },
    { key: 'Advertencias', patterns: ['Advertencias', 'advertencias', 'Guardrails', 'Seguridad', 'Precauciones'] },
    { key: 'Referencias', patterns: ['Referencias', 'referencias', 'Referencias oficiales', 'Enlaces'] },
    { key: 'Limitaciones', patterns: ['Limitaciones', 'limitaciones', 'Alcance y limitaciones', 'Limitaciones conocidas'] },
  ];

  let foundSections = 0;
  for (const sec of requiredSections) {
    const found = sec.patterns.some(p => content.includes(p));
    if (found) {
      foundSections++;
      sections.push(sec.key);
    } else {
      issues.push(`GUIDE_MISSING_SECTION_${sec.key.toUpperCase()}`);
    }
  }

  // Check for vague/generic content
  const vagueCount = VAGUE_PATTERNS.filter(p => p.test(content)).length;
  if (vagueCount >= 3) {
    issues.push('GUIDE_GENERIC_CONTENT');
  } else if (vagueCount > 0) {
    warnings.push(`GUIDE_VAGUE_PATTERNS_${vagueCount}`);
  }

  // Check for placeholders
  if (/(^|\s)(TODO|FIXME)(\s|$|[.,;:])|\[PENDIENTE\]|\[TODO\]|\bPLACEHOLDER\b/i.test(content)) {
    issues.push('GUIDE_CONTAINS_PLACEHOLDERS');
  }

  // Check for technical depth - backticks, code fences, CLI flags
  const backticks = (content.match(/`/g) || []).length;
  const codeFences = (content.match(/```/g) || []).length;
  const cliFlags = (content.match(/--[a-zA-Z][\w-]*/g) || []).length;
  const urls = (content.match(/https?:\/\/[^\s)]+/g) || []).length;

  if (foundSections >= 10 && backticks >= 10 && codeFences >= 4 && cliFlags >= 3 && urls >= 2) {
    // Good technical depth
  } else if (foundSections >= 10) {
    warnings.push('GUIDE_LOW_TECHNICAL_DEPTH');
  }

  return { valid: issues.length === 0, issues, warnings, sections, stats: { backticks, codeFences, cliFlags, urls, vagueCount, foundSections } };
}

function checkSkillContent(skillPath) {
  if (!fs.existsSync(skillPath)) {
    return { valid: false, issues: ['MISSING_SKILL'], warnings: [], sections: [] };
  }
  const content = fs.readFileSync(skillPath, 'utf8');
  const issues = [];
  const warnings = [];
  const sections = [];

  const requiredSections = [
    'name:', 'description:', 'Cuándo usar', 'Entradas mínimas', 'Procedimiento',
    'Salidas esperadas', 'Guardrails', 'Evidencia', 'Referencias'
  ];

  for (const sec of requiredSections) {
    if (content.includes(sec)) {
      sections.push(sec);
    } else {
      issues.push(`SKILL_MISSING_SECTION_${sec.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
    }
  }

  if (/(^|\s)(TODO|FIXME)(\s|$|[.,;:])|\[PENDIENTE\]|\[TODO\]|\bPLACEHOLDER\b/i.test(content)) {
    issues.push('SKILL_CONTAINS_PLACEHOLDERS');
  }

  // Check for procedural content
  const numberedSteps = (content.match(/^\d+\./gm) || []).length;
  if (numberedSteps < 3) {
    warnings.push('SKILL_FEW_STEPS');
  }

  return { valid: issues.length === 0, issues, warnings, sections, stats: { numberedSteps } };
}

function checkCasesContent(casesPath) {
  if (!fs.existsSync(casesPath)) {
    return { valid: false, issues: ['MISSING_CASOS_USO'], warnings: [], cases: [] };
  }
  const data = readJson(casesPath);
  if (!data) {
    return { valid: false, issues: ['INVALID_CASOS_USO_JSON'], warnings: [], cases: [] };
  }
  const issues = [];
  const warnings = [];
  const cases = data.casos || [];

  if (!Array.isArray(cases) || cases.length === 0) {
    issues.push('CASOS_EMPTY');
    return { valid: false, issues, warnings, cases: [] };
  }

  let substantiveCount = 0;
  for (const c of cases) {
    const hasObjective = c.objetivo && String(c.objetivo).trim().length > 20;
    const hasSteps = Array.isArray(c.pasos) && c.pasos.length >= 3;
    const hasPrereqs = Array.isArray(c.prerequisitos) && c.prerequisitos.length >= 1;
    const hasExpected = c.resultado_esperado && String(c.resultado_esperado).trim().length > 10;

    if (hasObjective && hasSteps && hasPrereqs && hasExpected) {
      substantiveCount++;
    }

    if (!hasObjective) issues.push(`CASO_${c.id}_MISSING_OBJECTIVE`);
    if (!hasSteps) issues.push(`CASO_${c.id}_MISSING_STEPS`);
    if (!hasPrereqs) issues.push(`CASO_${c.id}_MISSING_PREREQS`);
    if (!hasExpected) issues.push(`CASO_${c.id}_MISSING_EXPECTED`);
  }

  if (substantiveCount === 0) {
    issues.push('CASOS_NO_SUBSTANTIVE');
  } else if (substantiveCount < cases.length) {
    warnings.push(`CASOS_PARTIAL_${substantiveCount}_OF_${cases.length}`);
  }

  return { valid: issues.length === 0, issues, warnings, cases, stats: { total: cases.length, substantive: substantiveCount } };
}

function checkEvidenceContent(evidencePath) {
  if (!fs.existsSync(evidencePath)) {
    return { valid: false, issues: ['MISSING_EVIDENCIAS'], warnings: [], records: [] };
  }
  const data = readJson(evidencePath);
  if (!data) {
    return { valid: false, issues: ['INVALID_EVIDENCIAS_JSON'], warnings: [], records: [] };
  }
  const issues = [];
  const warnings = [];
  const records = data.registros || [];

  let passWithIntegrity = 0;
  let passTotal = 0;
  let blockedCount = 0;

  for (const r of records) {
    if (r.resultado === 'PASS') {
      passTotal++;
      const hasEvidenceObj = r.evidencia && r.evidencia.sha256 && r.evidencia.destRel;
      const hasProcedencia = r.procedencia && (r.procedencia.repositorio || r.procedencia.origen);
      const hasArtifacts = Array.isArray(r.artefactos) && r.artefactos.length > 0;
      const hasCommand = r.comando && String(r.comando).trim().length > 5;
      const hasEnv = r.entorno && String(r.entorno).trim().length > 3;
      const hasVersion = r.version && String(r.version).trim().length > 0;

      // Check artifact hash integrity
      let artifactIntegrity = false;
      if (hasEvidenceObj) {
        try {
          const artifactPath = path.join(ROOT, r.evidencia.destRel);
          if (fs.existsSync(artifactPath)) {
            const hash = sha256File(artifactPath);
            if (hash === r.evidencia.sha256) {
              artifactIntegrity = true;
            } else {
              issues.push(`EVIDENCE_HASH_MISMATCH_${r.id}`);
            }
          } else {
            issues.push(`EVIDENCE_ARTIFACT_MISSING_${r.id}`);
          }
        } catch {
          issues.push(`EVIDENCE_PATH_ERROR_${r.id}`);
        }
      }

      if (hasEvidenceObj && hasProcedencia && hasArtifacts && hasCommand && hasEnv && hasVersion && artifactIntegrity) {
        passWithIntegrity++;
      } else {
        if (!hasEvidenceObj) warnings.push(`EVIDENCE_${r.id}_MISSING_OBJECT`);
        if (!hasProcedencia) warnings.push(`EVIDENCE_${r.id}_MISSING_PROCEDENCIA`);
        if (!hasArtifacts) warnings.push(`EVIDENCE_${r.id}_MISSING_ARTIFACTS`);
        if (!hasCommand) warnings.push(`EVIDENCE_${r.id}_MISSING_COMMAND`);
        if (!hasEnv) warnings.push(`EVIDENCE_${r.id}_MISSING_ENV`);
        if (!hasVersion) warnings.push(`EVIDENCE_${r.id}_MISSING_VERSION`);
        if (!artifactIntegrity && hasEvidenceObj) warnings.push(`EVIDENCE_${r.id}_INTEGRITY_FAILED`);
      }
    } else if (r.resultado === 'BLOCKED') {
      blockedCount++;
      if (r.evidencia !== null) issues.push(`BLOCKED_${r.id}_HAS_EVIDENCE`);
      if (r.artefactos && r.artefactos.length > 0) issues.push(`BLOCKED_${r.id}_HAS_ARTIFACTS`);
      if (r.sha256 !== null) issues.push(`BLOCKED_${r.id}_HAS_SHA256`);
    }
  }

  if (passTotal > 0 && passWithIntegrity === 0) {
    issues.push('EVIDENCE_NO_INTEGRITY_PASS');
  }

  return { valid: issues.length === 0, issues, warnings, records, stats: { passTotal, passWithIntegrity, blockedCount } };
}

async function evaluateTool(tool) {
  const toolDir = path.posix.dirname(tool.href);
  const metaPath = path.join(ROOT, toolDir, 'metadata.json');
  const issues = [];
  const warnings = [];
  const checks = {};
  const evidenceRefs = [];
  const checkedFiles = [];

  let meta = {};
  try {
    meta = readJson(metaPath);
    if (!meta) {
      issues.push('MISSING_METADATA');
      meta = {};
    }
  } catch {
    issues.push('MISSING_METADATA');
    meta = {};
  }

  // Collect files for verification
  const guidePath = path.join(ROOT, toolDir, 'GUIA.md');
  const skillPath = path.join(ROOT, toolDir, 'SKILL.md');
  const casesPath = path.join(ROOT, toolDir, 'casos-uso.json');
  const evidencePath = path.join(ROOT, toolDir, 'evidencias.json');
  const readmePath = path.join(ROOT, toolDir, 'README.md');
  const sha256sumsPath = path.join(ROOT, toolDir, 'SHA256SUMS.txt');

  checkedFiles.push(metaPath, guidePath, skillPath, casesPath, evidencePath, readmePath, sha256sumsPath);

  // ===== L1 CHECKS =====
  const l1Checks = {
    id: { required: true, check: () => isVerifiedValue(meta.id) },
    nombre: { required: true, check: () => isVerifiedValue(meta.nombre) },
    descripcion: { required: true, check: () => isVerifiedValue(meta.descripcion) && !VAGUE_PATTERNS.some(p => p.test(String(meta.descripcion || ''))) },
    categoria: { required: true, check: () => isVerifiedValue(meta.categoria) },
    tipo: { required: true, check: () => isVerifiedValue(meta.tipo) },
    problema: { required: true, check: () => isVerifiedValue(meta.problema_que_resuelve || meta.caso_uso_evol || meta.uso_evol_propuesto) },
    funciones: { required: true, check: () => isVerifiedValue(meta.funciones_principales || meta.descripcion) },
    fuente: { required: true, check: () => collectUrls(meta).length > 0 },
    plataformas: { required: true, check: () => isVerifiedValue(meta.sistema_operativo) },
    limitaciones: { required: true, check: () => Array.isArray(meta.limites) && meta.limites.length > 0 },
    estado: { required: true, check: () => isVerifiedValue(meta.estado_fuente || meta.estado_mantenimiento || meta.estado) },
  };

  let l1Passed = true;
  for (const [key, { check }] of Object.entries(l1Checks)) {
    const passed = check();
    checks[`L1_${key.toUpperCase()}`] = passed ? 'PASS' : 'FAIL';
    if (!passed) {
      issues.push(`L1_MISSING_${key.toUpperCase()}`);
      l1Passed = false;
    }
  }

  // Additional L1 checks
  if (!isVerifiedValue(meta.fecha_verificacion) && !isVerifiedValue(meta.verificacion_fecha)) {
    issues.push('L1_MISSING_FECHA_VERIFICACION');
    checks.L1_FECHA_VERIFICACION = 'FAIL';
    l1Passed = false;
  } else {
    checks.L1_FECHA_VERIFICACION = 'PASS';
  }

  if (!isVerifiedValue(meta.licencia)) {
    issues.push('L1_MISSING_LICENCIA');
    checks.L1_LICENCIA = 'FAIL';
    l1Passed = false;
  } else {
    checks.L1_LICENCIA = 'PASS';
  }

  // ===== L2 CHECKS =====
  let l2Passed = l1Passed;
  const guideCheck = checkGuideContent(guidePath);
  checks.L2_GUIA = guideCheck.valid ? 'PASS' : 'FAIL';
  issues.push(...guideCheck.issues.map(i => `L2_${i}`));
  warnings.push(...guideCheck.warnings.map(w => `L2_${w}`));
  if (!guideCheck.valid) l2Passed = false;

  const l2MetaChecks = {
    licencia: () => isVerifiedValue(meta.licencia),
    sistema_operativo: () => isVerifiedValue(meta.sistema_operativo),
    dependencias: () => isVerifiedValue(meta.dependencias),
    requisitos: () => isVerifiedValue(meta.requisitos),
  };

  for (const [key, check] of Object.entries(l2MetaChecks)) {
    const passed = check();
    checks[`L2_${key.toUpperCase()}`] = passed ? 'PASS' : 'FAIL';
    if (!passed) {
      issues.push(`L2_MISSING_${key.toUpperCase()}`);
      l2Passed = false;
    }
  }

  // ===== L3 CHECKS =====
  let l3Passed = l2Passed;
  const skillCheck = checkSkillContent(skillPath);
  const casesCheck = checkCasesContent(casesPath);

  checks.L3_SKILL = skillCheck.valid ? 'PASS' : 'FAIL';
  checks.L3_CASOS = casesCheck.valid ? 'PASS' : 'FAIL';

  issues.push(...skillCheck.issues.map(i => `L3_${i}`));
  warnings.push(...skillCheck.warnings.map(w => `L3_${w}`));
  issues.push(...casesCheck.issues.map(i => `L3_${i}`));
  warnings.push(...casesCheck.warnings.map(w => `L3_${w}`));

  if (!skillCheck.valid && !casesCheck.valid) {
    l3Passed = false;
    issues.push('L3_NO_SKILL_OR_CASOS');
  } else if (!skillCheck.valid && casesCheck.stats.substantive === 0) {
    l3Passed = false;
    issues.push('L3_INSUFFICIENT_APPLIED_KNOWLEDGE');
  }

  // ===== L4 CHECKS =====
  let l4Passed = l3Passed;
  const evidenceCheck = checkEvidenceContent(evidencePath);
  // L4 requires valid evidence structure AND at least one PASS with integrity
  const l4EvidenceOk = evidenceCheck.valid && evidenceCheck.stats.passWithIntegrity > 0;
  checks.L4_EVIDENCIA = l4EvidenceOk ? 'PASS' : 'FAIL';

  issues.push(...evidenceCheck.issues.map(i => `L4_${i}`));
  warnings.push(...evidenceCheck.warnings.map(w => `L4_${w}`));

  evidenceRefs.push(...evidenceCheck.records
    .filter(r => r.resultado === 'PASS' && r.evidencia)
    .map(r => ({ id: r.id, sha256: r.evidencia.sha256, destRel: r.evidencia.destRel })));

  if (!l4EvidenceOk) {
    l4Passed = false;
  }

  // Determine levels
  const candidateLevel = l4Passed ? 'L4' : l3Passed ? 'L3' : l2Passed ? 'L2' : l1Passed ? 'L1' : 'NONE';
  const validatedLevel = candidateLevel; // In this strict mode, candidate = validated

  // Status
  let status = 'PASS';
  if (issues.length > 0) {
    const blockingIssues = issues.filter(i => i.startsWith('L1_') || i.startsWith('L2_') || i.startsWith('L3_') || i.startsWith('L4_'));
    if (blockingIssues.length > 0) status = 'FAIL';
    else status = 'REVIEW_REQUIRED';
  }

  return {
    toolId: tool.id,
    catalogId: meta.id_catalogo || null,
    validatedLevel,
    candidateLevel,
    status,
    checks,
    issues,
    warnings,
    evidenceRefs,
    checkedFiles: checkedFiles.filter(f => fs.existsSync(f)),
    limitations: []
  };
}

const catalogo = readJson(path.join(ROOT, 'catalogo.json'));
const report = {
  generatedAt: new Date().toISOString(),
  totals: { tools: catalogo.herramientas.length, categories: catalogo.categorias.length },
  levels: {},
  issues: [],
  tools: [],
};

for (const t of catalogo.herramientas) {
  const result = await evaluateTool(t);
  const lvl = result.validatedLevel;
  report.levels[lvl] = (report.levels[lvl] || 0) + 1;

  const entry = {
    id: t.id,
    category: t.cat,
    level: lvl,
    candidateLevel: result.candidateLevel,
    status: result.status,
    checks: result.checks,
    issues: result.issues,
    warnings: result.warnings,
    evidenceRefs: result.evidenceRefs,
    checkedFiles: result.checkedFiles,
    limitations: result.limitations
  };
  report.tools.push(entry);
  if (result.issues.length > 0 || result.warnings.length > 0) {
    report.issues.push(entry);
  }
}

const summary = {
  totalTools: report.totals.tools,
  levels: report.levels,
  toolsWithIssues: report.issues.length,
  issueCounts: {},
};
for (const e of report.issues) {
  for (const i of e.issues) summary.issueCounts[i] = (summary.issueCounts[i] || 0) + 1;
}

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'atds-validation.json'), JSON.stringify({ summary, report }, null, 2));
console.log('ATDS validation complete.');
console.log(JSON.stringify(summary, null, 2));
console.log(`Report: reports/atds-validation.json`);