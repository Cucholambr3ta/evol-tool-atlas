/**
 * Pure planner for the next incremental enrichment batch (methodology §1–§2).
 *
 * Progress is tracked per tool ID: a category stays pending until every one of its
 * admitted tools appears in an approved lot policy. Categories keep the global
 * order (effective tools ascending, ties by numero), except that a category already
 * started is continued first; a category larger than the limit is split into
 * consecutive sub-lots E3-NNa, E3-NNb, … E3-NNz, E3-NNaa, E3-NNab, … that never
 * repeat or skip an ID.
 */

const LOT_ID_RE = /^E3-(\d+)([a-z]*)$/i;
const SUFFIX_RE = /^[a-z]*$/;

/**
 * Sub-lot suffix → ordinal, bijective base 26: "" → 0, "a" → 1, "z" → 26,
 * "aa" → 27, "az" → 52, "ba" → 53, … (no artificial limit).
 *
 * @param {string} suffix
 * @returns {number}
 */
export function suffixToIndex(suffix) {
  const s = String(suffix ?? '').toLowerCase();
  if (!SUFFIX_RE.test(s)) throw new Error(`Sufijo de sublote no válido: ${suffix}`);
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 96);
  return n;
}

/**
 * Ordinal → sub-lot suffix (inverse of suffixToIndex): 1 → "a", 26 → "z", 27 → "aa".
 *
 * @param {number} index
 * @returns {string}
 */
export function indexToSuffix(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error(`Ordinal de sublote no válido: ${index}`);
  let n = index;
  let s = '';
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/**
 * Parse a lot id such as "E3-01" or "E3-05b".
 *
 * @param {string} id
 * @returns {{ number: number, letter: string } | null}
 */
export function parseLotId(id) {
  const m = LOT_ID_RE.exec(String(id ?? '').trim());
  if (!m) return null;
  return { number: Number(m[1]), letter: (m[2] ?? '').toLowerCase() };
}

/** Format a lot id: formatLotId(5, 'b') → "E3-05b"; formatLotId(5, 'aa') → "E3-05aa". */
export function formatLotId(number, letter = '') {
  const suffix = String(letter ?? '').toLowerCase();
  if (!SUFFIX_RE.test(suffix)) throw new Error(`Sufijo de sublote no válido: ${letter}`);
  return `E3-${String(number).padStart(2, '0')}${suffix}`;
}

/**
 * @param {{
 *   catalog: { categorias: Array<{ numero: number|string, slug: string, nombre: string, admitidas: number|string }>,
 *              herramientas: Array<{ id: string, cat: number|string, href: string }> },
 *   lots: Array<{ id: string, file?: string, targets: Record<string, string> }>,
 *   maxTools?: number,
 * }} input
 */
export function planNextBatch({ catalog, lots, maxTools = 6 }) {
  if (!Number.isInteger(maxTools) || maxTools < 1) throw new Error('maxTools debe ser un entero positivo');

  const toolsByCat = new Map();
  for (const t of catalog.herramientas) {
    const k = Number(t.cat);
    if (!toolsByCat.has(k)) toolsByCat.set(k, []);
    toolsByCat.get(k).push(t);
  }
  const toolById = new Map(catalog.herramientas.map((t) => [String(t.id), t]));

  // Approved lots: every target must be a catalogue tool, and no ID may be claimed twice.
  const errors = [];
  const doneBy = new Map(); // tool id → lot id
  const parsedLots = lots.map((l) => ({ ...l, parsed: parseLotId(l.id) }));
  for (const l of parsedLots) {
    if (!l.parsed) errors.push(`Identificador de lote no reconocido: ${l.id}`);
    for (const id of Object.keys(l.targets ?? {})) {
      if (!toolById.has(id)) errors.push(`La política ${l.file ?? l.id} cita una herramienta inexistente: ${id}`);
      else if (doneBy.has(id)) errors.push(`${id} figura en dos lotes: ${doneBy.get(id)} y ${l.id}`);
      else doneBy.set(id, l.id);
    }
  }

  const discrepancies = [];
  const categories = catalog.categorias.map((c) => {
    const numero = Number(c.numero);
    const tools = toolsByCat.get(numero) ?? [];
    if (tools.length !== Number(c.admitidas)) discrepancies.push(`${c.slug}: admitidas ${c.admitidas}, efectivas ${tools.length}`);
    const pendingTools = tools.filter((t) => !doneBy.has(String(t.id)));
    return {
      numero,
      slug: String(c.slug),
      nombre: String(c.nombre),
      admitidas: Number(c.admitidas),
      efectivas: tools.length,
      completadas: tools.length - pendingTools.length,
      pendientes: pendingTools.length,
      pendingTools,
    };
  });

  const ordered = [...categories].sort((a, b) => a.efectivas - b.efectivas || a.numero - b.numero);
  // A category whose sub-lots already started is continued first, so its sub-lots
  // stay consecutive (methodology §2); the rest keep the global order.
  const started = ordered.filter((c) => c.pendientes > 0 && c.completadas > 0);
  const pending = [...started, ...ordered.filter((c) => c.pendientes > 0 && c.completadas === 0)];
  const completed = ordered.filter((c) => c.efectivas > 0 && c.pendientes === 0);

  const maxNumber = Math.max(0, ...parsedLots.filter((l) => l.parsed).map((l) => l.parsed.number));
  const toEntry = (t) => ({ id: String(t.id), ruta: String(t.href).replace(/\/[^/]*$/, '') });

  let proposal = null;
  const first = pending[0];
  if (first && (first.pendientes > maxTools || first.completadas > 0)) {
    // Sub-lot of a large (or already started) category. Continue the lot number of
    // the category's previous sub-lots with the next letter; otherwise open a new
    // number with letter "a".
    const previous = parsedLots
      .filter((l) => l.parsed && Object.keys(l.targets ?? {}).some((id) => Number(toolById.get(id)?.cat) === first.numero))
      .map((l) => l.parsed);
    let number;
    let letter;
    if (previous.length > 0) {
      number = previous[0].number;
      // Next suffix by ordinal (a … z, aa, ab, …), never by comparing characters.
      // A plain lot number without suffix counts as its first sub-lot ("a").
      const ordinals = previous.filter((p) => p.number === number).map((p) => suffixToIndex(p.letter) || 1);
      letter = indexToSuffix(Math.max(...ordinals) + 1);
    } else {
      number = maxNumber + 1;
      letter = 'a';
    }
    const take = first.pendingTools.slice(0, maxTools);
    proposal = {
      lote: formatLotId(number, letter),
      tipo: 'sublote',
      categoria: { numero: first.numero, slug: first.slug, nombre: first.nombre, herramientas: first.efectivas },
      herramientas: take.map(toEntry),
      total: take.length,
      restantes_en_categoria: first.pendientes - take.length,
      completa_la_categoria: take.length === first.pendientes,
    };
  } else if (first) {
    const batch = [];
    let total = 0;
    for (const c of pending) {
      // Only untouched categories that fit entirely join a regular lot.
      if (c.completadas > 0 || c.pendientes > maxTools || total + c.pendientes > maxTools) break;
      batch.push(c);
      total += c.pendientes;
    }
    proposal = {
      lote: formatLotId(maxNumber + 1),
      tipo: 'lote',
      categorias: batch.map((c) => ({ numero: c.numero, slug: c.slug, nombre: c.nombre, herramientas: c.efectivas })),
      herramientas: batch.flatMap((c) => c.pendingTools.map(toEntry)),
      total,
    };
  }

  return {
    errors,
    discrepancies,
    lotes_aprobados: parsedLots.map((l) => ({ lote: l.id, politica: l.file ?? null, herramientas: Object.keys(l.targets ?? {}) })),
    herramientas_completadas: doneBy.size,
    herramientas_pendientes: catalog.herramientas.length - doneBy.size,
    categorias_completadas: completed.map((c) => c.slug),
    categorias_pendientes_en_orden: pending.map(({ numero, slug, nombre, efectivas, completadas, pendientes }) => ({ numero, slug, nombre, efectivas, completadas, pendientes })),
    propuesta: proposal,
  };
}
