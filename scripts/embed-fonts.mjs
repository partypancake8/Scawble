// embed-fonts.mjs — inline the Fredoka woff2 files as data-URIs into fonts.css,
// so the cute rounded type is CSP-safe and works offline / from file://.
import fs from 'fs';
const root = new URL('..', import.meta.url).pathname;
const b64 = (f) => fs.readFileSync(root + 'apps/prototype/fonts/' + f).toString('base64');
const face = (weight, file) =>
  `@font-face{font-family:'Fredoka';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url(data:font/woff2;base64,${b64(file)}) format('woff2');}`;
const css = [face(400, 'fredoka-400.woff2'), face(600, 'fredoka-600.woff2')].join('\n') + '\n';
fs.writeFileSync(root + 'apps/prototype/fonts.css', css);
console.log(`wrote fonts.css (${(css.length / 1024).toFixed(0)} KB)`);
