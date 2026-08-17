// MTOK2 wavetable AudioWorkletProcessor — WO-wavetable.
// Ports MTOK_B.scd blocks 6b/7/9: 5×2048-frame tables, Phasor+BufRd(interp=4)
// playback, XFade2-style equal-power morph between the selected pair.
// Owner: WO-wavetable. Contract: SPEC-mtok2-web-2026-08-15.md.

const TABLE_SIZE = 2048;
const PAIRS = [[0, 1], [1, 2], [2, 3], [3, 4]];

function makeSine() {
  const t = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) t[i] = Math.sin((i / TABLE_SIZE) * 2 * Math.PI);
  return normalize(t);
}

function makeSaw() {
  const t = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) {
    const ph = i / TABLE_SIZE;
    let s = 0;
    for (let k = 0; k < 16; k++) {
      const n = k + 1;
      s += Math.sin(ph * 2 * Math.PI * n) / n;
    }
    t[i] = s;
  }
  return normalize(t);
}

function makeSquare() {
  const t = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) {
    const ph = i / TABLE_SIZE;
    let s = 0;
    for (let k = 0; k < 16; k++) {
      const n = k * 2 + 1;
      s += Math.sin(ph * 2 * Math.PI * n) / n;
    }
    t[i] = s;
  }
  return normalize(t);
}

function makeComplex() {
  // MTOK_B Block 6b: fundamental + 2nd + 3rd + septimal(7)/undecimal(11)/tridecimal(13) + 5th
  const t = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) {
    const ph = i / TABLE_SIZE;
    const tp = ph * 2 * Math.PI;
    t[i] = Math.sin(tp) * 1.0
      + Math.sin(tp * 2) * 0.6
      + Math.sin(tp * 3) * 0.3
      + Math.sin(tp * 7) * 0.45
      + Math.sin(tp * 11) * 0.3
      + Math.sin(tp * 13) * 0.2
      + Math.sin(tp * 5) * 0.15;
  }
  return normalize(t);
}

function normalize(t) {
  let peak = 0.001;
  for (let i = 0; i < t.length; i++) peak = Math.max(peak, Math.abs(t[i]));
  const g = 0.9 / peak;
  for (let i = 0; i < t.length; i++) t[i] *= g;
  return t;
}

// 4-point cubic (Catmull-Rom) read, wrapping — matches BufRd interp=4 in spirit
// (smooth, click-free interpolation; exact SC kernel not reproduced).
function cubicRead(table, phase) {
  const n = table.length;
  const i1 = Math.floor(phase);
  const frac = phase - i1;
  const i0 = (i1 - 1 + n) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;
  const y0 = table[i0], y1 = table[i1 % n], y2 = table[i2], y3 = table[i3];
  const a0 = y3 - y2 - y0 + y1;
  const a1 = y0 - y1 - a0;
  const a2 = y2 - y0;
  const a3 = y1;
  const f2 = frac * frac;
  return a0 * frac * f2 + a1 * f2 + a2 * frac + a3;
}

// Static tables 0-3 are generated ONCE at module evaluation (addModule time)
// and shared read-only across all processor instances — generating them in the
// constructor would burn ~80k Math.sin calls on the audio thread at every
// noteOn, a dropout risk under polyphony. Only the drawable (4) is per-instance.
const STATIC_TABLES = [makeSine(), makeSaw(), makeSquare(), makeComplex()];

class MtokWavetableProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 0.01, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'morph', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.tables = [...STATIC_TABLES, new Float32Array(TABLE_SIZE)];
    this.pairIdx = 0;
    this.phase = 0;
    this.port.onmessage = (e) => {
      const msg = e.data || {};
      if (typeof msg.setPair === 'number') {
        this.pairIdx = Math.max(0, Math.min(PAIRS.length - 1, msg.setPair | 0));
      } else if (msg.draw) {
        const { idx, amp } = msg.draw;
        if (idx >= 0 && idx < TABLE_SIZE) this.tables[4][idx] = amp;
      } else if (msg.clearDrawable) {
        this.tables[4].fill(0);
      } else if (msg.loadDrawable) {
        this.tables[4].set(msg.loadDrawable);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const freqParam = parameters.frequency;
    const morph = parameters.morph[0]; // k-rate
    const [aIdx, bIdx] = PAIRS[this.pairIdx];
    const tableA = this.tables[aIdx];
    const tableB = this.tables[bIdx];
    // equal-power crossfade, mirrors XFade2 with pan = morph*2-1
    const pan = morph * 2 - 1;
    const angle = (pan + 1) * 0.25 * Math.PI; // 0..pi/2
    const gainA = Math.cos(angle);
    const gainB = Math.sin(angle);

    for (let i = 0; i < out.length; i++) {
      const freq = freqParam.length > 1 ? freqParam[i] : freqParam[0];
      const inc = (freq / sampleRate) * TABLE_SIZE;
      this.phase += inc;
      if (this.phase >= TABLE_SIZE) this.phase -= TABLE_SIZE;
      if (this.phase < 0) this.phase += TABLE_SIZE;
      const a = cubicRead(tableA, this.phase);
      const b = cubicRead(tableB, this.phase);
      out[i] = a * gainA + b * gainB;
    }
    return true;
  }
}

registerProcessor('mtok-wavetable-processor', MtokWavetableProcessor);
