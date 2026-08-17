// MTOK2 v2b — full-fidelity surface assembly + boot (CC, 2026-08-16).
// Every control is placed from mtok-layout.json — machine-extracted frames,
// colors, and label text from David's own TouchOSC file (mtok_adsr_2026-03-15
// .tosc, 860×640 canvas) — scaled to the viewport and letterboxed. The zone
// grid of v2a is gone; the keyboard canvas underlays the whole stage and the
// DOM widgets float above it at their original coordinates.
//
// Params invented AFTER TouchOSC (lpq, noiseType, chordMode, keyXY togs,
// pedal, tempo, granular sources…) have no home in the original geometry —
// they live in the two letterbox margin strips, explicitly marked as
// post-TouchOSC, until David re-places them.

import { P, SOURCES } from './state.js?v=7';
import { Tuning } from './tuning.js?v=7';
import Engine from './engine.js?v=7';
import FX from './fx.js?v=7';
import { Modes } from './modes.js?v=7';
import Capture from './capture.js?v=7';
import { Dial, Fader, Radio, Toggle, XYPad, Dead, Btn, BOUND, el, blurLater } from './ui-controls.js?v=7';
import * as KB from './ui-keyboard.js?v=7';
import { Layout, CANVAS } from './ui-layout.js?v=7';

const SRC_COLOR = {
  saw: '#e05a7a', pwm: '#e0b040', tri: '#7b5ce0',
  sin: '#c8ccdd', wt: '#40c8c0', noise: '#6fbf5a',
};
const YELLOW = '#d8b845', GREEN = '#5ab06a', PURPLE = '#9a6ad0', RED = '#c0392b';

// Tuning display names (David, 2026-08-16): C, D, Go, Qt — every scale's own
// fundamental, and all four land on a programming language. Internal ids stay
// alpha/beta/gamma/qt. tunings-mtok.json displayName overrides these.
const SCALE_FALLBACK = {
  alpha: { label: 'C',  title: 'C — 25-pad just intonation on C3' },
  beta:  { label: 'D',  title: 'D — upper row re-tuned over D/G' },
  gamma: { label: 'Go', title: 'Go — lattice transposed to a G fundamental' },
  qt:    { label: 'Qt', title: 'Qt — 24-EDO quartertone grid' },
};

const $ = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════
// LAYOUT → WIDGET MAPPING
// ═══════════════════════════════════════════════════════════

// .tosc control name → state.js param, where they differ.
const RENAMES = {
  gainFaderRed: 'gain', feedbackFaderPink: 'feedback',
  hpfader: 'hpf', lpfader: 'lpf', radialTanH: 'tanh',
  filtEnvDial: 'filtEnvAmt', ampEnvDial: 'ampEnvAmt',
  sqTup: 'pwmTup',            // the PWM source is 'sq' in the original tuplet row
};

// Non-key XY pads: name → [px, py, ptouch, color, label]
const XY_SPECIAL = {
  xyYellow1: ['xy1x', 'xy1y', 'xy1touch', YELLOW, 'xy 1'],
  xyYellow2: ['xy2x', 'xy2y', 'xy2touch', YELLOW, 'xy 2'],
  greenXY:   ['greenXYx', 'greenXYy', 'greenXYtouch', GREEN, 'green'],
  loblue:    ['loBluex', 'loBluey', 'loBluetouch', '#4a6ee0', 'G'],
  lopurp:    ['loPurpx', 'loPurpy', 'loPurptouch', PURPLE, 'C'],
};

// Radio option sets. Order = the ORIGINAL's visual order (radioScale runs
// qt→α top-to-bottom in the .tosc, hence the descending values).
function radioOptions(name) {
  switch (name) {
    case 'radioScale':
      return [3, 2, 1, 0].map(v => {
        const id = Tuning.SCALES[v];
        return {
          value: v,
          label: (window.__mtokNames?.[id]?.displayName) || SCALE_FALLBACK[id].label,
          badge: Tuning.isPlaceholder(id) ? '*' : null,
          title: SCALE_FALLBACK[id].title + (Tuning.isPlaceholder(id) ? ' — placeholder table' : ''),
        };
      });
    case 'radioMode':
      return [{ value: 0, label: 'arp' }, { value: 1, label: 'shm' },
              { value: 2, label: 'pls' }, { value: 3, label: 'def' }];
    case 'regSelect':
      return [{ value: 0, label: '−8' }, { value: 1, label: '0' },
              { value: 2, label: '+8' }, { value: 3, label: '+15' }];
    case 'dplusRadio':
      return [{ value: 0, label: '13' }, { value: 1, label: 'qt' }, { value: 2, label: '7' }];
    case 'yellowModRad': // original 3 modes here; granular 3-5 live in the aux strip
      return [{ value: 0, label: 'v/t' }, { value: 1, label: 'vrb' }, { value: 2, label: 'FM' }];
    case 'greenModRad':
      return [{ value: 0, label: 'tmp' }, { value: 1, label: 'draw' }, { value: 2, label: 'mod' }];
    case 'loBlueRad':
    case 'loPurpRad':
      return [{ value: 0, label: '1' }, { value: 1, label: '2' }, { value: 2, label: '3' }];
    case 'wavetableRadio':
      return [{ value: 0, label: '∿' }, { value: 1, label: 'sw' },
              { value: 2, label: 'sq' }, { value: 3, label: 'cx' }];
    case 'radioPreset':
      return Array.from({ length: 6 }, (_, i) => ({ value: i, label: String(i + 1), title: 'slot ' + (i + 1) }));
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════
// STAGE
// ═══════════════════════════════════════════════════════════

let S = 1;                                   // px per .tosc unit
let noiseRowMap = null;                      // radialN → noiseA/D/S/R/X/Y (by x order)
let presetRadioEl = null;

function abs(c, node) {
  const d = el('div', 'abs');
  d.style.left = (c.x * S) + 'px';
  d.style.top = (c.y * S) + 'px';
  d.style.width = (c.w * S) + 'px';
  d.style.height = (c.h * S) + 'px';
  if (node) d.append(node);
  return d;
}

function buildNoiseRowMap() {
  // radial2/5/10/15/20/25 are the unlabeled 6th ADSR row (noise) — assign
  // a/d/s/r/x/y positionally by x, not by trusting the numeric suffixes.
  const row = Layout.all()
    .filter(c => /^radial(2|5|10|15|20|25)$/.test(c.name || ''))
    .sort((a, b) => a.x - b.x);
  noiseRowMap = new Map(row.map((c, i) => [c.name + '@' + c.x, 'noise' + ['A', 'D', 'S', 'R', 'X', 'Y'][i]]));
}

function paramFor(c) {
  const n = c.name || '';
  if (noiseRowMap.has(n + '@' + c.x)) return noiseRowMap.get(n + '@' + c.x);
  if (RENAMES[n]) return RENAMES[n];
  return P.names().includes(n) ? n : null;
}

const seenNames = new Set();                 // duplicate names (tog33 ×2): first binds

function widgetFor(c) {
  const name = c.name || '';
  const color = c.color || '#8a8ab0';
  const vertical = c.h > c.w;
  const dup = seenNames.has(name);
  seenNames.add(name);

  if (c.type === 'LABEL' || c.type === 'TEXT') {
    if (/S\s*C\s*R\s*A\s*M/.test(c.text || '')) {  // the SCRAM label IS the panic surface
      return Btn({ label: 'SCRAM', cls: 'scram', color: RED,
        onTap: () => { KB.releaseAllVisuals(); panicAll(); updateVoiceCount(); } });
    }
    const d = el('div', 'lab', c.text || '');
    d.style.color = color;
    d.style.fontSize = Math.max(7, Math.min(13, c.h * S * 0.62)) + 'px';
    return d;
  }

  if (c.type === 'XY') {
    const sp = XY_SPECIAL[name];
    if (sp) return XYPad({ px: sp[0], py: sp[1], ptouch: sp[2], color: sp[3], label: sp[4] });
    return Dead({ label: name, why: 'unassigned in original layout', color: '#555' }); // xy5
  }

  if (c.type === 'RADIAL') {
    const p = paramFor(c);
    if (!p) return Dead({ label: name, why: 'unmapped', color });
    return Dial({ param: p, label: '', color, size: Math.min(c.w, c.h) * S,
                  ...(p === 'tempo' ? { min: 40, max: 240, int: true } : {}) });
  }

  if (c.type === 'FADER') {
    const p = paramFor(c);
    if (!p) return Dead({ label: name, why: 'unmapped', color });
    return Fader({ param: p, label: '', color, vertical });
  }

  if (c.type === 'BUTTON') {
    if (name === 'recButt') return recButton(color);
    if (name === 'undoButton') return Btn({ label: '↺', color,
      onTap: () => Capture.triggerUndo() });
    if (name === 'mlButton') return Dead({ label: 'ML', why: 'ML — wave 3', color });
    const p = !dup && /^tog/.test(name) && P.names().includes(name) ? name : null;
    if (p) return Toggle({ param: p, label: name.replace(/^tog/, '').replace('P5qs', 'P5↑'), color });
    return Dead({ label: '·', why: name + ' — unassigned in original', color: '#555' });
  }

  if (c.type === 'RADIO') {
    if (dup) return Dead({ label: '·', why: name + ' (duplicate)', color: '#555' });
    const opts = radioOptions(name);
    if (!opts) return Dead({ label: name, why: 'unmapped', color });
    const r = Radio({ param: name, color, vertical, options: opts });
    if (name === 'radioPreset') presetRadioEl = r;
    return r;
  }

  return Dead({ label: name, why: c.type, color });
}

function recButton(color) {
  const rec = el('button', 'tog');
  rec.type = 'button';
  rec.style.setProperty('--dc', color || RED);
  rec.append(el('span', null, 'REC'));
  rec.addEventListener('click', () => {
    const on = !rec.classList.contains('on');
    rec.classList.toggle('on', on);
    Capture.setRecButt(on ? 1 : 0);  // rising edge arms, falling edge finalizes
    blurLater(rec);
  });
  return rec;
}

function buildStage() {
  const stage = $('stage');
  const wrapEl = $('stage-wrap');
  const availW = wrapEl.clientWidth, availH = wrapEl.clientHeight;
  S = Math.min(availW / CANVAS.w, availH / CANVAS.h);
  stage.style.width = (CANVAS.w * S) + 'px';
  stage.style.height = (CANVAS.h * S) + 'px';

  // rebuild from scratch (resize/orientation): drop stale widget registrations
  BOUND.clear();
  seenNames.clear();
  presetRadioEl = null;
  const layer = $('controls');
  layer.textContent = '';
  buildNoiseRowMap();

  for (const c of Layout.all()) {
    // Every XY that isn't a named special is a key — the canvas owns it.
    if (c.type === 'XY' && !(c.name in XY_SPECIAL) && c.name !== 'xy5') continue;
    layer.append(abs(c, widgetFor(c)));
  }
  // The panic surface must always win the z-order — an unassigned original
  // button ('·' Dead) overlaps the SCRAM frame and would steal taps.
  const scram = layer.querySelector('.btn.scram');
  if (scram) scram.parentElement.style.zIndex = '5';
  buildAux();
  markPresetSlots();
}

// ═══════════════════════════════════════════════════════════
// AUX STRIPS — post-TouchOSC params, letterbox margins
// ═══════════════════════════════════════════════════════════

function auxItem(label, node) {
  const d = el('div', 'aux-item');
  if (label) d.append(el('div', 'aux-l', label));
  d.append(node);
  return d;
}

function buildAux() {
  const L = $('aux-left'), R = $('aux-right');
  L.textContent = ''; R.textContent = '';
  L.append(
    auxItem('pedal', Toggle({ param: 'pedal', label: '▁', color: GREEN, momentary: true })),
    auxItem('keyXY', el('div', 'aux-col')),
  );
  const kx = L.querySelector('.aux-col');
  kx.append(
    Toggle({ param: 'keyXYFilter', label: 'flt', color: '#c0553a' }),
    Toggle({ param: 'keyXYVib', label: 'vib', color: YELLOW }),
    Toggle({ param: 'keyXYDrive', label: 'drv', color: RED }),
  );
  L.append(
    auxItem('style', Radio({ param: 'keyXYStyle', color: '#8a8ab0', vertical: true,
      options: [{ value: 0, label: 'rel' }, { value: 1, label: 'abs', title: 'spec pending — inert' }] })),
    auxItem('chord', Radio({ param: 'chordMode', color: '#4a8ee0', vertical: true,
      options: [{ value: 0, label: 'hrm' }, { value: 1, label: 'drn' }] })),
  );
  R.append(
    auxItem('Q', Dial({ param: 'lpq', label: '', color: '#c0553a', size: 38 })),
    // 'rolloff' exists only as a label strip in the .tosc — no control behind it
    auxItem('rolloff', Dial({ param: 'rolloff', label: '', color: PURPLE, size: 38 })),
    auxItem('noise', Radio({ param: 'noiseType', color: SRC_COLOR.noise, vertical: true,
      options: [{ value: 0, label: 'wht' }, { value: 1, label: 'pnk' }, { value: 2, label: 'brn' }] })),
    auxItem('nzLev', Dial({ param: 'noiseLev', label: '', color: SRC_COLOR.noise, size: 38 })),
    auxItem('nzTup', Dial({ param: 'noiseTup', label: '', color: SRC_COLOR.noise, size: 38, min: 0, max: 7, int: true })),
    auxItem('wtTup', Dial({ param: 'wtTup', label: '', color: SRC_COLOR.wt, size: 38, min: 0, max: 7, int: true })),
    auxItem('BPM', Dial({ param: 'tempo', label: '', color: '#4a8ee0', size: 38, min: 40, max: 240, int: true })),
    auxItem('gran', Radio({ param: 'yellowModRad', color: YELLOW, vertical: true,
      options: [{ value: 3, label: 'syn' }, { value: 4, label: 'mic' }, { value: 5, label: 'file' }] })),
    auxItem('preset', el('div', 'aux-col')),
  );
  const pr = R.querySelector('.aux-col:last-of-type');
  pr.append(
    Btn({ label: 'sv', color: '#a8b04a', onTap: savePreset }),
    Btn({ label: 'ld', color: '#a8b04a', onTap: loadPreset }),
  );
}

// ═══════════════════════════════════════════════════════════
// PRESETS (6 localStorage slots, shared with v2a on purpose)
// ═══════════════════════════════════════════════════════════

const slotKey = i => 'mtok2.preset.' + i;
const slotFilled = i => { try { return !!localStorage.getItem(slotKey(i)); } catch (_) { return false; } };

function markPresetSlots() {
  if (!presetRadioEl) return;
  presetRadioEl.querySelectorAll('.radio-btn').forEach((b, i) =>
    b.classList.toggle('filled', slotFilled(i)));
}

function savePreset() {
  try {
    localStorage.setItem(slotKey(P.get('radioPreset')), JSON.stringify(P.snapshot()));
    markPresetSlots();
  } catch (e) { console.warn('[mtok2] preset save failed:', e); }
}

function loadPreset() {
  const raw = (() => { try { return localStorage.getItem(slotKey(P.get('radioPreset'))); } catch (_) { return null; } })();
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    delete obj.radioPreset;      // never move the slot selector out from under the tap
    P.load(obj);
    KB.releaseAllVisuals();
    KB.resizeKeyboard();
  } catch (e) { console.warn('[mtok2] preset load failed:', e); }
}

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════

function updateCtxBadge() {
  const b = $('ctx-badge');
  if (!b) return;
  const s = Engine.ctx ? Engine.ctx.state : 'null';
  b.textContent = 'ctx:' + s;
  b.dataset.state = s;
}

function updateVoiceCount() {
  const b = $('voice-count');
  if (b) b.textContent = Engine.voiceCount() + ' v';
}

// yellowModRad is deliberately double-bound: the original 3-mode radio in the
// layout plus the post-TouchOSC granular sources (3-5) in the aux strip.
const MULTI_OK = new Set(['yellowModRad']);

function auditCoverage() {
  const unbound = [], multi = [];
  for (const name of P.names()) {
    const b = BOUND.get(name);
    if (!b || !b.length) unbound.push(name);
    else if (b.length > 1 && b[0].kind !== 'xy' && !MULTI_OK.has(name)) multi.push(name + '×' + b.length);
  }
  const smallest = KB.smallestTarget();
  const report = { unbound, multi, smallestKeyPx: Math.round(smallest) };
  console.info('[mtok2] param coverage:', P.names().length - unbound.length, '/', P.names().length,
    '| unbound:', unbound.length ? unbound.join(' ') : 'none',
    '| double-bound:', multi.length ? multi.join(' ') : 'none',
    '| smallest key:', report.smallestKeyPx + 'px');
  const badge = $('audit-badge');
  if (badge) {
    badge.textContent = `${P.names().length - unbound.length}/${P.names().length} bound`;
    badge.title = unbound.length ? 'unbound: ' + unbound.join(', ') : 'all params bound';
    badge.classList.toggle('warn', unbound.length > 0);
  }
  window.__mtokAudit = report;
  return report;
}

// PANIC CONTRACT (fx.js RESULTS deviation 2, extended by modes/capture):
// Engine.panic() severs every outgoing edge from voiceMix and rebuilds
// buses.master — FX.panic(), Modes.panic(), Capture.panic() MUST follow, in
// that order, every time. One function so no call site drifts.
function panicAll() { Engine.panic(); FX.panic(); Modes.panic(); Capture.panic(); }

async function startAudio() {
  const overlay = $('unlock');
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (_) {}
    await ctx.resume().catch(() => {});
    await Engine.init(ctx);
    FX.init(ctx, Engine.buses); // rack taps buses — must follow Engine.init
    Modes.init();               // needs Engine.tick + buses live
    Capture.init(ctx, Engine.buses);
    ctx.onstatechange = updateCtxBadge;
    updateCtxBadge();
    if (Engine.wavetableStubbed()) {
      const b = $('audit-badge');
      if (b) b.textContent += ' · wt stub';
    }
    overlay.classList.add('gone');
  } catch (err) {
    console.error('[mtok2] audio init failed:', err);
    overlay.querySelector('.unlock-sub').textContent = 'audio failed: ' + (err?.message || err);
  }
}

export async function boot() {
  try {
    const r = await fetch('./tunings-mtok.json');
    if (r.ok) window.__mtokNames = await r.json();
  } catch (_) {}
  await Layout.ready;

  buildStage();

  // Double-rAF: first frame starts layout, second measures it. iPadOS Safari
  // does not settle 100vh + flex in one frame. (PoC)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    KB.initKeyboard($('kb-canvas'), $('stage'));
    document.querySelectorAll('.xy').forEach(x => x._resize && x._resize());
    auditCoverage();
  }));

  KB.setVoiceChangeHandler(updateVoiceCount);

  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      KB.releaseAllVisuals();
      buildStage();
      KB.resizeKeyboard();
      document.querySelectorAll('.xy').forEach(x => x._resize && x._resize());
      auditCoverage();
    }, 250);
  });
  window.addEventListener('pointerup', KB.globalPointerUp, { passive: true });
  window.addEventListener('pointercancel', KB.globalPointerUp, { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { KB.releaseAllVisuals(); panicAll(); updateVoiceCount(); }
  });

  $('unlock').addEventListener('click', startAudio, { once: true });
  setInterval(updateVoiceCount, 250);

  // console access for debugging (Safari Web Inspector ↔ iPad) + test harnesses
  window.Engine = Engine; window.P = P; window.FX = FX;
  window.Modes = Modes; window.Capture = Capture;
}

boot();
