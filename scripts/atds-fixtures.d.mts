import type { CatalogTool } from './lib/atds/evaluate.d.mts';
import type { AtdsLevel } from './lib/atds/types.d.mts';

export interface FixtureSpec {
  id: string;
  expected: AtdsLevel;
  meta?: Record<string, unknown>;
  guide?: string;
  skill?: boolean;
  cases?: boolean;
  evidence?: { corruptSecondary?: boolean; unknownType?: boolean; wrappedVersion?: boolean; toolMismatch?: boolean; foreignArtifact?: boolean };
}

export function fixtureMetadata(id: string, overrides?: Record<string, unknown>): Record<string, unknown> & { id: string; id_catalogo: string; nombre: string };
export const CLI_GUIDE: string;
export const GUI_GUIDE: string;
export const API_GUIDE: string;
export const REPETITIVE_GUIDE: string;
export const PROSE_ONLY_GUIDE: string;
export const BRIEF_CLI_GUIDE: string;
export const SKILL_MD: string;
export function fixtureCases(meta: { nombre: string; id_catalogo: string }): { schema: string; herramienta: string; id_catalogo: string; casos: Array<Record<string, unknown>> };
export function writeFixtureEvidence(root: string, toolDir: string, meta: { nombre: string; id_catalogo: string }, options?: { corruptSecondary?: boolean; unknownType?: boolean; wrappedVersion?: boolean; toolMismatch?: boolean; foreignArtifact?: boolean }): { registros: Array<Record<string, unknown>> } & Record<string, unknown>;
export const FIXTURE_SPECS: FixtureSpec[];
export const NEGATIVE_L4_FIXTURE_SPECS: FixtureSpec[];
export function writeFixtureTool(root: string, spec: FixtureSpec): CatalogTool;
export function buildFixtureRoot(root: string, specs?: FixtureSpec[]): CatalogTool[];
