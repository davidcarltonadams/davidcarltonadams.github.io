// MTOK2 — control surface assembly + boot (WO-ui).
// Builds the zone layout, binds every widget to the param store, drives the
// keyboard, and runs the boot-time param-coverage audit.
//
// Checkpoint 1 (playable): layout, widgets, keyboard, boot flow, XY pads,
// chord toggles, filters, master. Deferred to pass 2 and listed by the audit:
// tuplet ratio dials, tempo, preset slots, green pots detail, REC/ML/undo.

import { P, SOURCES } from './state.js?v=6';
import { Tuning } from './tuning.js?v=6';
import Engine from './engine.js?v=6';
import FX from './fx.js?v=6';
import { Modes } from './modes.js?v=6';
import Capture from './capture.js?v=6';
import { Dial, Fader, Radio, Toggle, XYPad, Dead, Btn, BOUND, el, blurLater } from './ui-controls.js?v=6';
import * as KB from './ui-keyboard.js?v=6';

// TouchOSC color language (layout screenshot, 2026-01-29) — David's muscle
// memory is keyed to these hues, so they are load-bearing, not decoration.
const SRC_COLOR = {
  saw:   '#e05a7a',   // pink
  pwm:   '#e0b040',   // amber
  tri:   '#7b5ce0',   // violet
  sin:   '#c8ccdd',   // white/grey
  wt:    '#40c8c0',   // teal
  noise: '#6fbf5a',   // green (the unlabeled 6th ADSR row)
};
const SRC_LABEL = { saw: 'Saw', pwm: 'PWM', tri: 'Tri', sin: '∿', wt: 'WT', noise: 'Nz' };
const YELLOW = '#d8b845', GREEN = '#5ab06a', PURPLE = '#9a6ad0', ORANGE = '#d88a3a', RED = '#c0392b';

// Tuning display names (David, 2026-08-16). Internal ids stay alpha/beta/
// gamma/qt; nothing user-facing says them, because they collide with Wendy
// Carlos's scales. Each label is the scale's own fundamental, and all four
// land on a programming language — C, D, Go, Qt. `displayName` in
// tunings-mtok.json is the source of truth; this mirrors it so a missing or
// malformed JSON degrades to the right labels rather than to the old names.
const SCALE_FALLBACK = {
  alpha: { label: 'C',  title: 'C — 25-pad just intonation on C3' },
  beta:  { label: 'D',  title: 'D — upper row re-tuned over D/G' },
  gamma: { label: 'Go', title: 'Go — lattice transposed to a G fundamental' },
  qt:    { label: 'Qt', title: 'Qt — 24-EDO quartertone grid' },
};

const $ = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════
// ZONE BUILDERS
// ═══════════════════════════════════════════════════════════

function zone(id, title, cls = '') {
  const z = el('section', 'zone ' + cls);
  z.id = 'z-' + id;
  if (title) z.append(el('h2', 'zone-t', title));
  return z;
}

// Per-osc ADSR matrix: 6 rows (one per source, color-coded) × a/d/s/r/x/y.
function buildADSR() {
  const z = zone('adsr', null, 'z-adsr');
  const grid = el('div', 'adsr-grid');
  grid.append(el('div', 'adsr-corner', ''));
  for (const h of ['a', 'd', 's', 'r', 'x', 'y']) grid.append(el('div', 'adsr-head', h));
  for (const src of SOURCES) {
    const tag = el('div', 'adsr-src', SRC_LABEL[src]);
    tag.style.color = SRC_COLOR[src];
    grid.append(tag);
    for (const sfx of ['A', 'D', 'S', 'R', 'X', 'Y']) {
      grid.append(Dial({ param: src + sfx, label: '', color: SRC_COLOR[src], size: 44 }));
    }
  }
  z.append(grid);
  return z;
}

function buildTuning() {
  const z = zone('tuning', 'Tuning', 'z-tuning');
  z.append(Radio({
    param: 'radioScale', vertical: true, color: ORANGE,
    options: Tuning.SCALES.map((id, i) => ({
      value: i,
      label: (window.__mtokNames?.[id]?.displayName) || SCALE_FALLBACK[id].label,
      badge: Tuning.isPlaceholder(id) ? '*' : null,
      title: SCALE_FALLBACK[id].title + (Tuning.isPlaceholder(id) ? ' — placeholder table' : ''),
    })),
  }));
  z.append(Radio({
    param: 'dplusRadio', label: 'D+', color: ORANGE,
    options: [{ value: 0, label: '13' }, { value: 1, label: 'qt' }, { value: 2, label: '7' }],
  }));
  z.append(Dial({ param: 'tanh', label: 'tanh', color: GREEN, size: 44 }));
  return z;
}

function buildInstruments() {
  const z = zone('inst', 'Instruments', 'z-inst');
  const row = el('div', 'inst-row');
  for (const src of SOURCES) {
    const cell = el('div', 'inst-cell');
    cell.append(Dial({ param: src + 'Lev', label: SRC_LABEL[src], color: SRC_COLOR[src], size: 42 }));
    row.append(cell);
  }
  z.append(row);
  const wtRow = el('div', 'row');
  z.append(Fader({ param: 'faderPW', label: 'PW', color: SRC_COLOR.pwm }));
  wtRow.append(Fader({ param: 'wtFader', label: 'wavetable', color: SRC_COLOR.wt }));
  wtRow.append(Dial({ param: 'wth', label: 'wth', color: SRC_COLOR.wt, size: 40 }));
  z.append(wtRow);
  z.append(Radio({
    param: 'wavetableRadio', color: SRC_COLOR.wt,
    options: [
      { value: 0, label: '∿/saw' }, { value: 1, label: 'saw/sq' },
      { value: 2, label: 'sq/cplx' }, { value: 3, label: 'cplx/draw' },
    ],
  }));
  z.append(Radio({
    param: 'noiseType', color: SRC_COLOR.noise,
    options: [{ value: 0, label: 'wht' }, { value: 1, label: 'pnk' }, { value: 2, label: 'brn' }],
  }));
  return z;
}

function buildMode() {
  const z = zone('mode', 'Mode', 'z-mode');
  z.append(Radio({
    param: 'radioMode', vertical: true, color: '#4a8ee0',
    options: [
      { value: 0, label: 'arp' }, { value: 1, label: 'shm' },
      { value: 2, label: 'pls' }, { value: 3, label: 'def' },
    ],
  }));
  z.append(Dial({ param: 'ampEnvAmt', label: 'ampEnv', color: '#4a8ee0', size: 46 }));
  z.append(Dial({ param: 'filtEnvAmt', label: 'filtEnv', color: '#4a8ee0', size: 46 }));
  return z;
}

function buildYellow() {
  const z = zone('yellow', null, 'z-yellow');
  const pads = el('div', 'xy-pair');
  pads.append(XYPad({ px: 'xy1x', py: 'xy1y', ptouch: 'xy1touch', label: 'xy 1', color: YELLOW }));
  pads.append(XYPad({ px: 'xy2x', py: 'xy2y', ptouch: 'xy2touch', label: 'xy 2', color: YELLOW }));
  z.append(pads);
  z.append(Radio({
    param: 'yellowModRad', color: YELLOW,
    options: [{ value: 0, label: 'vib/trem' }, { value: 1, label: 'verb' }, { value: 2, label: 'FM' },
              // 3-5 = capture.js granular sources (synth take / mic / file)
              { value: 3, label: 'syn' }, { value: 4, label: 'mic' }, { value: 5, label: 'file' }],
  }));
  return z;
}

function buildGreen() {
  const z = zone('green', null, 'z-green');
  z.append(XYPad({ px: 'greenXYx', py: 'greenXYy', ptouch: 'greenXYtouch', label: 'green', color: GREEN }));
  z.append(Radio({
    param: 'greenModRad', color: GREEN,
    options: [{ value: 0, label: 'tempo' }, { value: 1, label: 'wt draw' }, { value: 2, label: 'mod' }],
  }));
  const pots = el('div', 'pot-row');
  for (let i = 1; i <= 6; i++) {
    pots.append(Dial({
      param: 'greenPot' + i, label: i === 4 ? 'pan' : 'p' + i, color: GREEN, size: 40,
    }));
  }
  z.append(pots);
  return z;
}

function buildFilters() {
  const z = zone('filt', 'RLPF / HPF', 'z-filt');
  // Two columns rather than one tall stack: keeps every fader ≥40px on its
  // short axis, which a six-high single column cannot do in this cell.
  const g = el('div', 'filt-grid');
  // Resonance sits beside its cutoff, TouchOSC-style, not stacked in the list.
  const lp = el('div', 'row');
  lp.append(Fader({ param: 'lpf', label: 'RLPF', color: '#c0553a' }));
  lp.append(Dial({ param: 'lpq', label: 'Q', color: '#c0553a', size: 40 }));
  g.append(lp);
  g.append(Fader({ param: 'hpf', label: 'HPF', color: '#c0553a' }));
  g.append(Fader({ param: 'rolloff', label: 'rolloff', color: PURPLE }));
  g.append(Fader({ param: 'gain', label: 'gain', color: RED }));
  g.append(Fader({ param: 'feedback', label: 'feedback', color: RED }));
  g.append(Fader({ param: 'fader5', label: 'verb lvl', color: '#4a8ee0' }));
  z.append(g);
  return z;
}

function buildChords() {
  const z = zone('chord', 'Chord', 'z-chord');
  const row = el('div', 'tog-row');
  for (const [p, l] of [['tog7', '7'], ['tog9', '9'], ['tog11', '11'], ['tog13', '13'],
                        ['tog15', '15'], ['tog33', '33'], ['togP5', 'P5'], ['togP5qs', 'P5↑']]) {
    row.append(Toggle({ param: p, label: l, color: '#4a8ee0' }));
  }
  z.append(row);
  z.append(Radio({
    param: 'chordMode', color: '#4a8ee0',
    options: [{ value: 0, label: 'harm' }, { value: 1, label: 'drone' }],
  }));
  return z;
}

function buildExpression() {
  const z = zone('expr', 'Key XY / Pedal', 'z-expr');
  const row = el('div', 'tog-row');
  row.append(Toggle({ param: 'keyXYFilter', label: 'filt', color: '#c0553a' }));
  row.append(Toggle({ param: 'keyXYVib', label: 'vib', color: YELLOW }));
  row.append(Toggle({ param: 'keyXYDrive', label: 'drive', color: RED }));
  z.append(row);
  z.append(Radio({
    param: 'keyXYStyle', label: 'style', color: '#8a8ab0',
    options: [
      { value: 0, label: 'rel' },
      { value: 1, label: 'abs', title: 'spec pending — inert' },
    ],
  }));
  z.append(Toggle({ param: 'pedal', label: 'pedal', color: GREEN, momentary: true }));
  z.append(Fader({ param: 'pedalReleaseTime', label: 'release', color: GREEN }));
  return z;
}

function buildRegister() {
  const z = zone('reg', 'Register', 'z-reg');
  z.append(Radio({
    param: 'regSelect', color: '#8a6a3a',
    options: [{ value: 0, label: '−8ᵛᵃ' }, { value: 1, label: '0' },
              { value: 2, label: '+8ᵛᵃ' }, { value: 3, label: '+15ᵐᵃ' }],
  }));
  return z;
}

function buildMaster() {
  const z = zone('master', null, 'z-master');
  z.append(Fader({ param: 'masterVol', label: 'vol', color: ORANGE, vertical: true, tall: true }));
  z.append(Btn({
    label: 'SCRAM', cls: 'scram', color: RED,
    onTap: () => { KB.releaseAllVisuals(); panicAll(); updateVoiceCount(); },
  }));
  return z;
}

// PANIC CONTRACT (fx.js RESULTS deviation 2, extended by modes/capture):
// Engine.panic() severs every outgoing edge from voiceMix and rebuilds
// buses.master — FX.panic(), Modes.panic(), Capture.panic() MUST follow, in
// that order, every time, to re-tap their nodes and clear bookkeeping.
// One function so no call site drifts.
function panicAll() { Engine.panic(); FX.panic(); Modes.panic(); Capture.panic(); }

// Tuplet ratio per source — an int index into {off, 1..7}, so the dial is
// stepped rather than continuous.
const TUP_LABEL = i => i === 0 ? 'off' : String(i);

function buildTuplets() {
  const z = zone('tup', 'Tup', 'z-tup');
  const row = el('div', 'tup-row');
  for (const src of SOURCES) {
    row.append(Dial({
      param: src + 'Tup', label: SRC_LABEL[src], color: SRC_COLOR[src], size: 40,
      min: 0, max: 7, int: true, fmtFn: TUP_LABEL,
    }));
  }
  z.append(row);
  z.append(Dial({
    param: 'tempo', label: 'BPM', color: '#4a8ee0', size: 40,
    min: 40, max: 240, int: true, fmtFn: v => v + '',
  }));
  return z;
}

// Drone pads (MTOK_B block 8) + their reserved mode radios. Pads publish
// loBlue*/loPurp* x/y/touch; fx.js subscribes and drives droneUpdate/Release.
// x = pitch bend (±1 oct around base), y = amp — wide-and-short suits the
// x-dominant gesture, but 36px tall is a guess: judge on glass (David).
function buildDrones() {
  const z = zone('drone', 'Drones', 'z-drone');
  z.append(Radio({
    param: 'loBlueRad', label: 'blue', color: '#4a6ee0',
    options: [{ value: 0, label: '1' }, { value: 1, label: '2' }, { value: 2, label: '3' }],
  }));
  z.append(XYPad({ px: 'loBluex', py: 'loBluey', ptouch: 'loBluetouch', label: 'G', color: '#4a6ee0' }));
  z.append(XYPad({ px: 'loPurpx', py: 'loPurpy', ptouch: 'loPurptouch', label: 'C', color: PURPLE }));
  z.append(Radio({
    param: 'loPurpRad', label: 'purp', color: PURPLE,
    options: [{ value: 0, label: '1' }, { value: 1, label: '2' }, { value: 2, label: '3' }],
  }));
  return z;
}

// ── presets ────────────────────────────────────────────────
const SLOTS = 6;
const slotKey = i => 'mtok2.preset.' + i;

function slotFilled(i) {
  try { return !!localStorage.getItem(slotKey(i)); } catch (_) { return false; }
}

function buildPresets(refresh) {
  const z = zone('presets', 'Presets', 'z-presets');
  const radio = Radio({
    param: 'radioPreset', color: '#a8b04a',
    options: Array.from({ length: SLOTS }, (_, i) => ({
      value: i, label: String(i + 1), title: 'slot ' + (i + 1),
    })),
  });
  z.append(radio);

  const mark = () => radio.querySelectorAll('.radio-btn').forEach((b, i) =>
    b.classList.toggle('filled', slotFilled(i)));

  const row = el('div', 'row');
  row.append(Btn({
    label: 'save', color: '#a8b04a',
    onTap: () => {
      try {
        localStorage.setItem(slotKey(P.get('radioPreset')), JSON.stringify(P.snapshot()));
        mark();
      } catch (e) { console.warn('[mtok2] preset save failed:', e); }
    },
  }));
  row.append(Btn({
    label: 'load', color: '#a8b04a',
    onTap: () => {
      const raw = (() => { try { return localStorage.getItem(slotKey(P.get('radioPreset'))); } catch (_) { return null; } })();
      if (!raw) return;
      try {
        const obj = JSON.parse(raw);
        // Never let a snapshot move the slot selector out from under the tap.
        delete obj.radioPreset;
        P.load(obj);
        refresh();
      } catch (e) { console.warn('[mtok2] preset load failed:', e); }
    },
  }));
  z.append(row);
  mark();
  return z;
}

// REC + undo drive capture.js directly (its own CP store, not P — see its
// RESULTS' CAPTURE_PARAMS proposal, pending David). ML stays inert.
function buildWave2() {
  const z = zone('w2', null, 'z-w2');
  const row = el('div', 'tog-row');
  const rec = el('button', 'tog');
  rec.type = 'button';
  rec.style.setProperty('--dc', RED);
  rec.append(el('span', null, 'REC'));
  rec.addEventListener('click', () => {
    const on = !rec.classList.contains('on');
    rec.classList.toggle('on', on);
    Capture.setRecButt(on ? 1 : 0); // rising edge arms, falling edge finalizes the take
    blurLater(rec);
  });
  row.append(rec);
  row.append(Dead({ label: 'ML', color: GREEN }));
  const undo = el('button', 'tog');
  undo.type = 'button';
  undo.style.setProperty('--dc', '#8a8ab0');
  undo.append(el('span', null, '↺'));
  undo.addEventListener('click', () => { Capture.triggerUndo(); blurLater(undo); });
  row.append(undo);
  z.append(row);
  return z;
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
  const v = $('voice-count');
  if (v) v.textContent = Engine.voiceCount() + ' v';
}

// SPEC acceptance #3: every param in state.js gets exactly one bound control,
// or is listed as an exception. Machine-checked at boot so the RESULTS list is
// observed rather than remembered.
function auditCoverage() {
  const unbound = [], multi = [];
  for (const name of P.names()) {
    const b = BOUND.get(name);
    if (!b || !b.length) unbound.push(name);
    else if (b.length > 1 && b[0].kind !== 'xy') multi.push(name + '×' + b.length);
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

async function startAudio() {
  const overlay = $('unlock');
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // iOS belt-and-suspenders: a silent one-sample buffer forces the unlock
    // even when resume() alone leaves the context suspended. (PoC)
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
  // tunings-mtok.json is WO-tuning's file — read-only here, and only for
  // display names. A missing/renamed field must never break the surface.
  try {
    const r = await fetch('./tunings-mtok.json');
    if (r.ok) window.__mtokNames = await r.json();
  } catch (_) {}

  const surface = $('surface');
  // A preset load rewrites the scale/register, so the keyboard must rebuild.
  const refresh = () => { KB.releaseAllVisuals(); KB.resizeKeyboard(); };

  surface.append(
    buildTuning(), buildADSR(), buildInstruments(), buildMode(),
    buildYellow(), buildGreen(), buildFilters(), buildChords(),
    buildExpression(), buildRegister(), buildWave2(), buildMaster(),
    buildPresets(refresh), buildTuplets(), buildDrones(),
  );

  // Keyboard fit toggle — the full 3-octave staircase is wider than an iPad,
  // so it scrolls by default; "fit" squeezes it all into view at the cost of
  // finger-sized targets. David picks per situation.
  $('fit-btn').addEventListener('click', (e) => {
    KB.setFitMode(!KB.isFitMode());
    e.currentTarget.classList.toggle('on', KB.isFitMode());
    blurLater(e.currentTarget);
    auditCoverage();
  });

  KB.setVoiceChangeHandler(updateVoiceCount);

  // Double-rAF: first frame starts layout, second measures it. iPadOS Safari
  // does not settle 100vh + flex in one frame. (PoC)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    KB.initKeyboard($('kb-canvas'), $('kb-wrap'));
    document.querySelectorAll('.xy').forEach(x => x._resize && x._resize());
    auditCoverage();
  }));

  window.addEventListener('resize', () => {
    KB.releaseAllVisuals();
    KB.resizeKeyboard();
    document.querySelectorAll('.xy').forEach(x => x._resize && x._resize());
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
