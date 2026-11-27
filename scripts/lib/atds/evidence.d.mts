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
  justificacion_tipo?: string;
}

export type ArtifactStatus =
  | 'VERIFIED' | 'VERIFIED_VIA_PRIMARY' | 'UNVERIFIABLE_NO_PATH' | 'NO_IDENTITY' | 'MALFORMED_HASH'
  | 'UNSAFE_PATH' | 'MISSING' | 'NOT_A_FILE' | 'HASH_MISMATCH' | 'DUPLICATE'
  | 'FOREIGN_ARTIFACT' | 'VERIFIED_BY_EXCEPTION';

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
  scope: 'functional' | 'version' | 'none';
  identityOk: boolean;
  typeOk: boolean;
  complete: boolean;
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

export type EvidenceSchemaStatus = 'MISSING_FILE' | 'INVALID_JSON' | 'INVALID_SCHEMA' | 'EMPTY' | 'OK';

export interface EvidenceRef { id: string; sha256: string | null; destRel: string | null }
export interface DeclaredEvidenceRef extends EvidenceRef { integrityVerified: boolean }

export interface EvidenceIdentity {
  id?: string;
  nombre?: string;
  id_catalogo?: string | null;
  exceptionsPath?: string;
  today?: string;
}

export interface ProvenanceException {
  id?: string;
  herramienta: string;
  ruta: string;
  sha256: string;
  motivo: string;
  aprobado_por: string;
  vence: string;
}

export interface EvidenceCheckResult extends CheckResultBase {
  schemaStatus: EvidenceSchemaStatus;
  declaredEvidenceRefs: DeclaredEvidenceRef[];
  verifiedEvidenceRefs: EvidenceRef[];
  records: EvidenceRecord[];
  integrity: RecordIntegrity[];
  limitations: string[];
  stats: EvidenceStats;
}

export function checkEvidenceContent(evidencePath: string, root: string, docRoot: string, identity?: EvidenceIdentity | null): EvidenceCheckResult;
export function verifyArtifact(
  art: DeclaredArtifact,
  docRoot: string,
  primary: ArtifactCheck | null,
  role: 'primary' | 'artifact',
  scope?: { toolDirAbs?: string | null; toolId?: string | null; exceptions?: ProvenanceException[]; today?: string },
): ArtifactCheck;
export function isVersionOnlyCommand(comando: unknown): boolean;
export function commandScope(comando: unknown): 'version' | 'other' | 'none';
export function normalizeIdentity(value: unknown): string;
export function loadProvenanceExceptions(filePath?: string): ProvenanceException[];
export const L4_FUNCTIONAL_TYPES: ReadonlySet<string>;
export const VALID_EVIDENCE_RESULTS: ReadonlySet<string>;
export const VALID_TEST_TYPES: ReadonlySet<string>;
