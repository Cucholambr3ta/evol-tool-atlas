import { expect, test } from '@playwright/test';
import { resolveBasePath } from '../../scripts/lib/base-path.mjs';

const BASE_PATH = resolveBasePath();
const FORBIDDEN_RE = new RegExp(['bl', 'ack', '\\s*', 'ar', 'ch'].join(''), 'i');

test.describe('Evol Tool Atlas PWA', () => {
  test('renders official Evol branding, accessible UI, and zero forbidden mentions', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const badResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && new URL(res.url()).origin === new URL(page.url()).origin) {
        badResponses.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(BASE_PATH, { waitUntil: 'networkidle' });

    // Wait for dashboard KPIs
    await expect(page.getByRole('heading', { name: 'Evol Tool Atlas', level: 1 })).toBeVisible();
    await expect(page.locator('.kpi-value').nth(0)).toHaveText('49');
    await expect(page.locator('.kpi-value').nth(1)).toHaveText(/2[.,]137/);
    await expect(page.locator('.kpi-value').nth(2)).toHaveText('741');
    await expect(page.locator('.kpi-value').nth(3)).toHaveText(/2[.,]878/);

    // Check zero forbidden mentions on dashboard & index JSON
    const bodyText = await page.locator('body').innerText();
    expect(FORBIDDEN_RE.test(bodyText)).toBe(false);

    const indexResp = await page.request.get(`${BASE_PATH}data/catalog-index.json`);
    expect(indexResp.ok()).toBe(true);
    const indexRaw = await indexResp.text();
    expect(FORBIDDEN_RE.test(indexRaw)).toBe(false);

    // Check official fonts & token colors (Light mode forced cleanly)
    const themeBtn = page.getByRole('button', { name: /Cambiar tema visual/i });
    await themeBtn.click(); // system -> light
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const lightStyles = await page.evaluate(() => {
      const bodyCs = getComputedStyle(document.body);
      const h1 = document.querySelector('h1');
      const h1Cs = h1 ? getComputedStyle(h1) : null;
      const card = document.querySelector('.card');
      const cardCs = card ? getComputedStyle(card) : null;
      return {
        bodyBg: bodyCs.backgroundColor,
        bodyFont: bodyCs.fontFamily,
        bodySize: bodyCs.fontSize,
        h1Font: h1Cs?.fontFamily ?? '',
        cardBg: cardCs?.backgroundColor ?? '',
      };
    });

    expect(lightStyles.bodyBg).toBe('rgb(246, 243, 237)');
    expect(lightStyles.cardBg).toBe('rgb(255, 253, 247)');
    expect(lightStyles.bodySize).toBe('14px');
    expect(lightStyles.bodyFont).toContain('Atkinson Hyperlegible');
    expect(lightStyles.h1Font).toContain('Manrope');

    // Toggle to Dark mode and check official dark tokens (#191b1e, #27292d)
    await themeBtn.click(); // light -> dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkStyles = await page.evaluate(() => {
      const bodyCs = getComputedStyle(document.body);
      const card = document.querySelector('.card');
      const cardCs = card ? getComputedStyle(card) : null;
      return {
        bodyBg: bodyCs.backgroundColor,
        cardBg: cardCs?.backgroundColor ?? '',
      };
    });
    expect(darkStyles.bodyBg).toBe('rgb(25, 27, 30)');
    expect(darkStyles.cardBg).toBe('rgb(39, 41, 45)');

    // Check official SVGs preserved proportions
    const brandMetrics = await page.evaluate(() => {
      const wordmark = document.querySelector('.evol-wordmark-hero') as HTMLImageElement | null;
      const oMark = document.querySelector('.evol-o-mark') as HTMLImageElement | null;
      if (!wordmark || !oMark) return null;
      const wr = wordmark.getBoundingClientRect();
      const or = oMark.getBoundingClientRect();
      return {
        wNatW: wordmark.naturalWidth,
        wNatH: wordmark.naturalHeight,
        wRatio: wr.width / wr.height,
        wNatRatio: wordmark.naturalWidth / wordmark.naturalHeight,
        oNatW: oMark.naturalWidth,
        oNatH: oMark.naturalHeight,
        oW: or.width,
        oH: or.height,
      };
    });
    expect(brandMetrics).not.toBeNull();
    expect(brandMetrics!.wNatW).toBe(570);
    expect(brandMetrics!.wNatH).toBe(150);
    expect(Math.abs(brandMetrics!.wRatio - brandMetrics!.wNatRatio)).toBeLessThan(0.05);
    expect(brandMetrics!.oNatW).toBeGreaterThan(0);

    // Check accessible names on all buttons
    const buttonsWithoutLabel = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.filter((b) => {
        const text = (b.textContent ?? '').trim();
        const aria = (b.getAttribute('aria-label') ?? '').trim();
        return !text && !aria;
      }).length;
    });
    expect(buttonsWithoutLabel).toBe(0);

    // Check keyboard shortcut '/' focuses global search
    await page.keyboard.press('/');
    await expect(page.getByLabel('Buscador global de herramientas')).toBeFocused();

    // Check reduced motion compliance
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motionToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--evol-motion-enter').trim(),
    );
    expect(motionToken).toBe('0ms');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test('verifies 49 categories, search, empty state, tool detail, and favorites persistence', async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: 'networkidle' });

    // Explore 49 categories
    await page.goto(`${BASE_PATH}#/categorias`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-category-slug]')).toHaveCount(49);

    // Search for Semgrep
    const topSearch = page.getByLabel('Buscador global de herramientas');
    await topSearch.fill('semgrep');
    await topSearch.press('Enter');
    await expect(page.locator('[data-tool-id="semgrep"]')).toBeVisible();

    // Favorite Semgrep from card and check badge
    await page.getByRole('button', { name: /Guardar Semgrep en favoritos/i }).click();
    await expect(page.locator('.topbar .badge-count')).toHaveText('1');

    // Open Semgrep detail view & verify preserved metadata and static link
    await page.locator('[data-tool-id="semgrep"] a', { hasText: 'Ver ficha' }).click();
    await expect(page.getByRole('heading', { name: 'Semgrep', level: 1 })).toBeVisible();
    // The version is shown in the metadata grid and again in the evidence record.
    await expect(page.locator('.facts-grid').first().getByText('1.186.0', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a Auditoría de código' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ficha HTML original' })).toHaveAttribute(
      'href',
      `${BASE_PATH}02-catalogo/testing-y-auditoria/semgrep/index.html`,
    );

    // New technical resources, use cases and evidence are visible in the detail view
    await page.goto(`${BASE_PATH}#/herramienta/cargo-fuzz`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'cargo-fuzz', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Guía técnica' })).toHaveAttribute(
      'href',
      `${BASE_PATH}02-catalogo/pruebas-tecnicas/cargo-fuzz/GUIA.md`,
    );
    await expect(page.getByText('Casos de uso propuestos (3)')).toBeVisible();
    await expect(page.getByText('Evidencia registrada')).toBeVisible();
    await expect(page.getByText('PASS', { exact: true })).toBeVisible();

    await page.goto(`${BASE_PATH}#/buscar?q=cargo-fuzz`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-tool-id="cargo-fuzz"]')).toBeVisible();

    // Check historical tool warnings preserved on bluediving
    await page.goto(`${BASE_PATH}#/herramienta/bluediving`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'bluediving', level: 1 })).toBeVisible();
    await expect(
      page.getByRole('region', { name: /Advertencias de mantenimiento/i }).getByText(/Histórica o experimental/i),
    ).toBeVisible();
    await page.getByRole('button', { name: /Añadir a favoritos/i }).click();
    await expect(page.locator('.topbar .badge-count')).toHaveText('2');

    // Check scrubbed external URL on sploitctl keeps neutral notice
    await page.goto(`${BASE_PATH}#/herramienta/sploitctl`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'sploitctl', level: 1 })).toBeVisible();
    await expect(page.getByText(/Referencia externa no disponible o retirada/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a Automatización' })).toBeVisible();

    // Reload and confirm favorites persisted in localStorage
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${BASE_PATH}#/favoritos`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-tool-id="semgrep"]')).toBeVisible();
    await expect(page.locator('[data-tool-id="bluediving"]')).toBeVisible();

    // Check empty search state
    await page.goto(`${BASE_PATH}#/buscar?q=herramienta_inexistente_xyz_999`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByRole('heading', { name: 'Búsqueda sin resultados' })).toBeVisible();
  });

  test('validates PWA manifest, service worker, offline download + cancel + real offline browsing', async ({
    page,
    context,
  }) => {
    test.setTimeout(420_000);
    await page.goto(BASE_PATH, { waitUntil: 'networkidle' });

    // Validate manifest.webmanifest
    const manifestRes = await page.request.get(`${BASE_PATH}manifest.webmanifest`);
    expect(manifestRes.ok()).toBe(true);
    const manifestRaw = await manifestRes.text();
    expect(FORBIDDEN_RE.test(manifestRaw)).toBe(false);
    const manifest = JSON.parse(manifestRaw) as {
      name: string;
      display: string;
      start_url: string;
      scope: string;
      icons: Array<{ src: string; purpose?: string }>;
    };
    expect(manifest.name).toBe('Evol Tool Atlas');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe(BASE_PATH);
    expect(manifest.scope).toBe(BASE_PATH);
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, new URL(BASE_PATH, page.url())).pathname;
      const iconRes = await page.request.get(iconUrl);
      expect(iconRes.ok(), `Icon ${iconUrl} should return HTTP 200`).toBe(true);
    }

    // Ensure Service Worker is active and controlling this scope
    const swScope = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return {
        scope: new URL(reg.scope).pathname,
        hasController: Boolean(navigator.serviceWorker.controller),
      };
    });
    expect(swScope.scope).toBe(BASE_PATH);
    if (!swScope.hasController) {
      await page.reload({ waitUntil: 'networkidle' });
    }
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    expect(controlled).toBe(true);

    // Save one favorite before going offline to test preservation
    await page.goto(`${BASE_PATH}#/herramienta/semgrep`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Añadir a favoritos/i }).click();

    // Verify clean offline-unavailable state on uncached shard before full download
    await context.setOffline(true);
    await page.goto(`${BASE_PATH}#/categoria/criptografia`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Contenido no disponible sin conexión' })).toBeVisible();
    await context.setOffline(false);

    // Open Offline Center and test Cancel + Full Download
    await page.goto(`${BASE_PATH}#/offline`, { waitUntil: 'networkidle' });
    const startBtn = page.getByRole('button', {
      name: 'Guardar catálogo completo para uso sin conexión',
    });
    const cancelBtn = page.getByRole('button', { name: 'Cancelar descarga' });

    await startBtn.click();
    await expect(cancelBtn).toBeEnabled();
    await cancelBtn.click();
    await expect(page.getByText(/Descarga cancelada/i)).toBeVisible({ timeout: 20_000 });

    // Resume / complete full catalog download
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    // 6.672 resources (≈26 MB) are fetched and SHA-256-checked; allow for loaded CI hosts.
    await expect(
      page.getByText(/Todas las categorías y las 2\.137 fichas están disponibles sin conexión/i),
    ).toBeVisible({ timeout: 300_000 });

    // Switch browser to genuine OFFLINE mode
    await context.setOffline(true);

    // Reload app shell completely offline
    await page.goto(BASE_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Evol Tool Atlas', level: 1 })).toBeVisible();
    await expect(page.getByText(/Modo sin conexión activo/i)).toBeVisible();
    await expect(page.locator('.topbar .badge-count')).toHaveText('1');

    // Search offline
    await page.goto(`${BASE_PATH}#/buscar?q=bluediving`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-tool-id="bluediving"]')).toBeVisible();

    // Open tool shard & detail offline
    await page.goto(`${BASE_PATH}#/herramienta/bluediving`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'bluediving', level: 1 })).toBeVisible();

    // Open preserved static HTML sheet directly offline via Service Worker cache!
    const staticPage = await context.newPage();
    await staticPage.goto(
      `${BASE_PATH}02-catalogo/seguridad/catalogo/firmware-mod-kit/index.html`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(staticPage.getByRole('heading', { name: 'Firmware Mod Kit' })).toBeVisible();
    await staticPage.close();

    await context.setOffline(false);
  });

  test('adapts responsively across desktop, tablet, and mobile without overflow', async ({ page }) => {
    const viewports = [
      { width: 1280, height: 800, mobile: false },
      { width: 768, height: 1024, mobile: true },
      { width: 390, height: 844, mobile: true },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_PATH, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Evol Tool Atlas', level: 1 })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `Horizontal overflow at ${vp.width}x${vp.height}`).toBe(false);

      if (vp.mobile) {
        const menuBtn = page.getByRole('button', { name: /Abrir menú de navegación/i });
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();
        await expect(page.locator('#atlas-sidebar')).toHaveClass(/is-open/);
        await page.getByRole('button', { name: 'Cerrar menú lateral' }).click();
        await expect(page.locator('#atlas-sidebar')).not.toHaveClass(/is-open/);
      }
    }
  });
});
