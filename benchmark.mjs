import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, 'public');
const iterations = 5;
const cpuSlowdown = 4;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function average(values) {
  const usable = values.filter(value => Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function rounded(value) {
  return value === null ? 'n/a' : Number(value.toFixed(1));
}

function summarize(runs) {
  const keys = [
    'domContentLoaded',
    'load',
    'firstContentfulPaint',
    'uiResponsive',
    'deferredPreload',
    'scriptTransferKb',
    'scriptEncodedKb',
    'scriptRequests'
  ];

  return Object.fromEntries(keys.map(key => [key, rounded(average(runs.map(run => run[key])))]));
}

async function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known path.
    }
  }

  throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to your browser executable.');
}

async function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }

      const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
      const normalizedPath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(publicDir, normalizedPath);
      const fileStats = await stat(filePath);

      if (!fileStats.isFile()) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream'
      });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    close: () => new Promise(resolve => server.close(resolve)),
    url: `http://127.0.0.1:${port}/`
  };
}

async function measureRun(browser, url, mode) {
  const context = await browser.newContext();
  await context.addInitScript(selectedMode => {
    localStorage.clear();
    localStorage.setItem('sq1LastScreen', selectedMode === 'devtool' ? 'jsonCreator' : 'training');
  }, mode.name);

  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown });
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const uiResponsivePromise = page
    .waitForFunction(() => window.__sq1UiResponsive, null, { timeout: 30000 })
    .then(() => page.evaluate(() => window.__sq1UiResponsive));

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  const uiResponsive = await uiResponsivePromise;
  await page.waitForSelector(mode.selector, { state: 'visible', timeout: 30000 });

  const deferredPreload = await page
    .waitForFunction(() => window.__sq1FeaturePreloadDone, null, { timeout: 30000 })
    .then(() => page.evaluate(() => window.__sq1FeaturePreloadDone))
    .catch(() => null);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
    const scripts = performance
      .getEntriesByType('resource')
      .filter(entry => entry.initiatorType === 'script');

    return {
      domContentLoaded: nav.domContentLoadedEventEnd,
      firstContentfulPaint: fcp ? fcp.startTime : null,
      load: nav.loadEventEnd,
      scriptEncodedKb: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0) / 1024,
      scriptRequests: scripts.length,
      scriptTransferKb: scripts.reduce((sum, entry) => sum + entry.transferSize, 0) / 1024
    };
  });

  await context.close();

  return {
    ...metrics,
    deferredPreload,
    errors,
    uiResponsive
  };
}

async function benchmarkMode(browser, url, mode) {
  const runs = [];

  for (let index = 0; index < iterations; index++) {
    const run = await measureRun(browser, url, mode);
    runs.push(run);
    console.log(`${mode.name} run ${index + 1}/${iterations}:`, summarize([run]));
  }

  return runs;
}

console.log('Building public output...');
await execFileAsync(process.execPath, ['build.mjs'], { cwd: rootDir });

const chromePath = await findChrome();
const server = await createStaticServer();
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

try {
  const modes = [
    { name: 'trainer', selector: '#timerZone' },
    { name: 'devtool', selector: '#jsonCreatorFullscreen' }
  ];

  const results = {};
  for (const mode of modes) {
    results[mode.name] = await benchmarkMode(browser, server.url, mode);
  }

  const summary = Object.fromEntries(
    Object.entries(results).map(([name, runs]) => [name, summarize(runs)])
  );

  console.log('\nAverages with 4x CPU slowdown, 5 cold runs per mode:');
  console.table(summary);

  const errorRows = Object.entries(results)
    .flatMap(([mode, runs]) => runs.map((run, index) => ({ mode, run: index + 1, errors: run.errors })))
    .filter(row => row.errors.length > 0);

  if (errorRows.length > 0) {
    console.log('\nBrowser errors:');
    console.dir(errorRows, { depth: null });
  }
} finally {
  await browser.close();
  await server.close();
}
