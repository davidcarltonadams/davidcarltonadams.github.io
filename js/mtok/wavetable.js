// MTOK2 wavetable oscillator module — WO-wavetable.
// Wraps the AudioWorklet processor: table-pair selection, morph, drawable
// paint. Owns params: wavetableRadio, wtFader, wth (reserved).
// Contract: SPEC-mtok2-web-2026-08-15.md.

import { P } from './state.js?v=7';

// ?v= busts Safari's module cache — bump when the worklet file changes.
const WORKLET_URL = new URL('./wavetable-worklet.js?v=7', import.meta.url).href;
const TABLE_SIZE = 2048;
const VERSION = 5;   // surfaced as Wavetable.VERSION for cache diagnostics
const PAIRS = [[0, 1], [1, 2], [2, 3], [3, 4]];

let loadPromise = null;
let loadedCtx = null;
let currentPairIdx = 0; // canonical pair state — updated by setPair(), read by createSource()
let mode = null;        // 'worklet' | 'periodicwave' (fallback) — set by load()
const liveNodes = new Set();

// ═══ PeriodicWave fallback (CC 2026-08-16) ═══════════════════
// David's iPad Air 4 Safari has NO AudioWorklet (supported:false with ctx
// running — likely Lockdown Mode or iPadOS < 14.5). Since it is the primary
// performance device, the fallback must be musical, not a sine stub. The
// static tables are pure harmonic recipes, so we hand Safari native
// PeriodicWave oscillators; morph = equal-power SPECTRAL blend of the pair
// (linear table mix == linear spectral mix, so this is exact up to phase);
// the drawable is DFT'd to 129 partials, throttled. Trade-offs vs worklet:
// PeriodicWave renormalizes each blend (constant-loudness approximation of
// equal-power), and morph updates are stepped at ~25 fps instead of k-rate.
const NH = 130; // partials 1..129
function spec(fill) { const a = new Float32Array(NH); fill(a); return a; }
const SPECTRA = [
  spec(a => { a[1] = 1; }),                                                  // sine
  spec(a => { for (let n = 1; n <= 16; n++) a[n] = 1 / n; }),                // saw-16h
  spec(a => { for (let n = 1; n <= 31; n += 2) a[n] = 1 / n; }),             // square odd-16
  spec(a => { a[1] = 1; a[2] = 0.6; a[3] = 0.3; a[5] = 0.15; a[7] = 0.45;    // complex —
              a[11] = 0.3; a[13] = 0.2; }),                                  // MTOK_B 7/11/13 weights
  new Float32Array(NH),                                                      // drawable (DFT'd)
];
const FB_REAL = new Float32Array(NH); // cosine terms stay 0 — tables are sin-built
let fbTimer = null, fbNeedsDrawSpec = false;

function computeDrawSpec() {
  const d = drawMirror, out = SPECTRA[4], N = TABLE_SIZE;
  for (let k = 1; k < NH; k++) {
    let s = 0; const w = 2 * Math.PI * k / N;
    for (let n = 0; n < N; n++) s += d[n] * Math.sin(w * n);
    out[k] = (2 / N) * s;
  }
}

function fbWaveFor(tableIdx) {
  const s = SPECTRA[tableIdx];
  for (let k = 1; k < NH; k++) if (s[k]) return loadedCtx.createPeriodicWave(FB_REAL, s);
  const im = new Float32Array(NH); im[1] = 1e-6;   // all-silent table (undrawn buf4): valid near-silent wave
  return loadedCtx.createPeriodicWave(FB_REAL, im);
}

// Pair switches and drawable edits refresh both oscillators of every live
// composite. Safari can be flaky about setPeriodicWave on a RUNNING osc, so
// morph itself never swaps waves (gain crossfade only) — a pair switch that
// doesn't take mid-note self-heals on the next retrigger.
function fbApplySoon() {
  if (fbTimer) return;
  fbTimer = setTimeout(() => {
    fbTimer = null;
    if (!loadedCtx) return;
    if (fbNeedsDrawSpec) { computeDrawSpec(); fbNeedsDrawSpec = false; }
    const [ai, bi] = PAIRS[currentPairIdx];
    const wa = fbWaveFor(ai), wb = fbWaveFor(bi);
    for (const n of liveNodes) if (n.__fb) { n.__oscA.setPeriodicWave(wa); n.__oscB.setPeriodicWave(wb); }
  }, 40);
}

// Dual-oscillator composite: oscA = pair's table A, oscB = table B, morph is a
// pure equal-power GAIN crossfade — live-safe on every browser, k-rate smooth.
// Returned node is a GainNode (mix out) dressed with the worklet node's API.
function createFallbackSource(ctx, freq) {
  const [ai, bi] = PAIRS[currentPairIdx];
  const oA = ctx.createOscillator(), oB = ctx.createOscillator();
  oA.frequency.value = freq; oB.frequency.value = freq;
  oA.setPeriodicWave(fbWaveFor(ai)); oB.setPeriodicWave(fbWaveFor(bi));
  const gA = ctx.createGain(), gB = ctx.createGain();
  const out = ctx.createGain();
  oA.connect(gA).connect(out); oB.connect(gB).connect(out);

  let mv = P.get('wtFader');
  const setMorph = (v, tc) => {
    mv = v;
    const angle = clamp01(v) * 0.5 * Math.PI;
    const t = ctx.currentTime;
    gA.gain.setTargetAtTime(Math.cos(angle), t, tc);
    gB.gain.setTargetAtTime(Math.sin(angle), t, tc);
  };
  gA.gain.value = Math.cos(clamp01(mv) * 0.5 * Math.PI);
  gB.gain.value = Math.sin(clamp01(mv) * 0.5 * Math.PI);

  out.__fb = true; out.__oscA = oA; out.__oscB = oB;
  // BOTH oscillators must retune together — .frequency is a forwarding shim
  // (harness slider), .freqParams exposes the real AudioParams (engine joins
  // its vibrato LFO to every entry).
  out.freqParams = [oA.frequency, oB.frequency];
  out.frequency = {
    get value() { return oA.frequency.value; },
    setValueAtTime(v, t) { oA.frequency.setValueAtTime(v, t); oB.frequency.setValueAtTime(v, t); },
    setTargetAtTime(v, t, tc) { oA.frequency.setTargetAtTime(v, t, tc); oB.frequency.setTargetAtTime(v, t, tc); },
  };
  out.morph = {
    get value() { return mv; },
    setValueAtTime(v) { setMorph(v, 0.005); },
    setTargetAtTime(v) { setMorph(v, 0.015); },
  };
  oA.start(); oB.start();   // self-sounding once connected, like the worklet node
  out.start = () => {};
  out.stop = () => {
    liveNodes.delete(out);
    try { oA.stop(); oB.stop(); } catch (_) {}
    [oA, oB, gA, gB, out].forEach(n => { try { n.disconnect(); } catch (_) {} });
  };
  liveNodes.add(out);
  return out;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// Local mirror of the drawable table (buf4) for UI rendering without a
// round trip through the worklet's message port.
const drawMirror = new Float32Array(TABLE_SIZE);

function supported() {
  // Don't test window.AudioWorklet — Safari (iPad included) doesn't reliably
  // expose the AudioWorklet constructor globally even when the feature works.
  // The robust check is audioWorklet on the context prototype + the node ctor.
  // (CC fix 2026-08-15 after false "unavailable" on iPad Air 4 Safari.)
  if (typeof window === 'undefined' || typeof AudioWorkletNode === 'undefined') return false;
  const AC = window.AudioContext || window.webkitAudioContext;
  return !!(AC && 'audioWorklet' in AC.prototype);
}

export const Wavetable = {
  VERSION,
  supported,

  get mode() { return mode; },

  // ctx: AudioContext. Idempotent per-context; re-call with a new ctx (e.g.
  // after a panic rebuild) to re-register the module on that context.
  // NEVER rejects for a missing AudioWorklet anymore — it degrades to the
  // PeriodicWave fallback and resolves, so consumers get sound either way.
  load(ctx) {
    if (loadedCtx === ctx && loadPromise) return loadPromise;
    loadedCtx = ctx;
    liveNodes.clear();
    if (!supported()) {
      mode = 'periodicwave';
      loadPromise = Promise.resolve('periodicwave');
    } else {
      mode = 'worklet';
      loadPromise = ctx.audioWorklet.addModule(WORKLET_URL)
        .catch(err => { console.warn('addModule failed, PeriodicWave fallback:', err?.message); mode = 'periodicwave'; });
    }
    return loadPromise;
  },

  // Returns a node with .frequency/.morph params and .start()/.stop() shims —
  // an AudioWorkletNode, or a PeriodicWave oscillator in fallback mode.
  createSource(ctx, freq = 440) {
    if (loadedCtx !== ctx) throw new Error('Wavetable.load(ctx) must resolve for this AudioContext before createSource().');
    if (mode === 'periodicwave') return createFallbackSource(ctx, freq);
    const node = new AudioWorkletNode(ctx, 'mtok-wavetable-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    node.frequency = node.parameters.get('frequency');
    node.morph = node.parameters.get('morph');
    node.frequency.setValueAtTime(freq, ctx.currentTime);
    node.morph.setValueAtTime(P.get('wtFader'), ctx.currentTime);
    node.port.postMessage({ setPair: currentPairIdx });
    // Seed with the current painted state — SC's design has ONE shared buf4
    // read by every voice, so a fresh voice must hear existing paint, not silence.
    node.port.postMessage({ loadDrawable: drawMirror.slice() });
    node.start = () => {}; // no-op shim — node is live as soon as it's connected
    node.stop = () => { liveNodes.delete(node); try { node.disconnect(); } catch (_) {} };
    liveNodes.add(node);
    return node;
  },

  setPair(radioVal) {
    currentPairIdx = pairIdxFromRadio(radioVal);
    for (const node of liveNodes) if (!node.__fb) node.port.postMessage({ setPair: currentPairIdx });
    fbApplySoon();
  },

  // x,y in 0-1 (touch-pad coords). Per MTOK_B block 9: x -> frame index,
  // y inverted -> amplitude (drag up = positive).
  draw(x, y) {
    const idx = Math.max(0, Math.min(TABLE_SIZE - 1, Math.round(x * 2047)));
    const amp = (1 - y) * 2 - 1; // y:0->+1, y:1->-1 (invert of SC's linlin(0,1,1,-1))
    drawMirror[idx] = amp;
    for (const node of liveNodes) if (!node.__fb) node.port.postMessage({ draw: { idx, amp } });
    fbNeedsDrawSpec = true; fbApplySoon();
  },

  clear() {
    drawMirror.fill(0);
    for (const node of liveNodes) if (!node.__fb) node.port.postMessage({ clearDrawable: true });
    SPECTRA[4].fill(0); fbApplySoon();
  },

  // Read-only mirror for dev/UI canvas rendering — not the source of truth,
  // the worklet's own table is (this just tracks what draw() has sent).
  drawableMirror: drawMirror,
};

function pairIdxFromRadio(val) {
  return Math.max(0, Math.min(3, val | 0));
}

// Own wavetableRadio + wtFader per SPEC.
P.sub('wavetableRadio', (val) => Wavetable.setPair(val));
P.sub('wtFader', (val) => {
  if (!loadedCtx) return;
  const now = loadedCtx.currentTime;
  for (const node of liveNodes) node.morph.setValueAtTime(val, now);
});
// wth (WT harmonics) — reserved, reading unconfirmed (SPEC open question).
P.sub('wth', () => {});
