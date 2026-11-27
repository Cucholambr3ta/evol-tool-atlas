#!/usr/bin/env node
/**
 * Reproducible performance measurement of a built Atlas (dist/ already built).
 *
 *   node scripts/measure-performance.mjs [--root <worktree>] [--port 4190] [--runs 5]
 *
 * Starts `vite preview` in <root>, then with Playwright's Chromium (or
 * PLAYWRIGHT_CHROMIUM_PATH) measures, on a fresh profile per run:
 *   - dashboard: navigation until the h1 and the catalogue index are rendered;
 *   - search: #/buscar?q=semgrep until the Semgrep card is visible;
 *   - largest category (webapp) until its first card is visible;
 *   - tool detail (semgrep) until the ATDS/evidence section is visible;
 *   - JS heap used after those views (Chromium CDP metric).
 * Prints medians as JSON. It does not modify any file.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { resolveBasePath } from './lib/base-path.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const root = path.resolve(opt('--root', process.cwd()));
const port = Number(opt('--port', '4190'));
const runs = Number(opt('--runs', '5'));
const base = resolveBasePath();
const origin = `http://127.0.0.1:${port}`;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)] ?? 0);
};

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${origin}${base}`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('vite preview no respondió');
}

const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
try {
  await waitForServer();
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH?.trim() || undefined;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const samples = { dashboardMs: [], searchMs: [], largestCategoryMs: [], toolDetailMs: [], jsHeapMB: [] };
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let t = Date.now();
    await page.goto(`${origin}${base}`);
    await page.getByRole('heading', { name: 'Evol Tool Atlas', level: 1 }).waitFor();
    await page.locator('[data-tool-id]').first().waitFor();
    samples.dashboardMs.push(Date.now() - t);

    t = Date.now();
    await page.goto(`${origin}${base}#/buscar?q=semgrep`);
    await page.locator('[data-tool-id="semgrep"]').waitFor();
    samples.searchMs.push(Date.now() - t);

    t = Date.now();
    await page.goto(`${origin}${base}#/categoria/webapp`);
    await page.locator('[data-tool-id]').first().waitFor();
    samples.largestCategoryMs.push(Date.now() - t);

    t = Date.now();
    await page.goto(`${origin}${base}#/herramienta/semgrep`);
    await page.getByRole('heading', { name: 'Evidencia registrada' }).waitFor();
    samples.toolDetailMs.push(Date.now() - t);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const heap = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
    samples.jsHeapMB.push(heap / (1024 * 1024));
    await context.close();
  }
  await browser.close();
  const result = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, median(v)]));
  console.log(JSON.stringify({ root, base, runs, medians: result, samples }, null, 2));
} finally {
  server.kill();
}
