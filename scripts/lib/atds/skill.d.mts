import type { CheckResultBase } from './types.d.mts';

export interface SkillCheckResult extends CheckResultBase {
  sections: string[];
  stats: { numberedSteps: number; substantiveSteps: number; foundSections?: number; substantiveSections?: number };
}
export function checkSkillContent(skillPath: string): SkillCheckResult;
export const REQUIRED_SKILL_SECTIONS: Array<{ key: string; patterns: string[] }>;
