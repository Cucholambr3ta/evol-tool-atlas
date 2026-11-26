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
