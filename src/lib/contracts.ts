/**
 * Runtime contracts for the JSON the app fetches (SEC-DATA-01).
 *
 * `as CatalogIndex` is only a compile-time assertion. These validators run once at
 * the fetch boundary, so views can trust the shapes they receive. A violation is a
 * recoverable DataContractError (the view shows an error with retry), never a
 * misleading detail page or an endless loading state.
 */
import type { CatalogIndex, CategoryShard, EvidenceGroup } from '../types/catalog';
import { isSafeCatalogPath } from './dom';

export class DataContractError extends Error {
  constructor(
    readonly resource: string,
    readonly detail: string,
  ) {
    super(`Los datos de ${resource} no cumplen el contrato esperado (${detail}). Reintenta o regenera el catálogo.`);
    this.name = 'DataContractError';
  }
}

const ATDS_LEVELS: ReadonlySet<string> = new Set(['NONE', 'L1', 'L2', 'L3', 'L4']);
const INTEGRITY_STATES: ReadonlySet<string> = new Set(['VERIFICADA', 'NO_ACREDITADA', 'NO_APLICA']);
const EVIDENCE_GROUPS: ReadonlySet<EvidenceGroup> = new Set(['verificada', 'expediente', 'historica']);

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Checker {
  constructor(private readonly resource: string) {}

  fail(detail: string): never {
    throw new DataContractError(this.resource, detail);
  }

  obj(v: unknown, at: string): Obj {
    if (!isObj(v)) this.fail(`${at} debe ser un objeto`);
    return v;
  }

  arr(v: unknown, at: string): unknown[] {
    if (!Array.isArray(v)) this.fail(`${at} debe ser una lista`);
    return v;
  }

  str(v: unknown, at: string, { nonEmpty = false } = {}): string {
    if (typeof v !== 'string') this.fail(`${at} debe ser texto`);
    if (nonEmpty && v.trim() === '') this.fail(`${at} está vacío`);
    return v;
  }

  optStr(v: unknown, at: string): string | null {
    if (v === null || v === undefined) return null;
    return this.str(v, at);
  }

  num(v: unknown, at: string): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) this.fail(`${at} debe ser un número`);
    return v;
  }

  bool(v: unknown, at: string): boolean {
    if (typeof v !== 'boolean') this.fail(`${at} debe ser booleano`);
    return v;
  }

  catalogPath(v: unknown, at: string): string {
    const s = this.str(v, at, { nonEmpty: true });
    if (!isSafeCatalogPath(s)) this.fail(`${at} no es una ruta del catálogo permitida`);
    return s;
  }

  isoDate(v: unknown, at: string): string {
    const s = this.str(v, at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) this.fail(`${at} no es una fecha AAAA-MM-DD`);
    return s;
  }

  strList(v: unknown, at: string): string[] {
    return this.arr(v, at).map((item, i) => this.str(item, `${at}[${i}]`));
  }
}

/**
 * Validate the global index. Checks keys, types, unique ids/slugs, category
 * membership of every tool, safe paths and coherent totals.
 */
export function validateCatalogIndex(raw: unknown): CatalogIndex {
  const c = new Checker('el índice del catálogo');
  const root = c.obj(raw, 'raíz');
  c.str(root.project, 'project');
  c.str(root.date, 'date');
  c.str(root.globalWarning, 'globalWarning');
  const totals = c.obj(root.totals, 'totals');
  for (const k of ['categories', 'admitted', 'excluded', 'totalEntries']) c.num(totals[k], `totals.${k}`);
  c.obj(root.evidenceCounts, 'evidenceCounts');

  const slugs = new Set<string>();
  const categories = c.arr(root.categories, 'categories');
  categories.forEach((item, i) => {
    const cat = c.obj(item, `categories[${i}]`);
    const slug = c.str(cat.slug, `categories[${i}].slug`, { nonEmpty: true });
    if (slugs.has(slug)) c.fail(`categoría duplicada "${slug}"`);
    slugs.add(slug);
    c.num(cat.number, `categories[${i}].number`);
    c.str(cat.name, `categories[${i}].name`, { nonEmpty: true });
    c.num(cat.admitted, `categories[${i}].admitted`);
    c.num(cat.excluded, `categories[${i}].excluded`);
    c.catalogPath(cat.htmlHref, `categories[${i}].htmlHref`);
  });
  if (categories.length !== totals.categories) c.fail('totals.categories no coincide con la lista de categorías');

  const ids = new Set<string>();
  const perCategory = new Map<string, number>();
  const tools = c.arr(root.tools, 'tools');
  tools.forEach((item, i) => {
    const t = c.obj(item, `tools[${i}]`);
    const id = c.str(t.id, `tools[${i}].id`, { nonEmpty: true });
    if (ids.has(id)) c.fail(`herramienta duplicada "${id}"`);
    ids.add(id);
    c.str(t.name, `tools[${i}].name`, { nonEmpty: true });
    const slug = c.str(t.categorySlug, `tools[${i}].categorySlug`);
    if (!slugs.has(slug)) c.fail(`la herramienta "${id}" pertenece a una categoría inexistente "${slug}"`);
    perCategory.set(slug, (perCategory.get(slug) ?? 0) + 1);
    c.str(t.description, `tools[${i}].description`);
    c.str(t.evidenceStatus, `tools[${i}].evidenceStatus`);
    if (!EVIDENCE_GROUPS.has(t.evidenceGroup as EvidenceGroup)) c.fail(`tools[${i}].evidenceGroup desconocido`);
    c.catalogPath(t.htmlHref, `tools[${i}].htmlHref`);
    c.bool(t.historicalFlag, `tools[${i}].historicalFlag`);
    if (t.sourceCheckedOn !== null) c.isoDate(t.sourceCheckedOn, `tools[${i}].sourceCheckedOn`);
    if (!ATDS_LEVELS.has(t.atdsLevel as string)) c.fail(`tools[${i}].atdsLevel desconocido`);
  });
  if (tools.length !== totals.admitted) c.fail('totals.admitted no coincide con la lista de herramientas');
  categories.forEach((item) => {
    const cat = item as Obj;
    if ((perCategory.get(cat.slug as string) ?? 0) !== cat.admitted) {
      c.fail(`la categoría "${String(cat.slug)}" declara ${String(cat.admitted)} herramientas y el índice contiene ${perCategory.get(cat.slug as string) ?? 0}`);
    }
  });
  const featured = c.strList(root.featuredIds, 'featuredIds');
  for (const id of featured) if (!ids.has(id)) c.fail(`featuredIds contiene "${id}", que no está en el índice`);

  return raw as CatalogIndex;
}

/**
 * ATDS summary of a sheet (ATDS-UI-01). Artifact links must stay inside the sheet's
 * directory, and VERIFICADA is only accepted for PASS records.
 */
function validateAtdsSummary(c: Checker, raw: unknown, at: string, htmlHref: string): void {
  const a = c.obj(raw, at);
  if (!ATDS_LEVELS.has(a.candidateLevel as string)) c.fail(`${at}.candidateLevel desconocido`);
  if (!ATDS_LEVELS.has(a.validatedLevel as string)) c.fail(`${at}.validatedLevel desconocido`);
  c.str(a.status, `${at}.status`);
  c.num(a.blockingCount, `${at}.blockingCount`);
  c.arr(a.findings, `${at}.findings`);
  c.str(a.contentRevision, `${at}.contentRevision`, { nonEmpty: true });
  const toolDir = htmlHref.slice(0, htmlHref.lastIndexOf('/') + 1);
  c.arr(a.resources, `${at}.resources`).forEach((item, j) => {
    const r = c.obj(item, `${at}.resources[${j}]`);
    c.str(r.kind, `${at}.resources[${j}].kind`);
    c.bool(r.present, `${at}.resources[${j}].present`);
    c.bool(r.valid, `${at}.resources[${j}].valid`);
    if (r.href !== null) c.catalogPath(r.href, `${at}.resources[${j}].href`);
  });
  if (a.evidence === null) return;
  const ev = c.obj(a.evidence, `${at}.evidence`);
  c.arr(ev.records, `${at}.evidence.records`).forEach((item, j) => {
    const r = c.obj(item, `${at}.evidence.records[${j}]`);
    c.str(r.id, `${at}.evidence.records[${j}].id`);
    const integrity = c.str(r.integrity, `${at}.evidence.records[${j}].integrity`);
    if (!INTEGRITY_STATES.has(integrity)) c.fail(`${at}.evidence.records[${j}].integrity desconocido`);
    if (integrity === 'VERIFICADA' && r.resultado !== 'PASS') c.fail(`${at}.evidence.records[${j}] acredita un resultado que no es PASS`);
    c.strList(r.limitaciones, `${at}.evidence.records[${j}].limitaciones`);
    c.arr(r.artifacts, `${at}.evidence.records[${j}].artifacts`).forEach((art, k) => {
      const ar = c.obj(art, `${at}.evidence.records[${j}].artifacts[${k}]`);
      if (ar.href !== null) {
        const href = c.catalogPath(ar.href, `${at}.evidence.records[${j}].artifacts[${k}].href`);
        if (!href.startsWith(toolDir)) c.fail(`${at}.evidence.records[${j}].artifacts[${k}] apunta fuera de la ficha`);
      }
    });
  });
}

/**
 * Validate one category shard. With `index`, every tool must also be listed in
 * the index under the same category.
 */
export function validateCategoryShard(raw: unknown, expectedSlug: string, index?: CatalogIndex | null): CategoryShard {
  const c = new Checker(`la categoría "${expectedSlug}"`);
  const root = c.obj(raw, 'raíz');
  const cat = c.obj(root.category, 'category');
  const slug = c.str(cat.slug, 'category.slug');
  if (slug !== expectedSlug) c.fail(`el fragmento corresponde a "${slug}"`);
  c.str(cat.name, 'category.name', { nonEmpty: true });
  c.strList(root.limits, 'limits');
  c.arr(root.excludedEntries, 'excludedEntries');

  const indexed = index ? new Map(index.tools.map((t) => [t.id, t.categorySlug])) : null;
  const ids = new Set<string>();
  const tools = c.arr(root.tools, 'tools');
  tools.forEach((item, i) => {
    const t = c.obj(item, `tools[${i}]`);
    const id = c.str(t.id, `tools[${i}].id`, { nonEmpty: true });
    if (ids.has(id)) c.fail(`herramienta duplicada "${id}"`);
    ids.add(id);
    if (c.str(t.categorySlug, `tools[${i}].categorySlug`) !== expectedSlug) c.fail(`"${id}" declara otra categoría`);
    if (indexed && indexed.get(id) !== expectedSlug) c.fail(`"${id}" no figura en el índice bajo esta categoría`);
    c.str(t.name, `tools[${i}].name`, { nonEmpty: true });
    c.catalogPath(t.htmlHref, `tools[${i}].htmlHref`);
    c.catalogPath(t.metadataHref, `tools[${i}].metadataHref`);
    if (t.readmeHref !== null) c.catalogPath(t.readmeHref, `tools[${i}].readmeHref`);
    c.optStr(t.sourceUrl, `tools[${i}].sourceUrl`);
    c.strList(t.warnings, `tools[${i}].warnings`);
    c.strList(t.conditions, `tools[${i}].conditions`);
    c.arr(t.externalReferences, `tools[${i}].externalReferences`).forEach((ref, j) => {
      const r = c.obj(ref, `tools[${i}].externalReferences[${j}]`);
      c.str(r.label, `tools[${i}].externalReferences[${j}].label`);
      c.str(r.url, `tools[${i}].externalReferences[${j}].url`);
    });
    c.arr(t.technicalResources, `tools[${i}].technicalResources`).forEach((res, j) => {
      const r = c.obj(res, `tools[${i}].technicalResources[${j}]`);
      c.catalogPath(r.href, `tools[${i}].technicalResources[${j}].href`);
    });
    c.arr(t.useCases, `tools[${i}].useCases`);
    if (t.sourceCheckedOn !== null) c.isoDate(t.sourceCheckedOn, `tools[${i}].sourceCheckedOn`);
    validateAtdsSummary(c, t.atds, `tools[${i}].atds`, String(t.htmlHref));
    if (!isObj(t.rawMetadata)) c.fail(`tools[${i}].rawMetadata debe ser un objeto`);
  });
  if (isObj(cat) && typeof cat.admitted === 'number' && cat.admitted !== tools.length) {
    c.fail(`declara ${cat.admitted} herramientas y contiene ${tools.length}`);
  }
  return raw as CategoryShard;
}
