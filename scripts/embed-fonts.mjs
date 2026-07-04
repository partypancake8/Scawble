// embed-fonts.mjs — inline the Fredoka woff2 files as data-URIs into fonts.css,
// so the cute rounded type is CSP-safe and works offline / from file://.
// Run: `npm run embed-fonts`. You ONLY need this if you change/replace the Fredoka
// woff2 files in apps/prototype/fonts/ — it regenerates apps/prototype/fonts.css,
// which `npm run build` then inlines into the standalone. (The native app uses
// @expo-google-fonts/fredoka instead, so this doesn't affect apps/native.)
import fs from 'fs';
const root = new URL('..', import.meta.url).pathname;
const b64 = (f) => fs.readFileSync(root + 'apps/prototype/fonts/' + f).toString('base64');
const face = (weight, file) =>
  `@font-face{font-family:'Fredoka';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url(data:font/woff2;base64,${b64(file)}) format('woff2');}`;
const css = [face(400, 'fredoka-400.woff2'), face(600, 'fredoka-600.woff2')].join('\n') + '\n';
fs.writeFileSync(root + 'apps/prototype/fonts.css', css);
console.log(`wrote fonts.css (${(css.length / 1024).toFixed(0)} KB)`);
