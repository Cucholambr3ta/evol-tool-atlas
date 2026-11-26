import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveWithin } from './paths.mjs';

const VALID_EVIDENCE_RESULTS = new Set(['PASS', 'FAIL', 'BLOCKED', 'INCONCLUSIVE']);
const VALID_TEST_TYPES = new Set(['prueba_funcional', 'prueba_funcional_acotada', 'verificacion_de_version', 'prueba_integracion', 'prueba_rendimiento', 'prueba_seguridad', 'otro']);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function checkEvidenceContent(evidencePath, root, docRoot) {
  if (!fs.existsSync(evidencePath)) {
    return { valid: false, issues: ['MISSING_EVIDENCIAS'], warnings: [], records: [], stats: { passTotal: 0, passWithIntegrity: 0, blockedCount: 0 } };
  }
  const data = readJson(evidencePath);
  if (!data) {
    return { valid: false, issues: ['INVALID_EVIDENCIAS_JSON'], warnings: [], records: [], stats: { passTotal: 0, passWithIntegrity: 0, blockedCount: 0 } };
  }
  const issues = [];
  const warnings = [];
  const records = data.registros || [];
  
  let passWithIntegrity = 0;
  let passTotal = 0;
  let blockedCount = 0;
  let failCount = 0;
  let inconclusiveCount = 0;
  
  for (const r of records) {
    // Identity consistency
    if (r.herramienta && r.id_catalogo) {
      // Will be checked against metadata in classify
    }
    
    if (!VALID_EVIDENCE_RESULTS.has(r.resultado)) {
      issues.push(`EVIDENCE_${r.id}_INVALID_RESULT_${r.resultado}`);
    }
    
    if (!VALID_TEST_TYPES.has(r.tipo)) {
      warnings.push(`EVIDENCE_${r.id}_UNKNOWN_TEST_TYPE_${r.tipo}`);
    }
    
    if (r.resultado === 'PASS') {
      passTotal++;
      
      const hasEvidenceObj = r.evidencia && r.evidencia.sha256 && r.evidencia.destRel;
      const hasProcedencia = r.procedencia && (r.procedencia.repositorio || r.procedencia.origen || r.procedencia.archivo_original);
      const hasArtifacts = Array.isArray(r.artefactos) && r.artefactos.length > 0;
      const hasCommand = r.comando && String(r.comando).trim().length > 10;
      const hasEnv = r.entorno && String(r.entorno).trim().length > 5;
      const hasVersion = r.version && String(r.version).trim().length > 0;
      const hasFecha = r.fecha && String(r.fecha).trim().length > 5;
      const hasTipo = r.tipo && String(r.tipo).trim().length > 3;
      const hasResumen = r.resumen && String(r.resumen).trim().length > 20;
      const hasLimitaciones = Array.isArray(r.limitaciones) && r.limitaciones.length > 0;
      const hasCriterioAceptacion = r.criterio_aceptacion && String(r.criterio_aceptacion).trim().length > 10;
      const hasResultadoObservado = r.resultado_observado && String(r.resultado_observado).trim().length > 10;
      
      // Check artifact hash integrity
      let artifactIntegrity = false;
      if (hasEvidenceObj) {
        try {
          const resolved = resolveWithin(docRoot, r.evidencia.destRel, { allowMissing: false });
          if (resolved.ok) {
            const hash = sha256File(resolved.path);
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
      
      // Check all declared artifacts
      let allArtifactsMatch = true;
      if (hasArtifacts) {
        for (const art of r.artefactos) {
          if (art.sha256 && art.nombre) {
            // Can't verify all artifacts without paths, but check format
            if (!/^[a-f0-9]{64}$/i.test(art.sha256)) {
              issues.push(`EVIDENCE_${r.id}_INVALID_ARTIFACT_HASH`);
              allArtifactsMatch = false;
            }
          } else {
            allArtifactsMatch = false;
          }
        }
      }
      
      // Version check scope - if type is version check, command should reflect that
      const isVersionCheck = r.tipo === 'verificacion_de_version' || 
                             (r.comando && /--version|-V\b|version\b/.test(r.comando));
      if (isVersionCheck && r.tipo !== 'verificacion_de_version') {
        warnings.push(`EVIDENCE_${r.id}_VERSION_CHECK_AS_FUNCTIONAL`);
      }
      
      if (hasEvidenceObj && hasProcedencia && hasArtifacts && hasCommand && hasEnv && 
          hasVersion && hasFecha && hasTipo && hasResumen && hasLimitaciones &&
          hasCriterioAceptacion && hasResultadoObservado && artifactIntegrity && allArtifactsMatch) {
        passWithIntegrity++;
      } else {
        if (!hasEvidenceObj) warnings.push(`EVIDENCE_${r.id}_MISSING_EVIDENCE_OBJECT`);
        if (!hasProcedencia) warnings.push(`EVIDENCE_${r.id}_MISSING_PROCEDENCIA`);
        if (!hasArtifacts) warnings.push(`EVIDENCE_${r.id}_MISSING_ARTIFACTS`);
        if (!hasCommand) warnings.push(`EVIDENCE_${r.id}_MISSING_COMMAND`);
        if (!hasEnv) warnings.push(`EVIDENCE_${r.id}_MISSING_ENV`);
        if (!hasVersion) warnings.push(`EVIDENCE_${r.id}_MISSING_VERSION`);
        if (!hasFecha) warnings.push(`EVIDENCE_${r.id}_MISSING_FECHA`);
        if (!hasTipo) warnings.push(`EVIDENCE_${r.id}_MISSING_TIPO`);
        if (!hasResumen) warnings.push(`EVIDENCE_${r.id}_MISSING_RESUMEN`);
        if (!hasLimitaciones) warnings.push(`EVIDENCE_${r.id}_MISSING_LIMITACIONES`);
        if (!hasCriterioAceptacion) warnings.push(`EVIDENCE_${r.id}_MISSING_CRITERIO_ACEPTACION`);
        if (!hasResultadoObservado) warnings.push(`EVIDENCE_${r.id}_MISSING_RESULTADO_OBSERVADO`);
        if (!artifactIntegrity && hasEvidenceObj) warnings.push(`EVIDENCE_${r.id}_INTEGRITY_FAILED`);
        if (!allArtifactsMatch && hasArtifacts) warnings.push(`EVIDENCE_${r.id}_ARTIFACTS_MISMATCH`);
      }
      
    } else if (r.resultado === 'BLOCKED') {
      blockedCount++;
      if (r.evidencia !== null && r.evidencia !== undefined) issues.push(`BLOCKED_${r.id}_HAS_EVIDENCE`);
      if (r.artefactos && r.artefactos.length > 0) issues.push(`BLOCKED_${r.id}_HAS_ARTIFACTS`);
      if (r.sha256 !== null && r.sha256 !== undefined) issues.push(`BLOCKED_${r.id}_HAS_SHA256`);
      if (r.comando && String(r.comando).trim().length > 5) warnings.push(`BLOCKED_${r.id}_HAS_COMMAND`);
    } else if (r.resultado === 'FAIL') {
      failCount++;
    } else if (r.resultado === 'INCONCLUSIVE') {
      inconclusiveCount++;
    }
  }
  
  if (passTotal > 0 && passWithIntegrity === 0) {
    issues.push('EVIDENCE_NO_INTEGRITY_PASS');
  }
  
  return { 
    valid: issues.length === 0, 
    issues, 
    warnings, 
    records, 
    stats: { passTotal, passWithIntegrity, blockedCount, failCount, inconclusiveCount } 
  };
}

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export { checkEvidenceContent, VALID_EVIDENCE_RESULTS, VALID_TEST_TYPES };