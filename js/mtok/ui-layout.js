// MTOK2 — .tosc layout loader (CC, v2b full-fidelity rework 2026-08-16).
// mtok-layout.json is machine-extracted from mtok_adsr_2026-03-15.tosc
// (scratchpad/active/tosc-extract.mjs): every control's name, type, absolute
// frame on the original 860×640 canvas, its TouchOSC color, and label text.
// This module is data access only — no DOM, no audio.

const JSON_URL = new URL('./mtok-layout.json?v=7', import.meta.url).href;

export const CANVAS = { w: 860, h: 640 };

let _controls = [];
let _byName = new Map();

// Name normalization, .tosc → tuning.js ids. The original file has three
// legacy spellings tuning.js corrected or renamed:
//   fqs0mid (lone 'mid' in a 'med' scheme) · csh* (tuning uses cs — the
//   block-6/8 mismatch the tuning WO found) · bqfl* (tuning uses bflqs).
export const keyIdFor = (name) => (name || '')
  .replace(/mid$/, 'med')
  .replace(/^csh/, 'cs')
  .replace(/^bqfl/, 'bflqs');

export const Layout = {
  ready: fetch(JSON_URL)
    .then(r => { if (!r.ok) throw new Error('layout fetch ' + r.status); return r.json(); })
    .then(j => {
      _controls = j.controls;
      for (const c of _controls) {
        // duplicate names exist (tog33 ×2) — first wins, rest reachable via all()
        if (c.name && !_byName.has(c.name)) _byName.set(c.name, c);
      }
      return Layout;
    }),
  all: () => _controls,
  get: (name) => _byName.get(name),
  ofType: (t) => _controls.filter(c => c.type === t),
};
