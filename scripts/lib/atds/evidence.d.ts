export interface EvidenceRecord {
  id: string;
  herramienta: string;
  id_catalogo: string;
  tipo: string;
  fecha: string;
  entorno: string;
  version: string;
  comando: string;
  resultado: 'PASS' | 'FAIL' | 'BLOCKED' | 'INCONCLUSIVE';
  resumen: string;
  evidencia: { sha256: string; destRel: string } | null;
  sha256: string | null;
  procedencia: { repositorio?: string; origen?: string; archivo_original?: string } | null;
  artefactos: Array<{ sha256: string; nombre?: string }> | null;
  limitaciones: string[];
  criterio_aceptacion?: string;
  resultado_observado?: string;
}

export interface EvidenceCheckResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  records: EvidenceRecord[];
  stats: {
    passTotal: number;
    passWithIntegrity: number;
    blockedCount: number;
    failCount: number;
    inconclusiveCount: number;
  };
}

export function checkEvidenceContent(evidencePath: string, root: string, docRoot: string): EvidenceCheckResult;
export const VALID_EVIDENCE_RESULTS: ReadonlySet<'PASS' | 'FAIL' | 'BLOCKED' | 'INCONCLUSIVE'>;
export const VALID_TEST_TYPES: ReadonlySet<string>;
