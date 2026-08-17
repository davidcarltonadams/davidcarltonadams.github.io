// MTOK2 performance-logic layer — WO-modes, wave 3 (launched after engine +
// fx RESULTS landed). Owns: mode radio (arp/shm/pls/def), per-source tuplet
// AM, chord-extension toggles (harmonizer/drone).
// Contract: SPEC-mtok2-web-2026-08-15.md · WORK-ORDER-mtok2-modes-2026-08-15.md
// Reads Engine (engine.js), FX (fx.js), Tuning (tuning.js) but never writes
// to those files.
//
// PANIC CONTRACT: Engine.panic() calls buses.voiceMix.disconnect() (severs
// EVERY outgoing edge from voiceMix — same trap fx.js documented). shm mode's
// voiceMix -> shmTap tap is one of those edges. Whoever wires the panic
// button (ui.js) must call Engine.panic() -> FX.panic() -> Modes.panic(), in
// that order, every time, or shm mode goes silent-but-still-toggled-on after
// a panic. pls mode's tap (plsScale -> voiceMix.gain) is an INPUT to voiceMix,
// not an output, so it is unaffected by panic and needs no re-tap.
//
// PER-SOURCE GAIN HOOK (proposed, per WO instruction "propose if absent" —
// it's absent): tuplets modulate <src>Lev through P.set on a rAF loop, the
// only public per-source hook that exists. That's control-rate (~60 Hz),
// fine for tempo/subdivision combinations up to roughly 20 Hz of modulation
// (e.g. 120 BPM x 7-tup ~= 14 Hz) but will start to alias at the top end of
// the range (240 BPM x 7-tup ~= 28 Hz). A real fix needs an engine-exposed
// per-source AudioParam (or gain node) modes.js can drive with an actual
// oscillator, same as pls mode does on buses.voiceMix.gain. See RESULTS.

import { P, SOURCES } from './state.js?v=6';
import { Engine } from './engine.js?v=6';
import { FX } from './fx.js?v=6';
import { Tuning } from './tuning.js?v=6';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const SMOOTH = 0.02;

// ── chord-toggle ratios (SPEC decision 2) ───────────────────────────────
// All already fold within [1,2) — foldToOctave is a safety net for future
// toggles, documented rather than silently doing nothing.
const TOGGLES = {
  tog7: 7 / 4, tog9: 9 / 8, tog11: 11 / 8, tog13: 13 / 8,
  tog15: 15 / 8, tog33: 33 / 32, togP5: 3 / 2, togP5qs: (3 / 2) * (33 / 32),
};
function foldToOctave(ratio) {
  while (ratio >= 2) ratio /= 2;
  while (ratio < 1) ratio *= 2;
  return ratio;
}

const HARM_AMP = 0.18;   // per-partial amp — kept low, several may stack
const DRONE_AMP = 0.22;
const ARP_AMP = 0.32;
const PLS_DEPTH = 0.85;  // whole-mix tremolo depth when pls is active
const TUP_DEPTH = 0.85;  // per-source tremolo depth when a tuplet is active

let cFundamental = 130.81; // C3 fallback; resolved from Tuning once available

function resolveCFundamental() {
  try {
    const key = Tuning.keyboard('alpha').find(k => k.id === 'c1');
    if (key) cFundamental = key.freq;
  } catch (_) { /* Tuning not ready yet — fallback stands */ }
}

// ═══════════════════════════════════════════════════════════
// MODE RADIO — arp / shm / pls / def
// ═══════════════════════════════════════════════════════════

// -- arp --
let arpSounding = false;

function arpTick(time, beatIndex) {
  if ((P.get('radioMode') | 0) !== 0) return; // not in arp mode
  const held = Engine.held().slice().sort((a, b) => a.freq - b.freq);
  if (arpSounding) { Engine.noteOffRaw('arp'); arpSounding = false; }
  if (held.length === 0) return;
  const note = held[beatIndex % held.length]; // up pattern v1 — room left for more via arpPattern later
  Engine.noteOnRaw('arp', note.freq, ARP_AMP);
  arpSounding = true;
}

// -- pls -- whole-mix AM tremolo on buses.voiceMix.gain, tempo-synced.
// Same bipolar-sine -> unipolar-shift -> scale idiom as fx.js's tremolo on
// buses.master.gain (see fx.js buildYellowNodes), just tapped one bus earlier
// so it doesn't fight fx.js's own master.gain automation.
let plsOsc = null, plsHalf = null, plsDC = null, plsSum = null, plsScale = null;

function ensurePlsNodes() {
  if (plsOsc) return;
  const ctx = Engine.ctx;
  plsOsc = ctx.createOscillator(); plsOsc.type = 'sine';
  plsOsc.frequency.value = clamp(P.get('tempo'), 40, 240) / 60;
  plsOsc.start();
  plsHalf = ctx.createGain(); plsHalf.gain.value = 0.5;      // -1..1 -> -0.5..0.5
  plsDC = ctx.createConstantSource(); plsDC.offset.value = -0.5; plsDC.start(); // -> -1..0
  plsSum = ctx.createGain(); plsSum.gain.value = 1;
  plsOsc.connect(plsHalf); plsHalf.connect(plsSum); plsDC.connect(plsSum);
  plsScale = ctx.createGain(); plsScale.gain.value = 0;      // depth, 0 until pls active
  plsSum.connect(plsScale); plsScale.connect(Engine.buses.voiceMix.gain);
}

function setPlsActive(active) {
  ensurePlsNodes();
  const t = Engine.ctx.currentTime;
  plsScale.gain.setTargetAtTime(active ? PLS_DEPTH : 0, t, SMOOTH);
}

// -- shm -- borrows FX slot B, routes the whole dry mix through shimmer.
// SPEC-confirmed reading (2026-08-15): "shm = shimmer, pitch-shifted feedback
// reverb." Only 2 FX slots exist and shm needs a full-mix send that isn't
// one of them, so it temporarily reassigns slot B (default reverb) to
// shimmer while active and restores whatever was there when deactivated.
// KNOWN TRADEOFF: if a user has per-source <src>Y sends feeding slot B for
// their own reasons, activating shm mode changes what those sends hear too,
// for as long as shm is on. Flagged for David in RESULTS — a dedicated
// modes-only bus would need a 3rd rack slot (fx.js territory).
const SHM_SLOT = 'B';
let shmTap = null;
let shmActive = false;
let shmPrevEffect = null;
let shmRestoreTimer = null;

function ensureShmTap() {
  if (shmTap) return;
  const ctx = Engine.ctx;
  shmTap = ctx.createGain(); shmTap.gain.value = 0;
  Engine.buses.voiceMix.connect(shmTap);
  shmTap.connect(Engine.buses.fxSendB);
}

function activateShm() {
  ensureShmTap();
  if (shmRestoreTimer) { clearTimeout(shmRestoreTimer); shmRestoreTimer = null; }
  if (shmActive) return;
  shmPrevEffect = FX.slots[SHM_SLOT];
  if (shmPrevEffect !== 'shimmer') FX.assign(SHM_SLOT, 'shimmer');
  shmTap.gain.setTargetAtTime(1, Engine.ctx.currentTime, SMOOTH);
  shmActive = true;
}

function deactivateShm() {
  if (!shmActive) return;
  shmTap.gain.setTargetAtTime(0, Engine.ctx.currentTime, SMOOTH);
  shmActive = false;
  const prev = shmPrevEffect;
  shmRestoreTimer = setTimeout(() => {
    shmRestoreTimer = null;
    if (!shmActive && prev && prev !== 'shimmer') FX.assign(SHM_SLOT, prev);
  }, 120); // let the tap ramp fully to 0 before swapping the slot's algorithm
}

function applyRadioMode() {
  const mode = P.get('radioMode') | 0; // 0 arp, 1 shm, 2 pls, 3 def
  if (mode !== 0 && arpSounding) { Engine.noteOffRaw('arp'); arpSounding = false; }
  if (mode === 1) activateShm(); else deactivateShm();
  setPlsActive(mode === 2);
}

// ═══════════════════════════════════════════════════════════
// TUPLETS — per-source AM via <src>Lev, control-rate (see header note)
// ═══════════════════════════════════════════════════════════

const tupBase = {};     // src -> last known user-set <src>Lev
const writingTup = {};  // src -> true while modes.js itself is writing <src>Lev

function initTuplets() {
  for (const src of SOURCES) {
    tupBase[src] = P.get(src + 'Lev');
    writingTup[src] = false;
    P.sub(src + 'Lev', (v) => { if (!writingTup[src]) tupBase[src] = v; });
  }
}

function tuplStep() {
  const ctx = Engine.ctx;
  if (!ctx) return;
  const tempoHz = clamp(P.get('tempo'), 40, 240) / 60;
  for (const src of SOURCES) {
    const ratio = P.get(src + 'Tup') | 0; // 0=off, else subdivision N
    if (!ratio) continue;
    const hz = tempoHz * ratio;
    const phase = (ctx.currentTime * hz) % 1;
    const lfo = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI); // unipolar 0..1
    const level = tupBase[src] * (1 - TUP_DEPTH + TUP_DEPTH * lfo);
    writingTup[src] = true;
    P.set(src + 'Lev', level);
    writingTup[src] = false;
  }
}

function restoreTupBase(src) {
  writingTup[src] = true;
  P.set(src + 'Lev', tupBase[src]);
  writingTup[src] = false;
}

// watch for a source's tuplet turning off and snap its level back to base
// rather than leaving it wherever the LFO last left it.
function wireTupletOffSnap() {
  for (const src of SOURCES) {
    let wasOn = (P.get(src + 'Tup') | 0) !== 0;
    P.sub(src + 'Tup', (v) => {
      const isOn = (v | 0) !== 0;
      if (wasOn && !isOn) restoreTupBase(src);
      wasOn = isOn;
    });
  }
}

// ═══════════════════════════════════════════════════════════
// CHORD TOGGLES — harmonizer (per note-on) / drone (over C, toggle-driven)
// ═══════════════════════════════════════════════════════════

let prevHeld = new Map();          // keyId -> freq, last poll
const harmChildren = new Map();    // keyId -> [rawId, ...] spawned at that note's on-time

function pollHeld() {
  const held = Engine.held();
  const heldMap = new Map(held.map(h => [h.keyId, h.freq]));
  for (const [keyId, freq] of heldMap) if (!prevHeld.has(keyId)) onNoteOnDetected(keyId, freq);
  for (const keyId of prevHeld.keys()) if (!heldMap.has(keyId)) onNoteOffDetected(keyId);
  prevHeld = heldMap;
}

function onNoteOnDetected(keyId, freq) {
  if ((P.get('chordMode') | 0) !== 0) return; // harmonizer only; toggles snapshot at note-on
  const ids = [];
  for (const [togName, ratio] of Object.entries(TOGGLES)) {
    if (P.get(togName) > 0.5) {
      const id = `harm:${keyId}:${togName}`;
      Engine.noteOnRaw(id, freq * foldToOctave(ratio), HARM_AMP);
      ids.push(id);
    }
  }
  if (ids.length) harmChildren.set(keyId, ids);
}

function onNoteOffDetected(keyId) {
  const ids = harmChildren.get(keyId);
  if (!ids) return;
  for (const id of ids) Engine.noteOffRaw(id);
  harmChildren.delete(keyId);
}

// -- drone toggles -- independent of note-hold, driven directly by the tog params.
// Tracked in droneActive (not recomputed from live P values) so panic() can
// clear it precisely: panic silences the underlying raw voice but does not
// touch tog params, so P.get(togName) still reads "on" afterward — deriving
// "is it sounding" from that param post-panic would be wrong.
const droneActive = new Set();

function setDroneToggle(togName, active) {
  const id = 'drone:' + togName;
  if (active) {
    if ((P.get('chordMode') | 0) !== 1) return;
    Engine.noteOnRaw(id, cFundamental * foldToOctave(TOGGLES[togName]), DRONE_AMP);
    droneActive.add(togName);
  } else {
    Engine.noteOffRaw(id);
    droneActive.delete(togName);
  }
}

function wireChordToggles() {
  for (const togName of Object.keys(TOGGLES)) {
    P.sub(togName, (v) => { if ((P.get('chordMode') | 0) === 1) setDroneToggle(togName, v > 0.5); });
  }
  P.sub('chordMode', (v) => {
    for (const togName of Object.keys(TOGGLES)) {
      if ((v | 0) === 1) { if (P.get(togName) > 0.5) setDroneToggle(togName, true); }
      else if (droneActive.has(togName)) setDroneToggle(togName, false); // leaving drone mode always silences drones
    }
  });
}

// ═══════════════════════════════════════════════════════════
// UNDO — safety hatch: release every mode-spawned raw voice. Provisional
// (WO: "for now"), does not touch played-key voices or toggle state.
// ═══════════════════════════════════════════════════════════

function undo() {
  if (arpSounding) { Engine.noteOffRaw('arp'); arpSounding = false; }
  for (const [keyId, ids] of harmChildren) for (const id of ids) Engine.noteOffRaw(id);
  harmChildren.clear();
  for (const togName of droneActive) Engine.noteOffRaw('drone:' + togName);
  droneActive.clear();
}

// ═══════════════════════════════════════════════════════════
// RAF LOOP — tuplets (control-rate AM) + held-note polling (harmonizer)
// ═══════════════════════════════════════════════════════════

let rafId = null;
function rafLoop() {
  tuplStep();
  pollHeld();
  rafId = requestAnimationFrame(rafLoop);
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

let unsubTick = null;
let inited = false;

function init() {
  if (inited) return;
  inited = true;
  resolveCFundamental();
  initTuplets();
  wireTupletOffSnap();
  wireChordToggles();
  ensurePlsNodes();
  applyRadioMode();
  P.sub('radioMode', applyRadioMode);
  unsubTick = Engine.tick(arpTick);
  if (!rafId) rafId = requestAnimationFrame(rafLoop);
}

function panic() {
  // Engine.panic() severs every outgoing edge from voiceMix, including
  // shmTap's tap — re-establish it if shm is (still) toggled on.
  // harmChildren/droneActive must also be cleared here, not just left for
  // the next natural release: Engine.panic() already stopped and cleared
  // the underlying raw voices, but tog params and held-note bookkeeping are
  // untouched, so leaving these maps stale would make activeRawCount() (and
  // the next legitimate noteOffRaw call) reference voices that no longer
  // exist.
  harmChildren.clear();
  droneActive.clear();
  if (shmActive && shmTap && Engine.buses) Engine.buses.voiceMix.connect(shmTap);
}

// dev/test accessor — every raw voice id modes.js currently believes is
// sounding. Used by dev-modes.html to assert "churn returns to 0."
function activeRawCount() {
  let n = arpSounding ? 1 : 0;
  for (const ids of harmChildren.values()) n += ids.length;
  n += droneActive.size;
  return n;
}

export const Modes = {
  init, panic, undo, activeRawCount,
  TOGGLES,
};
