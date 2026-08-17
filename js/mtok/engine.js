// MTOK2 — voice engine. WO-engine, 2026-08-15.
// Contract: SPEC-mtok2-web-2026-08-15.md · WORK-ORDER-mtok2-engine-2026-08-15.md
// SC reference: MTOK_C.scd blocks 7-9 (env matrix, pedal, cleanup),
//               MTOK_A.scd blocks 7-8 (per-key XY). PoC: website/mtok.html.
//
// DEVIATION from SPEC signal-flow diagram (confirmed with David 2026-08-15):
// tanh / gain / RLPF / HPF / pan live PER VOICE, as in MTOK_C and the PoC — the
// master chain is just voiceMix (+ fx returns) → masterVol → destination. Per-note
// filtEnvAmt sweep and the key-XY filter/overdrive modes are impossible otherwise.

import { P, SOURCES } from './state.js?v=7';

// ═══════════════════════════════════════════════════════════
// MAPPINGS (ported from SC)
// ═══════════════════════════════════════════════════════════

// SC: v.max(0.001).linexp(0.001, 1.0, lo, hi)
function linexp(v, inLo, inHi, lo, hi) {
  const x = Math.min(Math.max(v, inLo), inHi);
  return lo * Math.pow(hi / lo, (x - inLo) / (inHi - inLo));
}
const envTime = (v) => linexp(v, 0.001, 1.0, 0.001, 10.0);   // MTOK_C mapTime
const lpfHzOf = (v) => linexp(v, 0.001, 1.0, 80.0, 20000.0);
const hpfHzOf = (v) => linexp(v, 0.001, 1.0, 20.0, 5000.0);
const clamp   = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const REG_MULTS = [0.5, 1.0, 2.0, 4.0];

// RLPF rq 0.6 → BiquadFilter Q = 1/rq ≈ 1.67 (SC rq is reciprocal-Q).
const LPF_Q = 1 / 0.6;                       // SC-derived default; live value comes from lpq
const lpqOf = (v) => 0.3 * Math.pow(40, clamp(v, 0, 1));  // linexp 0.3–12; 0.465 ≈ 1.67 = LPF_Q

// MTOK_C: satDrive = tanh.linlin(0,1, 1,12); makeup = satDrive.linlin(1,12, 1,2.8)
const driveOf  = (t) => 1.0 + clamp(t, 0, 1) * 11.0;
// MTOK_A widens the makeup range to accommodate XY overdrive (drive up to 22).
const makeupOf = (d) => 1.0 + (clamp(d, 1, 22) - 1) * (2.8 / 11.0);

// PoC makeTanhCurve (mtok.html:440)
function makeTanhCurve(drive, n = 512) {
  const curve = new Float32Array(n);
  const d = Math.max(drive, 0.001);
  const norm = Math.tanh(d);
  for (let i = 0; i < n; i++) {
    const x = (i * 2 / (n - 1)) - 1;
    curve[i] = Math.tanh(x * d) / norm;
  }
  return curve;
}

// Hard-step curve for PWM: saw + DC offset → this → pulse of variable width.
function makeStepCurve(n = 1024) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = ((i * 2 / (n - 1)) - 1) >= 0 ? 1 : -1;
  return curve;
}

const SMOOTH = 0.02;  // setTargetAtTime time-constant for continuous params

// ═══════════════════════════════════════════════════════════
// ENGINE STATE
// ═══════════════════════════════════════════════════════════

let ctx = null;
let ready = false;
let initPromise = null;

let buses = null;          // {voiceMix, fxSendA, fxSendB, master}
let dc = null;             // ConstantSourceNode(1) — DC for every control envelope
let staticScale = null;    // gain = 1 - ampEnvAmt, summed into every srcAmp.gain
let noiseBuf = null;
let stepCurve = null;
let WT = null;             // wavetable.js module, if it exists yet
let wtStubbed = true;

const voices    = new Map();  // keyId → voice  (played keys; counted by held())
const rawVoices = new Map();  // rawId → voice  (modes.js: arps, drones, harmonizer)
const sustained = new Set();  // voices whose key was lifted while the pedal was down

// Which key-XY targets are live. Multi-select, PoC parity (mtok.html:358).
// No param for this in state.js yet — proposed in RESULTS.
const keyXYModes = new Set(['filter']);

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

// iOS unlock, PoC pattern (mtok.html:392-412). Safe to call on every gesture.
function unlock() {
  if (!ctx) return;
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {});
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch (_) {}
  }
}

// White + pink + brown noise buffers (David 2026-08-15: 6th source ships all
// three, selected by noiseType). Pink = Paul Kellet's economy filter; brown =
// leaky integrator. noiseType is latched at note-on like the other source picks.
function buildNoiseBuffer() {
  const len = Math.floor(ctx.sampleRate * 2);
  const mk = () => ctx.createBuffer(1, len, ctx.sampleRate);
  const white = mk(), pink = mk(), brown = mk();
  const w = white.getChannelData(0), p = pink.getChannelData(0), br = brown.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.96900 * b2 + x * 0.1538520; b3 = 0.86650 * b3 + x * 0.3104856;
    b4 = 0.55000 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.0168980;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
    last = (last + 0.02 * x) / 1.02;
    br[i] = last * 3.5;
  }
  return { white, pink, brown };
}

function buildMaster() {
  buses = {
    voiceMix: ctx.createGain(),
    fxSendA:  ctx.createGain(),
    fxSendB:  ctx.createGain(),
    master:   ctx.createGain(),
  };
  buses.voiceMix.gain.value = 1;
  buses.fxSendA.gain.value  = 1;
  buses.fxSendB.gain.value  = 1;
  buses.master.gain.value   = P.get('masterVol');
  buses.voiceMix.connect(buses.master);
  buses.master.connect(ctx.destination);
  // fxSendA/B intentionally left unconnected — fx.js taps them and returns
  // its wet signal into buses.master.
}

function init(audioCtx) {
  if (initPromise) return initPromise;
  ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();

  initPromise = (async () => {
    unlock();
    noiseBuf  = buildNoiseBuffer();
    stepCurve = makeStepCurve();
    buildMaster();

    dc = ctx.createConstantSource();
    dc.offset.value = 1;
    dc.start();

    staticScale = ctx.createGain();
    staticScale.gain.value = 1 - P.get('ampEnvAmt');
    dc.connect(staticScale);

    // wavetable.js is WO-wavetable's file. Dynamic import + await load() so that a
    // missing module, or a browser without AudioWorklet, degrades to a sine stub
    // instead of breaking the engine.
    try {
      const mod = await import('./wavetable.js?v=7');  // ?v= matches wavetable.js — busts Safari's stale module cache
      if (typeof mod?.Wavetable?.createSource !== 'function') throw new Error('no createSource');
      await mod.Wavetable.load(ctx);          // registers the worklet; rejects if unsupported
      WT = mod; wtStubbed = false;
    } catch (e) {
      WT = null; wtStubbed = true;
      console.warn('[engine] wavetable unavailable, using sine stub:', e?.message || e);
    }

    wireParams();
    startClock();
    ready = true;
    return Engine;
  })();

  return initPromise;
}

// ═══════════════════════════════════════════════════════════
// PARAM WIRING — live voices track knob moves (SC In.kr semantics)
// ═══════════════════════════════════════════════════════════

// Every voice that is still making sound. Pedal-sustained voices have left
// `voices` (so their key can retrigger) but are very much still audible.
function allVoices() { return [...voices.values(), ...rawVoices.values(), ...sustained]; }

function wireParams() {
  P.sub('masterVol', (v) => {
    buses.master.gain.setTargetAtTime(v, ctx.currentTime, SMOOTH);
  });

  P.sub('ampEnvAmt', (v) => {
    const t = ctx.currentTime;
    staticScale.gain.setTargetAtTime(1 - v, t, SMOOTH);
    for (const voice of allVoices()) {
      for (const s of voice.srcs) s.ampScale.gain.setTargetAtTime(v, t, SMOOTH);
    }
  });

  P.sub('filtEnvAmt', () => { for (const v of allVoices()) applyFilter(v); });
  P.sub('lpf',        () => { for (const v of allVoices()) applyFilter(v); });
  P.sub('hpf', (v) => {
    const t = ctx.currentTime;
    for (const voice of allVoices()) voice.hpf.frequency.setTargetAtTime(hpfHzOf(v), t, SMOOTH);
  });

  P.sub('lpq', (v) => {
    const q = lpqOf(v);
    for (const vc of allVoices()) vc.lpf.Q.setTargetAtTime(q, ctx.currentTime, SMOOTH);
  });
  // key-XY target toggles (engine RESULTS proposal, applied by CC 2026-08-15):
  // params mirror the internal multi-select Set so the UI binds params like every
  // other control. Engine.keyXYModes stays as the dev/API accessor.
  for (const [param, mode] of [['keyXYFilter', 'filter'], ['keyXYVib', 'vibrato'], ['keyXYDrive', 'overdrive']]) {
    P.sub(param, (v) => { if (v > 0.5) keyXYModes.add(mode); else keyXYModes.delete(mode); });
  }
  P.sub('tanh',  () => { for (const v of allVoices()) applyDrive(v); });
  P.sub('gain', (v) => {
    const t = ctx.currentTime;
    for (const voice of allVoices()) voice.gainStage.gain.setTargetAtTime(v * 2, t, SMOOTH);
  });

  P.sub('greenPot4', () => { for (const v of allVoices()) applyPan(v); });

  P.sub('faderPW', (v) => {
    const t = ctx.currentTime;
    const off = pwOffset(v);
    for (const voice of allVoices()) if (voice.pwOffset) voice.pwOffset.offset.setTargetAtTime(off, t, SMOOTH);
  });

  for (const src of SOURCES) {
    P.sub(src + 'Lev', (v) => {
      const t = ctx.currentTime;
      for (const voice of allVoices()) voice.src[src].lev.gain.setTargetAtTime(v, t, SMOOTH);
    });
    P.sub(src + 'X', (v) => {
      const t = ctx.currentTime;
      for (const voice of allVoices()) voice.src[src].sendA.gain.setTargetAtTime(v, t, SMOOTH);
    });
    P.sub(src + 'Y', (v) => {
      const t = ctx.currentTime;
      for (const voice of allVoices()) voice.src[src].sendB.gain.setTargetAtTime(v, t, SMOOTH);
    });
    // A/D/S/R are read at note-on (and at release for R) — no live rescheduling,
    // matching how EnvGen latches its segment times in SC.
  }
}

// ═══════════════════════════════════════════════════════════
// SOURCES
// ═══════════════════════════════════════════════════════════

// faderPW 0..1 → pulse width 0.05..0.95 (MTOK_C:427). A saw ramps -1..1 linearly,
// so adding DC offset d and hard-clipping gives duty = (1 + d) / 2 → d = 2*w - 1.
function pwOffset(v) { return 2 * (0.05 + clamp(v, 0, 1) * 0.90) - 1; }

// Returns {node, stop(), freqParams:[AudioParam], extra:{}}
function buildSource(src, freq, voice) {
  if (src === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = [noiseBuf.white, noiseBuf.pink, noiseBuf.brown][P.get('noiseType') | 0] || noiseBuf.white;
    n.loop = true;
    n.start();
    return { node: n, freqParams: [], stop: () => { try { n.stop(); } catch (_) {} } };
  }

  if (src === 'pwm') {
    // saw + DC offset → hard step = pulse with modulatable width.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const sum = ctx.createGain();
    sum.gain.value = 0.5;                       // keep pre-shaper sum inside ±1
    const off = ctx.createConstantSource();
    off.offset.value = pwOffset(P.get('faderPW'));
    off.start();
    const shaper = ctx.createWaveShaper();
    shaper.curve = stepCurve;
    osc.connect(sum); off.connect(sum); sum.connect(shaper);
    osc.start();
    voice.pwOffset = off;
    return {
      node: shaper, freqParams: [osc.frequency], extra: [osc, sum, off],
      stop: () => { try { osc.stop(); } catch (_) {} try { off.stop(); } catch (_) {} },
    };
  }

  if (src === 'wt') {
    if (!wtStubbed) {
      // WO-wavetable returns a live AudioWorkletNode with .frequency/.morph
      // AudioParams and a no-op .start(). It sounds as soon as it is connected.
      try {
        const n = WT.Wavetable.createSource(ctx, freq);
        return {
          // fallback composites expose freqParams (two real AudioParams — vibrato
          // must drive both oscillators); worklet nodes expose .frequency directly
          node: n, freqParams: n.freqParams || (n.frequency ? [n.frequency] : []),
          stop: () => { try { n.stop(); } catch (_) {} },
        };
      } catch (e) {
        console.warn('[engine] wavetable createSource failed, sine for this voice:', e?.message || e);
      }
    }
    // STUB — wavetable unavailable. Sine placeholder; see RESULTS.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.start();
    return { node: osc, freqParams: [osc.frequency], stop: () => { try { osc.stop(); } catch (_) {} } };
  }

  const osc = ctx.createOscillator();
  osc.type = { saw: 'sawtooth', tri: 'triangle', sin: 'sine' }[src];
  osc.frequency.value = freq;
  osc.start();
  return { node: osc, freqParams: [osc.frequency], stop: () => { try { osc.stop(); } catch (_) {} } };
}

// ═══════════════════════════════════════════════════════════
// VOICE
// ═══════════════════════════════════════════════════════════

// ADSR scheduled onto the gain AudioParam of a control-rate GainNode fed by DC.
// Release is scheduled separately in scheduleRelease().
function scheduleAttack(p, a, d, s, t0) {
  p.cancelScheduledValues(t0);
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(1, t0 + a);
  p.linearRampToValueAtTime(clamp(s, 0, 1), t0 + a + d);
}

function scheduleRelease(p, r, t0) {
  const cur = p.value;
  p.cancelScheduledValues(t0);
  p.setValueAtTime(Math.max(cur, 0.0001), t0);
  p.linearRampToValueAtTime(0, t0 + r);
}

function makeVoice(freq, amp) {
  const t0 = ctx.currentTime;
  const voice = {
    freq, amp, released: false, startedAt: t0,
    src: {}, srcs: [], xy: { origin: null, dist: 0, angle: 0.5 },
    baseDrive: driveOf(P.get('tanh')),
  };

  // ── master envelope (control signal): amp + filter sweep ──
  // MTOK_C: Env.adsr(0.005, 0.05, 1.0, pedalReleaseTime)
  const masterEnv = ctx.createGain();
  masterEnv.gain.value = 0;
  dc.connect(masterEnv);
  scheduleAttack(masterEnv.gain, 0.005, 0.05, 1.0, t0);
  voice.masterEnv = masterEnv;

  // ── per-voice chain ──
  const voiceSum   = ctx.createGain(); voiceSum.gain.value = 1;
  const shaper     = ctx.createWaveShaper();
  shaper.curve = makeTanhCurve(voice.baseDrive);
  shaper.oversample = '2x';
  const makeup     = ctx.createGain(); makeup.gain.value = makeupOf(voice.baseDrive);
  const gainStage  = ctx.createGain(); gainStage.gain.value = P.get('gain') * 2;  // linlin 0-2
  const lpf        = ctx.createBiquadFilter(); lpf.type = 'lowpass';  lpf.Q.value = lpqOf(P.get('lpq'));
  const hpf        = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hpfHzOf(P.get('hpf'));
  let panner;
  try { panner = ctx.createStereoPanner(); panner.pan.value = 0; }
  catch (_) { panner = ctx.createGain(); panner.pan = { setTargetAtTime: () => {}, value: 0 }; }  // iOS < 14.5
  const voiceAmp   = ctx.createGain(); voiceAmp.gain.value = 0;

  // masterEnv (control) → voiceAmp.gain, scaled by note amp
  const ampScaleM = ctx.createGain(); ampScaleM.gain.value = amp;
  masterEnv.connect(ampScaleM);
  ampScaleM.connect(voiceAmp.gain);

  // masterEnv → LPF frequency modulation (filtEnvAmt · lpfHz · 3, MTOK_C:456)
  const filtMod = ctx.createGain(); filtMod.gain.value = 0;
  masterEnv.connect(filtMod);
  filtMod.connect(lpf.frequency);

  // ── per-source sub-chains ──
  for (const src of SOURCES) {
    const s = buildSource(src, freq, voice);

    const env = ctx.createGain(); env.gain.value = 0;      // ADSR 0..1 (control)
    dc.connect(env);
    scheduleAttack(env.gain, envTime(P.get(src + 'A')), envTime(P.get(src + 'D')),
                   P.get(src + 'S'), t0);

    const ampScale = ctx.createGain(); ampScale.gain.value = P.get('ampEnvAmt');
    env.connect(ampScale);

    // srcAmp.gain intrinsic 0 + (ampEnvAmt·env) + (1 − ampEnvAmt) = MTOK_C's
    // (1-ampEnvAmt) + (ampEnvAmt * env), exactly, and continuous when a changes.
    const srcAmp = ctx.createGain(); srcAmp.gain.value = 0;
    ampScale.connect(srcAmp.gain);
    staticScale.connect(srcAmp.gain);

    const lev = ctx.createGain(); lev.gain.value = P.get(src + 'Lev');

    const sendA = ctx.createGain(); sendA.gain.value = P.get(src + 'X');
    const sendB = ctx.createGain(); sendB.gain.value = P.get(src + 'Y');

    s.node.connect(srcAmp);
    srcAmp.connect(lev);
    lev.connect(voiceSum);
    lev.connect(sendA); sendA.connect(buses.fxSendA);
    lev.connect(sendB); sendB.connect(buses.fxSendB);

    const entry = { src, s, env, ampScale, srcAmp, lev, sendA, sendB };
    voice.src[src] = entry;
    voice.srcs.push(entry);
  }

  // ── per-key vibrato LFO (key-XY mode 1) ──
  const lfo  = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0;
  lfo.connect(lfoG);
  for (const e of voice.srcs) for (const fp of e.s.freqParams) lfoG.connect(fp);
  lfo.start();

  voiceSum.connect(shaper); shaper.connect(makeup); makeup.connect(gainStage);
  gainStage.connect(lpf); lpf.connect(hpf); hpf.connect(panner); panner.connect(voiceAmp);
  voiceAmp.connect(buses.voiceMix);

  Object.assign(voice, {
    voiceSum, shaper, makeup, gainStage, lpf, hpf, panner, voiceAmp,
    ampScaleM, filtMod, lfo, lfoG,
  });

  applyFilter(voice);
  applyPan(voice);

  // iOS: if the ctx was still suspended, every ramp above was scheduled at a
  // frozen t=0 and is already in the past when audio actually starts. Reschedule
  // from the real start moment. PoC pattern (mtok.html:526-548).
  if (ctx.state !== 'running') {
    const onReady = () => {
      if (ctx.state !== 'running') return;
      ctx.removeEventListener('statechange', onReady);
      if (voice.released) return;
      const now = ctx.currentTime;
      scheduleAttack(voice.masterEnv.gain, 0.005, 0.05, 1.0, now);
      for (const e of voice.srcs) {
        scheduleAttack(e.env.gain, envTime(P.get(e.src + 'A')), envTime(P.get(e.src + 'D')),
                       P.get(e.src + 'S'), now);
      }
    };
    ctx.addEventListener('statechange', onReady);
  }

  return voice;
}

function applyFilter(voice) {
  if (!voice.lpf) return;
  const t = ctx.currentTime;
  const base = lpfHzOf(P.get('lpf'));
  const xyMod = keyXYModes.has('filter') ? (1 + voice.xy.dist * 2) : 1;
  const target = clamp(base * xyMod, 80, 20000);
  voice.lpf.frequency.setTargetAtTime(target, t, SMOOTH);
  // MTOK_C: lpfHz * (1 + filtEnvAmt * masterEnv * 3) → additive mod of lpfHz*3*amt
  voice.filtMod.gain.setTargetAtTime(target * P.get('filtEnvAmt') * 3, t, SMOOTH);
}

function applyDrive(voice) {
  const extra = keyXYModes.has('overdrive') ? voice.xy.dist * 10 : 0;
  const d = driveOf(P.get('tanh')) + extra;
  voice.baseDrive = driveOf(P.get('tanh'));
  voice.shaper.curve = makeTanhCurve(d);
  voice.makeup.gain.setTargetAtTime(makeupOf(d), ctx.currentTime, SMOOTH);
}

function applyPan(voice) {
  const base  = P.get('greenPot4') * 2 - 1;
  const shift = (voice.xy.angle - 0.5) * 0.6;   // ±0.3, MTOK_A:461
  voice.panner.pan.setTargetAtTime(clamp(base + shift, -1, 1), ctx.currentTime, SMOOTH);
}

function releaseVoice(voice, relOverride) {
  if (voice.released) return;
  voice.released = true;

  // Context never ran → nothing was ever audible; skip the ramps and tear down.
  if (!ctx || ctx.state !== 'running') {
    setTimeout(() => teardown(voice), 50);
    return;
  }

  const t = ctx.currentTime;
  // pedalReleaseTime governs ONLY pedal-lift releases (its TouchOSC label:
  // "release time when sustain pedal lifted") — passed in as relOverride, and
  // it overrides the per-source releases too so the fader is actually audible.
  // A normal note-off lets each source use its own R; the master env follows
  // the longest of them so it never truncates a tail. (CC fix 2026-08-15 —
  // previously masterRel always read pedalReleaseTime, so the per-source R
  // capped every tail and the pedal fader appeared dead.)
  const srcRels = voice.srcs.map(e => envTime(P.get(e.src + 'R')));
  const masterRel = relOverride != null ? relOverride : Math.max(0.02, ...srcRels);
  scheduleRelease(voice.masterEnv.gain, masterRel, t);

  let longest = masterRel;
  for (let i = 0; i < voice.srcs.length; i++) {
    const r = relOverride != null ? relOverride : srcRels[i];
    scheduleRelease(voice.srcs[i].env.gain, r, t);
    if (r > longest) longest = r;
  }
  voice.lfoG.gain.cancelScheduledValues(t);
  voice.lfoG.gain.setTargetAtTime(0, t, SMOOTH);

  // ampEnvAmt < 1 leaves a static floor under the per-osc envs, so the master
  // env is what actually silences the voice — but wait for the longest of both.
  setTimeout(() => teardown(voice), (longest + 0.15) * 1000);
}

function teardown(voice) {
  for (const e of voice.srcs) {
    e.s.stop();
    [e.s.node, ...(e.s.extra || []), e.env, e.ampScale, e.srcAmp, e.lev, e.sendA, e.sendB]
      .forEach(n => { try { n.disconnect(); } catch (_) {} });
  }
  try { voice.lfo.stop(); } catch (_) {}
  if (voice.pwOffset) { try { voice.pwOffset.stop(); } catch (_) {} }
  [voice.lfo, voice.lfoG, voice.voiceSum, voice.shaper, voice.makeup, voice.gainStage,
   voice.lpf, voice.hpf, voice.panner, voice.voiceAmp, voice.masterEnv,
   voice.ampScaleM, voice.filtMod]
    .forEach(n => { try { n.disconnect(); } catch (_) {} });

  if (voice.keyId != null && voices.get(voice.keyId) === voice) voices.delete(voice.keyId);
  if (voice.rawId != null && rawVoices.get(voice.rawId) === voice) rawVoices.delete(voice.rawId);
  sustained.delete(voice);
}

// ═══════════════════════════════════════════════════════════
// NOTE LIFECYCLE
// ═══════════════════════════════════════════════════════════

function noteOn(keyId, freq, opts = {}) {
  if (!ready) return null;
  unlock();
  if (voices.has(keyId)) return voices.get(keyId);   // SC: ~notes[key].isNil guard

  const mult = REG_MULTS[P.get('regSelect')] ?? 1.0;
  const voice = makeVoice(freq * mult, 0.3);
  voice.keyId = keyId;
  voice.baseFreq = freq;
  if (opts.x != null && opts.y != null) voice.xy.origin = [opts.x, opts.y];
  voices.set(keyId, voice);
  return voice;
}

function noteOff(keyId) {
  const voice = voices.get(keyId);
  if (!voice) return;
  voice.xy.origin = null;
  if (P.get('pedal') > 0.5) {
    // Pedal down: key lifted but the note keeps sounding. It leaves `voices`
    // so the same key can retrigger, and waits in `sustained` for pedal-up.
    voices.delete(keyId);
    voice.keyId = null;
    sustained.add(voice);
    return;
  }
  releaseVoice(voice);
  voices.delete(keyId);
}

// Relative-from-origin per-key expression. MTOK_A:517-527 + PoC updateVoiceXY.
// x, y are 0-1 within the key the touch started on; y is screen-down, flipped here.
function updateXY(keyId, x, y) {
  if (P.get('keyXYStyle') === 1) return;  // SPEC PENDING (David) — absolute handoff
  const voice = voices.get(keyId);
  if (!voice || voice.released) return;
  if (!voice.xy.origin) { voice.xy.origin = [x, y]; return; }

  const dx = x - voice.xy.origin[0];
  const dy = voice.xy.origin[1] - y;
  const dist  = Math.min(Math.sqrt(dx * dx + dy * dy), 1.0);
  const angle = clamp((Math.atan2(dy, dx) / (2 * Math.PI)) + 0.5, 0, 1);
  voice.xy.dist = dist;
  voice.xy.angle = angle;

  applyPan(voice);                                     // angle pans in every mode
  if (keyXYModes.has('filter'))    applyFilter(voice);
  if (keyXYModes.has('overdrive')) applyDrive(voice);
  if (keyXYModes.has('vibrato')) {
    const t = ctx.currentTime;
    voice.lfo.frequency.setTargetAtTime(0.5 + angle * 11.5, t, SMOOTH);   // 0.5-12 Hz
    voice.lfoG.gain.setTargetAtTime(dist * 0.06 * voice.freq, t, SMOOTH); // 0-6 %
  }
}

function pedal(down) {
  P.set('pedal', down ? 1 : 0);
  if (down) return;
  // Pedal up: release everything that is no longer physically held.
  const rel = envTime(P.get('pedalReleaseTime'));
  for (const voice of [...sustained]) releaseVoice(voice, rel);
  sustained.clear();
}

function panic() {
  // Nuclear silence, PoC pattern (mtok.html:615-636): stop every source, then
  // sever and rebuild the master gain to cut any zombie connection.
  for (const voice of allVoices()) {
    voice.released = true;
    for (const e of voice.srcs) e.s.stop();
    try { voice.lfo.stop(); } catch (_) {}
    if (voice.pwOffset) { try { voice.pwOffset.stop(); } catch (_) {} }
  }
  voices.clear(); rawVoices.clear(); sustained.clear();

  if (ctx && buses) {
    const t = ctx.currentTime;
    buses.master.gain.setValueAtTime(0, t);
    try { buses.master.disconnect(); } catch (_) {}
    try { buses.voiceMix.disconnect(); } catch (_) {}
    buses.master = ctx.createGain();
    buses.master.gain.value = P.get('masterVol');
    buses.master.connect(ctx.destination);
    buses.voiceMix.connect(buses.master);
    // fx.js returns feed buses.master — it re-taps on its own panic hook.
  }
}

function held() {
  return [...voices.entries()].map(([keyId, v]) => ({ keyId, freq: v.baseFreq ?? v.freq }));
}

// Untracked voices for modes.js (arp, harmonizer, drones). Separate namespace so
// they can never collide with played keys, and excluded from held().
function noteOnRaw(id, freq, amp = 0.3) {
  if (!ready) return null;
  if (rawVoices.has(id)) return rawVoices.get(id);
  const mult = REG_MULTS[P.get('regSelect')] ?? 1.0;
  const voice = makeVoice(freq * mult, amp);
  voice.rawId = id;
  voice.baseFreq = freq;
  rawVoices.set(id, voice);
  return voice;
}

function noteOffRaw(id) {
  const voice = rawVoices.get(id);
  if (!voice) return;
  releaseVoice(voice);
  rawVoices.delete(id);
}

// ═══════════════════════════════════════════════════════════
// SCHEDULER — one dumb lookahead clock. Musical logic lives in modes.js.
// ═══════════════════════════════════════════════════════════

const LOOKAHEAD = 0.1;    // s of audio time scheduled ahead
const TICK_MS   = 25;
let clockTimer = null, nextBeatTime = 0, beatIndex = 0;
const tickCbs = new Set();

function startClock() {
  if (clockTimer) return;
  nextBeatTime = ctx.currentTime;
  clockTimer = setInterval(() => {
    if (!ctx) return;
    const beatDur = 60 / clamp(P.get('tempo'), 40, 240);
    while (nextBeatTime < ctx.currentTime + LOOKAHEAD) {
      if (nextBeatTime < ctx.currentTime) nextBeatTime = ctx.currentTime;  // catch up after a stall
      for (const cb of tickCbs) {
        try { cb(nextBeatTime, beatIndex); } catch (e) { console.error('Engine.tick cb:', e); }
      }
      nextBeatTime += beatDur;
      beatIndex++;
    }
  }, TICK_MS);
}

function tick(cb) {
  tickCbs.add(cb);
  return () => tickCbs.delete(cb);
}

// ═══════════════════════════════════════════════════════════

export const Engine = {
  init, noteOn, noteOff, updateXY, pedal, panic, held, noteOnRaw, noteOffRaw, tick,
  get buses() { return buses; },
  get ctx()   { return ctx; },
  get ready() { return ready; },
  keyXYModes,                                  // multi-select Set (see RESULTS)
  voiceCount: () => voices.size + rawVoices.size + sustained.size,
  sustainedCount: () => sustained.size,
  wavetableStubbed: () => wtStubbed,
  unlock,
};

export default Engine;
