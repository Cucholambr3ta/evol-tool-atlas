import { el, formatFactValue, isSafeCatalogPath, isSafeHttpUrl, withBase } from '../lib/dom';
import { renderBreadcrumbs } from '../components/breadcrumbs';
import { isFavorite, toggleFavorite } from '../lib/favorites';
import { createFineLineIcon } from '../lib/icons';
import { buildHashUrl } from '../lib/router';
import { evidenceGroupLabel } from '../components/cards';
import {
  ARTIFACT_STATUS_LABELS,
  ATDS_LEVEL_LABELS,
  EVIDENCE_RESULT_LABELS,
  INTEGRITY_LABELS,
  REASON_LABELS,
  RESOURCE_LABELS,
  SCOPE_LABELS,
  SOURCE_KIND_LABELS,
  evidenceStatusLabel,
  formatIsoDate,
  plural,
  resourceStateLabel,
  useCaseStateLabel,
} from '../lib/labels';
import type { AtdsEvidenceRecord, AtdsSummary, ToolDetail } from '../types/catalog';

export function renderToolDetailView(
  tool: ToolDetail,
  onFavoriteChange: () => void,
): HTMLElement {
  const container = el('div', { className: 'detail-stack' });
  const statusLabel = evidenceStatusLabel(tool.evidenceStatus);
  const catHash = buildHashUrl(`/categoria/${encodeURIComponent(tool.categorySlug)}`);

  let favActive = isFavorite(tool.id);
  const favBtn = el(
    'button',
    {
      className: 'btn',
      attrs: {
        type: 'button',
        'aria-pressed': String(favActive),
      },
      on: {
        click: () => {
          favActive = toggleFavorite({
            id: tool.id,
            name: tool.name,
            categorySlug: tool.categorySlug,
            categoryName: tool.categoryName,
          });
          favBtn.setAttribute('aria-pressed', String(favActive));
          favLabel.textContent = favActive ? 'Guardada en favoritos' : 'Añadir a favoritos';
          onFavoriteChange();
        },
      },
    },
    createFineLineIcon('favorite'),
  );
  const favLabel = el('span', {
    text: favActive ? 'Guardada en favoritos' : 'Añadir a favoritos',
  });
  favBtn.append(favLabel);

  const staticDocLinks: HTMLElement[] = [];
  if (isSafeCatalogPath(tool.htmlHref)) {
    staticDocLinks.push(
      el(
        'a',
        {
          className: 'btn btn-sm',
          attrs: { href: withBase(tool.htmlHref), target: '_blank', rel: 'noopener noreferrer' },
        },
        createFineLineIcon('docOpen'),
        'Ficha HTML original',
      ),
    );
  }
  if (isSafeCatalogPath(tool.metadataHref)) {
    staticDocLinks.push(
      el(
        'a',
        {
          className: 'btn btn-sm',
          attrs: { href: withBase(tool.metadataHref), target: '_blank', rel: 'noopener noreferrer' },
        },
        createFineLineIcon('evidence'),
        'metadata.json',
      ),
    );
  }
  if (tool.readmeHref && isSafeCatalogPath(tool.readmeHref)) {
    staticDocLinks.push(
      el(
        'a',
        {
          className: 'btn btn-sm',
          attrs: { href: withBase(tool.readmeHref), target: '_blank', rel: 'noopener noreferrer' },
        },
        createFineLineIcon('docOpen'),
        'README.md',
      ),
    );
  }

  const header = el(
    'header',
    { className: 'surface-window' },
    renderBreadcrumbs([
      { label: 'Inicio', href: '#/' },
      { label: 'Categorías', href: '#/categorias' },
      { label: tool.categoryName, href: catHash },
      { label: tool.name },
    ]),
    el(
      'div',
      { className: 'detail-header' },
      el(
        'div',
        null,
        el('span', {
          className: 'kpi-label',
          text: `Categoría ${String(tool.categoryNumber).padStart(2, '0')} · ${tool.categoryName} · ${tool.id}`,
        }),
        el('h1', { className: 'detail-title', text: tool.name }),
      ),
      el(
        'div',
        { className: 'pill-row' },
        el(
          'a',
          { className: 'btn', attrs: { href: catHash } },
          createFineLineIcon('prev'),
          `Volver a ${tool.categoryName}`,
        ),
        favBtn,
      ),
    ),
    el(
      'div',
      { className: 'pill-row' },
      el('span', {
        className: tool.evidenceGroup === 'verificada' ? 'pill pill-accent' : 'pill',
        text: evidenceGroupLabel(tool.evidenceGroup),
      }),
      el('span', {
        className: 'pill pill-muted',
        text: statusLabel.label,
        attrs: { title: `Código: ${tool.evidenceStatus}` },
      }),
      tool.sourceCheckedOn
        ? el('span', { className: 'pill', text: `Fuente contrastada el ${formatIsoDate(tool.sourceCheckedOn)} (fecha registrada)` })
        : null,
      el('span', {
        className: tool.atds.validatedLevel === 'NONE' ? 'pill pill-muted' : 'pill pill-accent',
        text: `ATDS validado: ${tool.atds.validatedLevel}`,
      }),
      tool.historicalFlag
        ? el('span', { className: 'pill', text: 'Referencia histórica' })
        : null,
    ),
  );

  // Description & Editorial Context
  const descSection = el(
    'section',
    { className: 'surface-window' },
    el('h2', { text: 'Descripción documental' }),
    el('p', {
      text:
        tool.description ||
        'El registro de origen no incluye una descripción extensa para esta herramienta. Consulta las referencias y metadatos conservados más abajo.',
    }),
    tool.useCaseEvol
      ? el('p', null, el('strong', { text: 'Uso documentado para EVOL: ' }), tool.useCaseEvol)
      : null,
    tool.editorialNote
      ? el('p', { className: 'section-subtitle', text: `Nota de procedencia: ${tool.editorialNote}` })
      : null,
    staticDocLinks.length > 0
      ? el('div', { className: 'pill-row' }, ...staticDocLinks)
      : null,
  );

  // Warnings & Compatibility Notice (always explicit)
  const warningItems: HTMLElement[] = tool.warnings.map((w) => el('li', { text: w }));
  if (tool.conditions.length > 0) {
    for (const cond of tool.conditions) {
      warningItems.push(el('li', { text: `Condición previa: ${cond}` }));
    }
  }
  if (warningItems.length === 0) {
    warningItems.push(
      el('li', {
        text: 'Sin instalación ni validación funcional demostrada en CachyOS. Verificar licencia, dependencias y seguridad en entorno aislado antes de cualquier uso.',
      }),
    );
  }

  const warningBox = el(
    'section',
    { className: 'notice-box', attrs: { 'aria-label': 'Advertencias de mantenimiento y compatibilidad' } },
    createFineLineIcon('warning'),
    el(
      'div',
      null,
      el('h2', { text: 'Advertencias de mantenimiento, compatibilidad y uso seguro' }),
      el('p', {
        text: 'Esta ficha es estrictamente documental. La aplicación no descarga, instala ni ejecuta ninguna herramienta del catálogo.',
      }),
      el('ul', { className: 'warning-list' }, ...warningItems),
    ),
  );

  // Structured Metadata Grid
  const sourceValueNode = isSafeHttpUrl(tool.sourceUrl)
    ? el(
        'a',
        {
          attrs: { href: tool.sourceUrl, target: '_blank', rel: 'noopener noreferrer' },
        },
        tool.sourceUrl,
      )
    : el('span', {
        text: 'Referencia externa no disponible o retirada por política editorial; requiere verificación manual.',
      });

  const factsSection = el(
    'section',
    { className: 'surface-window' },
    el('h2', { text: 'Metadatos documentales y trazabilidad' }),
    el(
      'dl',
      { className: 'facts-grid' },
      el('div', { className: 'fact-item' }, el('dt', { text: 'Nombre' }), el('dd', { text: tool.name })),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Categoría' }),
        el('dd', null, el('a', { attrs: { href: catHash }, text: tool.categoryName })),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Fuente / proyecto principal' }),
        el('dd', null, sourceValueNode),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Versión de referencia confirmada' }),
        el('dd', { text: tool.referenceVersion ?? 'No confirmada individualmente' }),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Versión histórica del registro' }),
        el('dd', { text: tool.historicalVersion ?? 'No consignada' }),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Estado documental' }),
        el(
          'dd',
          null,
          `${statusLabel.label} · ${SOURCE_KIND_LABELS[statusLabel.kind]}`,
          el('br'),
          el('span', { className: 'mono section-subtitle', text: tool.evidenceDetail ? `${tool.evidenceStatus} (${tool.evidenceDetail})` : tool.evidenceStatus }),
        ),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Estado operativo EVOL' }),
        el('dd', { text: tool.operationalStatus ?? 'Solo ficha documental' }),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Mantenimiento' }),
        el('dd', { text: tool.maintenanceStatus ?? 'No determinado' }),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Probado en CachyOS' }),
        el('dd', { text: formatFactValue(tool.cachyosTested) }),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Instalado en host' }),
        el('dd', { text: formatFactValue(tool.cachyosInstalled) }),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Licencia registrada' }),
        el('dd', { text: tool.license ?? 'Por verificar' }),
      ),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Fechas de verificación / revisión' }),
        el('dd', {
          text:
            [tool.verificationDate, tool.reviewDate].filter(Boolean).join(' · ') || 'No registradas',
        }),
      ),
    ),
  );

  // ATDS state, resources, use cases and evidence: official validator data (ATDS-UI-01..04)
  const technicalChildren: Array<HTMLElement | null> = [...renderAtdsState(tool.atds)];

  if (tool.useCases.length > 0) {
    technicalChildren.push(
      el('h2', { text: `Casos de uso propuestos (${tool.useCases.length})` }),
      el(
        'ul',
        { className: 'ref-list' },
        ...tool.useCases.map((useCase) =>
          el(
            'li',
            null,
            el('strong', { text: `${useCase.id} · ${useCase.titulo}` }),
            ' ',
            el('span', {
              className: 'pill pill-muted',
              text: useCaseStateLabel(useCase.estado),
              attrs: useCase.estado ? { title: `Estado registrado: ${useCase.estado}` } : {},
            }),
            useCase.objetivo ? el('p', { text: useCase.objetivo }) : null,
            useCase.riesgo ? el('p', { className: 'section-subtitle', text: `Riesgo: ${useCase.riesgo}` }) : null,
          ),
        ),
      ),
      el('p', {
        className: 'section-subtitle',
        text: 'El Atlas no ejecuta estos casos. Un caso solo cuenta como ejecutado cuando su ficha lo registra con evidencia.',
      }),
    );
  }

  const evidence = tool.atds.evidence;
  if (evidence) {
    const counts = new Map<string, number>();
    for (const r of evidence.records) counts.set(r.resultado, (counts.get(r.resultado) ?? 0) + 1);
    const summary = [...counts.entries()].map(([status, count]) => `${status}: ${count}`).join(' · ');
    const total = evidence.records.length;
    technicalChildren.push(
      el('h2', { text: 'Evidencia registrada' }),
      el('p', {
        className: 'section-subtitle',
        text: `${total} ${plural(total, 'registro', 'registros')} · ${summary || 'sin registros'} · ${evidence.verifiedCount} con integridad verificada de ${evidence.declaredCount} ${plural(evidence.declaredCount, 'declarado', 'declarados')}. El Atlas no ejecuta pruebas.`,
      }),
      evidence.schemaStatus === 'INVALID_SCHEMA' || evidence.schemaStatus === 'INVALID_JSON'
        ? el('p', { className: 'notice-box', text: 'El archivo evidencias.json no cumple el esquema; sus registros no se acreditan.' })
        : null,
      evidence.records.length > 0
        ? el('ul', { className: 'ref-list' }, ...evidence.records.map(renderEvidenceRecord))
        : el('p', { text: 'No hay evidencia registrada para esta herramienta.' }),
      ...(evidence.pendientes.length > 0
        ? [
            el(
              'div',
              null,
              el('strong', { text: 'Evidencia pendiente' }),
              el(
                'ul',
                { className: 'warning-list' },
                ...evidence.pendientes.map((item) => el('li', { text: item })),
              ),
            ),
          ]
        : []),
    );
  }

  const technicalSection =
    technicalChildren.length > 0
      ? el('section', { className: 'surface-window' }, ...technicalChildren)
      : null;

  container.append(header, descSection, warningBox, factsSection);
  if (technicalSection) {
    container.append(technicalSection);
  }

  // External References
  const safeRefs = tool.externalReferences.filter((ref) => isSafeHttpUrl(ref.url));
  const refsSection = el(
    'section',
    { className: 'surface-window' },
    el('h2', { text: 'Referencias externas del registro' }),
    el('p', {
      className: 'section-subtitle',
      text: 'Enlaces tal como los consigna la ficha. El Atlas no comprueba su vigencia por red; la etiqueta de cada uno es la del registro de origen.',
    }),
    safeRefs.length > 0
      ? el(
          'ul',
          { className: 'ref-list' },
          ...safeRefs.map((ref) =>
            el(
              'li',
              null,
              el('strong', { text: `${ref.label}: ` }),
              el(
                'a',
                {
                  attrs: { href: ref.url, target: '_blank', rel: 'noopener noreferrer' },
                },
                ref.url,
              ),
            ),
          ),
        )
      : el('p', {
          className: 'section-subtitle',
          text: 'No hay enlaces externos activos en esta ficha documental.',
        }),
  );

  // Complete Raw Metadata Disclosure
  const rawDetails = el(
    'details',
    { className: 'surface-window' },
    el('summary', { text: 'Inspeccionar registro metadata.json completo de origen' }),
    el('pre', {
      className: 'raw-pre mono',
      text: JSON.stringify(tool.rawMetadata, null, 2),
    }),
  );

  container.append(refsSection, rawDetails);
  return container;
}

function renderAtdsState(atds: AtdsSummary): HTMLElement[] {
  const rows = atds.resources.map((r) =>
    el(
      'tr',
      null,
      el('td', { text: RESOURCE_LABELS[r.kind] ?? r.kind }),
      el(
        'td',
        null,
        r.href && isSafeCatalogPath(r.href)
          ? el('a', { attrs: { href: withBase(r.href), target: '_blank', rel: 'noopener noreferrer' }, text: RESOURCE_LABELS[r.kind] ?? r.file })
          : el('span', { className: 'mono', text: r.file }),
      ),
      el('td', { text: resourceStateLabel(r.present, r.valid, r.check), attrs: { title: `Control: ${r.check}` } }),
    ),
  );
  const nodes: HTMLElement[] = [
    el('h2', { text: 'Estado ATDS v1' }),
    el(
      'dl',
      { className: 'facts-grid' },
      el('div', { className: 'fact-item' }, el('dt', { text: 'Nivel validado' }), el('dd', { text: ATDS_LEVEL_LABELS[atds.validatedLevel] })),
      el('div', { className: 'fact-item' }, el('dt', { text: 'Nivel candidato (recursos presentes)' }), el('dd', { text: ATDS_LEVEL_LABELS[atds.candidateLevel] })),
      el(
        'div',
        { className: 'fact-item' },
        el('dt', { text: 'Hallazgos' }),
        el('dd', {
          text: `${atds.blockingCount} ${plural(atds.blockingCount, 'bloqueante', 'bloqueantes')} · ${atds.warningCount} ${plural(atds.warningCount, 'advertencia', 'advertencias')}`,
        }),
      ),
    ),
    el('p', {
      className: 'section-subtitle',
      text: 'Calculado por el validador ATDS al construir el catálogo. El nivel candidato solo indica qué recursos existen; el validado exige que sus controles se cumplan. Ningún nivel certifica instalación ni funcionamiento.',
    }),
    el(
      'div',
      { className: 'table-wrap' },
      el(
        'table',
        { className: 'evol-table' },
        el('caption', { className: 'section-subtitle', text: 'Recursos documentales: presencia y controles' }),
        el('thead', null, el('tr', null, el('th', { text: 'Recurso' }), el('th', { text: 'Archivo' }), el('th', { text: 'Estado' }))),
        el('tbody', null, ...rows),
      ),
    ),
  ];
  if (atds.findings.length > 0) {
    nodes.push(
      el(
        'details',
        null,
        el('summary', { text: 'Hallazgos principales del validador' }),
        el(
          'ul',
          { className: 'ref-list' },
          ...atds.findings.map((f) =>
            el('li', { className: 'mono', text: `${f.level} · ${f.doc} · ${f.code}${f.blocking ? ' (bloqueante)' : ''}` }),
          ),
        ),
      ),
    );
  }
  return nodes;
}

function renderEvidenceRecord(record: AtdsEvidenceRecord): HTMLElement {
  const verified = record.integrity === 'VERIFICADA';
  const facts: Array<[string, string | null]> = [
    ['Tipo', record.tipo],
    ['Objetivo', record.objetivo],
    ['Alcance', SCOPE_LABELS[record.alcance] ?? record.alcance],
    ['Versión', record.version],
    ['Entorno', record.entorno],
    ['Fecha', record.fecha],
    ['Criterio de aceptación', record.criterio],
    ['Resultado observado', record.observado],
  ];
  return el(
    'li',
    null,
    el('span', {
      className: record.resultado === 'PASS' ? 'pill pill-accent' : 'pill pill-muted',
      text: record.resultado,
      attrs: { title: EVIDENCE_RESULT_LABELS[record.resultado] ?? record.resultado },
    }),
    ' ',
    el('strong', { text: record.id }),
    ' ',
    el('span', {
      className: verified ? 'pill pill-accent' : 'pill pill-muted',
      text: INTEGRITY_LABELS[record.integrity] ?? record.integrity,
      attrs: { 'data-integrity': record.integrity },
    }),
    record.resumen ? el('p', { text: record.resumen }) : null,
    record.reasons.length > 0
      ? el('p', { className: 'section-subtitle', text: `No acreditada: ${record.reasons.map((r) => REASON_LABELS[r] ?? r).join('; ')}.` })
      : null,
    el(
      'dl',
      { className: 'facts-grid' },
      ...facts.map(([k, v]) => el('div', { className: 'fact-item' }, el('dt', { text: k }), el('dd', { text: v ?? 'No registrado' }))),
    ),
    record.limitaciones.length > 0
      ? el('ul', { className: 'warning-list' }, ...record.limitaciones.map((l) => el('li', { text: `Limitación: ${l}` })))
      : null,
    record.artifacts.length > 0
      ? el(
          'ul',
          { className: 'ref-list' },
          ...record.artifacts.map((a) => {
            const label = a.nombre ?? (a.role === 'primary' ? 'Artefacto principal' : 'Artefacto');
            const status = ARTIFACT_STATUS_LABELS[a.status] ?? a.status;
            const qualifier = verified ? status : `${status}; registro no acreditado`;
            return el(
              'li',
              null,
              a.href && isSafeCatalogPath(a.href)
                ? el('a', { attrs: { href: withBase(a.href), target: '_blank', rel: 'noopener noreferrer' }, text: label })
                : el('span', { text: label }),
              ` — ${qualifier}`,
            );
          }),
        )
      : null,
  );
}
