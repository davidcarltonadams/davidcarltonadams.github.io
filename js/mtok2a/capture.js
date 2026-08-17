// MTOK2 — Capture + granular playback. WO-capture, 2026-08-16.
// Contract: SPEC-mtok2-web-2026-08-15.md · WORK-ORDER-mtok2-capture-2026-08-16.md
// Owns: buses.master → ring-buffer recording, one-level undo, and a granular
// engine (synth-buffer / mic / preselected-file sources) whose output feeds
// back into Engine.buses.master.
//
// HARD CONSTRAINT (WORK ORDER + REVIEW-mtok2-wavetable addendum): David's
// iPad Air 4 Safari has NO AudioWorklet. This file uses ONLY
// ScriptProcessorNode (deprecated but universal, and it hands us synchronous
// Float32 access, which a worklet's message-passing would make painful for a
// ring buffer anyway) — see RESULTS for the MediaRecorder alternative that
// was considered and rejected.
//
// SOURCE NUMBERING HANDSHAKE (coordinate with fx.js — SPEC reserves this):
// `yellowModRad` 0-2 are owned by fx.js (vib+trem / reverb ctl / FM).
// 3 = synth buffer (this module's recorded take), 4 = mic, 5 = preselected
// file. fx.js's applyYellowMode() only branches on mode 0/1/2 so it silently
// no-ops for 3-5 — no collision. Granular here is "active" (audible, and
// claims xy1/xy2) exactly when yellowModRad is 3, 4, or 5.
//
// PANIC CONTRACT (mirrors fx.js's — read that file's header comment for the
// underlying mechanism): Engine.panic() calls `buses.master.disconnect()`
// on the OLD master node (severing our master→recProc tap, an edge that is
// OUTGOING from master) and then replaces `buses.master` with a brand-new
// GainNode. Our grainOut→master edge is OUTGOING from grainOut, so it is
// NOT severed by that call, but it now points at a disconnected, orphaned
// node — silent, not connected to destination. Both need to be redone
// against the CURRENT buses.master. Capture.panic() does this AND stops
// every in-flight grain immediately; it does NOT touch recording state — the
// recorder (ScriptProcessor + ring buffer) survives and can re-arm, per WO
// acceptance. Whoever wires the panic button (ui.js) must call
// `Engine.panic(); FX.panic(); Capture.panic();` together.

import { P } from './state.js?v=6';

const clamp  = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const lin    = (v, lo, hi) => lo + clamp(v, 0, 1) * (hi - lo);
const linexp = (v, inLo, inHi, lo, hi) => {
  const x = clamp(v, inLo, inHi);
  return lo * Math.pow(hi / lo, (x - inLo) / (inHi - inLo));
};

// ═══════════════════════════════════════════════════════════
// CAPTURE_PARAMS — local param table (state.js is read-only; proposed for
// real promotion there in RESULTS). Same get/set/sub shape as state.js's P
// so dev harnesses and (eventually) ui.js can treat it identically.
// ═══════════════════════════════════════════════════════════

const CAPTURE_PARAMS = {
  recButt:    [0,    'record enable — rising edge starts recording buses.master into the ring buffer, falling edge stops + finalizes a take'],
  undoButton: [0,    'momentary trigger — rising edge swaps current/previous take (one level, matches TouchOSC undo)'],
  capSpray:   [0.15, 'grain start-position random jitter, 0-1 (fraction of buffer length)'],
  capLevel:   [0.7,  'granular engine output level into buses.master'],
};

const _cv = {}, _cs = {};
for (const k in CAPTURE_PARAMS) _cv[k] = CAPTURE_PARAMS[k][0];

const CP = {
  names: () => Object.keys(CAPTURE_PARAMS),
  meta:  (n) => CAPTURE_PARAMS[n],
  get:   (n) => _cv[n],
  set(n, v) {
    if (!(n in _cv)) { console.warn('CP.set unknown param:', n); return; }
    const prev = _cv[n];
    if (prev === v) return;
    _cv[n] = v;
    (_cs[n] || []).forEach(fn => fn(v, prev, n));
  },
  sub(n, fn) { (_cs[n] = _cs[n] || []).push(fn); return () => { _cs[n] = _cs[n].filter(f => f !== fn); }; },
};

// ═══════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════

let ctx = null, buses = null;

// ── recorder: rolling ring buffer over buses.master ──
// 12s: comfortably above the WO's "≥8s" floor (room for a full chord + a
// beat of silence either side without truncating), small enough (12s * 2ch *
// 4B * 44.1kHz ≈ 4.2MB) to be a non-issue on an iPad.
const RING_SEC = 12;
let ringLen = 0, ringData = null;      // [Float32Array L, Float32Array R]
let writePos = 0, wroteSamples = 0, recording = false;
let recProc = null;
let currentTake = null, prevTake = null;   // AudioBuffer | null — Capture.buffer / one-level undo

// ── mic: continuously-updated rolling mono buffer, separate from the main
// ring (mic capture and master-recording are independent lanes) ──
const MIC_RING_SEC = 6;
let micStream = null, micSourceNode = null, micProc = null;
let micRing = null, micRingLen = 0, micWritePos = 0, micWrote = 0;
let micArmed = false, micDenied = false;
let micSnapCache = null, micSnapAt = -1;

// ── preselected file (source 5) ──
let fileBuffer = null, fileLoadAttempted = false, fileLoadError = null;

// ── granular engine ──
let grainOut = null;                   // persistent gain, always -> buses.master (see PANIC CONTRACT)
let hannCurve = null;
const liveGrains = new Set();          // {src, env} — stopped immediately on panic
let clockTimer = null, nextGrainTime = 0;
const LOOKAHEAD = 0.1, TICK_MS = 25;   // same lookahead-clock shape as engine.js's startClock

// ═══════════════════════════════════════════════════════════
// RING BUFFER HELPERS
// ═══════════════════════════════════════════════════════════

function buildHann(steps = 64) {
  const c = new Float32Array(steps);
  for (let i = 0; i < steps; i++) c[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (steps - 1)));
  return c;
}

// Un-wraps a circular buffer into a linear Float32Array of length `wrote`,
// oldest sample first. `wrote < len` means the ring hasn't filled yet (oldest
// sample is index 0); `wrote === len` means it wrapped (oldest is at `wp`).
function linearizeRing(ring, wp, wrote, len) {
  const out = new Float32Array(wrote);
  if (wrote < len) {
    out.set(ring.subarray(0, wrote));
  } else {
    const tail = len - wp;
    out.set(ring.subarray(wp, len), 0);
    out.set(ring.subarray(0, wp), tail);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// RECORDER (buses.master → ring buffer)
// ═══════════════════════════════════════════════════════════

function attachRecorder() {
  // 4096-sample blocks: same size PoC/engine-era code treats as "safe" for
  // ScriptProcessor on iOS (small enough for low latency, large enough to
  // avoid glitching under GC pressure).
  recProc = ctx.createScriptProcessor(4096, 2, 2);
  recProc.onaudioprocess = (e) => {
    if (!recording) return;
    const inp = e.inputBuffer;
    const chs = Math.min(inp.numberOfChannels, 2);
    const n = inp.length;
    const chData = [inp.getChannelData(0), chs > 1 ? inp.getChannelData(1) : inp.getChannelData(0)];
    let wp = writePos;
    for (let i = 0; i < n; i++) {
      ringData[0][wp] = chData[0][i];
      ringData[1][wp] = chData[1][i];
      wp = (wp + 1) % ringLen;
    }
    writePos = wp;
    wroteSamples = Math.min(wroteSamples + n, ringLen);
  };
  // ScriptProcessorNode only reliably fires onaudioprocess while it sits on a
  // path to destination (spec quirk, still true in current engines). Route
  // its output through a zero-gain node so the tap stays silent.
  const mute = ctx.createGain(); mute.gain.value = 0;
  recProc.connect(mute);
  mute.connect(ctx.destination);
}

function startRecording() {
  if (!ctx || recording) return;
  writePos = 0;
  wroteSamples = 0;
  recording = true;
}

function stopRecording() {
  if (!recording) return;
  recording = false;
  const len = wroteSamples;
  if (len < 512) { console.warn('[capture] recording too short (<12ms), discarded'); return; }
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  buf.copyToChannel(linearizeRing(ringData[0], writePos, len, ringLen), 0);
  buf.copyToChannel(linearizeRing(ringData[1], writePos, len, ringLen), 1);
  prevTake = currentTake;   // one level of undo history
  currentTake = buf;
}

function undo() {
  if (!prevTake) { console.warn('[capture] nothing to undo'); return; }
  const tmp = currentTake;
  currentTake = prevTake;
  prevTake = tmp;
}

CP.sub('recButt', (v, prev) => {
  const on = v > 0.5, was = prev > 0.5;
  if (on && !was) startRecording();
  if (!on && was) stopRecording();
});
CP.sub('undoButton', (v, prev) => {
  if (v > 0.5 && !(prev > 0.5)) undo();
});
CP.sub('capLevel', (v) => {
  if (grainOut) grainOut.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
});

// ═══════════════════════════════════════════════════════════
// MIC SOURCE (4) — getUserMedia is gesture-gated by the caller: only invoke
// armMic() from inside a real user-gesture handler (a pointerdown/click), or
// from a P.sub callback that itself fires synchronously inside one (e.g. a
// radio-button tap in ui.js that calls P.set('yellowModRad', 4)). Denial is
// caught and left non-fatal — every other source keeps working.
// ═══════════════════════════════════════════════════════════

async function armMic() {
  if (micArmed || micDenied || !ctx) return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    micDenied = true;
    console.warn('[capture] mic permission denied or unavailable:', e?.message || e);
    return;
  }
  micSourceNode = ctx.createMediaStreamSource(micStream);
  micRingLen = Math.floor(ctx.sampleRate * MIC_RING_SEC);
  micRing = new Float32Array(micRingLen);
  micProc = ctx.createScriptProcessor(2048, 1, 1);
  micProc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    let wp = micWritePos;
    for (let i = 0; i < data.length; i++) { micRing[wp] = data[i]; wp = (wp + 1) % micRingLen; }
    micWritePos = wp;
    micWrote = Math.min(micWrote + data.length, micRingLen);
  };
  const muteMic = ctx.createGain(); muteMic.gain.value = 0;
  micSourceNode.connect(micProc);
  micProc.connect(muteMic);
  muteMic.connect(ctx.destination);
  micArmed = true;
}

// Rebuilds (throttled) a snapshot AudioBuffer from the live mic ring so
// grains can read it with the same offset/position math as the other two
// sources. "position" for mic is therefore PROVISIONAL: it reads as
// lookback depth into the last MIC_RING_SEC of audio, not a fixed take's
// timeline — see RESULTS.
function micSnapshotBuffer() {
  if (!micArmed || micWrote < 512) return null;
  const now = ctx.currentTime;
  if (micSnapCache && now - micSnapAt < 0.1) return micSnapCache;
  const lin_ = linearizeRing(micRing, micWritePos, micWrote, micRingLen);
  const buf = ctx.createBuffer(1, lin_.length, ctx.sampleRate);
  buf.copyToChannel(lin_, 0);
  micSnapCache = buf;
  micSnapAt = now;
  return buf;
}

// ═══════════════════════════════════════════════════════════
// FILE SOURCE (5) — fetched relative to THIS module (import.meta.url), so it
// resolves the same way regardless of which page imports capture.js.
// ═══════════════════════════════════════════════════════════

const FILE_PATH = '../../assets/mtok-capture-sample.wav';

async function loadFile() {
  if (fileBuffer || fileLoadAttempted || !ctx) return fileBuffer;
  fileLoadAttempted = true;
  try {
    const url = new URL(FILE_PATH, import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const arr = await res.arrayBuffer();
    fileBuffer = await ctx.decodeAudioData(arr);
  } catch (e) {
    fileLoadError = e?.message || String(e);
    console.warn('[capture] preselected file source (5) unavailable:', fileLoadError);
  }
  return fileBuffer;
}

// ═══════════════════════════════════════════════════════════
// GRANULAR ENGINE
// ═══════════════════════════════════════════════════════════

function sourceBufferForMode(mode) {
  if (mode === 3) return currentTake;
  if (mode === 4) return micSnapshotBuffer();
  if (mode === 5) return fileBuffer;
  return null;
}

// Control mapping when granular is active (WO step 4 — PROVISIONAL reading,
// no TouchOSC precedent to port from, unlike the rest of the surface):
//   xy1x = position (0-1 fraction into the buffer)
//   xy1y = grain size (10-100ms, per WO step 2's envelope range)
//   xy2x = density (grains/sec, log-mapped 1-40)
//   xy2y = pitch (playback rate, log-mapped ~0.25x-4x, centered at xy2y=0.5)
// capSpray and capLevel (CAPTURE_PARAMS, not xy-mapped — only 4 DOF on two
// pads for 5 requested params) round out position/spray/density/pitch/level.
function scheduleGrain(t0, srcBuffer) {
  const dur = srcBuffer.duration;
  if (dur <= 0) return;

  const grainSizeSec = lin(P.get('xy1y'), 0.010, 0.100);
  const positionFrac = clamp(P.get('xy1x'), 0, 1);
  const pitchRatio = Math.pow(2, (clamp(P.get('xy2y'), 0, 1) - 0.5) * 4);   // ~0.25x .. 4x, 1x @ 0.5
  const sprayFrac = CP.get('capSpray');

  const jitter = (Math.random() * 2 - 1) * sprayFrac * dur * 0.5;
  const offsetSec = clamp(positionFrac * dur + jitter, 0, Math.max(dur - 0.005, 0));

  const src = ctx.createBufferSource();
  src.buffer = srcBuffer;
  src.playbackRate.value = pitchRatio;

  const env = ctx.createGain();
  env.gain.value = 0;
  src.connect(env);
  env.connect(grainOut);

  const heardDur = grainSizeSec / pitchRatio;
  env.gain.setValueCurveAtTime(hannCurve, t0, heardDur);
  src.start(t0, offsetSec);
  src.stop(t0 + heardDur + 0.01);

  const entry = { src, env };
  liveGrains.add(entry);
  const cleanup = () => {
    liveGrains.delete(entry);
    try { src.disconnect(); } catch (_) {}
    try { env.disconnect(); } catch (_) {}
  };
  src.onended = cleanup;
  // Belt-and-suspenders: onended can be unreliable across engines when a
  // node is stopped early (panic) — the panic path also removes from
  // liveGrains directly, so double-cleanup here is harmless (try/catch).
}

function startGrainClock() {
  if (clockTimer) return;
  nextGrainTime = ctx.currentTime;
  clockTimer = setInterval(() => {
    if (!ctx) return;
    const mode = P.get('yellowModRad') | 0;
    const active = mode >= 3 && mode <= 5;
    const buf = active ? sourceBufferForMode(mode) : null;
    if (!active || !buf) { nextGrainTime = ctx.currentTime; return; }   // stay caught up, emit nothing

    const densityHz = linexp(P.get('xy2x'), 0.001, 1.0, 1, 40);
    const interval = 1 / densityHz;
    while (nextGrainTime < ctx.currentTime + LOOKAHEAD) {
      if (nextGrainTime < ctx.currentTime) nextGrainTime = ctx.currentTime;  // catch up after a stall
      scheduleGrain(nextGrainTime, buf);
      nextGrainTime += interval;
    }
  }, TICK_MS);
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

function init(audioCtx, engineBuses) {
  if (ctx) return Capture;   // idempotent guard — dev harnesses may call once per page
  ctx = audioCtx;
  buses = engineBuses;

  ringLen = Math.floor(ctx.sampleRate * RING_SEC);
  ringData = [new Float32Array(ringLen), new Float32Array(ringLen)];
  attachRecorder();
  buses.master.connect(recProc);

  grainOut = ctx.createGain();
  grainOut.gain.value = CP.get('capLevel');
  grainOut.connect(buses.master);

  hannCurve = buildHann(64);
  startGrainClock();
  loadFile();   // fire-and-forget; no gesture required for a same-origin fetch

  // Auto-arm mic the first time yellowModRad selects source 4. Relies on the
  // caller having set yellowModRad from inside a real user gesture — flagged
  // unverified-on-iPad in RESULTS.
  P.sub('yellowModRad', (v) => {
    const m = v | 0;
    if (m === 4) armMic();
    if (m === 5) loadFile();
  });

  return Capture;
}

// See PANIC CONTRACT header comment. Kills every in-flight grain immediately
// and re-taps grainOut + the recorder against the CURRENT buses.master.
// Recording state (recording/writePos/wroteSamples/currentTake/prevTake) is
// untouched — the recorder survives and can re-arm.
function panic() {
  for (const { src, env } of liveGrains) {
    try { src.stop(); } catch (_) {}
    try { src.disconnect(); } catch (_) {}
    try { env.disconnect(); } catch (_) {}
  }
  liveGrains.clear();
  if (ctx) nextGrainTime = ctx.currentTime;   // resync so we don't burst-catch-up

  if (!ctx || !buses) return;
  try { grainOut.disconnect(); } catch (_) {}
  grainOut.connect(buses.master);
  if (recProc) { try { buses.master.connect(recProc); } catch (_) {} }
}

export const Capture = {
  init,
  panic,
  // recorder
  setRecButt: (v) => CP.set('recButt', v),
  triggerUndo: () => CP.set('undoButton', 1) || CP.set('undoButton', 0),  // synthesize a momentary press
  get buffer() { return currentTake; },
  get prevBuffer() { return prevTake; },
  isRecording: () => recording,
  recordedSeconds: () => (ctx ? wroteSamples / ctx.sampleRate : 0),
  // sources
  armMic,
  micStatus: () => (micDenied ? 'denied' : micArmed ? 'armed' : 'unarmed'),
  loadFile,
  fileStatus: () => (fileBuffer ? 'loaded' : fileLoadAttempted ? ('failed: ' + fileLoadError) : 'not attempted'),
  // granular
  liveGrainCount: () => liveGrains.size,
  // param table (mirrors P's shape; see CAPTURE_PARAMS for proposed state.js entries)
  params: CP,
};

export default Capture;
