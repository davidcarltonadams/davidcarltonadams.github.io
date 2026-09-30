# Website Creative Coding — CHANGELOG

Covers all interactive instruments and easter eggs on davidcarltonadams.com.
Files live in `~/projects/website/` (eggs in `eggs/` since 2026-09-03). Deployed via GitHub Pages.
Git repo: davidcarltonadams/davidcarltonadams.github.io
Commit hashes below were re-pointed 2026-09-30 to the rewritten history on main.

---

## 2026-09-30 · audit + repair

Night audit of all 41 eggs and the four hub pages, then repairs in four groups of eggs plus the hub pages.
- group A (spiral, diamond, tuning, stern-brocot, farey, lattice, septimal, undertone, temperament, eikosany, comma) · voice bugs on spiral and diamond fixed · spiral and eikosany no longer clip · temperament's fugues gain 51 missing chord notes, hold their ties, and lose 14 wrong pitches · new: tuning's held triad across systems, stern-brocot's bag playback, eikosany's own chords, mirror chords on septimal and undertone, note names on lattice · phone layouts fit
- group B (partials, sumtones, tartini, sculptor, consonance, spectrogram, risset, escher, brush, flicker, beating) · partials and sumtones stuck notes fixed · tartini at ghost 0 is truly linear · risset stays phase-locked · sculptor and escher no longer clip · spectrogram gains a scrolling spectrogram · beating dyad mode · sumtones cubic tone · consonance drone is a harmonic tone · brush plays on first press and names its 24-per-octave snap
- group C (rhythm, sequence, drift, clutch, night-shift, clock, vuza, euclidean, phase, canon, pulse) · rhythm keeps every track through a tempo change · sequence opens on a just major scale, edits steps, and stops within 20 ms · clock draws its QR on the page and drops malformed sync messages · canon's voices sit on the tuning's own pitches, with engraved rests and beams · euclidean presets and rotation · phase in stereo with a lock mode · sequencers no longer bunch notes after a stall
- group D (mtok, modes, lissajous, drone, sound, text-score, spontaneous-text-score) · mtok stuck notes fixed, 19- and 31-TET keys spelled, big chords no longer distort · modes spells every seven-note scale with seven letters, keys at true pitch · lissajous draws closed figures and plays a kept scale · drone stays under clipping and says A4 is 436.05 Hz · sound's resonant top no longer jumps 13 dB
- every group · buttons and links lifted to 4.5:1 contrast · em dashes out of on-page prose · most held tones fade when the tab is hidden · thumbnails re-shot
- tools.html · eikosany credited to Erv Wilson, partials has 24, drone's partials are 2 to 9 plus 11, 13, 16, 21, sound is not generative · tags and footer readable
- eggs.html, tools.html, llms.txt · forty eggs · "nothing collected" now means by this site, and names the PeerJS relay behind clock's shared sessions · every card and tool blurb says what its egg does now · nest map no longer stretched
- nest · septimal "oblique", sumtones and spectrogram blurbs fixed in the vector store · rebake separates eggs with identical vectors, so phase, farey, rhythm and clutch can be clicked · labels no longer overprint · back link and captions readable
- raw-eggs · links readable
- Kirnberger III · one fifth (F♯–C♯) carries the schisma, here and in tunings.json

---

## Canon Machine (canon.html)

### v2.3 — 2026-03-23 — commit 3a5ea7c
**External tuning file + well-temperament + save/load**
- `tunings.json` — new standalone editable file at website root. Same semitone notation as DCA scale (0=C, 1=C#, 0.5=C↑, 9.7≈7∂). Three entries: Kirnberger III, Vallotti, DCA Beta.
- `loadExternalTunings()`: fetches tunings.json on page load; adds K3/Vallotti/DCA Beta to tuning selector.
- `wellTempTuning()`: 12-pitch piano layout, row labels show note + cent deviation from 12-TET (e.g. "E −14¢" for K3).
- `semToLabel()`: labels arbitrary semitone values as "E −8¢", "F♯ +2¢" etc; falls back to DCA_NAMES for known microtones.
- `customTuningFromJSON()`: arbitrary pitch set (any length), labels via DCA_NAMES + nearest-12TET fallback.
- ↺ reload button in tuning panel: re-fetches tunings.json without page refresh.
- `saveGrid()` / `loadGrid()`: localStorage key `canon-v1`. Saves grid, bpm, swing, osc type, voices. Auto-saves 1.2s after any `markNotaDirty()` call. Manual save/load buttons in grid toolbar. Load reports "nothing saved" if storage is empty.
- **Kirnberger III**: four 1/4-comma narrow fifths C-G-D-A-E → pure major third C-E (386.314¢ = exact 5/4). Of the remaining 8 fifths, F♯-C♯ is narrowed by the schisma (700.0¢) and 7 are pure (corrected 2026-09-30; the pitches were always right).
- **Vallotti**: six narrow fifths (F-C-G-D-A-E-B, −3.9¢ each), six pure. C-G = 698.045¢ (confirmed).
- **DCA Beta**: Vallotti backbone + C↑(0.5), F↑(5.5), Bb↓(9.7). 15 pitches. Starter kit for DCA's well-tempered + microtonal hybrid system. Edit tunings.json on GitHub → hit ↺ to hear changes instantly.

### v2.2 — 2026-03-18 — commit 9da8dd7
**Fugue exposition mode, swing, oscillator types**
- Swing % slider (even → double-dotted, 6 labeled positions)
- Oscillator type selector: triangle/sine/sawtooth/square/pluck (triangle LP filter emulation)
- Phase 2 Fugue Exposition: real/tonal answer, answerGrid, comes voice auto-created, key selector
- `computeAnswerGrid()`: tonal answer uses scale-degree logic (tonic side → P5, dominant side → P4)
- Contrast fix; dux pip hidden in voice list

### v2.1 — 2026-03-18 — commits 5696f5a, 971462f
**Custom SVG notation (VexFlow removed)**
- Added a VexFlow 4 CDN renderer, then replaced it the same day with inline custom SVG notation. Zero external dependencies.
- Treble clef, ledger lines, accidentals, cent-deviation annotations (>15¢), clickable note heads (data-step/data-row wired)
- staffPos math: E4=0, G4=2, B4=4, D5=6, F5=8; `centsToNoteInfo()`, `drawLedgerLines()`

### v2.0 — 2026-03-18 — commit 885ea29
**Full rebuild from Opus 4.6 architecture spec**
- 5 tunings: 12-TET, 19-EDO, 24-EDO, 31-EDO, DCA scale
- DCA scale: 18 base pitches + P4/P5 fills → ~30 pitches/octave. NOT Wendy Carlos alpha.
- Multi-voice with per-voice color, octave offset, transpose interval, mute
- Staff notation (drawn on a canvas), piano roll canvas
- Grid: 2D boolean array, double stops = multiple true per column
- Scheduler: Web Audio API look-ahead (0.15s buffer), setTimeout 20ms poll

### v1.0 — pre-2026-03-18 — commit 660ab7e
**Original Canon Machine**
- Custom alpha tuning (77.965¢/step), 4 hardcoded tunings
- Basic grid + Web Audio playback

---

## MTOK — Microtonal Touch Keyboard (mtok.html)

### v1.3 — 2026-03-23 — commit 3a5ea7c
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
- Per-voice: ratio (divisions of one shared bar), click pitch, visual track
- Phase relationship visualization
- Side-by-side layout (canvas left, controls right, 660px flex breakpoint; 700px today)

---

## Easter Eggs (tuning.html, partials.html, sound.html, score.html, eggs.html)

### 2026-03-18
- `eggs.html`: unlisted landing page for all hidden instruments (URL-only, no nav; in the nav since 2026-07-25)
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
**eggs/tunings.json** is loaded by Canon Machine and MTOK via `fetch('./tunings.json')`, relative to `eggs/`. This only works over HTTP (not `file://`). When testing locally, run a simple HTTP server: `python3 -m http.server 8000` from the `website/` directory, then open `http://localhost:8000/eggs/canon.html`.
