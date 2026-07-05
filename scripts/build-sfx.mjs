// build-sfx.mjs — synthesize the app's SFX assets from the pure sound-design
// table (src/audio/sfx.js) with the pure WAV synth (src/audio/wav.js). Emits one
// .wav per event into apps/native/assets/sfx/. Re-run when the SFX specs change:
//   npm run build-sfx
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SFX } from '../src/audio/sfx.js';
import { toneWav } from '../src/audio/wav.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'apps/native/assets/sfx');
mkdirSync(outDir, { recursive: true });

for (const [event, spec] of Object.entries(SFX)) {
  const bytes = toneWav(spec.tone);
  writeFileSync(join(outDir, `${event}.wav`), Buffer.from(bytes));
  console.log(`wrote ${event}.wav (${bytes.length} bytes)`);
}
console.log('SFX assets written to apps/native/assets/sfx/');
