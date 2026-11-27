/**
 * Estabilización post-E3-01 — controles de navegador sobre el build de producción
 * servido por `vite preview` (el mismo servidor que usa el servicio systemd).
 */
import { expect, test, type Page } from '@playwright/test';
import { resolveBasePath } from '../../scripts/lib/base-path.mjs';

const BASE = resolveBasePath();

/** Collect CSP violations and uncaught errors for the page lifetime. */
async function watch(page: Page) {
  const violations: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  return { violations, pageErrors };
}

test.describe('Seguridad, rutas y CSP en el hosting real', () => {
  test('SEC-WEB-01: cabeceras CSP en la SPA y en las páginas estáticas, sin violaciones', async ({ page, request }) => {
    const spa = await request.get(BASE);
    expect(spa.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(spa.headers()['content-security-policy']).toContain("script-src 'self'");
    expect(spa.headers()['x-content-type-options']).toBe('nosniff');
    const staticPage = `${BASE}02-catalogo/seguridad/catalogo/threat-dragon/index.html`;
    const doc = await request.get(staticPage);
    expect(doc.headers()['content-security-policy']).toContain("script-src 'none'");
    expect(doc.headers()['content-security-policy']).toContain("frame-ancestors 'none'");

    const w = await watch(page);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.goto(`${BASE}#/herramienta/threat-dragon`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'OWASP Threat Dragon', level: 1 })).toBeVisible();
    await page.goto(staticPage, { waitUntil: 'networkidle' });
    // Inline <style> of the historical page still applies under the document policy.
    const styled = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(styled.length).toBeGreaterThan(0);
    expect(w.violations).toEqual([]);
    expect(w.pageErrors).toEqual([]);
  });

  test('ROUTER-01: hashes malformados muestran un estado recuperable; Unicode y Atrás funcionan', async ({ page }) => {
    const w = await watch(page);
    await page.goto(`${BASE}#/herramienta/semgrep`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Semgrep', level: 1 })).toBeVisible();
    for (const bad of ['%', '%ZZ', '%E0%A4%A']) {
      await page.goto(`${BASE}#/herramienta/${bad}`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Ruta no válida', level: 1 })).toBeVisible();
    }
    await page.goto(`${BASE}#/herramienta/%C3%B1and%C3%BA`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Ficha no encontrada', level: 1 })).toBeVisible();
    await expect(page.getByText(/"ñandú"/)).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Ruta no válida', level: 1 })).toBeVisible();
    await page.goto(`${BASE}#/categoria/no-existe`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Categoría no encontrada', level: 1 })).toBeVisible();
    await page.goto(`${BASE}#/no-existe`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Ruta no encontrada', level: 1 })).toBeVisible();
    expect(w.pageErrors).toEqual([]);
  });
});

test.describe('Contrato ATDS en la ficha', () => {
  test('ATDS-UI: niveles oficiales, recursos opcionales y evidencia no acreditada', async ({ page }) => {
    await page.goto(`${BASE}#/herramienta/threat-dragon`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Estado ATDS v1' })).toBeVisible();
    await expect(page.getByText('ATDS validado: L3')).toBeVisible();
    await expect(page.getByRole('row', { name: /Skill reutilizable.*Ausente · opcional/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Guía técnica.*controles superados/ })).toBeVisible();
    await expect(page.getByText('Propuesto · no ejecutado').first()).toBeVisible();

    await page.goto(`${BASE}#/herramienta/semgrep`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Declarada · no acreditada')).toBeVisible();
    await expect(page.locator('[data-integrity="VERIFICADA"]')).toHaveCount(0);
    await expect(page.getByText(/histórico sin ruta · no verificable/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Referencias externas del registro' })).toBeVisible();
    await expect(page.getByText(/verificadas en el registro/)).toHaveCount(0);
  });
});

test.describe('Accesibilidad y UX', () => {
  test('A11Y-01: drawer móvil con foco inicial, contención, Escape y restauración', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const menu = page.getByRole('button', { name: /Abrir menú de navegación/i });
    await menu.click();
    await expect(page.getByRole('button', { name: 'Cerrar menú lateral' })).toBeFocused();
    expect(await page.locator('#main-content').evaluate((n) => (n as HTMLElement).inert)).toBe(true);
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => document.getElementById('atlas-sidebar')?.contains(document.activeElement) ?? false);
      expect(inside, `Tab ${i} escapó del drawer`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.getElementById('atlas-sidebar')?.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#atlas-sidebar')).not.toHaveClass(/is-open/);
    await expect(menu).toBeFocused();
    expect(await page.locator('#main-content').evaluate((n) => (n as HTMLElement).inert)).toBe(false);
  });

  test('A11Y-02/04, UX-01: progreso con nombre, migas con página actual, foco y scroll al navegar', async ({ page }) => {
    await page.goto(`${BASE}#/offline`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('progressbar', { name: 'Progreso de la copia offline' })).toBeVisible();
    const crumbs = page.getByRole('navigation', { name: 'Ruta de navegación' });
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Centro offline');

    await page.goto(`${BASE}#/categorias`, { waitUntil: 'networkidle' });
    await page.goto(`${BASE}#/categoria/webapp`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);
    await page.locator('[data-tool-id] a', { hasText: 'Ver ficha' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('UX-02: tamaño de objetivos, reflow a 320 px y 200 % de zoom, tema oscuro y movimiento reducido', async ({ page }) => {
    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 800 });
      for (const hash of ['#/', '#/categorias', '#/herramienta/semgrep', '#/offline', '#/favoritos']) {
        await page.goto(`${BASE}${hash}`, { waitUntil: 'networkidle' });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `desbordamiento horizontal en ${hash} a ${width}px`).toBe(false);
      }
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.topbar button, .topbar a, .sidebar-nav-link, .btn'))
        .filter((n) => n.offsetParent !== null)
        .map((n) => ({ label: n.getAttribute('aria-label') ?? n.textContent?.trim() ?? '', ...n.getBoundingClientRect().toJSON() }))
        .filter((r) => r.width < 24 || r.height < 24)
        .map((r) => `${r.label} ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(small, 'objetivos menores de 24×24 px (WCAG 2.5.8)').toEqual([]);

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const ratio = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r = 0, g = 0, b = 0]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const body = getComputedStyle(document.body);
      const a = lum(parse(body.color));
      const b = lum(parse(body.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio, 'contraste texto/fondo en tema oscuro').toBeGreaterThanOrEqual(4.5);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const duration = await page.evaluate(() => getComputedStyle(document.querySelector('.btn') as Element).transitionDuration);
    expect(duration.split(',').every((d) => parseFloat(d) <= 0.01)).toBe(true);

    // Keyboard focus is visible.
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('FAV-01: con localStorage bloqueado se avisa de que los favoritos son solo de sesión', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('bloqueado', 'SecurityError'); } });
    });
    const w = await watch(page);
    await page.goto(`${BASE}#/herramienta/semgrep`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Añadir a favoritos/i }).click();
    await expect(page.locator('[data-favorites-persistence="session-only"]')).toBeVisible();
    await expect(page.getByText(/solo durante esta sesión/).first()).toBeVisible();
    await page.goto(`${BASE}#/favoritos`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-tool-id="semgrep"]')).toBeVisible();
    expect(w.pageErrors).toEqual([]);
  });
});

test.describe('Offline con perfil limpio (OFF-01..05)', () => {
  test('descarga parcial, reintento, verificación, corrupción reparada y borrado con confirmación', async ({ page, context }) => {
    test.setTimeout(600_000);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload({ waitUntil: 'networkidle' });
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await page.goto(`${BASE}#/herramienta/sagan`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Añadir a favoritos/i }).click();

    // One shard fails at the network: the download must not be declared complete.
    const failing = `**${BASE}data/categories/criptografia.json`;
    await context.route(failing, (route) => route.fulfill({ status: 500, body: 'fallo simulado' }));

    await page.goto(`${BASE}#/offline`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-offline-availability]')).toHaveAttribute('data-offline-availability', 'none');
    await page.getByRole('button', { name: 'Guardar catálogo completo para uso sin conexión' }).click();
    await expect(page.getByText(/Terminada con incidencias/)).toBeVisible({ timeout: 480_000 });
    await expect(page.getByRole('alert').getByText(/No se pudieron guardar 1 recurso/)).toBeVisible();
    await expect(page.locator('[data-offline-availability]')).toHaveAttribute('data-offline-availability', 'partial');

    await context.unroute(failing);
    await page.getByRole('button', { name: 'Reintentar fallidos' }).click();
    await expect(page.getByText(/Todas las categorías y las 2\.137 fichas están disponibles sin conexión/)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-offline-availability]')).toHaveAttribute('data-offline-availability', 'complete');

    // Controlled corruption of one stored file.
    await page.evaluate(async () => {
      const names = await caches.keys();
      const name = names.find((n) => n.startsWith('evol-atlas-offline-') && n !== 'evol-atlas-offline-meta');
      if (!name) throw new Error('sin caché offline');
      const cache = await caches.open(name);
      const key = (await cache.keys()).find((r) => r.url.endsWith('/metadata.json'));
      if (!key) throw new Error('sin metadata en caché');
      await cache.put(key, new Response('{"dañado":true}'));
    });
    await page.getByRole('button', { name: 'Verificar integridad' }).click();
    await expect(page.getByRole('alert').getByText(/Se eliminó 1 archivo dañado/)).toBeVisible({ timeout: 300_000 });
    await expect(page.locator('[data-offline-availability]')).not.toHaveAttribute('data-offline-availability', 'complete');
    await page.getByRole('button', { name: 'Guardar catálogo completo para uso sin conexión' }).click();
    await expect(page.getByText(/Todas las categorías y las 2\.137 fichas están disponibles sin conexión/)).toBeVisible({ timeout: 120_000 });

    // Real offline navigation after repair.
    await context.setOffline(true);
    await page.goto(`${BASE}#/categoria/criptografia`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/no disponible/i);
    await context.setOffline(false);

    // OFF-05: cancel keeps the copy, confirm deletes it; favorites survive.
    await page.goto(`${BASE}#/offline`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Borrar copia offline' }).click();
    const dialog = page.getByRole('dialog', { name: '¿Borrar la copia offline?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-offline-availability]')).toHaveAttribute('data-offline-availability', 'complete');
    await page.getByRole('button', { name: 'Borrar copia offline' }).click();
    await dialog.getByRole('button', { name: 'Borrar copia offline' }).click();
    await expect(page.getByText(/Copia offline del catálogo eliminada/)).toBeVisible();
    await expect(page.locator('[data-offline-availability]')).toHaveAttribute('data-offline-availability', 'none');
    await expect(page.locator('.topbar .badge-count')).toHaveText('1');
  });
});
