// MTOK2 — canvas keyboard (WO-ui).
// Renders the TouchOSC staircase from Tuning.keyboard(scaleId, {dplusRadio}):
// each key's `row` (sub | main | lo | med | hi) picks a vertical band, its
// noteKey picks a column, its `type` (nat | acc | qt) picks width + color.
// NOT the PoC's flat piano — but the PoC's hit-testing, legato, XY-drag, glow,
// dual pointer/touch handling and iOS quirk workarounds are ported verbatim.
//
// Keys drive Engine.noteOn / noteOff / updateXY. No audio nodes here.

import { P } from './state.js?v=6';
import { Tuning } from './tuning.js?v=6';
import Engine from './engine.js?v=6';

// Column width units by key type, and the vertical band map. Bands are
// fractions of keyboard height; a column's topmost element stretches to 0 and
// its lowest non-sub element stretches to MAIN_BOTTOM, so the staircase has
// no gaps whatever subset of rows a given note actually has.
const COL_UNITS = { nat: 1.6, acc: 1.15, qt: 1.0 };
const BAND = { hi: 0.00, med: 0.16, lo: 0.32, main: 0.48 };
const BAND_ORDER = ['hi', 'med', 'lo', 'main'];
const MAIN_BOTTOM = 0.82;
const UNIT_PX = 42;                       // qt pads land at 42px, naturals at 67
const MIN_TOUCH = 40;                     // acceptance floor for finger targets

const KC = {
  nat: { bg: ['#252838', '#1e2030'], act: ['#2a5cb8', '#1a3c7a'], txt: '#9898bc', brd: '#000008' },
  acc: { bg: ['#0f1020', '#0a0b16'], act: ['#1e4898', '#122c60'], txt: '#6a6a86', brd: '#000004' },
  qt:  { bg: ['#1e1a0c', '#161208'], act: ['#6a4010', '#3a2008'], txt: '#c09848', brd: '#080400' },
};

let cv, cx, dpr = 1, wrap;
let keyRects = [];
let logicalW = 0, logicalH = 0;
let fitMode = false;                      // true = squeeze all 3 octaves in view

// Live touches. Two maps because iOS Safari has historically fired one family
// or the other, never reliably both — PoC pattern, kept verbatim.
const voiceKeys = new Map();              // pointerId -> rect
const touchKeys = new Map();              // touch.identifier -> rect
let pointerEventsWorking = false;

// ═══════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════

function buildKeyRects(W, H) {
  const scaleId = Tuning.SCALES[P.get('radioScale')] || 'alpha';
  const keys = Tuning.keyboard(scaleId, { dplusRadio: P.get('dplusRadio') });

  // Columns in encounter order; each holds every pad of one noteKey.
  const cols = new Map();
  for (const k of keys) {
    if (!cols.has(k.noteKey)) cols.set(k.noteKey, { keys: [], type: k.type, oct: k.oct });
    cols.get(k.noteKey).keys.push(k);
  }

  const unitPx = fitMode
    ? W / [...cols.values()].reduce((s, c) => s + COL_UNITS[c.type], 0)
    : UNIT_PX;

  const rects = [];
  let x = 0;
  for (const [, col] of cols) {
    const w = COL_UNITS[col.type] * unitPx;

    const sub = col.keys.find(k => k.row === 'sub');
    const stack = col.keys
      .filter(k => k.row !== 'sub')
      .sort((a, b) => BAND_ORDER.indexOf(a.row) - BAND_ORDER.indexOf(b.row));

    stack.forEach((k, i) => {
      const top = i === 0 ? 0 : BAND[k.row] * H;
      const bottom = i === stack.length - 1 ? MAIN_BOTTOM * H : BAND[stack[i + 1].row] * H;
      rects.push(mkRect(k, x, top, w, bottom - top, col.oct));
    });

    if (sub) rects.push(mkRect(sub, x, MAIN_BOTTOM * H, w, (1 - MAIN_BOTTOM) * H, col.oct));

    x += w;
  }
  logicalW = x;
  return rects;
}

function mkRect(k, x, y, w, h, oct) {
  return {
    x, y, w, h, key: k, type: k.type, row: k.row, oct,
    octStart: k.noteKey === 'c' + oct || (oct === 0 && k.noteKey === 'e0'),
    active: false, modAmt: 0,
  };
}

// ═══════════════════════════════════════════════════════════
// INIT / DRAW
// ═══════════════════════════════════════════════════════════

export function initKeyboard(canvasEl, wrapEl) {
  cv = canvasEl; wrap = wrapEl;
  cv.addEventListener('pointerdown', onDown, { passive: false });
  cv.addEventListener('pointermove', onMove, { passive: false });
  cv.addEventListener('pointerup', onUp, { passive: false });
  cv.addEventListener('pointercancel', onUp, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // Capture-phase touchstart: iOS treats it as a trusted gesture for resume()
  cv.addEventListener('touchstart', () => Engine.unlock && Engine.unlock(), { passive: true, capture: true });
  cv.addEventListener('touchstart', onTouchStart, { passive: false });
  cv.addEventListener('touchmove', onTouchMove, { passive: false });
  cv.addEventListener('touchend', onTouchEnd, { passive: false });
  cv.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // Re-render when the scale model changes underneath us.
  P.sub('radioScale', () => resizeKeyboard());
  P.sub('dplusRadio', () => resizeKeyboard());

  resizeKeyboard();
  // Tuning's beta/gamma JSON resolves async; redraw once it lands.
  if (Tuning.ready?.then) Tuning.ready.then(() => resizeKeyboard()).catch(() => {});
}

export function resizeKeyboard() {
  if (!cv || !wrap) return;
  dpr = window.devicePixelRatio || 1;
  // wrap.clientHeight can read 0 in the first frame on iPadOS (flex not settled)
  logicalH = Math.max(wrap.clientHeight || 0, 220);

  keyRects = buildKeyRects(wrap.clientWidth || 1180, logicalH);

  cv.style.width = logicalW + 'px';
  cv.style.height = logicalH + 'px';
  cv.width = Math.round(logicalW * dpr);
  cv.height = Math.round(logicalH * dpr);
  cx = cv.getContext('2d');
  cx.scale(dpr, dpr);                    // safe: setting .width reset ctx state
  drawKeyboard();
  // Open on the middle octave, where two hands land naturally.
  requestAnimationFrame(() => { if (!fitMode) wrap.scrollLeft = logicalW / 3; });
}

export function setFitMode(on) { fitMode = !!on; resizeKeyboard(); }
export function isFitMode() { return fitMode; }

// Smallest rendered touch target — reported by the boot audit.
export function smallestTarget() {
  return keyRects.reduce((m, r) => Math.min(m, r.w, r.h), Infinity);
}

export function drawKeyboard() {
  if (!cx) return;
  cx.clearRect(0, 0, logicalW, logicalH);
  // Paint order = hit order reversed: naturals first, pads on top.
  for (const layer of ['nat', 'acc', 'qt']) {
    keyRects.filter(r => r.type === layer).forEach(drawKey);
  }
}

function drawKey(r) {
  const { x, y, w, h, active, modAmt, type } = r;
  const col = KC[type], c = cx;
  const [t0, t1] = active ? col.act : col.bg;
  const gr = c.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, t0); gr.addColorStop(1, t1);

  const rad = type === 'nat' ? 4 : 2;
  c.fillStyle = gr;
  c.beginPath();
  c.moveTo(x + 0.5, y);
  c.lineTo(x + w - 0.5, y);
  c.lineTo(x + w - 0.5, y + h - rad);
  c.arcTo(x + w - 0.5, y + h, x + w - 0.5 - rad, y + h, rad);
  c.lineTo(x + 0.5 + rad, y + h);
  c.arcTo(x + 0.5, y + h, x + 0.5, y + h - rad, rad);
  c.closePath();
  c.fill();
  c.strokeStyle = col.brd; c.lineWidth = 1; c.stroke();

  if (r.octStart) {
    c.strokeStyle = '#5a5a88'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x + 1, y); c.lineTo(x + 1, y + h); c.stroke();
  }

  const glow = type === 'qt' ? 'rgba(212,168,67,' : 'rgba(74,158,255,';
  if (active) {
    const g = c.createLinearGradient(x, y + h, x, y);
    g.addColorStop(0, glow + '0.35)'); g.addColorStop(1, glow + '0.0)');
    c.fillStyle = g; c.fillRect(x, y, w, h);
  }
  if (modAmt > 0) {                          // per-key XY drag depth
    const mh = h * modAmt;
    const g = c.createLinearGradient(x, y + h, x, y + h - mh);
    g.addColorStop(0, glow + '0.5)'); g.addColorStop(1, glow + '0.05)');
    c.fillStyle = g; c.fillRect(x, y + h - mh, w, mh);
  }

  // Labels: pitch name always, ratio on the roomy rows only.
  c.textAlign = 'center';
  c.fillStyle = active ? '#ffffff' : col.txt;
  c.font = `500 ${type === 'nat' ? 10 : 8}px "JetBrains Mono",ui-monospace,monospace`;
  c.textBaseline = 'top';
  if (h > 22) c.fillText(r.key.label, x + w / 2, y + 5);
  if (h > 52 && w > 34) {
    c.fillStyle = active ? 'rgba(255,255,255,0.5)' : 'rgba(160,160,200,0.28)';
    c.font = '300 7px "JetBrains Mono",ui-monospace,monospace';
    c.textBaseline = 'bottom';
    c.fillText(r.key.ratioStr, x + w / 2, y + h - 4);
  }
}

// ═══════════════════════════════════════════════════════════
// HIT TEST — pads win over the big keys they overlap (they don't overlap in
// this layout, but the reversed-layer walk keeps PoC parity if they ever do).
// ═══════════════════════════════════════════════════════════

function hitTest(lx, ly) {
  for (const layer of ['qt', 'acc', 'nat']) {
    const hits = keyRects.filter(r =>
      r.type === layer && lx >= r.x && lx < r.x + r.w && ly >= r.y && ly < r.y + r.h);
    if (hits.length) return hits[hits.length - 1];
  }
  return null;
}

// Wrapper BCR + scrollLeft, never the canvas BCR: iPad Safari can return wrong
// values for a child element inside a horizontally-scrolled container. (PoC)
function canvasXY(clientX, clientY) {
  const b = wrap.getBoundingClientRect();
  return { lx: clientX - b.left + wrap.scrollLeft, ly: clientY - b.top };
}

// Normalized 0-1 position within the key that was struck — Engine.updateXY's
// contract (y screen-down; the engine flips it).
function localXY(rect, lx, ly) {
  return {
    x: Math.max(0, Math.min(1, (lx - rect.x) / rect.w)),
    y: Math.max(0, Math.min(1, (ly - rect.y) / rect.h)),
  };
}

// ═══════════════════════════════════════════════════════════
// NOTE PLUMBING
// ═══════════════════════════════════════════════════════════

let onVoiceChange = () => {};
export function setVoiceChangeHandler(fn) { onVoiceChange = fn; }

function strike(rect, id, lx, ly) {
  const { x, y } = localXY(rect, lx, ly);
  rect.active = true;
  rect.modAmt = 0;
  try {
    Engine.noteOn(id, rect.key.freq, { x, y });
  } catch (err) {
    rect.active = false;                     // roll the visual back if synth failed
    console.error('[kb] noteOn:', err);
    return false;
  }
  onVoiceChange();
  return true;
}

function drag(rect, id, lx, ly) {
  const { x, y } = localXY(rect, lx, ly);
  Engine.updateXY(id, x, y);
  const dx = x - 0.5, dy = y - 0.5;
  rect.modAmt = Math.min(1, Math.hypot(dx, dy) * 2);
}

function lift(rect, id) {
  Engine.noteOff(id);
  rect.active = false;
  rect.modAmt = 0;
  onVoiceChange();
}

// ── pointer family ──────────────────────────────────────────

function onDown(e) {
  e.preventDefault();
  if (e.pointerType === 'touch') pointerEventsWorking = true;
  const { lx, ly } = canvasXY(e.clientX, e.clientY);
  const rect = hitTest(lx, ly);
  if (!rect) return;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  // Force Touch can fire a second pointerdown for the same id — release first.
  const prev = voiceKeys.get(e.pointerId);
  if (prev) lift(prev, 'p' + e.pointerId);
  if (strike(rect, 'p' + e.pointerId, lx, ly)) voiceKeys.set(e.pointerId, rect);
  drawKeyboard();
}

function onMove(e) {
  const rect = voiceKeys.get(e.pointerId);
  if (!rect) return;
  e.preventDefault();
  const { lx, ly } = canvasXY(e.clientX, e.clientY);
  drag(rect, 'p' + e.pointerId, lx, ly);
  drawKeyboard();
}

function onUp(e) {
  const rect = voiceKeys.get(e.pointerId);
  if (!rect) return;
  e.preventDefault();
  lift(rect, 'p' + e.pointerId);
  voiceKeys.delete(e.pointerId);
  drawKeyboard();
}

// ── touch family (only when pointer events are not firing) ──

function onTouchStart(e) {
  if (pointerEventsWorking) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (touchKeys.has(t.identifier)) continue;
    const { lx, ly } = canvasXY(t.clientX, t.clientY);
    const rect = hitTest(lx, ly);
    if (!rect) continue;
    if (strike(rect, 't' + t.identifier, lx, ly)) touchKeys.set(t.identifier, rect);
  }
  drawKeyboard();
}

function onTouchMove(e) {
  if (pointerEventsWorking) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const rect = touchKeys.get(t.identifier);
    if (!rect) continue;
    const { lx, ly } = canvasXY(t.clientX, t.clientY);
    drag(rect, 't' + t.identifier, lx, ly);
  }
  drawKeyboard();
}

function onTouchEnd(e) {
  if (pointerEventsWorking) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const rect = touchKeys.get(t.identifier);
    if (!rect) continue;
    lift(rect, 't' + t.identifier);
    touchKeys.delete(t.identifier);
  }
  drawKeyboard();
}

// Safety net: a finger that slides off the canvas and lifts elsewhere still
// releases its note (PoC globalPointerUp).
export function releaseAllVisuals() {
  voiceKeys.forEach((rect, id) => lift(rect, 'p' + id));
  touchKeys.forEach((rect, id) => lift(rect, 't' + id));
  voiceKeys.clear(); touchKeys.clear();
  keyRects.forEach(r => { r.active = false; r.modAmt = 0; });
  drawKeyboard();
}

export function globalPointerUp(e) {
  const rect = voiceKeys.get(e.pointerId);
  if (!rect) return;
  lift(rect, 'p' + e.pointerId);
  voiceKeys.delete(e.pointerId);
  drawKeyboard();
}

export const KB = { MIN_TOUCH };
