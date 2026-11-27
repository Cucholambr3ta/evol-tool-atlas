export const OFFLINE_MANIFEST_SCHEMA: string;
export interface OfflineManifestEntry { url: string; kind: string; sha256: string; bytes: number }
export interface BuiltOfflineManifest {
  schema: string;
  revision: string;
  version: string;
  totalFiles: number;
  totalBytes: number;
  items: OfflineManifestEntry[];
}
export function buildOfflineManifest(input: { root: string; publicDir: string; items: Array<{ url: string; kind: string }> }): BuiltOfflineManifest;
