export interface ScannedTag { name: string; attrs: Array<{ name: string; value: string | null }>; offset: number }
export function tokenizeTags(html: string): ScannedTag[];
export function scanHtml(html: string, ctx: { file: string; resolveLocal: (href: string) => boolean }): {
  blocking: string[];
  advisory: string[];
  stats: { inlineStyleBlocks: number; styleAttributes: number; externalLinks: number };
};
export function scanStaticTree(dir: string, root: string): {
  files: number;
  blocking: string[];
  advisoryCounts: Record<string, number>;
  stats: { inlineStyleBlocks: number; styleAttributes: number; externalLinks: number };
};
