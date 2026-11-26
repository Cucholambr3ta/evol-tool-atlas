export const ROOT: string;

export function isPathInside(root: string, target: string): boolean;

export interface ResolveResult {
  ok: true;
  path: string;
} | {
  ok: false;
  error: 'EMPTY_PATH' | 'NULL_BYTE' | 'ABSOLUTE_PATH' | 'PATH_TRAVERSAL' | 'PATH_ESCAPE' | 'SYMLINK_ESCAPE' | 'REALPATH_ERROR' | 'MISSING';
  path?: string;
}

export function resolveWithin(root: string, relPath: string, options?: { allowMissing?: boolean }): ResolveResult;

export interface ReadJsonResult {
  ok: true;
  data: unknown;
  path: string;
} | {
  ok: false;
  error: string;
  path?: string;
}

export function readJsonWithin(root: string, relPath: string): ReadJsonResult;

export interface Sha256Result {
  ok: true;
  sha256: string;
  path: string;
  bytes: number;
} | {
  ok: false;
  error: string;
  path?: string;
}

export function sha256Within(root: string, relPath: string): Sha256Result;

export function toolDirFromHref(href: string): string;
