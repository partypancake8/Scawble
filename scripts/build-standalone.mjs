// build-standalone.mjs — bundle the prototype into ONE self-contained HTML file
// that runs from file:// (double-click, no server). Embeds the ENABLE list.
import { build } from 'esbuild';
import fs from 'fs';

const root = new URL('..', import.meta.url).pathname;
const P = (p) => root + p;

const out = await build({
  entryPoints: [P('apps/prototype/app.js')],
  bundle: true, format: 'iife', write: false, minify: true, target: 'es2019',
});
const js = out.outputFiles[0].text;
const fontsCss = fs.readFileSync(P('apps/prototype/fonts.css'), 'utf8');
const css = fs.readFileSync(P('apps/prototype/style.css'), 'utf8');
const words = fs.readFileSync(P('apps/prototype/enable1.txt'), 'utf8');

// pull the <body> markup out of index.html, minus the module <script>
const html = fs.readFileSync(P('apps/prototype/index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '').trim();

const doc = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1"/>
<title>Scawble</title>
<style>${fontsCss}
${css}</style>
</head><body>
${body}
<script>window.SCAWBLE_ENABLE=${JSON.stringify(words)};</script>
<script>${js}</script>
</body></html>`;

fs.writeFileSync(P('apps/prototype/scawble.html'), doc);
console.log(`built scawble.html — ${(doc.length / 1e6).toFixed(2)} MB, self-contained`);
