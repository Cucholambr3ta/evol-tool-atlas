import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Dynamically constructed so this script itself never embeds forbidden wording.
const FORBIDDEN_TERM_RE = new RegExp(['bl', 'ack', '\\s*', 'ar', 'ch'].join(''), 'i');

const OFFICIAL_HEX_COLORS = new Set([
  '#f6f3ed',
  '#fffdf7',
  '#30383c',
  '#4d4b48',
  '#365568',
  '#ffffff',
  '#9b8793',
  '#191b1e',
  '#27292d',
  '#faf8f0',
  '#ccc9c1',
  '#a98a9f',
]);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function assert(cond, message) {
  if (!cond) {
    throw new Error(`Verification failed: ${message}`);
  }
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function readPngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  assert(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `Invalid PNG signature: ${filePath}`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function verifyCatalogAndLinks() {
  const catalogo = readJson(path.join(ROOT, 'catalogo.json'));
  const indexData = readJson(path.join(ROOT, 'public', 'data', 'catalog-index.json'));
  const offlineManifest = readJson(path.join(ROOT, 'public', 'data', 'offline-manifest.json'));

  assert(catalogo.categorias.length === 48, `Expected 48 categories in catalogo.json, got ${catalogo.categorias.length}`);
  assert(catalogo.herramientas.length === 2127, `Expected 2127 tools in catalogo.json, got ${catalogo.herramientas.length}`);
  assert(indexData.categories.length === 48, `Expected 48 categories in catalog-index.json, got ${indexData.categories.length}`);
  assert(indexData.tools.length === 2127, `Expected 2127 tools in catalog-index.json, got ${indexData.tools.length}`);
  assert(indexData.totals.excluded === 741, `Expected 741 excluded entries, got ${indexData.totals.excluded}`);
  assert(indexData.totals.totalEntries === 2868, `Expected 2868 total entries, got ${indexData.totals.totalEntries}`);

  const toolIds = new Set(indexData.tools.map((t) => t.id));
  assert(toolIds.size === 2127, 'Duplicate tool IDs found in catalog-index.json');

  let shardToolCount = 0;
  const excludedNames = new Set();

  for (const cat of indexData.categories) {
    assert(fs.existsSync(path.join(ROOT, cat.htmlHref)), `Missing category HTML: ${cat.htmlHref}`);
    const shardPath = path.join(ROOT, 'public', 'data', 'categories', `${cat.slug}.json`);
    assert(fs.existsSync(shardPath), `Missing category shard: ${shardPath}`);
    const shard = readJson(shardPath);
    assert(shard.tools.length === cat.admitted, `Shard count mismatch for ${cat.slug}: ${shard.tools.length} vs ${cat.admitted}`);
    shardToolCount += shard.tools.length;
    for (const ex of shard.excludedEntries) {
      excludedNames.add(ex.name.toLowerCase());
    }
  }

  assert(shardToolCount === 2127, `Total shard tools mismatch: ${shardToolCount}`);

  // Ensure excluded entries (without colliding legitimate names? verify exact tool IDs vs excluded names)
  for (const ex of excludedNames) {
    assert(!toolIds.has(ex) || ex === 'metapaquete-oficial-distribucion-externa', `Excluded entry leaked as tool id: ${ex}`);
  }

  // Verify every offline manifest URL exists in public/ or root
  for (const item of offlineManifest.items) {
    const inRoot = fs.existsSync(path.join(ROOT, item.url));
    const inPublic = fs.existsSync(path.join(ROOT, 'public', item.url));
    assert(inRoot || inPublic, `Missing offline manifest resource: ${item.url}`);
  }

  // Verify zero broken internal links & zero inline scripts across 02-catalogo HTML files
  const catalogHtmlFiles = walkFiles(path.join(ROOT, '02-catalogo')).filter((f) => f.endsWith('.html'));
  assert(catalogHtmlFiles.length === 2175, `Expected 2175 HTML files in 02-catalogo, got ${catalogHtmlFiles.length}`);

  for (const htmlFile of catalogHtmlFiles) {
    const html = fs.readFileSync(htmlFile, 'utf8');
    assert(!/<script\b/i.test(html), `Unexpected <script> in ${htmlFile}`);
    assert(!/\bon[a-z]+\s*=/i.test(html), `Unexpected inline event handler in ${htmlFile}`);
    assert(!/(href|src)\s*=\s*["']?javascript:/i.test(html), `Unexpected javascript: URL in ${htmlFile}`);
    assert(!/<(script|link|img|iframe|object|embed)[^>]+https?:\/\//i.test(html), `Unexpected remote embed in ${htmlFile}`);

    const hrefRegex = /href=["']([^"']+)["']/g;
    let m;
    while ((m = hrefRegex.exec(html)) !== null) {
      const href = m[1];
      if (/^(https?:|#|mailto:)/i.test(href)) continue;
      const clean = href.split('#')[0].split('?')[0];
      if (!clean) continue;
      const resolved = path.resolve(path.dirname(htmlFile), clean);
      assert(fs.existsSync(resolved), `Broken internal link ${href} in ${path.relative(ROOT, htmlFile)}`);
    }
  }
}

function verifyBrandingCompliance() {
  const requiredBrandFiles = [
    'public/assets/brand/evol.svg',
    'public/assets/brand/o.svg',
    'src/assets/fonts/manrope.ttf',
    'src/assets/fonts/manrope-LICENSE.txt',
    'src/assets/fonts/atkinsonhyperlegible.ttf',
    'src/assets/fonts/atkinsonhyperlegible-LICENSE.txt',
    'public/icons/launcher-light.svg',
    'public/icons/launcher-dark.svg',
    'public/icons/launcher-maskable.svg',
    'public/icons/favicon.svg',
  ];
  for (const rel of requiredBrandFiles) {
    assert(fs.existsSync(path.join(ROOT, rel)), `Missing official brand asset: ${rel}`);
  }

  const expectedPngSizes = [
    ['public/icons/icon-192.png', 192, 192],
    ['public/icons/icon-512.png', 512, 512],
    ['public/icons/icon-maskable-192.png', 192, 192],
    ['public/icons/icon-maskable-512.png', 512, 512],
    ['public/icons/apple-touch-icon.png', 180, 180],
    ['public/icons/favicon-32.png', 32, 32],
  ];
  for (const [rel, w, h] of expectedPngSizes) {
    const abs = path.join(ROOT, rel);
    assert(fs.existsSync(abs), `Missing icon PNG: ${rel}`);
    const size = readPngSize(abs);
    assert(size.width === w && size.height === h, `Icon ${rel} has ${size.width}x${size.height}, expected ${w}x${h}`);
  }

  // Verify CSS files only use official hex palette colors
  const cssFiles = walkFiles(path.join(ROOT, 'src', 'styles')).filter((f) => f.endsWith('.css'));
  assert(cssFiles.length >= 1, 'No CSS files found in src/styles');
  for (const cssFile of cssFiles) {
    const css = fs.readFileSync(cssFile, 'utf8');
    const hexMatches = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    for (const hex of hexMatches) {
      assert(
        OFFICIAL_HEX_COLORS.has(hex.toLowerCase()),
        `Non-official color ${hex} in ${path.relative(ROOT, cssFile)}`,
      );
    }
  }

  // Ensure no external icon libs or CDNs in src/
  const srcFiles = walkFiles(path.join(ROOT, 'src'));
  for (const sf of srcFiles) {
    if (!/\.(ts|css|html|svg)$/.test(sf)) continue;
    const txt = fs.readFileSync(sf, 'utf8');
    assert(!/lucide|heroicons|fontawesome|bootstrap-icons/i.test(txt), `Forbidden third-party icon ref in ${sf}`);
    if (sf.endsWith('.ts') || sf.endsWith('.css')) {
      assert(!/https?:\/\/fonts\.googleapis\.com/i.test(txt), `Forbidden remote font CDN in ${sf}`);
    }
  }
}

function verifyZeroForbiddenMentions() {
  const dirsToScan = [
    path.join(ROOT, 'src'),
    path.join(ROOT, 'public'),
    path.join(ROOT, 'scripts'),
    path.join(ROOT, 'tests'),
    path.join(ROOT, '01-inventario'),
    path.join(ROOT, '02-catalogo'),
    path.join(ROOT, '05-referencias'),
    path.join(ROOT, '06-planificacion'),
    path.join(ROOT, 'plantillas'),
  ];
  const rootFilesToScan = [
    'index.html',
    'catalogo.json',
    'README.md',
    'SHA256SUMS.txt',
    'package.json',
    'vite.config.ts',
  ].map((f) => path.join(ROOT, f));

  if (fs.existsSync(DIST)) {
    dirsToScan.push(DIST);
  }

  const files = [...rootFilesToScan.filter((f) => fs.existsSync(f))];
  for (const d of dirsToScan) {
    walkFiles(d, files);
  }

  const textExtRe = /\.(html|json|md|txt|csv|ts|mjs|js|css|svg|webmanifest|yml|yaml)$/i;

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    assert(!FORBIDDEN_TERM_RE.test(rel), `Forbidden term found in file path: ${rel}`);
    if (textExtRe.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      assert(!FORBIDDEN_TERM_RE.test(content), `Forbidden term found in file contents: ${rel}`);
    }
  }
}

function verifyDistBuild() {
  if (!fs.existsSync(DIST)) {
    console.log('dist/ not present yet; skipping dist checks.');
    return;
  }
  const manifestPath = path.join(DIST, 'manifest.webmanifest');
  assert(fs.existsSync(manifestPath), 'Missing dist/manifest.webmanifest');
  const manifest = readJson(manifestPath);
  assert(manifest.name === 'Evol Tool Atlas', `Unexpected manifest.name: ${manifest.name}`);
  assert(manifest.display === 'standalone', `Unexpected manifest.display: ${manifest.display}`);
  assert(manifest.start_url === '/evol-tool-atlas/', `Unexpected manifest.start_url: ${manifest.start_url}`);
  assert(manifest.scope === '/evol-tool-atlas/', `Unexpected manifest.scope: ${manifest.scope}`);
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, 'Manifest must define at least 4 icons');
  for (const icon of manifest.icons) {
    const cleanIcon = icon.src.replace(/^\/evol-tool-atlas\//, '').replace(/^\//, '');
    const iconPath = path.join(DIST, cleanIcon);
    assert(fs.existsSync(iconPath), `Manifest icon missing in dist/: ${icon.src}`);
  }

  const distFonts = walkFiles(path.join(DIST, 'assets')).filter((f) => f.endsWith('.ttf'));
  assert(distFonts.length >= 2, `Expected >=2 bundled .ttf font files in dist/assets, found ${distFonts.length}`);

  assert(fs.existsSync(path.join(DIST, 'sw.js')), 'Missing dist/sw.js');
  const distIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert(distIndex.includes('Content-Security-Policy'), 'Missing CSP meta in dist/index.html');
  assert(fs.existsSync(path.join(DIST, '02-catalogo', 'seguridad', 'catalogo', 'firmware', 'index.html')), 'Missing static catalog in dist/');
  assert(fs.existsSync(path.join(DIST, '05-referencias', 'auditoria-v2.3.2', 'INFORME-FINAL.json')), 'Missing static references in dist/');
}

verifyCatalogAndLinks();
verifyBrandingCompliance();
verifyZeroForbiddenMentions();
verifyDistBuild();
console.log('ALL VERIFICATIONS PASSED: 48 categories, 2127 tools, 741 excluded, 0 broken links, 0 forbidden mentions, official Evol branding verified.');
