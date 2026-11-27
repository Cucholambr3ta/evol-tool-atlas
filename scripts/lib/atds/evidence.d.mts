import type { CheckResultBase } from './types.d.mts';

export type EvidenceResult = 'PASS' | 'FAIL' | 'BLOCKED' | 'INCONCLUSIVE';

export interface DeclaredArtifact {
  nombre?: string;
  sha256?: string;
  destRel?: string;
  ruta?: string;
  path?: string;
}

export interface EvidenceRecord {
  id: string;
  herramienta?: string;
  id_catalogo?: string;
  tipo?: string;
  fecha?: string;
  entorno?: string;
  version?: string;
  comando?: string;
  resultado: EvidenceResult | string;
  resumen?: string;
  evidencia?: (DeclaredArtifact & { sha256: string; destRel: string }) | null;
  sha256?: string | null;
  procedencia?: { repositorio?: string; origen?: string; archivo_original?: string } | null;
  artefactos?: DeclaredArtifact[] | null;
  limitaciones?: string[];
  criterio_aceptacion?: string;
  resultado_observado?: string;
}

export type ArtifactStatus =
  | 'VERIFIED' | 'VERIFIED_VIA_PRIMARY' | 'UNVERIFIABLE_NO_PATH' | 'NO_IDENTITY' | 'MALFORMED_HASH'
  | 'UNSAFE_PATH' | 'MISSING' | 'NOT_A_FILE' | 'HASH_MISMATCH' | 'DUPLICATE';

export interface ArtifactCheck {
  role: 'primary' | 'artifact';
  nombre: string | null;
  sha256: string | null;
  path: string | null;
  status: ArtifactStatus;
  detail?: string;
}

export interface RecordIntegrity {
  id: string;
  resultado: EvidenceResult;
  supportsL4: boolean;
  versionOnly: boolean;
  artifacts: ArtifactCheck[];
}

export interface EvidenceStats {
  passTotal: number;
  passWithIntegrity: number;
  blockedCount: number;
  failCount: number;
  inconclusiveCount: number;
  versionOnlyCount: number;
}

export interface EvidenceCheckResult extends CheckResultBase {
  records: EvidenceRecord[];
  integrity: RecordIntegrity[];
  limitations: string[];
  stats: EvidenceStats;
}

export function checkEvidenceContent(evidencePath: string, root: string, docRoot: string): EvidenceCheckResult;
export function verifyArtifact(art: DeclaredArtifact, docRoot: string, primary: ArtifactCheck | null, role: 'primary' | 'artifact'): ArtifactCheck;
export function isVersionOnlyCommand(comando: unknown): boolean;
export const VALID_EVIDENCE_RESULTS: ReadonlySet<string>;
export const VALID_TEST_TYPES: ReadonlySet<string>;
