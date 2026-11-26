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
