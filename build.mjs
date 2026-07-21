import { build, transform } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(rootDir, 'main');
const publicDir = process.env.BUILD_OUT_DIR
  ? resolve(process.env.BUILD_OUT_DIR)
  : path.join(rootDir, 'public');
const assetsDir = path.join(publicDir, 'assets');
const buildId = String(Date.now());

await rm(publicDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

await build({
  entryPoints: [path.join(sourceDir, 'src/app.js')],
  outdir: assetsDir,
  bundle: true,
  format: 'esm',
  splitting: true,
  target: 'es2022',
  minify: true,
  define: {
    'globalThis.__SQ1_BUILD_ID__': JSON.stringify(buildId)
  },
  entryNames: '[name].min',
  chunkNames: 'chunks/[name]-[hash].min',
  legalComments: 'none'
});

await cp(path.join(sourceDir, 'viz'), path.join(publicDir, 'viz'), { recursive: true });
await cp(path.join(sourceDir, 'default-algset'), path.join(publicDir, 'default-algset'), { recursive: true });
await cp(path.join(sourceDir, 'manifest.webmanifest'), path.join(publicDir, 'manifest.webmanifest'));

let sw = await readFile(path.join(sourceDir, 'service-worker.js'), 'utf8');
sw = sw.replaceAll('__SW_BUILD_ID__', buildId);
await writeFile(path.join(publicDir, 'service-worker.js'), sw);

await mkdir(path.join(publicDir, 'css'), { recursive: true });

for (const fileName of ['styles.css', 'devtool.css']) {
  const css = await readFile(path.join(sourceDir, 'css', fileName), 'utf8');
  const minified = await transform(css, { loader: 'css', minify: true });
  await writeFile(path.join(publicDir, 'css', fileName), minified.code);
}

const html = await readFile(path.join(sourceDir, 'index.html'), 'utf8');
const publicHtml = html
  .replace('<link rel="stylesheet" href="./css/styles.css">', `<link rel="stylesheet" href="./css/styles.css?v=${buildId}">`)
  .replace('<link rel="stylesheet" href="./css/devtool.css">', `<link rel="stylesheet" href="./css/devtool.css?v=${buildId}">`)
  .replace(
    '<script type="module" src="./src/app.js"></script>',
    `<script type="module" src="./assets/app.min.js?v=${buildId}"></script>`
  );

await writeFile(path.join(publicDir, 'index.html'), publicHtml);

console.log('Built public/index.html and public/assets/app.min.js');
