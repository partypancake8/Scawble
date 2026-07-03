// app.js — Soft & Cute view layer + P1 features (v2 PRD). Game logic stays in
// the tested controller/engine; this is the thin, juicy, cute front end.

import { createGame } from './controller.js';
import { premiumAt, SIZE } from '../../src/engine/board.js';
import { letterOf, VALUE } from '../../src/engine/tiles.js';
import { seedForDate } from './daily.js';
import { sfx, haptic, setSound, resume } from './sound.js';

const $ = (id) => document.getElementById(id);
const PLABEL = { DL: '2L', TL: '3L', DW: '2W', TW: '3W' };

let words = null, game = null, difficulty = 'expert';
let draft = [];            // [{tile,row,col,letter,blank}]
let rackOrder = [];
let busy = false, validNow = false, shownIds = new Set();
let draggingId = null, pendingId = null, tapSelected = null;
let hint = null;
let swapMode = false, swapSel = new Set();
const settings = loadSettings();

const isPlaced = (id) => draft.some((d) => d.tile.id === id);
const reduced = () => settings.motion === 'off' ? true : settings.motion === 'on' ? false : matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- boot ----------
async function init() {
  applyTheme();
  buildWordmark(); buildDiffRow(); buildBoardGrid(); buildSettings(); buildBlankLetters();
  renderStreak(); setSound(settings.sound); wire();
  try {
    let text = window.SCAWBLE_ENABLE;
    if (!text) text = await (await fetch('./enable1.txt')).text();
    words = text.split(/\r?\n/).filter(Boolean);
    $('playDaily').disabled = false; $('playClassic').disabled = false;
    $('playDaily').textContent = "Play today's puzzle";
  } catch {
    $('loaderr').textContent = 'Could not load dictionary. Serve from the repo root (npm run serve).';
    $('loaderr').classList.remove('hidden');
  }
}

function wire() {
  $('diffrow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { difficulty = b.dataset.d; settings.difficulty = difficulty; saveSettings(); buildDiffRow(); buildSettings(); } });
  $('playDaily').addEventListener('click', () => { resume(); start(seedForDate(new Date())); });
  $('playClassic').addEventListener('click', () => { resume(); start('classic-' + Math.random().toString(36).slice(2)); });
  $('homeBtn').addEventListener('click', () => showScreen('home'));
  $('homeSettings').addEventListener('click', () => openSettings('home'));
  $('setBtn').addEventListener('click', () => openSettings('game'));
  $('setBack').addEventListener('click', () => showScreen(settingsFrom));
  $('logBtn').addEventListener('click', openLog);
  $('logclose').addEventListener('click', () => $('movelog').classList.add('hidden'));
  $('submit').addEventListener('click', onSubmit);
  $('recall').addEventListener('click', recallAll);
  $('shuffle').addEventListener('click', shuffleRack);
  $('hint').addEventListener('click', onHint);
  $('pass').addEventListener('click', onPass);
  $('swap').addEventListener('click', enterSwap);
  $('swapConfirm').addEventListener('click', confirmSwap);
  $('swapCancel').addEventListener('click', exitSwap);
  $('board').addEventListener('click', onCellClick);
  $('blankcancel').addEventListener('click', () => resolveBlank(null));
  $('blankpicker').addEventListener('click', (e) => { if (e.target.id === 'blankpicker') resolveBlank(null); });
  $('setlist').addEventListener('click', onSettingChange);
}

// ---------- static builders ----------
function buildWordmark() {
  const L = [['S', 1], ['C', 2], ['A', 1], ['W', 5], ['B', 3], ['L', 1], ['E', 1]];
  $('wordmark').innerHTML = L.map(([l, v]) => `<div class="tile">${l}<span class="val">${v}</span></div>`).join('');
}
function buildDiffRow() {
  const tiers = [['casual', 'Casual'], ['skilled', 'Skilled'], ['expert', 'Expert'], ['brutal', 'Brutal']];
  $('diffrow').innerHTML = tiers.map(([d, l]) => `<button data-d="${d}" class="${d === difficulty ? 'on' : ''}">${l}</button>`).join('');
}
let cells = [];
function buildBoardGrid() {
  const board = $('board'); board.innerHTML = ''; cells = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.dataset.r = r; cell.dataset.c = c;
    const star = r === 7 && c === 7, p = premiumAt(r, c);
    if (star) { cell.classList.add('star'); cell.innerHTML = '<span class="plabel">✦</span>'; }
    else if (p) { cell.classList.add(p); cell.innerHTML = `<span class="plabel">${PLABEL[p]}</span>`; }
    board.appendChild(cell); cells.push(cell);
  }
}
const cellAt = (r, c) => cells[r * SIZE + c];
function buildBlankLetters() {
  $('blankletters').innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((L) => `<button data-l="${L}">${L}</button>`).join('');
  $('blankletters').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) resolveBlank(b.dataset.l); });
}

// ---------- lifecycle ----------
function start(seed) {
  game = createGame(words, { seed, difficulty });
  draft = []; busy = false; validNow = false; shownIds = new Set();
  draggingId = pendingId = tapSelected = hint = null; swapMode = false; swapSel = new Set();
  clearPreviewBadge(); exitSwapUI();
  rackOrder = game.state.racks.player.map((t) => t.id);
  showScreen('game'); renderAll();
  message('Your move — build off the center ✦');
}
function showScreen(name) { for (const s of ['home', 'game', 'analysis', 'settings']) $(s).classList.toggle('hidden', s !== name); }
let settingsFrom = 'home';
function openSettings(from) { settingsFrom = from; buildSettings(); showScreen('settings'); }

// ---------- render ----------
function renderAll() { renderBoard(); renderRack(); renderScores(); renderLastMoves(); renderBag(); renderTurn(); renderControls(); }

function tileEl(tile, cls = '') {
  const el = document.createElement('div');
  el.className = 'tile ' + cls + (tile.letter === '_' ? ' blank' : '');
  el.innerHTML = `${letterOf(tile)}<span class="val">${tile.value}</span>`;
  return el;
}
function renderBoard() {
  const draftAt = new Map(draft.map((d) => [`${d.row},${d.col}`, d]));
  const hintAt = new Map((hint ? hint.placements : []).map((p) => [`${p.row},${p.col}`, p]));
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const cell = cellAt(r, c);
    cell.querySelector('.tile')?.remove(); cell.querySelector('.ghost')?.remove();
    const label = cell.querySelector('.plabel');
    const committed = game.state.board[r][c].tile, d = draftAt.get(`${r},${c}`), g = hintAt.get(`${r},${c}`);
    if (committed) { if (label) label.style.visibility = 'hidden'; cell.appendChild(tileEl(committed, 'committed')); }
    else if (d) {
      if (label) label.style.visibility = 'hidden';
      const el = tileEl({ letter: d.blank ? '_' : d.letter, value: d.blank ? 0 : VALUE[d.letter], assigned: d.blank ? d.letter : undefined }, 'draft');
      el.addEventListener('pointerdown', (e) => startDrag(e, d.tile, { type: 'draft', row: r, col: c }));
      cell.appendChild(el);
    } else if (g) {
      if (label) label.style.visibility = 'hidden';
      const gh = document.createElement('div'); gh.className = 'ghost'; gh.textContent = letterOf(g.tile); cell.appendChild(gh);
    } else if (label) label.style.visibility = 'visible';
  }
}
function renderRack() {
  const rack = $('rack'); rack.innerHTML = '';
  const byId = new Map(game.state.racks.player.map((t) => [t.id, t]));
  const nowShown = new Set();
  for (let i = 0; i < 7; i++) {
    const slot = document.createElement('div'); slot.className = 'slot';
    const id = rackOrder[i];
    const tile = id && byId.get(id) && !isPlaced(id) && id !== draggingId && id !== pendingId ? byId.get(id) : null;
    if (tile) {
      const el = tileEl(tile);
      if (!shownIds.has(id) && !reduced()) el.classList.add('enter');
      if (id === tapSelected) el.classList.add('selected');
      if (swapSel.has(id)) el.classList.add('swapsel');
      nowShown.add(id);
      el.addEventListener('pointerdown', (e) => startDrag(e, tile, { type: 'rack' }));
      slot.appendChild(el);
    }
    rack.appendChild(slot);
  }
  shownIds = nowShown;
}
function renderScores() {
  $('scorePlayer').querySelector('.pts').textContent = game.state.scores.player;
  $('scoreBot').querySelector('.pts').textContent = game.state.scores.bot;
}
function lastFor(who) { const h = game.state.history; for (let i = h.length - 1; i >= 0; i--) if (h[i].by === who) return h[i]; return null; }
function fmtLast(h) {
  if (!h) return 'ready';
  if (h.pass) return 'passed';
  if (h.swap) return `swapped ${h.swap}`;
  return `${h.words[0]} <b>+${h.score}</b>`;
}
function renderLastMoves() { $('lastPlayer').innerHTML = fmtLast(lastFor('player')); $('lastBot').innerHTML = fmtLast(lastFor('bot')); }
function renderBag() { $('bag').innerHTML = `<b>${game.state.bag.length}</b><span>in bag</span>`; }
function renderTurn() {
  $('scorePlayer').classList.toggle('active', game.state.turn === 'player' && !game.state.over);
  $('scoreBot').classList.toggle('active', game.state.turn === 'bot' && !game.state.over);
}
function renderControls() {
  const my = game.state.turn === 'player' && !game.state.over && !busy && !swapMode;
  $('submit').disabled = !(my && draft.length && validNow);
  for (const b of ['recall', 'shuffle', 'pass', 'swap', 'hint']) $(b).disabled = !my;
}
function message(t, err = false) { const m = $('msg'); m.innerHTML = t; m.classList.toggle('err', err); }

// ---------- drag / tap ----------
function startDrag(e, tile, source) {
  if (busy || game.state.turn !== 'player' || game.state.over) return;
  if (swapMode) { if (source.type === 'rack') toggleSwap(tile.id); return; }
  e.preventDefault(); resume(); clearHint();
  if (source.type === 'draft') { draft = draft.filter((d) => !(d.row === source.row && d.col === source.col)); renderBoard(); refreshFeedback(); }
  draggingId = tile.id; renderRack();
  sfx.pickup(); if (settings.haptics) haptic(8);

  const fly = tileEl(tile, 'flying'); document.body.appendChild(fly);
  fly.style.setProperty('--cell', cellAt(0, 0).getBoundingClientRect().width + 'px');
  const x0 = e.clientX, y0 = e.clientY; let moved = false;
  const move = (ev) => {
    fly.style.left = ev.clientX + 'px'; fly.style.top = ev.clientY + 'px';
    if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) moved = true;
    const cell = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.cell');
    cells.forEach((c) => c.classList.remove('target'));
    if (cell && isDropTarget(cell)) cell.classList.add('target');
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    fly.remove(); cells.forEach((c) => c.classList.remove('target'));
    draggingId = null;
    const cell = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.cell');
    if (moved && cell && isDropTarget(cell)) {
      placeTile(tile, +cell.dataset.r, +cell.dataset.c);
    } else if (!moved && source.type === 'rack') {
      tapSelected = (tapSelected === tile.id) ? null : tile.id; // tap-to-select
    }
    // (dropped in void, or draft tapped = recall) — tile simply returns to the rack
    renderBoard(); renderRack(); refreshFeedback(); renderControls();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  move(e);
}
function onCellClick(e) {
  const cell = e.target.closest('.cell'); if (!cell) return;
  if (busy || swapMode || game.state.turn !== 'player' || game.state.over) return;
  if (tapSelected && isDropTarget(cell)) {
    const tile = game.state.racks.player.find((t) => t.id === tapSelected);
    const sel = tapSelected; tapSelected = null;
    if (tile) placeTile(tile, +cell.dataset.r, +cell.dataset.c); else renderRack();
  }
}
function isDropTarget(cell) {
  const r = +cell.dataset.r, c = +cell.dataset.c;
  return !game.state.board[r][c].tile && !draft.some((d) => d.row === r && d.col === c);
}
function placeTile(tile, r, c) {
  clearHint();
  if (tile.letter === '_') {
    pendingId = tile.id; renderRack();
    openBlankPicker().then((letter) => { pendingId = null; if (letter) commitDraft(tile, r, c, letter, true); else { renderRack(); refreshFeedback(); } });
  } else commitDraft(tile, r, c, tile.letter, false);
}
function commitDraft(tile, r, c, letter, blank) {
  draft.push({ tile, row: r, col: c, letter, blank }); tapSelected = null;
  renderBoard();
  const el = cellAt(r, c).querySelector('.tile'); if (el && !reduced()) el.classList.add('snap');
  sfx.place(); if (settings.haptics) haptic(12);
  renderRack(); refreshFeedback(); renderControls();
}

// ---------- live feedback ----------
function refreshFeedback() {
  cells.forEach((c) => c.classList.remove('validword'));
  clearPreviewBadge(); validNow = false;
  if (!draft.length) { message(game.state.turn === 'player' && !game.state.over ? 'Your move.' : ''); return; }
  const placements = draft.map((d) => ({ tile: d.blank ? { ...d.tile, assigned: d.letter } : d.tile, row: d.row, col: d.col }));
  const pv = game.preview(placements);
  if (pv.ok) {
    validNow = true; draft.forEach((d) => cellAt(d.row, d.col).classList.add('validword'));
    showPreviewBadge(pv); message(`${pv.words.join(', ')} — tap Submit`);
  } else message(pv.error || 'Keep building…', true);
}
function showPreviewBadge(pv) {
  const rects = draft.map((d) => cellAt(d.row, d.col).getBoundingClientRect());
  const cx = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / rects.length;
  const top = Math.min(...rects.map((r) => r.top));
  let b = $('previewbadge'); if (!b) { b = document.createElement('div'); b.id = 'previewbadge'; b.className = 'previewbadge'; $('fx').appendChild(b); }
  b.innerHTML = `+${pv.score}${pv.isBingo ? ' <small>BINGO</small>' : ''}`;
  b.style.left = cx + 'px'; b.style.top = top + 'px';
}
function clearPreviewBadge() { $('previewbadge')?.remove(); }

// ---------- blank picker ----------
let blankResolver = null;
function openBlankPicker() { $('blankpicker').classList.remove('hidden'); return new Promise((res) => { blankResolver = res; }); }
function resolveBlank(letter) { $('blankpicker').classList.add('hidden'); const r = blankResolver; blankResolver = null; if (r) r(letter); }

// ---------- hint ----------
function onHint() {
  clearHint();
  const best = game.playerBest();
  if (!best) { message('No legal moves — try Swap.', true); return; }
  hint = best; renderBoard();
  message(`Try <b>${best.words.join(', ')}</b> (+${best.score})`);
}
function clearHint() { if (hint) { hint = null; renderBoard(); } }

// ---------- controls ----------
function recallAll() { draft = []; tapSelected = null; clearHint(); renderAll(); refreshFeedback(); }
function shuffleRack() {
  clearHint();
  for (let i = rackOrder.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rackOrder[i], rackOrder[j]] = [rackOrder[j], rackOrder[i]]; }
  shownIds = new Set(); renderRack(); sfx.pickup();
}
function onPass() { if (!confirm('Pass your turn?')) return; recallAll(); game.pass(); afterPlayer(); }

// swap-select mode (#13)
function enterSwap() {
  if (game.state.bag.length < 1) { message('No tiles left to swap.', true); return; }
  recallAll(); swapMode = true; swapSel = new Set(); tapSelected = null;
  $('controls').classList.add('hidden'); $('swapbar').classList.remove('hidden');
  $('swapConfirm').textContent = 'Swap 0'; message('Tap tiles to exchange, then confirm.');
  renderRack();
}
function toggleSwap(id) { swapSel.has(id) ? swapSel.delete(id) : swapSel.add(id); $('swapConfirm').textContent = `Swap ${swapSel.size}`; renderRack(); }
function confirmSwap() {
  const tiles = game.state.racks.player.filter((t) => swapSel.has(t.id));
  if (!tiles.length) { message('Pick at least one tile.', true); return; }
  if (game.state.bag.length < tiles.length) { message('Not enough tiles left to swap that many.', true); return; }
  game.swap(tiles); exitSwap(); syncRack(); renderAll(); afterPlayer();
}
function exitSwap() { swapMode = false; swapSel = new Set(); exitSwapUI(); renderAll(); }
function exitSwapUI() { $('controls').classList.remove('hidden'); $('swapbar').classList.add('hidden'); }

function onSubmit() {
  if (busy || !draft.length || !validNow) return;
  clearHint();
  const placements = draft.map((d) => ({ tile: d.blank ? { ...d.tile, assigned: d.letter } : d.tile, row: d.row, col: d.col }));
  const res = game.commit(placements);
  if (!res.ok) {
    message(res.error, true); sfx.invalid(); if (settings.haptics) haptic([15, 40, 15]);
    draft.forEach((d) => { const t = cellAt(d.row, d.col).querySelector('.tile'); if (t && !reduced()) { t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); } });
    return;
  }
  const move = res.move, before = game.state.scores.player - move.score;
  draft = []; validNow = false; tapSelected = null;
  clearPreviewBadge(); cells.forEach((c) => c.classList.remove('validword'));
  syncRack(); renderBoard(); renderBag(); renderRack();
  landTiles(move.placements);
  animateCount($('scorePlayer').querySelector('.pts'), before, game.state.scores.player);
  celebrate(move, 'player'); renderLastMoves();
  afterPlayer();
}

// ---------- bot flow ----------
function afterPlayer() {
  syncRack(); renderAll();
  if (game.state.over) return endGame();
  busy = true; renderControls(); message('ScawBot is thinking…');
  setTimeout(botMove, 480);
}
function botMove() {
  const move = game.botTurn();
  renderBoard(); renderBag(); renderLastMoves();
  if (move) {
    const before = game.state.scores.bot - move.score;
    landTiles(move.placements);
    animateCount($('scoreBot').querySelector('.pts'), before, game.state.scores.bot);
    celebrate(move, 'bot');
    message(`ScawBot played ${move.words.join(', ')} — +${move.score}${move.isBingo ? ' · BINGO!' : ''}  ·  Your move.`);
  } else message('ScawBot passed.  ·  Your move.');
  busy = false; syncRack(); renderAll();
  if (game.state.over) endGame();
}

// ---------- feel ----------
function landTiles(placements) {
  if (reduced()) return;
  placements.forEach((p, i) => { const t = cellAt(p.row, p.col).querySelector('.tile'); if (t) { t.style.animationDelay = (i * 45) + 'ms'; t.classList.add('land'); sfx.tick(i); } });
}
function celebrate(move, who) {
  const rects = move.placements.map((p) => cellAt(p.row, p.col).getBoundingClientRect());
  const cx = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / rects.length;
  const cy = rects.reduce((s, r) => s + r.top + r.height / 2, 0) / rects.length;
  const chip = document.createElement('div'); chip.className = 'scorechip'; chip.textContent = `+${move.score}`;
  chip.style.left = cx + 'px'; chip.style.top = cy + 'px'; $('fx').appendChild(chip);
  requestAnimationFrame(() => chip.classList.add('rise')); setTimeout(() => chip.remove(), 1100);
  if (move.isBingo) { burst(cx, cy); sfx.bingo(); if (settings.haptics && who === 'player') haptic([20, 30, 40]); } else sfx.score();
}
function burst(x, y) {
  if (reduced()) return;
  for (let i = 0; i < 24; i++) {
    const d = document.createElement('div'); const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 75;
    const hue = [10, 165, 45, 195][i % 4];
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:8px;height:8px;border-radius:3px;z-index:115;background:hsl(${hue + Math.random() * 20},75%,62%);pointer-events:none;transition:transform .75s cubic-bezier(.2,.8,.3,1),opacity .75s;`;
    $('fx').appendChild(d);
    requestAnimationFrame(() => { d.style.transform = `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) rotate(${Math.random() * 360}deg)`; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 800);
  }
}
function animateCount(el, from, to) {
  if (reduced() || from === to) { el.textContent = to; return; }
  const start = performance.now();
  const step = (now) => { const k = Math.min(1, (now - start) / 420); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function syncRack() {
  const ids = game.state.racks.player.map((t) => t.id);
  rackOrder = rackOrder.filter((id) => ids.includes(id));
  for (const id of ids) if (!rackOrder.includes(id)) rackOrder.push(id);
}

// ---------- move log ----------
function openLog() {
  const rows = game.state.history.slice().reverse().map((h) => {
    const who = h.by === 'player' ? 'You' : 'ScawBot';
    const what = h.pass ? 'passed' : h.swap ? `swapped ${h.swap}` : h.words.join(', ');
    return `<div class="logrow ${h.by}"><span><span class="lwho">${who}</span><br><span class="lw">${what}</span></span><span class="ls">${h.score ? '+' + h.score : ''}</span></div>`;
  }).join('');
  $('logbody').innerHTML = rows || '<div class="msg">No moves yet.</div>';
  $('movelog').classList.remove('hidden');
}

// ---------- settings (#12) ----------
function buildSettings() {
  const seg = (key, val, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${val === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  $('setlist').innerHTML = `
    <div class="setrow"><span>Sound</span><button class="toggle ${settings.sound ? 'on' : ''}" data-key="sound"></button></div>
    <div class="setrow"><span>Haptics</span><button class="toggle ${settings.haptics ? 'on' : ''}" data-key="haptics"></button></div>
    <div class="setrow"><span>Motion</span>${seg('motion', settings.motion, [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']])}</div>
    <div class="setrow"><span>Theme</span>${seg('theme', settings.theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
    <div class="setrow"><span>Difficulty</span>${seg('difficulty', difficulty, [['casual', 'Casual'], ['skilled', 'Skilled'], ['expert', 'Expert'], ['brutal', 'Brutal']])}</div>`;
}
function onSettingChange(e) {
  const tgl = e.target.closest('.toggle');
  if (tgl) { const k = tgl.dataset.key; settings[k] = !settings[k]; if (k === 'sound') setSound(settings.sound); saveSettings(); buildSettings(); return; }
  const b = e.target.closest('.seg button'); if (!b) return;
  const key = b.parentElement.dataset.key, val = b.dataset.v;
  if (key === 'difficulty') { difficulty = val; settings.difficulty = val; buildDiffRow(); }
  else settings[key] = val;
  if (key === 'theme') applyTheme();
  saveSettings(); buildSettings();
}
function applyTheme() { const t = settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

// ---------- end / analysis ----------
function endGame() {
  busy = false; exitSwapUI();
  const s = game.state.scores, won = s.player > s.bot, r = game.review();
  $('analysis').innerHTML = `
    <h2>${won ? 'You win! 🎉' : s.player === s.bot ? "It's a draw" : 'ScawBot wins'}</h2>
    <div class="msg">Final — You ${s.player} · ScawBot ${s.bot}</div>
    <div class="ratings">
      <div class="rating"><div class="big">${r.strategy}%</div><div class="lbl">Strategy</div></div>
      <div class="rating"><div class="big">${r.luck}%</div><div class="lbl">Luck</div></div>
    </div>
    <div class="msg">Best play: <b>${r.bestPlay.words ? r.bestPlay.words.join(', ') : '—'}</b> (+${r.bestPlay.actual ?? 0})</div>
    <div class="turnlist">${r.turns.map((t) => `<div class="turnrow"><span class="w">${(t.words || []).join(', ') || '—'}</span><span class="${t.actual >= t.best ? 'ok' : 'miss'}">${t.actual} ${t.actual >= t.best ? '✓' : `/ best ${t.best} (${t.bestWords.join(',')})`}</span></div>`).join('')}</div>
    <button class="btn primary" id="againBtn" style="width:min(88vw,320px)">Home</button>`;
  showScreen('analysis');
  $('againBtn').addEventListener('click', () => { showScreen('home'); renderStreak(); });
  recordResult(won);
}

// ---------- storage ----------
function loadSettings() { const d = { sound: true, haptics: true, motion: 'auto', theme: 'auto', difficulty: 'expert' }; try { const s = { ...d, ...JSON.parse(localStorage.getItem('scawble.settings') || '{}') }; difficulty = s.difficulty || 'expert'; return s; } catch { return d; } }
function saveSettings() { try { localStorage.setItem('scawble.settings', JSON.stringify(settings)); } catch {} }
function stats() { try { return JSON.parse(localStorage.getItem('scawble.stats') || '{}'); } catch { return {}; } }
function recordResult(won) {
  const s = stats(); s.games = (s.games || 0) + 1; s.wins = (s.wins || 0) + (won ? 1 : 0);
  s.streak = won ? (s.streak || 0) + 1 : 0; s.best = Math.max(s.best || 0, s.streak);
  try { localStorage.setItem('scawble.stats', JSON.stringify(s)); } catch {}
}
function renderStreak() { const s = stats(); $('streak').innerHTML = s.games ? `Streak <b>${s.streak || 0}</b> · Best <b>${s.best || 0}</b> · ${s.wins || 0}/${s.games} won` : 'Your first game awaits.'; }

// boot once all module bindings exist
init();
