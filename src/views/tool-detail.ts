import { el, formatFactValue, isSafeCatalogPath, isSafeHttpUrl, withBase } from '../lib/dom';
import { isFavorite, toggleFavorite } from '../lib/favorites';
import { createFineLineIcon } from '../lib/icons';
import { buildHashUrl } from '../lib/router';
import { evidenceGroupLabel } from '../components/cards';
import type { ToolDetail } from '../types/catalog';

export function renderToolDetailView(
  tool: ToolDetail,
  onFavoriteChange: () => void,
): HTMLElement {
  const container = el('div', { className: 'detail-stack' });
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
    el(
      'div',
      { className: 'breadcrumbs' },
      el('a', { attrs: { href: '#/' }, text: 'Inicio' }),
      '/',
      el('a', { attrs: { href: '#/categorias' }, text: 'Categorías' }),
      '/',
      el('a', { attrs: { href: catHash }, text: tool.categoryName }),
      '/',
      el('span', { text: tool.name }),
    ),
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
      el('span', { className: 'pill pill-muted', text: tool.evidenceStatus }),
      tool.revalidated20261122
        ? el('span', { className: 'pill pill-accent', text: 'Revalidada 22-11-2026' })
        : null,
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
        el('dd', {
          text: tool.evidenceDetail
            ? `${tool.evidenceStatus} (${tool.evidenceDetail})`
            : tool.evidenceStatus,
        }),
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

  // Technical resources, use cases and evidence (only when present in the static sheet)
  const technicalChildren: HTMLElement[] = [];
  const resourceLinks = tool.technicalResources
    .filter((resource) => isSafeCatalogPath(resource.href))
    .map((resource) =>
      el(
        'a',
        {
          className: 'btn btn-sm',
          attrs: {
            href: withBase(resource.href),
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        },
        resource.label,
      ),
    );
  if (resourceLinks.length > 0) {
    technicalChildren.push(
      el('h2', { text: 'Recursos técnicos' }),
      el('div', { className: 'pill-row' }, ...resourceLinks),
    );
  }

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
            useCase.objetivo ? ` — ${useCase.objetivo}` : '',
            useCase.riesgo ? ` (${useCase.riesgo})` : '',
          ),
        ),
      ),
      el('p', {
        className: 'section-subtitle',
        text: 'Casos documentados, no ejecutados por el Atlas. Requieren autorización, entorno aislado y registro de evidencia.',
      }),
    );
  }

  if (tool.evidence) {
    const summary = Object.entries(tool.evidence.counts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(' · ');
    technicalChildren.push(
      el('h2', { text: 'Evidencia registrada' }),
      el('p', {
        className: 'section-subtitle',
        text: `${tool.evidence.total} registro(s) · ${summary || 'sin registros'} · El Atlas no ejecuta pruebas.`,
      }),
      tool.evidence.records.length > 0
        ? el(
            'ul',
            { className: 'ref-list' },
            ...tool.evidence.records.map((record) =>
              el(
                'li',
                null,
                el('span', {
                  className: record.resultado === 'PASS' ? 'pill pill-accent' : 'pill pill-muted',
                  text: record.resultado,
                }),
                ' ',
                el('strong', { text: `${record.id} · ${record.tipo}` }),
                record.fecha ? ` · ${record.fecha}` : '',
                record.version ? ` · v${record.version}` : '',
                el('p', { text: record.resumen }),
                record.sha256
                  ? el('p', {
                      className: 'section-subtitle mono',
                      text: `SHA-256: ${record.sha256}`,
                    })
                  : null,
              ),
            ),
          )
        : el('p', { text: 'No hay evidencia registrada para esta herramienta.' }),
      ...(tool.evidence.pendientes.length > 0
        ? [
            el(
              'div',
              null,
              el('strong', { text: 'Evidencia pendiente' }),
              el(
                'ul',
                { className: 'warning-list' },
                ...tool.evidence.pendientes.map((item) => el('li', { text: item })),
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
    el('h2', { text: 'Referencias externas verificadas en el registro' }),
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
