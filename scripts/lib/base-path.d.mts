export const DEFAULT_BASE_PATH: string;
export function normalizeBasePath(raw: string | undefined | null): string;
export function resolveBasePath(env?: Record<string, string | undefined>): string;
