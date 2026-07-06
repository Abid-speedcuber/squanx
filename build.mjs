import { build, transform } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(rootDir, 'main');
const publicDir = path.join(rootDir, 'public');
const assetsDir = path.join(publicDir, 'assets');

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
  entryNames: '[name].min',
  chunkNames: 'chunks/[name]-[hash].min',
  legalComments: 'none'
});

await cp(path.join(sourceDir, 'viz'), path.join(publicDir, 'viz'), { recursive: true });
await mkdir(path.join(publicDir, 'css'), { recursive: true });

for (const fileName of ['styles.css', 'devtool.css']) {
  const css = await readFile(path.join(sourceDir, 'css', fileName), 'utf8');
  const minified = await transform(css, { loader: 'css', minify: true });
  await writeFile(path.join(publicDir, 'css', fileName), minified.code);
}

const html = await readFile(path.join(sourceDir, 'index.html'), 'utf8');
const publicHtml = html.replace(
  '<script type="module" src="./src/app.js"></script>',
  '<script type="module" src="./assets/app.min.js"></script>'
);

await writeFile(path.join(publicDir, 'index.html'), publicHtml);

console.log('Built public/index.html and public/assets/app.min.js');
