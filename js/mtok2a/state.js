// MTOK2 shared param store — scaffolded by CC 2026-08-15.
// READ-ONLY for work orders: propose changes in your RESULTS file, don't edit.
// Contract: SPEC-mtok2-web-2026-08-15.md (scratchpad/active/).
//
// All params are numbers. Range is 0–1 unless noted in PARAMS.
// Names mirror the TouchOSC layout (mtok_adsr_2026-03-15.tosc).

const SOURCES = ['saw', 'pwm', 'tri', 'sin', 'wt', 'noise'];

// name: [default, comment]
const PARAMS = {
  // ── per-source (expanded below): <src>Lev, <src>A/D/S/R, <src>X/Y, <src>Tup
  // ── oscillator extras
  faderPW:        [0.5,  'PWM pulse width'],
  wtFader:        [0.0,  'wavetable morph within selected pair'],
  wavetableRadio: [0,    'int 0-3: pair sine↔saw, saw↔sq, sq↔complex, complex↔drawable'],
  wth:            [0.0,  'WT harmonics — reserved, reading unconfirmed'],
  // ── envelope matrix (MTOK_C)
  ampEnvAmt:      [1.0,  '0=static levels, 1=full per-osc ADSR shaping'],
  filtEnvAmt:     [0.0,  'master env sweeps LPF open on attack'],
  // ── master chain
  tanh:           [0.1,  'saturation drive (makeup-gain compensated)'],
  gain:           [0.7,  'gain stage, maps 0-2x'],
  lpf:            [0.95, 'LPF cutoff, linexp 80-20000 Hz'],
  lpq:            [0.465, 'LPF resonance, linexp Q 0.3-12; 0.465 ≈ SC RLPF rq 0.6 (David 2026-08-15)'],
  hpf:            [0.0,  'HPF cutoff, linexp 20-5000 Hz'],
  rolloff:        [0.0,  'filter keyboard-tracking amount — reading unconfirmed'],
  masterVol:      [0.8,  'master volume'],
  // ── FX rack
  feedback:       [0.0,  'slot-A delay feedback'],
  fader5:         [0.3,  'reverb output level — reading unconfirmed'],
  yellowModRad:   [0,    'int: 0 vib+trem, 1 reverb ctl, 2 FM (granular modes reserved)'],
  xy1x: [0.5,''], xy1y: [0.5,''], xy1touch: [0,''],
  xy2x: [0.5,''], xy2y: [0.5,''], xy2touch: [0,''],
  // ── green system
  greenModRad:    [0,    'int: 0 tempo, 1 wavetable draw, 2 reserved'],
  greenXYx: [0.5,''], greenXYy: [0.5,''], greenXYtouch: [0,''],
  greenPot1: [0.5,''], greenPot2: [0.5,''], greenPot3: [0.5,''],
  greenPot4: [0.5,'global pan'], greenPot5: [0.0,''], greenPot6: [0.0,''],
  // ── drones
  loBlueRad: [0,'reserved'], loPurpRad: [0,'reserved'],
  // drone pad touch surfaces (CC integration 2026-08-16) — same transient
  // x/y/touch pattern as xy1/xy2; fx.js consumes via droneUpdate/droneRelease
  loBluex: [0.5,''], loBluey: [0.5,''], loBluetouch: [0,''],
  loPurpx: [0.5,''], loPurpy: [0.5,''], loPurptouch: [0,''],
  // ── performance logic
  radioMode:      [3,    'int: 0 arp, 1 shm, 2 pls, 3 def'],
  tempo:          [120,  'BPM 40-240 (absolute, not 0-1)'],
  chordMode:      [0,    'int: 0 harmonizer (partials per played note), 1 drone (over C)'],
  tog7: [0,''], tog9: [0,''], tog11: [0,''], tog13: [0,''],
  tog15: [0,''], tog33: [0,''], togP5: [0,''], togP5qs: [0,''],
  // ── tuning / register
  radioScale:     [0,    'int: 0 alpha, 1 beta (placeholder), 2 gamma (placeholder), 3 qt'],
  dplusRadio:     [1,    'int: 0 tridecimal, 1 qt, 2 septimal — top-row retune'],
  radioPreset:    [0,    'int preset slot'],
  regSelect:      [1,    'int index → freq mult [0.5, 1, 2, 4]'],
  // ── noise source flavor (David 2026-08-15)
  noiseType:      [0,    'int: 0 white, 1 pink, 2 brown — latched at note-on'],
  // ── expression / pedal
  keyXYStyle:     [0,    'int: 0 relative (implemented), 1 absolute (SPEC PENDING — David)'],
  keyXYFilter:    [1,    'key-XY drag target tog (multi-select with Vib/Drive)'],
  keyXYVib:       [0,    'key-XY drag target tog'],
  keyXYDrive:     [0,    'key-XY drag target tog'],
  pedal:          [0,    'sustain pedal down'],
  pedalReleaseTime: [0.3, 'release time on pedal lift, linexp 0.001-10 s'],
};

const SRC_DEFAULTS = { Lev: 0.0, A: 0.01, D: 0.1, S: 0.8, R: 0.3, X: 0.0, Y: 0.0, Tup: 0 };
for (const src of SOURCES) {
  for (const [sfx, dflt] of Object.entries(SRC_DEFAULTS)) {
    PARAMS[src + sfx] = [dflt, sfx === 'Tup' ? 'int subdivision idx {off,1..7}' : ''];
  }
}
PARAMS.sawLev = [0.7, '']; PARAMS.sinLev = [0.5, '']; // audible out of the box

// ── store ──────────────────────────────────────────────────
const _vals = {}, _subs = {};
for (const k in PARAMS) _vals[k] = PARAMS[k][0];

export const P = {
  names: () => Object.keys(PARAMS),
  meta:  (name) => PARAMS[name],
  get:   (name) => _vals[name],
  set(name, value) {
    if (!(name in _vals)) { console.warn('P.set unknown param:', name); return; }
    if (_vals[name] === value) return;
    _vals[name] = value;
    (_subs[name] || []).forEach(fn => fn(value, name));
  },
  sub(name, fn) {
    (_subs[name] = _subs[name] || []).push(fn);
    return () => { _subs[name] = _subs[name].filter(f => f !== fn); };
  },
  snapshot: () => ({ ..._vals }),
  load(obj) { for (const k in obj) if (k in _vals) P.set(k, obj[k]); },
};

export { SOURCES };
