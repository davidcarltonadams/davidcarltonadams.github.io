# Website Creative Coding — CHANGELOG

Covers all interactive instruments and easter eggs on davidcarltonadams.com.
Files live in `~/projects/website/`. Deployed via GitHub Pages.
Git repo: davidcarltonadams/davidcarltonadams.github.io

---

## Canon Machine (canon.html)

### v2.3 — 2026-03-23 — commit 40ee725
**External tuning file + well-temperament + save/load**
- `tunings.json` — new standalone editable file at website root. Same semitone notation as DCA scale (0=C, 1=C#, 0.5=C↑, 9.7≈7∂). Three entries: Kirnberger III, Vallotti, DCA Beta.
- `loadExternalTunings()`: fetches tunings.json on page load; adds K3/Vallotti/DCA Beta to tuning selector.
- `wellTempTuning()`: 12-pitch piano layout, row labels show note + cent deviation from 12-TET (e.g. "E −14¢" for K3).
- `semToLabel()`: labels arbitrary semitone values as "E −8¢", "F♯ +2¢" etc; falls back to DCA_NAMES for known microtones.
- `customTuningFromJSON()`: arbitrary pitch set (any length), labels via DCA_NAMES + nearest-12TET fallback.
- ↺ reload button in tuning panel: re-fetches tunings.json without page refresh.
- `saveGrid()` / `loadGrid()`: localStorage key `canon-v1`. Saves grid, bpm, swing, osc type, voices. Auto-saves 1.2s after any `markNotaDirty()` call. Manual save/load buttons in grid toolbar. Load reports "nothing saved" if storage is empty.
- **Kirnberger III**: four 1/4-comma narrow fifths C-G-D-A-E → pure major third C-E (386.314¢ = exact 5/4). Remaining 8 fifths pure. Confirmed math.
- **Vallotti**: six narrow fifths (F-C-G-D-A-E-B, −3.9¢ each), six pure. C-G = 698.045¢ (confirmed).
- **DCA Beta**: Vallotti backbone + C↑(0.5), F↑(5.5), Bb↓(9.7). 15 pitches. Starter kit for DCA's well-tempered + microtonal hybrid system. Edit tunings.json on GitHub → hit ↺ to hear changes instantly.

### v2.2 — 2026-03-18 — commit ~94536fd (estimated)
**Fugue exposition mode, swing, oscillator types**
- Swing % slider (even → double-dotted, 6 labeled positions)
- Oscillator type selector: triangle/sine/sawtooth/square/pluck (triangle LP filter emulation)
- Phase 2 Fugue Exposition: real/tonal answer, answerGrid, comes voice auto-created, key selector
- `computeAnswerGrid()`: tonal answer uses scale-degree logic (tonic side → P5, dominant side → P4)
- Contrast fix; dux pip hidden in voice list

### v2.1 — 2026-03-18
**Custom SVG notation (VexFlow removed)**
- Replaced broken VexFlow CDN renderer with inline custom SVG notation. Zero external dependencies.
- Treble clef, ledger lines, accidentals, cent-deviation annotations (>15¢), clickable note heads (data-step/data-row wired)
- staffPos math: E4=0, G4=2, B4=4, D5=6, F5=8; `centsToNoteInfo()`, `drawLedgerLines()`

### v2.0 — 2026-03-18 — commit 94536fd
**Full rebuild from Opus 4.6 architecture spec**
- 5 tunings: 12-TET, 19-EDO, 24-EDO, 31-EDO, DCA scale
- DCA scale: 18 base pitches + P4/P5 fills → ~30 pitches/octave. NOT Wendy Carlos alpha.
- Multi-voice with per-voice color, octave offset, transpose interval, mute
- Staff notation (VexFlow), piano roll canvas
- Grid: 2D boolean array, double stops = multiple true per column
- Scheduler: Web Audio API look-ahead (0.15s buffer), setTimeout 20ms poll

### v1.0 — pre-2026-03-18 — commit 390b8fb
**Original Canon Machine**
- Custom alpha tuning (77.965¢/step), 4 hardcoded tunings
- Basic grid + Web Audio playback

---

## MTOK — Microtonal Touch Keyboard (mtok.html)

### v1.3 — 2026-03-23 — commit 40ee725
**External tuning support (tunings.json)**
- Loads tunings.json on startup; adds K3/Vallotti/DCA Beta to selector
- `wellTempToMTOKKeys()`: converts welltemp entries to 12-key piano layout with adjusted frequency ratios
- `customToMTOKKeys()`: converts custom pitch arrays to nat/acc/qt key objects (type inferred from proximity to 12-TET)
- `_semLabelM()` / `_semKeyType()`: label and key-type helpers (MTOK-local, no DCA_NAMES dependency)
- ↺ reload button + `reloadTunings()` global

### v1.2 — 2026-03-22 — (two sessions)
**Square oscillator, multi-XY mode, presets, iPad audio fix**
- 4th oscillator: square wave (sqOsc), slider in controls
- Multi-XY mode: filter/vibrato/drive toggle independently, any combination active simultaneously
- 5 built-in presets (Bright Saw, Soft Pad, Buzz, Glass, Organ) + save/load slot via localStorage
- iPad Silent Mode: confirmed root cause of "no sound" — iPadOS 16+ silent mode mutes Web Audio. ctx:running + browser audio indicator = device muted at OS, not a code bug.
- Canvas hit-test fix: `getBoundingClientRect()` on scrolled Safari container → use wrapper BCR + scrollLeft
- iOS AudioContext async unlock: `touchstart` is reliable; `pointerdown` is not on all iPadOS builds
- StereoPannerNode: absent on iOS < 14.5, try-catch + GainNode stub fallback
- Silent 1-sample AudioBuffer belt-and-suspenders for iOS audio unlock
- Double-rAF init: flex clientHeight not settled in one frame on iPadOS Safari
- Force Touch stuck notes: second pointerdown with same ID orphans old voice — release before creating new
- `user-select:none` + `-webkit-touch-callout:none` (no text selection / copy popup)

### v1.1 — 2026-03-22 (session 1)
**iOS audio fixes, canvas BCR, window.innerHeight fallback**
- Pointer events vs touch events: touchstart listeners added for iOS/iPadOS reliability
- Canvas height: `window.innerHeight` fallback when `clientHeight` returns 0 (iPadOS layout not settled)
- IIFE scope fix: `Object.assign(window, {panicAll, shiftOctave, ...})` to expose functions to HTML `onclick=` attributes

### v1.0 — 2026-03-22
**Initial implementation**
- JI alpha tuning: 25 pitches/octave, ratios from harmonic series subsets
- 3-oscillator synthesis (saw/tri/sin) with tanh waveshaper, ADSR, LPF/HPF, StereoPanner
- XY modulation: filter sweep and vibrato
- Canvas piano keyboard: naturals sequential, accidentals/QTs cents-positioned, draw order nat→qt→acc
- 3 octaves (C3–C6)

---

## Fugue Machine (fugue.html)

### v1.0 — 2026-03-21
**Initial implementation**
- Three editable grids: subject, answer, episode
- Answer modes: real (interval transpose) and tonal (scale-degree logic, 12-TET; cents approximation for others)
- ↻ button resets answer to algorithm from current subject
- "Seed → tonic" episode button: step-wise path from answer's last pitch to subject's first
- Full exposition playback: S₁/A₁/[Ep₁]/S₂/[Ep₂]/A₂, toggleable episodes, 2–4 voices
- Exposition bar visualization in 4 voice colors above piano roll
- Shares DCA scale (updated: added F# at 6, G at 7, D↑ at 2.5, B♭↑~ at 10.9 to DCA_BASE)
- Deferred: playhead on individual grids, Bach MusicXML import

---

## Rhythm Machine (rhythm.html)

### v1.0 — 2026-03-17
- Polyrhythm clock: up to 6 independent pulses
- Per-voice: tempo, timbre, visual track
- Phase relationship visualization
- Side-by-side layout (canvas left, controls right, 660px flex breakpoint)

---

## Easter Eggs (tuning.html, partials.html, sound.html, score.html, eggs.html)

### 2026-03-18
- `eggs.html`: unlisted landing page for all hidden instruments (URL-only, no nav)
- `sound.html`: WebAudio interactive sound field, sawtooth + lowpass, EQ + oscilloscope viz
- `partials.html`: harmonic series explorer, 16 partials, live retuning, cents-from-12TET display
- `score.html`: 30 Fluxus-style performance instructions, seeded daily shuffle, auto-advance
- `tuning.html`: exists but content TBD (placeholder for microtonal keyboard concept)

---

## Site Infrastructure

### 2026-03-21
- `gws` CLI installed for GWS API access (Drive, Sheets, Calendar, etc.)
- `drive_push.py`: uploads local files to Drive under `Briefing Materials/`

### 2026-03-15
- GitHub Pages deploy: repo `davidcarltonadams.github.io`, CNAME = `davidcarltonadams.com`
- Email obfuscation: `js/email.js` assembles address at runtime (hooks: `footer-email`, `contact-email`, `lessons-email`)
- Mobile nav: hamburger via `js/nav.js`, shared across pages

### Deployment note
**tunings.json** is loaded by Canon Machine and MTOK via `fetch('./tunings.json')`. This only works over HTTP (not `file://`). When testing locally, run a simple HTTP server: `python3 -m http.server 8000` from the `website/` directory, then open `http://localhost:8000/canon.html`.
