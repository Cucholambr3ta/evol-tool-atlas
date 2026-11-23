import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT_CATS_DIR = path.join(OUT_DIR, 'categories');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(trimmed);
}

function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function extractDescriptionFromHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) return '';
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Look for <h2>Qué es</h2><p>...</p> or <p class="lead">...</p> if meaningful
  const queEsMatch = html.match(/<h2[^>]*>\s*Qu[eé]\s+es\s*<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (queEsMatch && queEsMatch[1]) {
    const clean = decodeBasicEntities(queEsMatch[1].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (clean) return clean;
  }
  const leadMatch = html.match(/<p[^>]*class=["'][^"']*lead[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  if (leadMatch && leadMatch[1]) {
    const clean = decodeBasicEntities(leadMatch[1].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (clean && !/ficha comprobada|ficha documental|sin instalación/i.test(clean)) {
      return clean;
    }
  }
  return '';
}

function pickFirstString(obj, keys) {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

function pickFirstUrl(obj, keys) {
  for (const key of keys) {
    const val = obj[key];
    if (isHttpUrl(val)) return val.trim();
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const nested of Object.values(val)) {
        if (isHttpUrl(nested)) return String(nested).trim();
      }
    }
  }
  return null;
}

function collectWarnings(meta) {
  const keys = [
    'advertencia',
    'advertencias',
    'advertencia_historica',
    'restriccion',
    'restricciones',
    'restriccion_uso',
    'limites',
    'riesgos',
    'distincion_fuentes',
    'seguridad_contexto',
    'uso_autorizado',
    'nota_estado',
    'observaciones',
    'validaciones_pendientes',
  ];
  const seen = new Set();
  const out = [];
  for (const key of keys) {
    const val = meta[key];
    if (typeof val === 'string') {
      const s = val.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') {
          const s = item.trim();
          if (s && !seen.has(s)) {
            seen.add(s);
            out.push(s);
          }
        }
      }
    }
  }
  return out;
}

function collectExternalReferences(meta, primaryUrl) {
  const labeledKeys = [
    ['Sitio oficial', 'sitio_oficial'],
    ['Repositorio oficial', 'repositorio'],
    ['Releases oficiales', 'releases'],
    ['Repositorio', 'fuente_repositorio'],
    ['Distribución', 'fuente_distribucion'],
    ['Distribución verificada', 'fuente_distribucion_comprobada'],
    ['Proyecto verificado', 'fuente_proyecto_verificada'],
    ['Proyecto contrastado', 'fuente_proyecto_contrastada'],
    ['Referencia web verificada', 'referencia_web_verificada'],
    ['Fuente del proyecto', 'fuente_proyecto'],
    ['Fuente identificada', 'fuente_identificada_expediente'],
    ['Fuente del expediente', 'fuente_proyecto_del_expediente'],
    ['Fuente adicional', 'fuente_adicional'],
    ['Fuente histórica', 'fuente_historica'],
  ];

  const refs = [];
  const seenUrls = new Set();

  const pushRef = (label, url) => {
    if (!isHttpUrl(url)) return;
    const norm = url.trim();
    if (seenUrls.has(norm)) return;
    seenUrls.add(norm);
    refs.push({ label, url: norm });
  };

  if (primaryUrl) {
    pushRef('Fuente principal', primaryUrl);
  }

  for (const [label, key] of labeledKeys) {
    const val = meta[key];
    if (typeof val === 'string') pushRef(label, val);
  }

  if (meta.fuentes_oficiales && typeof meta.fuentes_oficiales === 'object') {
    for (const [subKey, subVal] of Object.entries(meta.fuentes_oficiales)) {
      if (typeof subVal === 'string') {
        pushRef(`Oficial (${subKey})`, subVal);
      }
    }
  }

  if (meta.registro_origen && typeof meta.registro_origen === 'object') {
    const hist = meta.registro_origen.fuente_historica;
    if (typeof hist === 'string') pushRef('Referencia de origen', hist);
  }

  if (Array.isArray(meta.fuentes_consultadas)) {
    for (const item of meta.fuentes_consultadas) {
      if (typeof item === 'string') {
        pushRef('Fuente consultada', item);
      }
    }
  }

  return refs;
}

function classifyEvidenceGroup(evidenceStatus, meta) {
  const upper = evidenceStatus.toUpperCase();
  const maint = String(meta.mantenimiento_actual ?? meta.estado_mantenimiento ?? '').toUpperCase();
  if (
    upper.includes('HISTORICA') ||
    upper.includes('HISTORICO') ||
    upper.includes('NO_APROBADA') ||
    maint.includes('ARCHIV') ||
    maint.includes('HISTORIC')
  ) {
    return 'historica';
  }
  if (
    upper.includes('REVALIDADA') ||
    upper.includes('RELEASE') ||
    upper.includes('PYPI') ||
    upper.includes('EXTERNA_COMPROBADA') ||
    upper.includes('CONTRASTADA') ||
    upper.includes('FUENTE_Y_RELEASE') ||
    upper.includes('PRIMARIA_VERIFICADA')
  ) {
    return 'verificada';
  }
  return 'expediente';
}

function extractExcludedEntries(valJson) {
  const raw = Array.isArray(valJson.exclusion)
    ? valJson.exclusion
    : Array.isArray(valJson.exclusiones)
      ? valJson.exclusiones
      : Array.isArray(valJson.rechazadas)
        ? valJson.rechazadas
        : [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      name: String(item.nombre ?? item.id ?? 'Entrada sin nombre'),
      reason: String(item.motivo ?? item.razon ?? 'Sin umbral documental suficiente'),
      sourceType: item.tipo_fuente ? String(item.tipo_fuente) : null,
      evidenceDate: item.evidencia_fecha ? String(item.evidencia_fecha) : null,
    }));
}

function main() {
  fs.mkdirSync(OUT_CATS_DIR, { recursive: true });

  const catalogo = readJson(path.join(ROOT, 'catalogo.json'));
  const informe = readJson(path.join(ROOT, '05-referencias', 'auditoria-v2.3.2', 'INFORME-FINAL.json'));

  const categories = catalogo.categorias.map((c) => ({
    number: Number(c.numero),
    slug: String(c.slug),
    name: String(c.nombre),
    admitted: Number(c.admitidas),
    excluded: Number(c.excluidas),
    totalEntries: Number(c.entradas),
    htmlHref: String(c.href),
    validationJsonHref: `05-referencias/auditoria-v2.3.2/${c.slug}/VALIDACION.json`,
    validationMdHref: `05-referencias/auditoria-v2.3.2/${c.slug}/VALIDACION.md`,
    originGroup: String(c.grupo_origen ?? ''),
    zipName: String(c.zip ?? ''),
  }));

  const categoryByNumber = new Map(categories.map((c) => [c.number, c]));
  const shardToolsBySlug = new Map(categories.map((c) => [c.slug, []]));
  const toolSummaries = [];
  const evidenceCounts = {};
  const featuredCandidates = [];

  for (const t of catalogo.herramientas) {
    const cat = categoryByNumber.get(Number(t.cat));
    if (!cat) {
      throw new Error(`Missing category ${t.cat} for tool ${t.id}`);
    }
    const toolDirRel = path.posix.dirname(t.href);
    const toolDirAbs = path.join(ROOT, toolDirRel);
    const metaPath = path.join(toolDirAbs, 'metadata.json');
    const readmePath = path.join(toolDirAbs, 'README.md');
    const htmlPath = path.join(ROOT, t.href);

    if (!fs.existsSync(metaPath)) {
      throw new Error(`Missing metadata.json for tool ${t.id}: ${metaPath}`);
    }

    const meta = readJson(metaPath);

    let description =
      (typeof t.description === 'string' && t.description.trim()) ||
      pickFirstString(meta, [
        'descripcion',
        'descripcion_original_catalogo',
        'descripcion_historica',
        'descripcion_editorial',
      ]) ||
      extractDescriptionFromHtml(htmlPath);

    description = description.replace(/\s+/g, ' ').trim();

    const evidenceStatus =
      (typeof t.evidence === 'string' && t.evidence.trim()) ||
      pickFirstString(meta, ['evidencia_fuente', 'estado_fuente', 'estado', 'nivel_evidencia']) ||
      'DOCUMENTAL';

    evidenceCounts[evidenceStatus] = (evidenceCounts[evidenceStatus] ?? 0) + 1;

    const evidenceGroup = classifyEvidenceGroup(evidenceStatus, meta);
    const historicalFlag = evidenceGroup === 'historica';
    const revalidated20261122 =
      evidenceStatus.includes('2026-11-22') ||
      evidenceStatus.includes('REVALIDADA_WEB') ||
      evidenceStatus.includes('RELEASE_OFICIAL_VERIFICADA') ||
      evidenceStatus.includes('FUENTE_Y_RELEASE') ||
      evidenceStatus.includes('PYPI_VERIFICADA') ||
      evidenceStatus.includes('FUENTE_EXTERNA_COMPROBADA');

    const sourceUrl = pickFirstUrl(meta, [
      'sitio_oficial',
      'repositorio',
      'fuentes_oficiales',
      'fuente_repositorio',
      'fuente_proyecto_verificada',
      'fuente_proyecto_contrastada',
      'fuente_proyecto',
      'fuente_distribucion',
      'fuente_distribucion_comprobada',
      'fuente_identificada_expediente',
      'fuente_proyecto_del_expediente',
      'fuente_historica',
      'referencia_web_verificada',
    ]) ?? (meta.registro_origen && isHttpUrl(meta.registro_origen.fuente_historica)
      ? meta.registro_origen.fuente_historica.trim()
      : null);

    const referenceVersion = pickFirstString(meta, [
      'version_release_verificada',
      'version_publicacion_verificada',
      'version_actual_confirmada',
      'version_actual',
    ]);

    const historicalVersion =
      pickFirstString(meta, ['version_historica', 'version_dataset']) ??
      (meta.registro_origen && typeof meta.registro_origen.version_historica === 'string'
        ? meta.registro_origen.version_historica
        : null) ??
      (meta.fuente_historia && typeof meta.fuente_historia.version_en_guia === 'string'
        ? meta.fuente_historia.version_en_guia
        : null);

    const editorialNote =
      pickFirstString(meta, [
        'descripcion_editorial',
        'evidencia_nota',
        'evidencia_descripcion',
        'evidencia_descripcion_expediente',
        'detalle_contraste',
        'detalle_verificacion',
      ]) ??
      (meta.fuente_historia && typeof meta.fuente_historia.nota === 'string'
        ? meta.fuente_historia.nota.trim()
        : null);

    const useCaseEvol = pickFirstString(meta, [
      'uso_evol',
      'caso_uso_evol',
      'uso_evol_propuesto',
      'aplicacion_evol',
    ]);

    const evidenceDetail = pickFirstString(meta, [
      'evidencia_tipo_expediente',
      'estado_fuente_expediente',
      'tipo_verificacion',
      'criterio_admision',
      'nivel_evidencia',
    ]);

    const operationalStatus = pickFirstString(meta, [
      'estado_operativo_evol',
      'estado_instalacion',
      'estado_vigencia',
    ]);

    const maintenanceStatus = pickFirstString(meta, [
      'mantenimiento_actual',
      'estado_mantenimiento',
      'mantenimiento',
    ]);

    const cachyosTested =
      meta.probado_en_cachyos !== undefined
        ? meta.probado_en_cachyos
        : meta.estado_prueba_funcional !== undefined
          ? meta.estado_prueba_funcional
          : null;

    const cachyosInstalled =
      meta.instalado_en_cachyos !== undefined
        ? meta.instalado_en_cachyos
        : meta.instalado_en_host !== undefined
          ? meta.instalado_en_host
          : meta.estado_instalacion !== undefined
            ? meta.estado_instalacion
            : null;

    const license = pickFirstString(meta, ['licencia']);

    const verificationDate = pickFirstString(meta, [
      'fecha_verificacion',
      'verificacion_fecha',
      'fecha_referencia_primaria',
      'fecha_verificacion_expediente',
    ]);

    const reviewDate = pickFirstString(meta, [
      'fecha_revision',
      'fecha_revision_documental',
      'fecha_revision_editorial',
      'fecha_exp_verificacion',
    ]);

    const warnings = collectWarnings(meta);
    const conditions = Array.isArray(meta.condiciones_antes_de_uso)
      ? meta.condiciones_antes_de_uso.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const externalReferences = collectExternalReferences(meta, sourceUrl);

    const name = (typeof t.name === 'string' && t.name.trim()) || String(meta.nombre ?? t.id);

    const summary = {
      id: String(t.id),
      name,
      categoryNumber: cat.number,
      categorySlug: cat.slug,
      categoryName: cat.name,
      description,
      evidenceStatus,
      evidenceGroup,
      origin: String(t.origin ?? ''),
      htmlHref: String(t.href),
      revalidated20261122,
      historicalFlag,
    };

    const detail = {
      id: summary.id,
      name: summary.name,
      categoryNumber: cat.number,
      categorySlug: cat.slug,
      categoryName: cat.name,
      description,
      editorialNote,
      useCaseEvol,
      sourceUrl,
      referenceVersion,
      historicalVersion,
      evidenceStatus,
      evidenceGroup,
      evidenceDetail,
      operationalStatus,
      maintenanceStatus,
      cachyosTested,
      cachyosInstalled,
      license,
      verificationDate,
      reviewDate,
      warnings,
      conditions,
      externalReferences,
      htmlHref: String(t.href),
      metadataHref: `${toolDirRel}/metadata.json`,
      readmeHref: fs.existsSync(readmePath) ? `${toolDirRel}/README.md` : null,
      historicalFlag,
      revalidated20261122,
      rawMetadata: meta,
    };

    toolSummaries.push(summary);
    shardToolsBySlug.get(cat.slug).push(detail);

    // Objective selection score for highlighted tools (ONLY strictly verified releases/web revalidation)
    let priority = 0;
    if (evidenceStatus.includes('FUENTE_Y_RELEASE')) priority = 4;
    else if (evidenceStatus.includes('RELEASE_OFICIAL') || evidenceStatus.includes('PYPI')) priority = 3;
    else if (evidenceStatus.includes('REVALIDADA_WEB') || evidenceStatus.includes('CONTRASTADA')) priority = 2;
    else if (evidenceStatus.includes('FUENTE_EXTERNA_COMPROBADA') && description) priority = 1;

    if (priority > 0 && description) {
      featuredCandidates.push({ id: summary.id, priority, name: summary.name });
    }
  }

  featuredCandidates.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, 'es'));
  const featuredIds = featuredCandidates.slice(0, 12).map((item) => item.id);

  // Write per-category shards
  const offlineItems = [];
  for (const cat of categories) {
    const valPath = path.join(ROOT, cat.validationJsonHref);
    const valJson = fs.existsSync(valPath) ? readJson(valPath) : {};
    const shard = {
      category: cat,
      exclusionRule: typeof valJson.regla_inclusion === 'string' ? valJson.regla_inclusion : null,
      limits: Array.isArray(valJson.limites) ? valJson.limites.map(String) : [],
      excludedEntries: extractExcludedEntries(valJson),
      tools: shardToolsBySlug.get(cat.slug) ?? [],
    };
    const shardRel = `data/categories/${cat.slug}.json`;
    fs.writeFileSync(path.join(ROOT, 'public', shardRel), JSON.stringify(shard), 'utf8');
    offlineItems.push({ url: shardRel, kind: 'shard' });
  }

  offlineItems.push({ url: '05-referencias/auditoria-v2.3.2/INFORME-FINAL.json', kind: 'report' });

  for (const cat of categories) {
    offlineItems.push({ url: cat.htmlHref, kind: 'category-html' });
  }
  for (const tool of toolSummaries) {
    offlineItems.push({ url: tool.htmlHref, kind: 'tool-html' });
  }

  const indexPayload = {
    project: String(catalogo.proyecto ?? 'EVOL Tool Atlas'),
    sourceLabel: String(catalogo.fuente ?? 'auditoria-documental-v2.3.2.zip'),
    date: String(catalogo.fecha ?? '2026-11-22'),
    globalWarning: String(
      catalogo.advertencia ??
        'Incluida no implica instalada ni verificada funcionalmente. Evidencia documental varía por ficha.',
    ),
    featuredCriterion:
      'Selección objetiva basada exclusivamente en fichas con publicación oficial verificada o revalidación web pública el 22-11-2026.',
    featuredIds,
    totals: {
      categories: categories.length,
      admitted: toolSummaries.length,
      excluded: Number(informe.exclusiones ?? categories.reduce((acc, c) => acc + c.excluded, 0)),
      totalEntries: Number(informe.entradas_dataset ?? categories.reduce((acc, c) => acc + c.totalEntries, 0)),
    },
    evidenceCounts,
    categories,
    tools: toolSummaries,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'catalog-index.json'), JSON.stringify(indexPayload), 'utf8');

  const offlineManifest = {
    version: `${indexPayload.date}-${toolSummaries.length}`,
    generatedAt: new Date().toISOString(),
    totalFiles: offlineItems.length,
    items: offlineItems,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'offline-manifest.json'), JSON.stringify(offlineManifest), 'utf8');

  console.log(
    `Generated catalog index: ${categories.length} categories, ${toolSummaries.length} tools, ${indexPayload.totals.excluded} excluded, ${offlineItems.length} offline manifest items.`,
  );
}

main();
