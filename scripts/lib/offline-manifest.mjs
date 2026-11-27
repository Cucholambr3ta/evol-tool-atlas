/**
 * Deterministic offline manifest (OFF-02, OFF-03).
 *
 * Every item carries the SHA-256 and size of the exact file that will be published,
 * and the revision is derived from that content: a GUIA.md edit that leaves the
 * 2,137 tools unchanged still produces a new revision. No timestamps are included,
 * so the same inputs always give byte-identical output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const OFFLINE_MANIFEST_SCHEMA = 'evol-tool-atlas/offline-manifest/2';
const SAFE_URL_RE = /^(data\/categories\/[a-z0-9-]+\.json|(02-catalogo|05-referencias|skills|docs\/atds)\/[A-Za-z0-9._/-]+|catalogo\.json|SHA256SUMS\.txt)$/;

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * @param {{ root: string, publicDir: string, items: Array<{ url: string, kind: string }> }} input
 *   `items` in display order; duplicates keep their first kind.
 * @returns {{ schema: string, revision: string, version: string, totalFiles: number, totalBytes: number,
 *   items: Array<{ url: string, kind: string, sha256: string, bytes: number }> }}
 */
export function buildOfflineManifest({ root, publicDir, items }) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    if (!SAFE_URL_RE.test(item.url) || item.url.includes('..')) {
      throw new Error(`URL de manifiesto offline no permitida: ${item.url}`);
    }
    const inPublic = path.join(publicDir, item.url);
    const inRoot = path.join(root, item.url);
    const file = fs.existsSync(inPublic) ? inPublic : inRoot;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`Recurso del manifiesto offline inexistente: ${item.url}`);
    }
    const buf = fs.readFileSync(file);
    out.push({ url: item.url, kind: item.kind, sha256: sha256(buf), bytes: buf.length });
  }
  const revision = sha256(
    [...out].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)).map((i) => `${i.url}\t${i.sha256}\n`).join(''),
  );
  return {
    schema: OFFLINE_MANIFEST_SCHEMA,
    revision,
    version: revision.slice(0, 16),
    totalFiles: out.length,
    totalBytes: out.reduce((acc, i) => acc + i.bytes, 0),
    items: out,
  };
}
