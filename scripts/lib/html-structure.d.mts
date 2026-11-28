export type Priority = 'P1' | 'P2' | 'P3';
export type Severity = 'error' | 'warn';
export type Mode = 'advisory' | 'strict';

export interface ToolRecord {
  id: string;
  href: string;
  cat: number;
  slug: string;
  [key: string]: unknown;
}

export interface CategoryRecord {
  numero: number;
  slug: string;
  href: string;
  [key: string]: unknown;
}

export interface AtdsTool {
  id: string;
  level: string;
  candidateLevel: string;
  [key: string]: unknown;
}

export interface AtdsReport {
  report: { tools: AtdsTool[]; [key: string]: unknown };
  [key: string]: unknown;
}

export interface Finding {
  rule: string;
  ruleName: string;
  priority: Priority;
  severity: Severity;
  category: string;
  wcag: string | null;
  file: string;
  message: string;
  element: string;
  context: string;
  allowed: boolean;
}

export interface RuleContext {
  root: unknown;
  filePath: string;
  rel: string;
  tool: ToolRecord | null;
  category: CategoryRecord | null;
  atdsReport: AtdsReport | null;
  rootDir: string;
  basePath: string;
}

export interface Rule {
  id: string;
  name: string;
  priority: Priority;
  severity: Severity;
  category: string;
  description: string;
  wcag?: string;
  check: (ctx: RuleContext) => Array<{ message: string; element: string; context?: string }>;
}

export interface BaseContext {
  rootDir: string;
  catalogo: { herramientas: ToolRecord[]; categorias: CategoryRecord[] };
  atdsReport: AtdsReport | null;
  basePath: string;
  toolsByHref: Map<string, ToolRecord>;
  categoriesByNumber: Map<number, CategoryRecord>;
}

export interface AllowlistEntry {
  file: string;
  rule: string;
  reason: string;
  expiresAt: string;
  ticket?: string;
  expired?: boolean;
}

export interface Allowlist {
  schema: string | null;
  expiresAt?: string | null;
  owner?: string | null;
  entries: AllowlistEntry[];
  byKey: Map<string, AllowlistEntry>;
  warnings: string[];
}

export interface Summary {
  total: number;
  byPriority: Record<Priority, number>;
  byCategory: Record<string, number>;
  byRule: Record<string, number>;
  byFile: Record<string, number>;
  filesWithFindings: number;
}

export const DEFAULT_BASE_PATH: string;
export const PRIORITY_SEVERITY: Readonly<Record<Priority, Severity>>;
export const CATEGORY_LABELS: Readonly<Record<string, string>>;
export const RULES: Rule[];

export function resolveLocalHref(fromDir: string, href: string | null | undefined, basePath?: string): string | null;
export function createContext(input: {
  rootDir: string;
  catalogo: { herramientas: ToolRecord[]; categorias: CategoryRecord[] };
  atdsReport?: AtdsReport | null;
  basePath?: string;
}): BaseContext;
export function fileContext(base: BaseContext, filePath: string): Omit<RuleContext, 'root'>;
export function validateHtml(html: string, ctx: Omit<RuleContext, 'root'>): Finding[];
export function validateFile(filePath: string, ctx: BaseContext): Finding[];
export function loadAllowlist(
  allowlistPath: string | null | undefined,
  options: { rootDir: string; now?: Date; rules?: Rule[] },
): Allowlist;
export function applyAllowlist(
  findings: Finding[],
  allowlist: Allowlist,
  mode: Mode,
): { findings: Finding[]; suppressed: number };
export function summarize(findings: Finding[]): Summary;
export function ruleCatalog(): Array<Omit<Rule, 'check'>>;
export function walkHtmlFiles(dir: string, out?: string[]): string[];
