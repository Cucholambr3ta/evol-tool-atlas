export const ROOT: string;
export function isPathInside(root: string, target: string): boolean;

export type ResolveError = 'EMPTY_PATH' | 'NULL_BYTE' | 'ABSOLUTE_PATH' | 'PATH_TRAVERSAL' | 'PATH_ESCAPE' | 'SYMLINK_ESCAPE' | 'REALPATH_ERROR' | 'MISSING';
export type ResolveResult = { ok: true; path: string } | { ok: false; error: ResolveError };
export function resolveWithin(root: string, relPath: string, options?: { allowMissing?: boolean }): ResolveResult;

export type ReadJsonResult =
  | { ok: true; data: unknown; path: string }
  | { ok: false; error: ResolveError | 'INVALID_JSON'; path?: string };
export function readJsonWithin(root: string, relPath: string): ReadJsonResult;

export type Sha256Result =
  | { ok: true; sha256: string; path: string; bytes: number }
  | { ok: false; error: ResolveError | 'READ_ERROR'; path?: string };
export function sha256Within(root: string, relPath: string): Sha256Result;

export function toolDirFromHref(href: string): string;
