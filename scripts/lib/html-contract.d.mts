import type { AtdsLookup, AtdsOfficial, BaseContext, RuleContext } from './html-structure.mjs';

export type ContractId = 'ficha' | 'category-index';

export interface Contract {
  id: ContractId;
  title: string;
  template: string;
  requiredRules: readonly string[];
  notApplicable: Readonly<Record<string, string>>;
  checks: readonly string[];
}

export interface BlockingFinding {
  source: 'rule' | 'contract-check';
  id: string;
  basis: 'normative-html' | 'contract';
  message: string;
  context: string;
}

export interface CertifyResult {
  contract: ContractId;
  status: 'PASS' | 'FAIL';
  blocking: BlockingFinding[];
  advisory: Array<{ source: 'rule'; id: string; message: string }>;
}

export interface TargetSelection {
  schema: string;
  description: string | null;
  expectedCount: number;
  targets: Array<{ file: string; contract: ContractId }>;
}

export declare const CONTRACT_TEMPLATE_DIR: string;
export declare const CONTRACT_BASE_PATHS: readonly string[];
export declare const TARGETS_SCHEMA: string;
export declare const CONTRACTS: Readonly<Record<ContractId, Contract>>;
export declare const CONTRACT_CHECK_IDS: readonly string[];

export declare class HtmlOperationalError extends Error {
  exitCode: 2;
}

export declare function createAtdsLookup(options: {
  source?: 'evaluate' | 'report';
  rootDir: string;
  reportPath?: string;
  required?: boolean;
}): (tool: { id: string; href?: string; cat?: number }) => AtdsOfficial;
export declare function resolveBrowserHref(
  rel: string,
  href: string | null | undefined,
  basePath: string,
): { target: string } | { error: string } | null;
export declare function loadTargets(
  targetsPath: string,
  ctx: { rootDir: string; catalogo: BaseContext['catalogo'] },
): TargetSelection;
export declare function certifyHtml(html: string, ctx: Omit<RuleContext, 'root'>, contractId: ContractId): CertifyResult;
export declare function certifyTargets(input: { base: BaseContext; selection: TargetSelection }): {
  certified: number;
  passed: number;
  failed: number;
  results: Array<CertifyResult & { file: string }>;
};
export declare function renderContract(contractId: ContractId, vars: Record<string, string | number>): string;
export declare function rootPrefix(rel: string): string;
export declare function relativeHref(fromRel: string, toRel: string): string;
export declare function fichaContractVars(
  rel: string,
  base: BaseContext,
  atdsLookup: AtdsLookup,
  options: { date: string; contentSectionsHtml?: string; description?: string },
): Record<string, string>;
export declare function categoryContractVars(
  rel: string,
  base: BaseContext,
  atdsLookup: AtdsLookup,
  options: { date: string },
): Record<string, string | number>;
