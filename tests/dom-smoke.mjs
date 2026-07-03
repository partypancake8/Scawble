// dom-smoke.mjs — boots the prototype UI in a headless DOM (linkedom) and drives
// a few turns, asserting the whole view layer renders and the bot plays with no
// runtime errors. Run: `npm run smoke`. (Feel/animation still needs a real browser.)
import fs from 'fs';
import { parseHTML } from 'linkedom';

const root = new URL('..', import.meta.url).pathname;
const html = fs.readFileSync(root + 'apps/prototype/index.html', 'utf8');
const enableText = fs.readFileSync(root + 'apps/prototype/enable1.txt', 'utf8');
const { window, document } = parseHTML(html);

global.window = window; global.document = document;
global.navigator = { vibrate() {} }; window.navigator = global.navigator;
global.HTMLElement = window.HTMLElement; global.Node = window.Node;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.performance = { now: () => Date.now() };
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia = global.matchMedia;
window.confirm = global.confirm = () => true;
window.prompt = global.prompt = () => 'A';
const store = new Map();
global.localStorage = window.localStorage = { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
global.fetch = async () => ({ ok: true, text: async () => enableText });
if (window.Element?.prototype) window.Element.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 20, height: 20, right: 20, bottom: 20 });
document.elementFromPoint = () => null; // linkedom has no layout; drag-drop tap path doesn't need it

const errors = [];
process.on('uncaughtException', (e) => errors.push('uncaught: ' + (e.stack || e.message)));
process.on('unhandledRejection', (e) => errors.push('rejection: ' + (e && (e.stack || e.message) || e)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
const q = (id) => document.getElementById(id);
const check = (c, m) => (c ? console.log('  ok:', m) : errors.push('FAIL: ' + m));

try { await import('../apps/prototype/app.js'); } catch (e) { console.log('IMPORT CRASH:', e.stack); process.exit(1); }
await sleep(300);

check(q('wordmark').querySelectorAll('.tile').length === 7, 'wordmark renders 7 tiles');
check(q('diffrow').querySelectorAll('button').length === 4, '4 difficulty tiers');
check(q('board').querySelectorAll('.cell').length === 225, 'board renders 225 cells');
check(!q('playDaily').disabled, 'play enabled after dictionary load');
fire(q('playDaily'), 'click'); await sleep(60);
check(!q('game').classList.contains('hidden'), 'game screen shown after Play');
check(q('rack').querySelectorAll('.tile').length === 7, 'rack shows 7 tiles');

// --- P1: tap-to-place (#11) ---
const rts = [...q('rack').querySelectorAll('.tile')];
const rt = rts.find((t) => t.textContent[0] !== '_') || rts[0];
rt.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
window.dispatchEvent(new window.Event('pointerup', { bubbles: true }));
await sleep(20);
fire(q('board').querySelectorAll('.cell')[7 * 15 + 7], 'click'); // place on center
await sleep(20);
check(q('board').querySelectorAll('.tile.draft').length === 1, 'tap-to-place puts a tile on the board');
fire(q('recall'), 'click'); await sleep(20);
check(q('board').querySelectorAll('.tile.draft').length === 0, 'recall clears the draft');

// --- P1: hint (#10) ---
fire(q('hint'), 'click'); await sleep(20);
check(q('board').querySelectorAll('.ghost').length > 0, 'hint shows ghost tiles');
fire(q('recall'), 'click'); await sleep(10);

// --- P1: settings screen (#12) ---
fire(q('setBtn'), 'click'); await sleep(20);
check(!q('settings').classList.contains('hidden'), 'settings screen opens');
fire(q('setlist').querySelector('.toggle'), 'click'); await sleep(10);
fire(q('setBack'), 'click'); await sleep(10);
check(!q('game').classList.contains('hidden'), 'settings returns to game');

// --- P1: move log (#8) ---
fire(q('logBtn'), 'click'); await sleep(10);
check(!q('movelog').classList.contains('hidden'), 'move log opens');
fire(q('logclose'), 'click'); await sleep(10);

const before = q('board').querySelectorAll('.tile.committed').length;
for (let i = 0; i < 10 && q('analysis').classList.contains('hidden'); i++) { if (!q('pass').disabled) fire(q('pass'), 'click'); await sleep(560); }
const after = q('board').querySelectorAll('.tile.committed').length;
check(after > before, `bot placed tiles on the board (${before} -> ${after})`);
check(q('scoreBot').querySelector('.pts').textContent !== '0', 'bot has scored');
check(q('lastBot').textContent.trim() !== 'ready', 'last-move HUD updates (#7)');

console.log('\nDOM smoke:', errors.length ? ('FAILED\n' + errors.join('\n\n')) : 'ALL CHECKS PASSED, no runtime errors');
process.exit(errors.length ? 1 : 0);
