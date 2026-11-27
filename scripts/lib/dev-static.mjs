/**
 * Static catalogue serving for the Vite dev server (SEC-DEV-01).
 *
 * Requests are rejected, never "sanitised": a path that is ambiguous, encoded
 * twice, uses alternative separators, contains dot segments, or resolves
 * (directly or through a symlink) outside the authorised roots gets a 403.
 * The containment check runs after decoding and after resolving real paths.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Directory roots and single files the dev server may serve from the repository. */
export const DEV_STATIC_DIRS = ['02-catalogo', '05-referencias', 'skills'];
export const DEV_STATIC_FILES = ['catalogo.json', 'SHA256SUMS.txt', 'docs/atds/ATDS-v1.md'];

export const DEV_MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const MAX_PATH_LENGTH = 1024;
const STATIC_FIRST_SEGMENTS = new Set([...DEV_STATIC_DIRS, ...DEV_STATIC_FILES.map((f) => f.split('/')[0])]);

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * Classify a request URL.
 *
 * @param {string} rawUrl request URL as received (path + optional query)
 * @param {string} basePath app base path, e.g. "/evol-tool-atlas/"
 * @param {string} workspaceRoot absolute repository root
 * @returns {{ kind: 'pass' } | { kind: 'reject', status: 403 | 404, reason: string } | { kind: 'file', path: string, rel: string }}
 */
export function resolveDevStaticRequest(rawUrl, basePath, workspaceRoot) {
  const rawPath = String(rawUrl ?? '').split(/[?#]/)[0];
  let rel = rawPath;
  if (rel.startsWith(basePath)) rel = rel.slice(basePath.length);
  else if (rel.startsWith('/')) rel = rel.slice(1);

  // Decide on the raw form whether this request targets the static catalogue at all.
  // Encoded variants of a prefix (e.g. "02%2Dcatalogo") are not catalogue requests.
  const firstSegment = rel.split('/')[0];
  if (!STATIC_FIRST_SEGMENTS.has(firstSegment)) return { kind: 'pass' };

  if (rel.length > MAX_PATH_LENGTH) return { kind: 'reject', status: 403, reason: 'PATH_TOO_LONG' };
  if (rel.includes('\\')) return { kind: 'reject', status: 403, reason: 'BACKSLASH' };
  // Encoded separators or dots are never legitimate in catalogue paths.
  if (/%(2e|2f|5c|00)/i.test(rel)) return { kind: 'reject', status: 403, reason: 'ENCODED_SEPARATOR' };

  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return { kind: 'reject', status: 403, reason: 'MALFORMED_ENCODING' };
  }
  // A "%" surviving one decode means double encoding.
  if (decoded.includes('%')) return { kind: 'reject', status: 403, reason: 'DOUBLE_ENCODING' };
  if (decoded.includes('\0')) return { kind: 'reject', status: 403, reason: 'NULL_BYTE' };
  if (decoded.includes('\\')) return { kind: 'reject', status: 403, reason: 'BACKSLASH' };
  if (path.posix.isAbsolute(decoded) || /^[a-z]:/i.test(decoded)) return { kind: 'reject', status: 403, reason: 'ABSOLUTE_PATH' };

  const segments = decoded.split('/');
  // A trailing slash is allowed (directory index); any other empty, "." or ".." segment is not.
  const inner = segments[segments.length - 1] === '' ? segments.slice(0, -1) : segments;
  if (inner.some((s) => s === '' || s === '.' || s === '..')) {
    return { kind: 'reject', status: 403, reason: 'DOT_OR_EMPTY_SEGMENT' };
  }

  const isFile = DEV_STATIC_FILES.includes(decoded);
  const dirRoot = DEV_STATIC_DIRS.includes(inner[0]) ? inner[0] : null;
  if (!isFile && !dirRoot) return { kind: 'reject', status: 403, reason: 'OUTSIDE_ALLOWED_ROOTS' };

  const workspace = path.resolve(workspaceRoot);
  const allowedRoot = isFile ? path.resolve(workspace, decoded) : path.resolve(workspace, dirRoot);
  const target = path.resolve(workspace, ...inner);
  if (!isInside(allowedRoot, target)) return { kind: 'reject', status: 403, reason: 'PATH_ESCAPE' };

  if (!fs.existsSync(target)) return { kind: 'reject', status: 404, reason: 'NOT_FOUND' };
  let realRoot;
  let realTarget;
  try {
    realRoot = fs.realpathSync(allowedRoot);
    realTarget = fs.realpathSync(target);
  } catch {
    return { kind: 'reject', status: 404, reason: 'NOT_FOUND' };
  }
  if (!isInside(realRoot, realTarget)) return { kind: 'reject', status: 403, reason: 'SYMLINK_ESCAPE' };

  let candidate = realTarget;
  if (fs.statSync(candidate).isDirectory()) {
    candidate = path.join(candidate, 'index.html');
    if (!fs.existsSync(candidate)) return { kind: 'reject', status: 404, reason: 'NOT_FOUND' };
    const realIndex = fs.realpathSync(candidate);
    if (!isInside(realRoot, realIndex)) return { kind: 'reject', status: 403, reason: 'SYMLINK_ESCAPE' };
    candidate = realIndex;
  }
  if (!fs.statSync(candidate).isFile()) return { kind: 'reject', status: 404, reason: 'NOT_FOUND' };
  return { kind: 'file', path: candidate, rel: inner.join('/') };
}

/**
 * Connect-style middleware for the dev server.
 *
 * @param {string} basePath
 * @param {string} workspaceRoot
 */
export function createDevStaticMiddleware(basePath, workspaceRoot) {
  return (req, res, next) => {
    const result = resolveDevStaticRequest(req.url, basePath, workspaceRoot);
    if (result.kind === 'pass') {
      next();
      return;
    }
    if (result.kind === 'reject') {
      res.statusCode = result.status;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Never echo the requested path or the filesystem location.
      res.end(result.status === 403 ? 'Forbidden' : 'Not Found');
      return;
    }
    const ext = path.extname(result.path).toLowerCase();
    res.setHeader('Content-Type', DEV_MIME_TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(result.path).pipe(res);
  };
}
