import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const ITEMS_TO_COPY = ['02-catalogo', '05-referencias', 'skills', 'catalogo.json', 'SHA256SUMS.txt'];

function copyEntry(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyEntry(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function main() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist/ does not exist; run vite build first.');
  }
  for (const item of ITEMS_TO_COPY) {
    const src = path.join(ROOT, item);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing required static catalog item: ${item}`);
    }
    copyEntry(src, path.join(DIST, item));
  }
  console.log('Copied static catalog directories and manifests into dist/.');
}

main();
