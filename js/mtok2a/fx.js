// MTOK2 FX rack — WO-fx, wave 2 (launched after WO-engine's RESULTS).
// Owns: the assignable 2-slot FX rack, yellow-XY global mod modes, drone pads.
// Contract: SPEC-mtok2-web-2026-08-15.md · WORK-ORDER-mtok2-fx-2026-08-15.md
// Reads Engine.buses (engine.js, WO-engine) and Tuning (tuning.js, WO-tuning)
// but never writes to either file.
//
// ENGINE DEVIATION (per engine RESULTS #1): wet returns land on
// Engine.buses.master, NOT voiceMix — engine.js does tanh/gain/RLPF/HPF/pan
// per voice, so buses.master is just voiceMix(+returns) -> masterVol -> out.
//
// PANIC CONTRACT: Engine.panic() rebuilds buses.master as a brand-new
// GainNode (mutates the .master property on the shared buses object, doesn't
// replace the object). Existing .connect() edges point at the OLD node object
// and do not follow that reassignment — Web Audio connections are structural,
// not live references. So FX.panic() MUST be called right after Engine.panic()
// to (a) hard-mute every effect's internal feedback/convolution state and
// (b) reconnect the two per-slot return gains to the CURRENT buses.master.
// Whoever wires the panic button (ui.js) needs to call both.

import { P } from './state.js?v=6';
import { Engine } from './engine.js?v=6';
import { Tuning } from './tuning.js?v=6';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const linexp = (v, inLo, inHi, lo, hi) => {
  const x = clamp(v, inLo, inHi);
  return lo * Math.pow(hi / lo, (x - inLo) / (inHi - inLo));
};
const SMOOTH = 0.02;

let ctx = null;
let buses = null;
let effects = null;              // { delay, reverb, shimmer } — always live, all 3
let returnA = null, returnB = null;   // per-slot output gains, permanently -> buses.master
const slots = { A: null, B: null };   // which effect name currently occupies each slot
let unsubs = [];

// ═══════════════════════════════════════════════════════════
// EFFECT: Delay
// ═══════════════════════════════════════════════════════════
// 'feedback' param wires here (SPEC: "slot-A delay feedback" default reading —
// applies to this instance regardless of which slot it's patched into, since
// the rack is a single shared table of live effect instances, not per-slot
// clones). No dedicated level param is scaffolded for delay (fader5 belongs
// to reverb, per SPEC's open question) — output stays at unity; the per-osc
// X/Y sends are what already control how much of it you hear.
function buildDelay(ctx) {
  const input = ctx.createGain();
  const delayL = ctx.createDelay(2.0); delayL.delayTime.value = 0.28;
  const delayR = ctx.createDelay(2.0); delayR.delayTime.value = 0.34; // offset for stereo width
  const fbL = ctx.createGain(); fbL.gain.value = 0;
  const fbR = ctx.createGain(); fbR.gain.value = 0;
  delayL.connect(fbL); fbL.connect(delayL);
  delayR.connect(fbR); fbR.connect(delayR);
  input.connect(delayL); input.connect(delayR);
  const merge = ctx.createChannelMerger(2);
  delayL.connect(merge, 0, 0);
  delayR.connect(merge, 0, 1);
  const output = ctx.createGain(); output.gain.value = 1;
  merge.connect(output);

  return {
    input, output,
    // clamped well under 1 so max feedback is a long, thick, but bounded tail —
    // "audible regeneration, stable, no runaway" per acceptance.
    setFeedback(v) {
      const g = clamp(v, 0, 1) * 0.88;
      const t = ctx.currentTime;
      fbL.gain.setTargetAtTime(g, t, SMOOTH);
      fbR.gain.setTargetAtTime(g, t, SMOOTH);
    },
    hardMute() {
      // Zero feedback to kill regeneration, then restore the store's value
      // AFTER the delay lines have drained (max delayTime 0.34s + margin) —
      // restoring immediately would let pre-panic residual regenerate (the
      // shimmer bug #2 class). Without the restore, feedback stayed dead
      // after every panic until the fader moved (caught by CC integration
      // smoke test 2026-08-16 — P.sub never re-fires on an unchanged value).
      const t = ctx.currentTime;
      const g = clamp(P.get('feedback'), 0, 1) * 0.88;
      for (const fb of [fbL, fbR]) {
        fb.gain.cancelScheduledValues(t);
        fb.gain.setValueAtTime(0, t);
        fb.gain.setValueAtTime(g, t + 1.0);
      }
    },
    dispose() {
      [input, delayL, delayR, fbL, fbR, merge, output].forEach(n => { try { n.disconnect(); } catch (_) {} });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// EFFECT: Reverb (ConvolverNode, no external IR files)
// ═══════════════════════════════════════════════════════════
// Exponential-decay filtered noise, regenerated whenever room/damp change —
// MTOK_C's FreeVerb(room, damp) doesn't map 1:1 onto convolution params, so
// this is a from-scratch approximation of the same intent: room -> tail
// length, damp -> how quickly the tail darkens (one-pole lowpass on the
// noise before the decay envelope is applied).
function makeImpulse(ctx, room, damp) {
  const decaySec = 0.6 + clamp(room, 0, 1) * 3.4; // 0.6s small room .. 4.0s huge room
  const len = Math.max(1, Math.floor(ctx.sampleRate * decaySec));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const dampCoeff = 0.05 + clamp(damp, 0, 1) * 0.6; // higher damp = darker tail
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lp += dampCoeff * (white - lp);
      const env = Math.pow(1 - i / len, 2.5);
      data[i] = lp * env;
    }
  }
  return buf;
}

function buildReverb(ctx) {
  const input = ctx.createGain();
  let convolver = ctx.createConvolver();
  convolver.normalize = true;
  let room = 0.5, damp = 0.3;
  convolver.buffer = makeImpulse(ctx, room, damp);
  input.connect(convolver);
  const wetGain = ctx.createGain(); wetGain.gain.value = 1.0; // mode-1 xy1x drives this
  const levelGain = ctx.createGain(); levelGain.gain.value = P.get('fader5');
  convolver.connect(wetGain); wetGain.connect(levelGain);
  const output = levelGain;

  return {
    input, output,
    setRoom(v) { room = clamp(v, 0, 1); convolver.buffer = makeImpulse(ctx, room, damp); },
    setDamp(v) { damp = clamp(v, 0, 1); convolver.buffer = makeImpulse(ctx, room, damp); },
    setMix(v) { wetGain.gain.setTargetAtTime(clamp(v, 0, 1), ctx.currentTime, SMOOTH); },
    setLevel(v) { levelGain.gain.setTargetAtTime(clamp(v, 0, 2), ctx.currentTime, SMOOTH); },
    hardMute() {
      // ConvolverNode has no "flush" API — the only clean way to kill an
      // in-flight convolution tail is to rebuild the node.
      try { input.disconnect(convolver); } catch (_) {}
      try { convolver.disconnect(); } catch (_) {}
      const fresh = ctx.createConvolver();
      fresh.normalize = true;
      fresh.buffer = convolver.buffer;
      input.connect(fresh);
      fresh.connect(wetGain);
      convolver = fresh;
    },
    dispose() {
      [input, convolver, wetGain, levelGain].forEach(n => { try { n.disconnect(); } catch (_) {} });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// EFFECT: Shimmer — "pitch-shifted (+octave) feedback reverb"
// ═══════════════════════════════════════════════════════════
// SPEC flags this reading as unconfirmed. Granular +octave pitch shift via
// two overlapping delay-time-ramp taps (classic technique: linearly ramping
// a DelayNode's delayTime down to ~0 over a grain window compresses time
// 2:1, i.e. +1 octave; two taps 50%-offset and crossfaded hide the ramp
// reset). Feeds back through a gentle lowpass so the wash darkens as it
// repeats rather than building harsh high-frequency energy.
function buildShimmer(ctx) {
  const GRAIN = 0.09; // s (~11 Hz grain rate)
  const input = ctx.createGain();
  const dlA = ctx.createDelay(1), dlB = ctx.createDelay(1);
  const gA = ctx.createGain(), gB = ctx.createGain();
  const fbGain = ctx.createGain(); fbGain.gain.value = 0.96; // sustained wash, still < 1 (stable)
  const toneFilt = ctx.createBiquadFilter(); toneFilt.type = 'lowpass'; toneFilt.frequency.value = 6500;
  const merge = ctx.createGain();
  const output = ctx.createGain(); output.gain.value = 1;

  input.connect(dlA); input.connect(dlB);
  dlA.connect(gA); dlB.connect(gB);
  gA.connect(merge); gB.connect(merge);
  merge.connect(toneFilt);
  toneFilt.connect(fbGain); fbGain.connect(input); // feedback loop: back through the pitch-shift + tone
  toneFilt.connect(output);

  // Constant-power Hann window over the full grain, sampled once and reused
  // via setValueCurveAtTime. At 50%-overlap (two grains, offset GRAIN/2)
  // this sums to a flat 1.0 everywhere — NOT the earlier fade-in/hold/fade-out
  // shape, which put both taps at gain 1 simultaneously during their overlap
  // (a real bug: summed to 2x there, and with feedback that's a >1 loop gain
  // — genuine exponential runaway, caught by the T6b harness assert, not
  // just an unstable-sounding texture).
  const HANN_STEPS = 64;
  const hannCurve = new Float32Array(HANN_STEPS);
  for (let i = 0; i < HANN_STEPS; i++) hannCurve[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (HANN_STEPS - 1)));

  function scheduleGrain(dl, g, t0) {
    dl.delayTime.cancelScheduledValues(t0);
    dl.delayTime.setValueAtTime(GRAIN, t0);
    dl.delayTime.linearRampToValueAtTime(0.0005, t0 + GRAIN); // ramp-down => +1 octave
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueCurveAtTime(hannCurve, t0, GRAIN);
  }
  function scheduleBoth() {
    const t0 = ctx.currentTime + 0.005;
    scheduleGrain(dlA, gA, t0);
    scheduleGrain(dlB, gB, t0 + GRAIN / 2); // 50%-offset overlap
  }
  scheduleBoth();
  const timer = setInterval(scheduleBoth, GRAIN * 1000);

  return {
    input, output,
    hardMute() {
      fbGain.gain.cancelScheduledValues(ctx.currentTime);
      fbGain.gain.setValueAtTime(0, ctx.currentTime);
      // Zeroing the gain alone doesn't clear whatever's already circulating
      // in dlA/dlB — restoring feedback too soon lets that residual energy
      // start regenerating right back (this WAS a bug: a 50ms restore let a
      // still-charged loop from a prior note resume ringing through panic).
      // Wait several grain cycles (GRAIN=0.09s) so the already-broken loop's
      // residual has actually drained before feedback is allowed again.
      fbGain.gain.setTargetAtTime(0.96, ctx.currentTime + 1.2, 0.05);
    },
    dispose() {
      clearInterval(timer);
      [input, dlA, dlB, gA, gB, fbGain, toneFilt, merge, output].forEach(n => { try { n.disconnect(); } catch (_) {} });
    },
  };
}

const REGISTRY = { delay: buildDelay, reverb: buildReverb, shimmer: buildShimmer };

// ═══════════════════════════════════════════════════════════
// RACK — assignable 2-slot, effects registered in a table
// ═══════════════════════════════════════════════════════════

function assign(slot, name) {
  if (!(slot === 'A' || slot === 'B')) { console.warn('FX.assign: slot must be A or B'); return; }
  if (!(name in effects)) { console.warn('FX.assign: unknown effect', name); return; }
  const send = slot === 'A' ? buses.fxSendA : buses.fxSendB;
  const ret = slot === 'A' ? returnA : returnB;
  const prev = slots[slot];
  if (prev) {
    try { send.disconnect(effects[prev].input); } catch (_) {}
    try { effects[prev].output.disconnect(ret); } catch (_) {}
  }
  send.connect(effects[name].input);
  effects[name].output.connect(ret);
  slots[slot] = name;
}

// ═══════════════════════════════════════════════════════════
// YELLOW XY — global modulation modes (yellowModRad)
// ═══════════════════════════════════════════════════════════
// Mode 0 (vibrato+tremolo) and mode 2 (FM) are inherently PER-VOICE in
// MTOK_C (they modulate each voice's own oscillator frequency) — engine.js
// exposes no hook for that, and reaching into its voice internals is exactly
// what this WO says not to do. Rather than skip them, both are implemented
// as honest DOWNSTREAM approximations at the master bus, with their
// rate/depth math ported exactly from MTOK_C's formulas:
//   - "vibrato" -> a chorus-style modulated-delay copy of voiceMix, summed
//     in alongside the untouched dry path (can't replace the dry signal
//     without touching engine's own voiceMix->master wiring).
//   - "FM" -> a ring-modulator on a tapped copy of voiceMix, using a fixed
//     reference frequency (220 Hz) in place of MTOK_C's per-voice-relative
//     modulator (which needs freq -- unavailable downstream).
// Mode 1 (reverb) doesn't have this problem: it's implemented for real,
// driving whichever effect currently occupies slot B, IF it exposes
// setRoom/setDamp/setMix (the reverb does; delay/shimmer no-op harmlessly).
// See RESULTS for the proposed engine.js hook that would make 0 and 2 real.

let chorusTap = null, chorusDelay = null, chorusLFO = null, chorusLFOGain = null, chorusOut = null;
let tremOsc = null, tremHalf = null, tremDC = null, tremSum = null, tremScale = null;
let fmTap = null, fmOsc = null, fmRing = null, fmOut = null;

function buildYellowNodes() {
  // ── vibrato-as-chorus tap (voiceMix -> modulated delay -> master) ──
  chorusTap = ctx.createGain(); chorusTap.gain.value = 1;
  buses.voiceMix.connect(chorusTap);
  chorusDelay = ctx.createDelay(0.05); chorusDelay.delayTime.value = 0.015;
  chorusLFO = ctx.createOscillator(); chorusLFO.type = 'sine'; chorusLFO.frequency.value = 5; chorusLFO.start();
  chorusLFOGain = ctx.createGain(); chorusLFOGain.gain.value = 0; // depth, in seconds — 0 until mode 0 is active
  chorusLFO.connect(chorusLFOGain); chorusLFOGain.connect(chorusDelay.delayTime);
  chorusOut = ctx.createGain(); chorusOut.gain.value = 0; // audibility gain — 0 until mode 0 is active
  chorusTap.connect(chorusDelay); chorusDelay.connect(chorusOut); chorusOut.connect(buses.master);

  // ── tremolo, real: modulates buses.master.gain directly ──
  tremOsc = ctx.createOscillator(); tremOsc.type = 'sine'; tremOsc.frequency.value = 5; tremOsc.start();
  tremHalf = ctx.createGain(); tremHalf.gain.value = 0.5;       // sin(-1..1) -> -0.5..0.5
  tremDC = ctx.createConstantSource(); tremDC.offset.value = -0.5; tremDC.start();
  tremSum = ctx.createGain(); tremSum.gain.value = 1;            // sums to -1..0
  tremOsc.connect(tremHalf); tremHalf.connect(tremSum); tremDC.connect(tremSum);
  tremScale = ctx.createGain(); tremScale.gain.value = 0;        // masterVol*depth, 0 until mode 0 active
  tremSum.connect(tremScale); tremScale.connect(buses.master.gain);

  // ── FM-as-ring-mod tap ──
  fmTap = ctx.createGain(); fmTap.gain.value = 1;
  buses.voiceMix.connect(fmTap);
  fmOsc = ctx.createOscillator(); fmOsc.type = 'sine'; fmOsc.frequency.value = 220; fmOsc.start();
  fmRing = ctx.createGain(); fmRing.gain.value = 0; // fmOsc drives this node's gain -> ring mod
  fmOsc.connect(fmRing.gain);
  fmTap.connect(fmRing);
  fmOut = ctx.createGain(); fmOut.gain.value = 0; // 0 until mode 2 active
  fmRing.connect(fmOut); fmOut.connect(buses.master);
}

function applyYellowMode() {
  const mode = P.get('yellowModRad') | 0;
  const t = ctx.currentTime;
  const x1 = P.get('xy1x'), y1 = P.get('xy1y'), x2 = P.get('xy2x'), y2 = P.get('xy2y');

  // Mode 0: vibrato (xy1) + tremolo (xy2) — MTOK_C exact rate/depth mappings.
  const vibratoRate = linexp(x1, 0.001, 1.0, 0.1, 15.0);
  const vibratoDepthSec = (y1 * 0.05) * 0.006; // MTOK_C depth is a freq-ratio (~0-5%); scaled to a chorus-delay-mod range in seconds
  const tremoloRate = linexp(x2, 0.001, 1.0, 0.1, 10.0);
  const tremoloDepth = y2 * 0.7;

  chorusLFO.frequency.setTargetAtTime(vibratoRate, t, SMOOTH);
  tremOsc.frequency.setTargetAtTime(tremoloRate, t, SMOOTH);
  const mode0On = mode === 0;
  chorusLFOGain.gain.setTargetAtTime(mode0On ? vibratoDepthSec : 0, t, SMOOTH);
  chorusOut.gain.setTargetAtTime(mode0On ? 0.5 : 0, t, SMOOTH); // 0.5 = audible-but-not-dominant chorus mix
  tremScale.gain.setTargetAtTime(mode0On ? P.get('masterVol') * tremoloDepth : 0, t, SMOOTH);

  // Mode 1: reverb control (xy1 = mix/room, xy2 = damp/level) — drives whichever
  // effect is in slot B, IF it supports these setters (only the reverb does).
  const slotBEffect = effects[slots.B];
  const mode1On = mode === 1;
  if (slotBEffect && typeof slotBEffect.setRoom === 'function') {
    if (mode1On) {
      slotBEffect.setMix(x1);
      slotBEffect.setRoom(y1);
      slotBEffect.setDamp(x2);
    }
    // y2 ("level") intentionally left to fader5 (SPEC: fader5 IS reverb output
    // level) rather than double-driven by yellow mode 1's y2x — MTOK_C's own
    // comment only lists y1x/y1y/y2x for mix/room/damp, not a 4th param.
  }

  // Mode 2: FM-as-ring-mod approximation (xy1 = ratio/depth of the primary
  // modulator only — MTOK_C's second modulator (xy2) needs a 2nd oscillator
  // per voice too, dropped here as it would just make the approximation
  // muddier, not more accurate).
  const fmRatio = linexp(x1, 0.001, 1.0, 0.25, 8.0);
  const REF_FREQ = 220; // stand-in for per-voice `freq` (unavailable downstream)
  const fmDepth = y1 * 0.5; // 0-0.5 ring-mod gain — keeps it textural, not harsh
  fmOsc.frequency.setTargetAtTime(REF_FREQ * fmRatio, t, SMOOTH);
  fmOut.gain.setTargetAtTime(mode === 2 ? fmDepth : 0, t, SMOOTH);
}

// ═══════════════════════════════════════════════════════════
// DRONE PADS — loblue (G, oct down) / lopurp (C, oct down)
// ═══════════════════════════════════════════════════════════
// MTOK_B block 8: touch-down starts a raw voice at baseHz*regMult, x bends
// pitch across baseHz*[0.5..2] (±1 octave around center), y*0.4 sets amp.
// Engine's noteOnRaw/noteOffRaw take a fixed freq/amp at note-on (no live
// update API for raw voices) — continuous X/Y glide would need a new engine
// hook (proposed in RESULTS: Engine.updateRaw(id, {freq, amp})). Until then,
// this retriggers on a coarse threshold crossing (>=3% of the bend range)
// rather than every touchmove tick, so it's steppy-but-functional instead of
// a click storm. Release stops unless the pedal is held (matches noteOff's
// own pedal-sustain semantics, applied manually since raw voices don't
// participate in Engine's pedal/sustained bookkeeping).
const DRONE_BASE = { lopurp: 'c1', loblue: 'g1' };
const droneState = {}; // padId -> {active, lastBendStep, held}

function droneBaseFreq(padId) {
  const noteKey = DRONE_BASE[padId];
  const key = Tuning.keyboard('alpha').find(k => k.id === noteKey);
  return (key ? key.freq : 130.81) * 0.5; // "an octave down" per MTOK_B block 8
}

function droneUpdate(padId, x, y) {
  const st = droneState[padId] || (droneState[padId] = { active: false, lastBendStep: null, held: false });
  const bendMult = linexp(x, 0.0, 1.0, 0.5, 2.0);
  const amp = clamp(y, 0, 1) * 0.4;
  const step = Math.round(bendMult * 33); // ~3% quantization across the 0.5-2.0 range
  if (!st.active) {
    const freq = droneBaseFreq(padId) * bendMult;
    Engine.noteOnRaw(padId, freq, amp);
    st.active = true;
    st.lastBendStep = step;
    return;
  }
  if (step !== st.lastBendStep) {
    Engine.noteOffRaw(padId);
    const freq = droneBaseFreq(padId) * bendMult;
    Engine.noteOnRaw(padId, freq, amp);
    st.lastBendStep = step;
  }
}

function droneRelease(padId) {
  const st = droneState[padId];
  if (!st || !st.active) return;
  if (P.get('pedal') > 0.5) { st.held = true; return; } // sustain — leave the raw voice sounding
  Engine.noteOffRaw(padId);
  st.active = false;
  st.lastBendStep = null;
}

function dronePedalRelease() {
  for (const padId of Object.keys(DRONE_BASE)) {
    const st = droneState[padId];
    if (st && st.held) { Engine.noteOffRaw(padId); st.active = false; st.held = false; st.lastBendStep = null; }
  }
}

// ═══════════════════════════════════════════════════════════
// PARAM WIRING
// ═══════════════════════════════════════════════════════════

function wireParams() {
  unsubs.push(P.sub('feedback', (v) => effects.delay.setFeedback(v)));
  unsubs.push(P.sub('fader5', (v) => effects.reverb.setLevel(v)));
  for (const name of ['yellowModRad', 'xy1x', 'xy1y', 'xy2x', 'xy2y']) {
    unsubs.push(P.sub(name, applyYellowMode));
  }
  unsubs.push(P.sub('pedal', (v) => { if (v < 0.5) dronePedalRelease(); }));

  // Drone pad surfaces (ui.js XYPads → loBlue*/loPurp* params). XYPad sets
  // touch=1 BEFORE publishing x/y on pointerdown, so the touch-rise call uses
  // the previous touch's endpoint for one tick — the correct x/y lands
  // synchronously right after, and the 3% bend quantization absorbs the blip.
  for (const [padId, pfx] of [['loblue', 'loBlue'], ['lopurp', 'loPurp']]) {
    const upd = () => {
      if (P.get(pfx + 'touch') > 0.5) droneUpdate(padId, P.get(pfx + 'x'), P.get(pfx + 'y'));
    };
    unsubs.push(P.sub(pfx + 'x', upd));
    unsubs.push(P.sub(pfx + 'y', upd));
    unsubs.push(P.sub(pfx + 'touch', (v) => { if (v > 0.5) upd(); else droneRelease(padId); }));
  }
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

function init(audioCtx, engineBuses) {
  ctx = audioCtx;
  buses = engineBuses;
  effects = { delay: buildDelay(ctx), reverb: buildReverb(ctx), shimmer: buildShimmer(ctx) };
  returnA = ctx.createGain(); returnA.gain.value = 1; returnA.connect(buses.master);
  returnB = ctx.createGain(); returnB.gain.value = 1; returnB.connect(buses.master);
  assign('A', 'delay');
  assign('B', 'reverb');
  buildYellowNodes();
  applyYellowMode();
  wireParams();
}

// See PANIC CONTRACT header comment — must be called right after Engine.panic().
// engine.js's panic() calls buses.voiceMix.disconnect() with NO target arg,
// which severs every outgoing edge from voiceMix, not just its dry path to
// the old master — that takes chorusTap/fmTap down too. Everything this
// module ever connected FROM buses.voiceMix or INTO buses.master has to be
// re-made here, every time.
function panic() {
  if (!effects) return; // panic before init (e.g. Escape pre-unlock) — nothing to do
  for (const name of Object.keys(effects)) effects[name].hardMute();
  if (!buses) return;
  try { returnA.disconnect(buses.master); } catch (_) {}
  try { returnB.disconnect(buses.master); } catch (_) {}
  returnA.connect(buses.master);
  returnB.connect(buses.master);
  if (chorusTap) { try { buses.voiceMix.connect(chorusTap); } catch (_) {} }
  if (fmTap) { try { buses.voiceMix.connect(fmTap); } catch (_) {} }
  try { chorusOut && chorusOut.disconnect(); } catch (_) {}
  try { fmOut && fmOut.disconnect(); } catch (_) {}
  if (chorusOut) chorusOut.connect(buses.master);
  if (fmOut) fmOut.connect(buses.master);
  if (tremScale) {
    try { tremScale.disconnect(); } catch (_) {}
    tremScale.connect(buses.master.gain);
  }
}

export const FX = {
  init,
  assign,
  panic,
  droneUpdate,
  droneRelease,
  slots,          // read-only-in-spirit accessor for UI (which effect is in A/B)
  effects: () => effects,
};

export default FX;
