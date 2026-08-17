// MTOK2 tuning engine + keyboard data model — WO-tuning.
// Owns: alpha/beta/gamma/qt scale math and the keyboard *data model* (the
// key list the UI renders). Data only — no canvas drawing, no audio.
// Contract: SPEC-mtok2-web-2026-08-15.md.

const ROOT_C3 = 130.81; // MTOK_B block 6, canonical

// ── Alpha ratio table — ported from MTOK_B.scd block 6 exactly (25 named
// pitches per octave, as [num, den] to keep exact JI fractions). Canonical.
const ALPHA_RATIOS = {
  c: [1, 1], cqs: [33, 32], cs: [17, 16],
  dqfl: [12, 11], d: [9, 8], dqs: [11, 10],
  eflqfl: [13, 11], efl: [6, 5], eqfl: [11, 9],
  e: [5, 4], eqs: [9, 7],
  f: [4, 3], fqs: [11, 8], fsh: [45, 32], fshqs: [23, 16],
  g: [3, 2], gqs: [14, 9], gsh: [11, 7],
  atri: [13, 8], a: [5, 3],
  bflsept: [7, 4], bfl: [9, 5], bflqs: [11, 6],
  b: [15, 8], bqs: [243, 128],
};

// Declared order from block 6's addPitch loop — also the order QT-mode
// walks to assign 24-EDO degrees (see QT_DEGREE below).
const FULL_ORDER = ['c', 'cqs', 'cs', 'dqfl', 'd', 'dqs', 'eflqfl', 'efl', 'eqfl',
  'e', 'eqs', 'f', 'fqs', 'fsh', 'fshqs', 'g', 'gqs', 'gsh', 'atri', 'a',
  'bflsept', 'bfl', 'bflqs', 'b', 'bqs'];

// Oct 0 (E3-B3) only reaches this subset — block 6's separate oct-0 puts.
const OCT0_ORDER = ['e', 'eqs', 'f', 'fqs', 'fsh', 'fshqs', 'g', 'gqs', 'gsh',
  'atri', 'a', 'bflsept', 'bfl', 'bflqs', 'b', 'bqs'];

// Unicode display labels — ported from mtok.html's JI_KEYS (PoC), same 25 names.
const LABELS = {
  c: 'C', cqs: 'C↑', cs: 'C♯', dqfl: 'D♭↑', d: 'D', dqs: 'D↑',
  eflqfl: 'E♭¹³', efl: 'E♭', eqfl: 'E♭↑', e: 'E', eqs: 'E↑⁹⁷',
  f: 'F', fqs: 'F↑¹¹', fsh: 'F♯', fshqs: 'F♯↑',
  g: 'G', gqs: 'G↑¹⁴', gsh: 'G♯¹¹', atri: 'A♭¹³', a: 'A',
  bflsept: 'B♭⁷', bfl: 'B♭', bflqs: 'B♭↑', b: 'B', bqs: 'B↑',
};
const TYPES = {
  c: 'nat', cqs: 'qt', cs: 'acc', dqfl: 'qt', d: 'nat', dqs: 'qt',
  eflqfl: 'qt', efl: 'acc', eqfl: 'qt', e: 'nat', eqs: 'qt',
  f: 'nat', fqs: 'qt', fsh: 'acc', fshqs: 'qt',
  g: 'nat', gqs: 'qt', gsh: 'qt', atri: 'qt', a: 'nat',
  bflsept: 'qt', bfl: 'acc', bflqs: 'qt', b: 'nat', bqs: 'qt',
};
const SUBSCRIPT = ['₀', '₁', '₂'];

// ── Physical pad shape per base name — which id suffixes exist for that
// note, ported from MTOK_B.scd block 8's ~regKey groupings. 'single' means
// one bare id (== the noteKey itself), used for narrow accidentals that
// never got a lo/med/hi split in the TouchOSC layout.
//
// TWO CORRECTIONS vs the literal block-8 source (flagged in RESULTS):
//   1. block 8 groups the C# pads under noteKey \csh1/\csh2, but block 6's
//      frequency table only ever stores \cs1/\cs2 — a lookup-would-fail bug
//      in the original (never fired since GUI was never wired). Corrected
//      to 'cs' throughout, consistent with the canonical ratio table.
//   2. block 8 has no regKey group at all for 'eqfl' (11/9, "E♭↑") even
//      though block 6's ratio table defines it — an omission in the
//      original TouchOSC layout. Added as a 'single' pad, matching the
//      convention used for its narrow-accidental neighbors (dqfl, dqs).
const SHAPES = {
  c: ['sub', ''], cqs: ['lo', 'hi'], cs: ['lo', 'hi'], dqfl: ['single'],
  d: ['sub', ''], dqs: ['single'], eflqfl: ['single'], efl: ['lo', 'hi'],
  eqfl: ['single'], e: ['sub', '', 'hi'], eqs: ['single'],
  f: ['sub', ''], fqs: ['lo', 'med', 'hi'], fsh: ['lo', 'hi'], fshqs: ['single'],
  g: ['sub', ''], gqs: ['lo', 'hi'], gsh: ['lo', 'hi'], atri: ['lo', 'med', 'hi'],
  a: ['sub', ''], bflsept: ['lo', 'med', 'hi'], bfl: ['lo', 'hi'],
  bflqs: ['lo', 'hi'], b: ['sub', 'lo', 'hi'], bqs: ['lo', 'hi'],
};

// ── QT mode: "24-EDO on C3, upper-row keys become QT accidentals."
// 25 named alpha pads don't divide evenly into 24 EDO degrees, so one pair
// collapses onto a shared degree. dqfl/dqs are the closest adjacent pair in
// FULL_ORDER by far (14.4c apart — see RESULTS for the full gap table), and
// both already read as "quartertone flavors approaching D from below," so
// they're the natural single collapse: both land on degree 3 (150c).
// Every other slot gets its own degree, walked in FULL_ORDER, 0-23.
const QT_DEGREE = {};
(() => {
  let deg = 0;
  for (const base of FULL_ORDER) {
    if (base === 'dqs') { QT_DEGREE[base] = QT_DEGREE.dqfl; continue; }
    QT_DEGREE[base] = deg;
    deg++;
  }
})();

// ── dplusRadio — "top microtonal box," per state.js: 0 tridecimal, 1 qt,
// 2 septimal. Never wired in SC (bus declared, never read). NOT wired to any
// specific pad in the source material either — best-effort reading (flagged
// unconfirmed in RESULTS): targets the 'dqs' pad (the one ungrouped
// quartertone-of-D accidental), offering 3 close cent-flavors of "D+"
// clustered near the literal 24-EDO D+50c point, read literally off the
// notes doc's own numbers (treated as semitone fractions -> cents):
//   qt:  +50c from D            (the literal EDO quartertone point)
//   13:  qt point - 41c ("-0.41" from notes doc)
//   7:   qt point - 31c ("-0.31" from notes doc)
const DPLUS_QT_CENTS = 1200 * Math.log2(ALPHA_RATIOS.d[0] / ALPHA_RATIOS.d[1]) + 50;
const DPLUS_CENTS = { 0: DPLUS_QT_CENTS - 41, 1: DPLUS_QT_CENTS, 2: DPLUS_QT_CENTS - 31 };

function dplusRatioCents(mode) {
  return DPLUS_CENTS[mode] ?? DPLUS_CENTS[1];
}

// ── Beta/gamma placeholders — data, not code (SPEC step 3). Real content
// lives in tunings-mtok.json; these two are the "no override yet" state.
// null = "not loaded (or JSON absent/malformed)" => keyboard() below treats
// beta/gamma exactly like plain alpha for every pad. Never crashes.
let _betaOverrides = null;   // { [base]: [num, den] } — applies to 'hi' ids only
let _gammaAssign = null;     // { [base]: { from, foldedCents } }
let _jsonLoaded = false;

function validateBeta(beta) {
  if (!beta || typeof beta !== 'object' || !beta.overrides) return null;
  const out = {};
  for (const [base, entry] of Object.entries(beta.overrides)) {
    if (!Array.isArray(entry?.ratio) || entry.ratio.length !== 2) return null;
    out[base] = entry.ratio;
  }
  return out;
}
function validateGamma(gamma) {
  if (!gamma || typeof gamma !== 'object' || !gamma.assign) return null;
  const out = {};
  for (const base of FULL_ORDER) {
    const entry = gamma.assign[base];
    if (!entry || typeof entry.foldedCents !== 'number' || typeof entry.from !== 'string') return null;
    out[base] = { from: entry.from, foldedCents: entry.foldedCents };
  }
  return out;
}

async function loadPlaceholders() {
  if (_jsonLoaded) return;
  _jsonLoaded = true;
  try {
    const url = new URL('../../tunings-mtok.json', import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed: ' + res.status);
    const data = await res.json();
    const beta = validateBeta(data?.beta);
    const gamma = validateGamma(data?.gamma);
    if (!beta || !gamma) throw new Error('malformed tunings-mtok.json shape');
    _betaOverrides = beta;
    _gammaAssign = gamma;
  } catch (err) {
    console.warn('Tuning: tunings-mtok.json absent/malformed — beta/gamma fall back to plain alpha.', err);
    _betaOverrides = null;
    _gammaAssign = null;
  }
}
const ready = loadPlaceholders();

function freqFor(ratio, octMult) {
  return ROOT_C3 * (ratio[0] / ratio[1]) * octMult;
}

// oct: 0/1/2. mult per MTOK_B block 6: oct0=1x, oct1=2x, oct2=4x.
const OCT_MULT = [1, 2, 4];

function baseOrderForOct(oct) {
  return oct === 0 ? OCT0_ORDER : FULL_ORDER;
}

// Builds the raw {base, oct} -> ratio table for a given scale, before
// per-id expansion. Keeps ratio lookup logic in one place across scales.
function ratioFor(scaleId, base, dplusRadio) {
  if (scaleId === 'qt') {
    // Strict EDO grid — dplusRadio's JI-flavor cent-offsets would knock
    // dqs off the 50c grid, so qt mode ignores it (dqs already collapses
    // onto dqfl's degree here; see QT_DEGREE above).
    return { cents: QT_DEGREE[base] * 50, fromCents: true };
  }
  if (base === 'dqs' && scaleId !== 'gamma') {
    // dplusRadio override applies to the single ungrouped 'dqs' pad in
    // alpha/beta (gamma already fully re-derives every pad from G).
    return { cents: dplusRatioCents(dplusRadio), fromCents: true };
  }
  if (scaleId === 'beta' && _betaOverrides && base in _betaOverrides) {
    return { ratio: _betaOverrides[base], overrideHiOnly: true };
  }
  if (scaleId === 'gamma' && _gammaAssign) {
    return { cents: _gammaAssign[base].foldedCents, fromCents: true, from: _gammaAssign[base].from };
  }
  return { ratio: ALPHA_RATIOS[base] };
}

function freqForEntry(entry, octMult) {
  if (entry.fromCents) return ROOT_C3 * Math.pow(2, entry.cents / 1200) * octMult;
  return freqFor(entry.ratio, octMult);
}

// Per-key label. Gamma relabels each pad with the G-partial meaning it
// borrowed (per SPEC step 3); the placeholder *badge* itself (beta/gamma as
// a whole) is the UI's job via Tuning.isPlaceholder(scaleId) on the radio.
function labelFor(scaleId, base, entry) {
  if (scaleId === 'gamma' && entry.from) return LABELS[entry.from] || entry.from;
  return LABELS[base] || base;
}

function typeFor(base) {
  return TYPES[base] || 'qt';
}

/**
 * Tuning.keyboard(scaleId, opts?) -> array of
 * {id, noteKey, label, ratioStr, freq, row, oct, type}
 *
 * scaleId: 'alpha' | 'beta' | 'gamma' | 'qt'
 * opts.dplusRadio: 0|1|2 (default 1 = qt), applied to the 'dqs' pad.
 *
 * Synchronous — usable immediately at module load. Before Tuning.ready
 * resolves, beta/gamma silently render as plain alpha (never throws); await
 * Tuning.ready first if you want the placeholder tables in the first paint.
 */
function keyboard(scaleId, opts = {}) {
  const dplusRadio = opts.dplusRadio ?? 1;
  if (!['alpha', 'beta', 'gamma', 'qt'].includes(scaleId)) {
    console.warn('Tuning.keyboard: unknown scaleId, falling back to alpha:', scaleId);
    scaleId = 'alpha';
  }
  const keys = [];
  for (let oct = 0; oct < 3; oct++) {
    const order = baseOrderForOct(oct);
    const octMult = OCT_MULT[oct];
    for (const base of order) {
      const noteKey = `${base}${oct}`;
      const entry = ratioFor(scaleId, base, dplusRadio);
      // beta only overrides the 'hi' id of fqs/atri/bflsept — lo/med (and
      // every other base) stay plain alpha. Resolve the "default" entry
      // separately so non-hi ids of an overridden base keep alpha's ratio.
      const defaultEntry = entry.overrideHiOnly ? { ratio: ALPHA_RATIOS[base] } : entry;
      const freqDefault = freqForEntry(defaultEntry, octMult);
      const shape = SHAPES[base];
      for (const suffix of shape) {
        const isHi = suffix === 'hi';
        const useOverride = entry.overrideHiOnly && isHi;
        const activeEntry = useOverride ? entry : defaultEntry;
        const freq = useOverride ? freqForEntry(entry, octMult) : freqDefault;
        const id = suffix === 'single' || suffix === '' ? noteKey : `${noteKey}${suffix}`;
        const row = suffix === 'single' || suffix === '' ? 'main' : suffix;
        keys.push({
          id,
          noteKey,
          label: `${labelFor(scaleId, base, activeEntry)}${SUBSCRIPT[oct]}`,
          ratioStr: activeEntry.ratio ? `${activeEntry.ratio[0]}/${activeEntry.ratio[1]}` : `${activeEntry.cents.toFixed(1)}¢`,
          freq,
          row,
          oct,
          type: typeFor(base),
        });
      }
    }
  }
  return keys;
}

// beta/gamma are placeholders even before JSON resolves (they degrade to
// alpha content, but the radio should still badge them as unrefined).
function isPlaceholder(scaleId) {
  return scaleId === 'beta' || scaleId === 'gamma';
}

// Nearest 12-TET name + cents deviation, for generic UI key display
// (not tied to a specific alpha pad — works for any freq).
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
function label(freq) {
  if (!(freq > 0)) return '?';
  const midiF = 69 + 12 * Math.log2(freq / 440);
  const nearest = Math.round(midiF);
  const cents = Math.round((midiF - nearest) * 100);
  const pc = ((nearest % 12) + 12) % 12;
  const oct = Math.floor(nearest / 12) - 1;
  const devStr = cents ? (cents > 0 ? `+${cents}` : `${cents}`) + '¢' : '';
  return `${NOTE_NAMES[pc]}${oct}${devStr}`;
}

export const Tuning = {
  keyboard,
  isPlaceholder,
  label,
  dplusRatioCents,
  ready, // await before first render to include beta/gamma placeholder data
  ROOT_C3,
  ALPHA_RATIOS,
  QT_DEGREE,
  SCALES: ['alpha', 'beta', 'gamma', 'qt'],
};
