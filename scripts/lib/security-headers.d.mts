import type { IncomingMessage, ServerResponse } from 'node:http';

export const APP_CSP_DIRECTIVES: string[];
export const APP_CSP_HEADER: string;
export const APP_CSP_META: string;
export const DOCUMENT_CSP_HEADER: string;
export const COMMON_SECURITY_HEADERS: Record<string, string>;
export function policyForPath(urlPath: string, basePath: string): 'APP' | 'DOCUMENT';
export function securityHeadersFor(urlPath: string, basePath: string): Record<string, string>;
export function createSecurityHeadersMiddleware(
  basePath: string,
  options?: { documentsOnly?: boolean },
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
