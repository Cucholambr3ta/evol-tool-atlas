import type { IncomingMessage, ServerResponse } from 'node:http';

export const DEV_STATIC_DIRS: string[];
export const DEV_STATIC_FILES: string[];
export const DEV_MIME_TYPES: Record<string, string>;

export type DevStaticResolution =
  | { kind: 'pass' }
  | { kind: 'reject'; status: 403 | 404; reason: string }
  | { kind: 'file'; path: string; rel: string };

export function resolveDevStaticRequest(rawUrl: string | undefined, basePath: string, workspaceRoot: string): DevStaticResolution;
export function createDevStaticMiddleware(
  basePath: string,
  workspaceRoot: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
