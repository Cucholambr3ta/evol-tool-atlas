// Type declarations for ATDS JavaScript modules
declare module '../../scripts/lib/atds/normalize.mjs' {
  export const ROOT: string;
  export const UNVERIFIED_VALUES: ReadonlySet<string>;
  export const VAGUE_PATTERNS: readonly RegExp[];
  export function isHttpUrl(v: unknown): boolean;
  export function isVerifiedValue(v: unknown): boolean;
  export function collectUrls(meta: Record<string, unknown>): string[];
  export function extractTypeFromMeta(meta: Record<string, unknown>): 'cli' | 'gui' | 'api/sdk' | 'service/infra' | 'other';
  export function extractToolIdentity(meta: Record<string, unknown>, toolDir: string): Record<string, unknown>;
  export function normalizeMetadata(rawMeta: Record<string, unknown> | null, toolDir: string): {
    id: string;
    nombre: string;
    descripcion: string;
    categoria: string;
    tipo: string;
    problema_que_resuelve: string;
    funciones_principales: string;
    fuentes_oficiales: Record<string, unknown>;
    fuentes_consultadas: unknown[];
    referencias_oficiales: Array<{ url?: string }>;
    sitio_oficial: string;
    repositorio: string;
    upstream: string;
    sitio_web: string;
    licencia: string;
    sistema_operativo: string;
    dependencias: string;
    requisitos: string;
    fecha_verificacion: string;
    estado_fuente: string;
    limites: unknown[];
    id_catalogo: string;
    toolDir: string;
    rawTipo: string;
    urls: string[];
    toolType: 'cli' | 'gui' | 'api/sdk' | 'service/infra' | 'other';
    raw: Record<string, unknown>;
  };
}

declare module '../../scripts/lib/atds/guide.mjs' {
  export interface GuideCheckResult {
    valid: boolean;
    issues: string[];
    warnings: string[];
    sections: string[];
    stats: {
      backticks: number;
      codeFences: number;
      cliFlags: number;
      urls: number;
      guiMarkers: number;
      apiMarkers: number;
      serviceMarkers: number;
      vagueCount: number;
      foundSections: number;
      substantiveSections: number;
    };
  }
  export function checkGuideContent(guidePath: string, toolType?: 'cli' | 'gui' | 'api/sdk' | 'service/infra' | 'other'): GuideCheckResult;
  export function getGuideSections(toolType: string): { required: Array<{ key: string; patterns: string[] }>; markers: Record<string, number> };
  export const SECTION_DEFINITIONS: Record<string, { required: Array<{ key: string; patterns: string[] }>; markers: Record<string, number> }>;
}

declare module '../../scripts/lib/atds/skill.mjs' {
  export interface SkillCheckResult {
    valid: boolean;
    issues: string[];
    warnings: string[];
    sections: string[];
    stats: {
      numberedSteps: number;
      substantiveSteps: number;
      foundSections: number;
      substantiveSections: number;
    };
  }
  export function checkSkillContent(skillPath: string): SkillCheckResult;
  export const REQUIRED_SKILL_SECTIONS: Array<{ key: string; patterns: string[] }>;
}

declare module '../../scripts/lib/atds/cases.mjs' {
  export interface CasesCheckResult {
    valid: boolean;
    issues: string[];
    warnings: string[];
    cases: Array<Record<string, unknown>>;
    stats: {
      total: number;
      substantive: number;
    };
  }
  export function checkCasesContent(casesPath: string): CasesCheckResult;
}

declare module '../../scripts/lib/atds/evidence.mjs' {
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
}

declare module '../../scripts/lib/atds/classify.mjs' {
  export interface L1Result {
    passed: boolean;
    issues: string[];
    warnings: string[];
    checks: Record<string, 'PASS' | 'FAIL'>;
    score: number;
  }
  export interface L2Result {
    passed: boolean;
    issues: string[];
    warnings: string[];
    checks: Record<string, 'PASS' | 'FAIL' | 'BLOCKED'>;
  }
  export interface L3Result {
    passed: boolean;
    issues: string[];
    warnings: string[];
    checks: Record<string, 'PASS' | 'FAIL' | 'BLOCKED'>;
  }
  export interface L4Result {
    passed: boolean;
    issues: string[];
    warnings: string[];
    checks: Record<string, 'PASS' | 'FAIL' | 'BLOCKED'>;
    evidenceRefs: Array<{ id: string; sha256: string; destRel: string }>;
  }
  export function evaluateL1(normalizedMeta: Record<string, unknown>): L1Result;
  export function evaluateL2(l1Result: L1Result, guideResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown> }, normalizedMeta: Record<string, unknown>): L2Result;
  export function evaluateL3(l2Result: L2Result, skillResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown> }, casesResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown> }, normalizedMeta: Record<string, unknown>): L3Result;
  export function evaluateL4(l3Result: L3Result, evidenceResult: { valid: boolean; issues: string[]; warnings: string[]; stats: Record<string, unknown>; records: Array<Record<string, unknown>> }, normalizedMeta: Record<string, unknown>): L4Result;
  export function computeLevels(l1Result: any, l2Result: any, l3Result: any, l4Result: any): { candidateLevel: string; validatedLevel: string };
  export function computeStatus(issues: string[], l1Result: any, l2Result: any, l3Result: any, l4Result: any): 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' | 'ERROR';
}

declare module '../../scripts/lib/atds/diagnostics.mjs' {
  export interface Finding {
    doc: string;
    code: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    level: 'L1' | 'L2' | 'L3' | 'L4' | 'STRUCT';
    toolId: string | null;
    file: string | null;
    field: string | null;
    message: string;
    action: string;
    blocking: boolean;
    evidence?: unknown;
  }
  export function makeFinding(input: {
    code: string;
    level?: 'L1' | 'L2' | 'L3' | 'L4' | 'STRUCT';
    toolId?: string | null;
    file?: string | null;
    field?: string | null;
    message?: string;
    action?: string;
    severity?: 'ERROR' | 'WARNING' | 'INFO';
    blocking?: boolean;
    doc?: string;
    evidence?: unknown;
  }): Finding;
  export function mapCodeToDoc(code: string): string;
  export function summarizeFindings(findings: any[]): {
    byDoc: Record<string, number>;
    bySeverity: Record<string, number>;
    total: number;
    blocking: number;
  };
  export function isStructuralCode(code: string): boolean;
}

declare module '../../scripts/lib/atds/paths.mjs' {
  export const ROOT: string;
  export function isPathInside(root: string, target: string): boolean;
  export interface ResolveSuccess {
    ok: true;
    path: string;
  }
  export interface ResolveError {
    ok: false;
    error: 'EMPTY_PATH' | 'NULL_BYTE' | 'ABSOLUTE_PATH' | 'PATH_TRAVERSAL' | 'PATH_ESCAPE' | 'SYMLINK_ESCAPE' | 'REALPATH_ERROR' | 'MISSING';
    path?: string;
  }
  export type ResolveResult = ResolveSuccess | ResolveError;
  export function resolveWithin(root: string, relPath: string, options?: { allowMissing?: boolean }): ResolveResult;
  export interface ReadJsonSuccess {
    ok: true;
    data: unknown;
    path: string;
  }
  export interface ReadJsonError {
    ok: false;
    error: string;
    path?: string;
  }
  export type ReadJsonResult = ReadJsonSuccess | ReadJsonError;
  export function readJsonWithin(root: string, relPath: string): ReadJsonResult;
  export interface Sha256Success {
    ok: true;
    sha256: string;
    path: string;
    bytes: number;
  }
  export interface Sha256Error {
    ok: false;
    error: string;
    path?: string;
  }
  export type Sha256Result = Sha256Success | Sha256Error;
  export function sha256Within(root: string, relPath: string): Sha256Result;
  export function toolDirFromHref(href: string): string;
}
