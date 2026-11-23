#!/usr/bin/env node
// Genera reports/atlas-status.json (contrato evol-atlas-report-v1) para EVOL Atlas.
//
// - Ejecuta de verdad cada comprobación y guarda su salida en reports/evidence/<ID>.txt.
// - El estado declarado (milestone, status, summary, listas) se toma de reports/atlas-meta.json,
//   que es una decisión explícita y versionada; este script no lo inventa.
// - Nunca incluye "audit": un agente no puede autoauditarse.
//
// Uso: node scripts/atlas-report.mjs [--e2e]
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const EVIDENCE_DIR = path.join(REPORTS, 'evidence');
const META_PATH = path.join(REPORTS, 'atlas-meta.json');
const OUT_PATH = path.join(REPORTS, 'atlas-status.json');
const LOCK_PATH = path.join(REPORTS, '.atlas-report.lock');

const PROJECT_ID = 'evol-tool-atlas';
const AGENT = 'atlas-report.mjs';
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024; // límite del lector de Atlas
const EVIDENCE_BUDGET = MAX_EVIDENCE_BYTES - 64 * 1024; // margen para cabecera/marcador
const STATUSES = new Set([
  'documental', 'en_desarrollo', 'en_pruebas', 'bloqueado',
  'en_revision', 'listo_para_integrar', 'integrado_reportado',
]);
const ADVANCED = new Set(['en_revision', 'listo_para_integrar', 'integrado_reportado']);

const RUN_E2E = process.argv.includes('--e2e');

const CHECKS = [
  { id: 'TOOLATLAS-T01', name: 'typecheck', script: 'typecheck', bins: ['tsc'] },
  { id: 'TOOLATLAS-T02', name: 'lint', script: 'lint', bins: ['eslint'] },
  { id: 'TOOLATLAS-T03', name: 'unit', script: 'test:unit', bins: ['vitest'] },
  { id: 'TOOLATLAS-T04', name: 'build', script: 'build', bins: ['vite'] },
  { id: 'TOOLATLAS-T05', name: 'verify:catalog', script: 'verify:catalog', bins: [] },
  {
    id: 'TOOLATLAS-T06', name: 'e2e', script: 'test:e2e', bins: ['playwright'],
    optIn: true, files: ['/usr/bin/chromium'],
  },
];

// Mensajes que indican falta de dependencia/navegador, no un fallo del código.
const BLOCKED_PATTERNS = [
  /: command not found/i,
  /: not found\s*$/im,
  /Executable doesn't exist/i,
  /Failed to launch .*ENOENT/i,
  /spawn \S+ ENOENT/i,
];

// ---------------------------------------------------------------- utilidades

function fail(msg) {
  console.error(`atlas-report: ERROR: ${msg}`);
  process.exit(1);
}

function isoWithOffset(d = new Date()) {
  const pad = (n) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, 'g');

// Elimina rutas personales/absolutas de la salida antes de guardarla.
function sanitize(text) {
  let out = text.replace(ANSI_RE, ''); // códigos ANSI
  const home = os.homedir();
  out = out.split(ROOT).join('.');
  if (home && home !== '/') out = out.split(home).join('~');
  return out;
}

function ensureRealDir(dir) {
  try {
    const st = fs.lstatSync(dir);
    if (st.isSymbolicLink() || !st.isDirectory()) fail(`${path.relative(ROOT, dir)} no es un directorio real`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeAtomic(target, content) {
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  const fd = fs.openSync(tmp, 'wx', 0o644);
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, target);
}

function sha256OfEvidence(file) {
  const st = fs.lstatSync(file);
  if (st.isSymbolicLink() || !st.isFile()) fail(`${file} no es un archivo regular`);
  if (st.size >= MAX_EVIDENCE_BYTES) fail(`${file} supera 5 MiB`);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    return createHash('sha256').update(fs.readFileSync(fd)).digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

function limitBytes(text) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= EVIDENCE_BUDGET) return text;
  const head = buf.subarray(0, 1024 * 1024).toString('utf8');
  const tail = buf.subarray(buf.length - (EVIDENCE_BUDGET - 1024 * 1024 - 256)).toString('utf8');
  return `${head}\n\n[... salida truncada: ${buf.length} bytes en total; se conservan el inicio y el final ...]\n\n${tail}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Evita ejecuciones simultáneas (p. ej. hook post-commit + ejecución manual).
async function acquireLock() {
  const deadline = Date.now() + 30 * 60 * 1000;
  for (;;) {
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let stale = false;
      try {
        const pid = Number(fs.readFileSync(LOCK_PATH, 'utf8'));
        if (pid > 0) process.kill(pid, 0);
        else stale = true;
      } catch (err) {
        stale = err.code === 'ESRCH' || err.code === 'ENOENT' || err instanceof SyntaxError;
      }
      if (stale) {
        fs.rmSync(LOCK_PATH, { force: true });
        continue;
      }
      if (Date.now() > deadline) fail('otra ejecución mantiene el bloqueo hace más de 30 min');
      await sleep(2000);
    }
  }
}

function releaseLock() {
  fs.rmSync(LOCK_PATH, { force: true });
}

// ---------------------------------------------------------------- metadatos

function readMeta() {
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  } catch (e) {
    fail(`no se pudo leer reports/atlas-meta.json: ${e.message}`);
  }
  const allowed = ['milestone', 'status', 'summary', 'blockers', 'pending_decisions', 'next_steps'];
  const extra = Object.keys(meta).filter((k) => !allowed.includes(k) && !k.startsWith('_'));
  if (extra.length) fail(`atlas-meta.json: campos desconocidos: ${extra.join(', ')}`);
  const str = (k, max) => {
    const v = meta[k];
    if (typeof v !== 'string' || !v.trim() || v.length > max) fail(`atlas-meta.json: "${k}" debe ser texto de 1-${max} caracteres`);
    return v.trim();
  };
  const list = (k) => {
    const v = meta[k] ?? [];
    if (!Array.isArray(v) || v.length > 25 || v.some((s) => typeof s !== 'string' || !s.trim() || s.length > 300)) {
      fail(`atlas-meta.json: "${k}" debe ser una lista de hasta 25 textos de ≤300 caracteres`);
    }
    return v.map((s) => s.trim());
  };
  const status = str('status', 40);
  if (!STATUSES.has(status)) fail(`atlas-meta.json: status "${status}" no permitido`);
  return {
    milestone: str('milestone', 100),
    status,
    summary: str('summary', 1200),
    blockers: list('blockers'),
    pending_decisions: list('pending_decisions'),
    next_steps: list('next_steps'),
  };
}

// ---------------------------------------------------------------- ejecución

function runCommand(script) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn('npm', ['run', script], {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: process.env.CI ?? '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => chunks.push(d));
    child.on('error', (err) => resolve({ code: null, output: `${err.message}\n`, spawnError: err }));
    child.on('close', (code, signal) => resolve({
      code: code ?? null,
      signal,
      output: Buffer.concat(chunks).toString('utf8'),
    }));
  });
}

function missingPrereqs(check) {
  const missing = [];
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) missing.push('node_modules (ejecuta npm ci)');
  for (const bin of check.bins) {
    if (!fs.existsSync(path.join(ROOT, 'node_modules', '.bin', bin))) missing.push(`binario ${bin}`);
  }
  for (const f of check.files ?? []) {
    if (!fs.existsSync(f)) missing.push(`navegador ${path.basename(f)}`);
  }
  return missing;
}

async function runCheck(check, commit) {
  const evidenceFile = path.join(EVIDENCE_DIR, `${check.id}.txt`);
  const rel = `reports/evidence/${check.id}.txt`;

  if (check.optIn && !RUN_E2E) {
    // Una evidencia anterior no corresponde a esta ejecución: se elimina.
    fs.rmSync(evidenceFile, { force: true });
    return { test: { id: check.id, result: 'NOT_RUN', note: `${check.name}: no ejecutado (requiere --e2e)` } };
  }

  const started = new Date();
  const header = [
    `# ${check.id} ${check.name}`,
    `# comando: npm run ${check.script}`,
    `# commit: ${commit}`,
    `# inicio: ${isoWithOffset(started)}`,
  ];

  let result;
  let note = check.name;
  let body;
  let exitInfo;

  const missing = missingPrereqs(check);
  if (missing.length) {
    result = 'BLOCKED';
    note = `${check.name}: falta ${missing.join(', ')}`;
    body = `No se ejecutó: falta ${missing.join(', ')}.\n`;
    exitInfo = '# código de salida: (no ejecutado)';
  } else {
    console.error(`atlas-report: ejecutando ${check.id} (npm run ${check.script})...`);
    const r = await runCommand(check.script);
    body = r.output;
    exitInfo = `# código de salida: ${r.code ?? 'ninguno'}${r.signal ? ` (señal ${r.signal})` : ''}`;
    if (r.code === 0) {
      result = 'PASS';
    } else if (r.spawnError || BLOCKED_PATTERNS.some((re) => re.test(r.output))) {
      result = 'BLOCKED';
      note = `${check.name}: falta una dependencia o navegador (ver evidencia)`;
    } else {
      result = 'FAIL';
      note = `${check.name}: código de salida ${r.code ?? r.signal}`;
    }
  }

  const finished = new Date();
  header.push(`# fin: ${isoWithOffset(finished)} (${((finished - started) / 1000).toFixed(1)} s)`, exitInfo, `# resultado: ${result}`, '');
  writeAtomic(evidenceFile, limitBytes(sanitize(`${header.join('\n')}\n${body}`)));

  return {
    test: { id: check.id, result, note, evidence_ref: `repo:${rel}` },
    evidence: { label: `${check.id} ${check.name}`, path: `repo:${rel}`, sha256: sha256OfEvidence(evidenceFile) },
  };
}

// ---------------------------------------------------------------- principal

async function main() {
  const meta = readMeta();
  ensureRealDir(REPORTS);
  ensureRealDir(EVIDENCE_DIR);
  await acquireLock();
  try {
    const commit = git('rev-parse', 'HEAD');
    if (!/^[0-9a-f]{40}$/.test(commit)) fail(`HEAD inesperado: ${commit}`);
    const dirty = git('status', '--porcelain', '--untracked-files=normal') !== '';

    const tests = [];
    const evidence = [];
    for (const check of CHECKS) {
      const { test, evidence: ev } = await runCheck(check, commit);
      tests.push(test);
      if (ev) evidence.push(ev);
    }

    const headAfter = git('rev-parse', 'HEAD');
    if (headAfter !== commit) {
      console.error(`atlas-report: AVISO: HEAD cambió durante la ejecución (${commit.slice(0, 7)} → ${headAfter.slice(0, 7)}); el informe describe ${commit.slice(0, 7)}.`);
    }

    const counts = {};
    for (const t of tests) counts[t.result] = (counts[t.result] ?? 0) + 1;
    const tally = ['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].map((k) => `${counts[k] ?? 0} ${k}`).join(', ');
    const suffix = ` [Generado por ${AGENT}: ${tally}${dirty ? '; árbol de trabajo con cambios sin confirmar respecto al commit' : ''}.]`;
    const summary = (meta.summary.length + suffix.length <= 1200 ? meta.summary + suffix : meta.summary).slice(0, 1200);

    if (ADVANCED.has(meta.status) && ((counts.FAIL ?? 0) + (counts.BLOCKED ?? 0)) > 0) {
      console.error(`atlas-report: AVISO: status "${meta.status}" declarado con comprobaciones FAIL/BLOCKED; revisa reports/atlas-meta.json.`);
    }

    const report = {
      schema_version: 'evol-atlas-report-v1',
      project_id: PROJECT_ID,
      reported_at: isoWithOffset(),
      agent: AGENT,
      milestone: meta.milestone,
      status: meta.status,
      summary,
      commit,
      tests,
      evidence,
      blockers: meta.blockers,
      pending_decisions: meta.pending_decisions,
      next_steps: meta.next_steps,
    };
    writeAtomic(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.error(`atlas-report: escrito reports/atlas-status.json (${tally}; commit ${commit.slice(0, 7)}).`);
  } finally {
    releaseLock();
  }
}

main().catch((e) => {
  fail(e.stack ?? String(e));
});
