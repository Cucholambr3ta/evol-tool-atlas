import type { CheckResultBase, ToolType } from './types.d.mts';

export interface GuideSectionDefinition { key: string; patterns: string[] }
export interface GuideTypeDefinition { required: GuideSectionDefinition[]; markers: Record<string, number> }

export interface GuideStats {
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
  orderedSteps: number;
  commands: number;
  repeatedSections: number;
}
export interface GuideCheckResult extends CheckResultBase {
  sections: string[];
  /** Empty object when the guide file does not exist. */
  stats: GuideStats | Record<string, never>;
}
export function checkGuideContent(guidePath: string, toolType?: ToolType): GuideCheckResult;
export function getGuideSections(toolType: string): GuideTypeDefinition;
export const SECTION_DEFINITIONS: Record<ToolType, GuideTypeDefinition>;
export const PROCEDURE_REQUIREMENTS: Record<ToolType, { sections: string[]; responseSections?: string[]; need: 'commands' | 'steps' | 'commandsOrSteps' | 'requestResponse' }>;
export function countOrderedSteps(text: string): number;
export function countCommands(text: string): number;
