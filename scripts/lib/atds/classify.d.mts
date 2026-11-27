import type { AtdsLevel, CheckResultBase, LevelResult, ToolStatus } from './types.d.mts';
import type { EvidenceRecord } from './evidence.d.mts';
import type { NormalizedMetadata } from './normalize.d.mts';

export interface L1Result extends LevelResult { score: number }
export type L2Result = LevelResult;
export type L3Result = LevelResult;
export interface L4Result extends LevelResult {
  evidenceRefs: Array<{ id: string; sha256: string; destRel: string }>;
}

/** Minimal shape of the normalised metadata the level evaluators read. */
export type ClassifiableMeta = Partial<NormalizedMetadata>;

export interface ResourcePresence {
  metadata?: boolean;
  guide?: boolean;
  skillOrCases?: boolean;
  evidencePass?: boolean;
}

export const LEVELS: readonly AtdsLevel[];
export const L1_FIELDS: Record<string, { field: string; check: (m: ClassifiableMeta) => boolean }>;
export function evaluateL1(normalizedMeta: ClassifiableMeta): L1Result;
export function evaluateL2(l1Result: Pick<LevelResult, 'passed' | 'issues' | 'warnings' | 'checks'>, guideResult: CheckResultBase, normalizedMeta: ClassifiableMeta): L2Result;
export function evaluateL3(
  l2Result: Pick<LevelResult, 'passed' | 'issues' | 'warnings' | 'checks'>,
  skillResult: CheckResultBase,
  casesResult: CheckResultBase & { stats: { substantive: number } },
): L3Result;
export function evaluateL4(
  l3Result: Pick<LevelResult, 'passed' | 'issues' | 'warnings' | 'checks'>,
  evidenceResult: CheckResultBase & { stats: { passWithIntegrity: number }; records?: EvidenceRecord[] },
  normalizedMeta: ClassifiableMeta,
): L4Result;
export function computeCandidateLevel(resources: ResourcePresence | undefined): AtdsLevel;
export function computeLevels(
  l1Result: { passed: boolean },
  l2Result: { passed: boolean },
  l3Result: { passed: boolean },
  l4Result: { passed: boolean },
  resources?: ResourcePresence,
): { candidateLevel: AtdsLevel; validatedLevel: AtdsLevel };
export function computeStatus(issues: string[], warnings?: string[]): ToolStatus;
export function parseLevel(value: unknown): AtdsLevel | null;
export function levelRank(level: string): number;
