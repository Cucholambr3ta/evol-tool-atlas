import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Returns true when `target` is the same as `root` or lives inside it.
 * Both paths must already be absolute.
 *
 * @param {string} root
 * @param {string} target
 * @returns {boolean}
 */
export function isPathInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * Resolve a repository/documentary-relative path while enforcing containment.
 * The function rejects absolute paths, traversal segments, NUL bytes and
 * symlinks whose real target escapes `root`.
 *
 * @param {string} root Authorised documentary root.
 * @param {string} relPath Relative path to resolve.
 * @param {{ allowMissing?: boolean }} [options]
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
export function resolveWithin(root, relPath, options = {}) {
  const { allowMissing = true } = options;
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    return { ok: false, error: 'EMPTY_PATH' };
  }
  if (relPath.includes('\0')) {
    return { ok: false, error: 'NULL_BYTE' };
  }
  if (path.isAbsolute(relPath)) {
    return { ok: false, error: 'ABSOLUTE_PATH' };
  }
  const normalized = path.normalize(relPath);
  if (normalized === '..' || normalized.startsWith('..' + path.sep)) {
    return { ok: false, error: 'PATH_TRAVERSAL' };
  }

  const rootResolved = path.resolve(root);
  const target = path.resolve(rootResolved, normalized);
  if (!isPathInside(rootResolved, target)) {
    return { ok: false, error: 'PATH_ESCAPE' };
  }

  try {
    const realRoot = fs.realpathSync(rootResolved);
    let probe = target;
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
    const realProbe = fs.realpathSync(probe);
    if (!isPathInside(realRoot, realProbe)) {
      return { ok: false, error: 'SYMLINK_ESCAPE' };
    }
    if (fs.existsSync(target)) {
      const realTarget = fs.realpathSync(target);
      if (!isPathInside(realRoot, realTarget)) {
        return { ok: false, error: 'SYMLINK_ESCAPE' };
      }
    }
  } catch {
    return { ok: false, error: 'REALPATH_ERROR' };
  }

  if (!allowMissing && !fs.existsSync(target)) {
    return { ok: false, error: 'MISSING' };
  }

  return { ok: true, path: target };
}

/**
 * Read and parse a JSON file inside an authorised root.
 *
 * @param {string} root
 * @param {string} relPath
 * @returns {{ ok: true, data: unknown, path: string } | { ok: false, error: string, path?: string }}
 */
export function readJsonWithin(root, relPath) {
  const resolved = resolveWithin(root, relPath, { allowMissing: true });
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  if (!fs.existsSync(resolved.path)) {
    return { ok: false, error: 'MISSING', path: resolved.path };
  }
  try {
    const raw = fs.readFileSync(resolved.path, 'utf8');
    return { ok: true, data: JSON.parse(raw), path: resolved.path };
  } catch {
    return { ok: false, error: 'INVALID_JSON', path: resolved.path };
  }
}

/**
 * Compute the SHA-256 of a file inside an authorised root.
 *
 * @param {string} root
 * @param {string} relPath
 * @returns {{ ok: true, sha256: string, path: string, bytes: number } | { ok: false, error: string, path?: string }}
 */
export function sha256Within(root, relPath) {
  const resolved = resolveWithin(root, relPath, { allowMissing: false });
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  try {
    const content = fs.readFileSync(resolved.path);
    return {
      ok: true,
      sha256: createHash('sha256').update(content).digest('hex'),
      path: resolved.path,
      bytes: content.length,
    };
  } catch {
    return { ok: false, error: 'READ_ERROR', path: resolved.path };
  }
}

/**
 * Resolve a tool href such as `02-catalogo/x/y/index.html` to its directory.
 *
 * @param {string} href
 * @returns {string}
 */
export function toolDirFromHref(href) {
  return path.posix.dirname(String(href || '').replace(/\\/g, '/'));
}
