# EGG-RECIPES — the pattern zoo

Canonical snippets for building eggs. **Copy-paste, don't import** — every egg
stays a complete single-file artifact. This doc exists so sessions (human or
CC) don't re-derive the house patterns from scratch.

Born 2026-07-23, the night of escher + comma + nest.

## House rules

- One lowercase word filename (`comma.html`), matching `<title>` and `.title`.
- No nav links from public pages. Eggs are listed in `eggs.html` only
  (name + `egg-desc` with `·`-separated clauses; lowercase; specific numbers
  beat adjectives: "21.5¢ per cycle" not "slowly drifts").
- Self-contained: no CDNs, no shared JS beyond site-wide `js/nav.js`/`js/email.js`
  conventions. Inline everything.
- Every egg with audio must have a way to stop safely (pause button and/or
  master-gain fade — never a bare oscillator with no exit).
- After building: add to `eggs.html`, consider a nest concept-vector
  (see Harvest below), journal one observation.

## CSS skeleton (dark + gold)

```css
:root {
  --bg:     #070709;
  --bg2:    #0d0d11;
  --text:   #ccc8d0;
  --dim:    rgba(204,200,208,0.40);
  --dimmer: rgba(204,200,208,0.17);
  --border: rgba(255,255,255,0.07);
  --gold:   #d4c070;
}
/* Georgia serif body · 'SF Mono' for numbers/labels ·
   lowercase titles letter-spaced 0.24em · italic .sub epigraph ·
   fixed ← eggs backlink top-left (see escher.html for full block) */
```

## WebAudio: init + iOS unlock

Create the AudioContext lazily on first user gesture, resume if suspended,
fade the master gain (never hard-start):

```js
let actx = null, master = null;
function ensureAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  master = actx.createGain();
  master.gain.value = 0;                 // fade in via setTargetAtTime
  master.connect(actx.destination);
  // build voices here
}
btn.addEventListener('click', () => {
  ensureAudio();
  if (actx.state === 'suspended') actx.resume();  // iOS unlock
  // toggle running; loop does: master.gain.setTargetAtTime(running ? LEVEL : 0, actx.currentTime, 0.05)
});
```

Full iOS lore (silent switch, canvas BCR, panic patterns): memory file
`web_audio_ios_lessons.md`.

## Voice pool (persistent oscillators)

Never start/stop oscillators per note — create once, steer frequency:

```js
const osc = actx.createOscillator();
osc.connect(gain); gain.connect(master); osc.start();
// per event: osc.frequency.setTargetAtTime(freq, actx.currentTime, tc);
// tc ~0.012 sounds like a clean step; tighten with tempo:
// const tc = Math.min(0.012, (60 / bpm) * 0.06);
```

## Tone menu (PeriodicWave recipes, loudness-normalized)

Standardized in `comma.html` — reuse names and recipes for consistency:

```js
const TONES = {
  sine:    [0, 1],
  felt:    [0, 1, 0.15, 0.04],
  organ:   [0, 1, 0.35, 0.15, 0.08],
  reed:    [0, 1, 0.04, 0.45, 0.03, 0.28, 0.02, 0.15],
  strings: [0, 1, 0.55, 0.38, 0.27, 0.2, 0.15, 0.11, 0.08],
};
function buildWave(name) {           // normalize so switching tones
  const H = TONES[name];             // doesn't jump the volume
  const sum = H.reduce((a, b) => a + b, 0);
  const imag = new Float32Array(H.map(h => h / sum * 1.5));
  return actx.createPeriodicWave(new Float32Array(H.length), imag);
}
```

## Poses (staged state for headless thumbnail capture)

Eggs that idle silent/blank need a `?pose=1` querystring the page checks on
load to seed a photogenic default state before the molt screenshot. Keep the
snippet here per egg so the next capture doesn't have to be reinvented.

**tartini.html** — seeds a dissonant pair + mid-high ghost amount, and
switches the spectrum to a synthetic gaussian-bump renderer so headless
capture shows real-looking peaks without an unlocked AudioContext. Picked
250/340 Hz (~11/8) because it keeps all six derived markers — A, B, diff,
sum, 2A−B, 2B−A — well separated on the 0–2000 Hz axis (90, 160, 250, 340,
430, 590 Hz); an earlier attempt at 233/350 had two markers collide within
1 Hz and their labels overlapped. Lesson for any egg with a computed-frequency
spectrum: pick pose values that keep *every derived* marker separated, not
just the raw inputs.

**Capture URL — use `tartini.html?pose=1&capture=1`.** Bare `?pose=1` now
draws a large SIMULATED watermark plus a bottom banner, because a visitor can
stumble into the querystring and the spectrum it shows is synthetic, not
measured. `capture=1` stages the identical frame with the watermark
suppressed, so the molt must pass it or SIMULATED bakes into
`assets/eggs/tartini.webp`. The watermark is the only difference between the
two spellings.
```js
if (params.get('pose') === '1') {
  const capturing = params.get('capture') === '1';   // molt path, no watermark
  posed = true;
  freqA = 250; freqB = 340; gainA = 0.6; gainB = 0.6; ghost = 0.62;
  if (!capturing) showSimulatedWatermark();
}
```

**roughness.html** — not needed for capture; the curve renders immediately
on load regardless of interaction, and the default marker position (702¢,
the P5 valley) already gives a photogenic static render. Left here in case a
future redesign makes the curve interaction-gated: seed `cents = 702`.

**flicker.html** — no pose needed; the idle draw staggers the orbit dots
(`phases = [0.62, 0.28, 0.85]`) so the load state is already asymmetric and
photogenic. If a redesign ever gates the first draw behind audio unlock, seed
those phases plus `baseRate = 2.49` before capture. Label lesson: per-ring
Hz labels stack UNDER each ring (`cy + rad + 13`), never at a shared y to the
right — two rings printed at the same y collide the moment rates share digits.

## Canvas boilerplate (retina + width clamp)

```js
const dpr = window.devicePixelRatio || 1;
const W = Math.min(window.innerWidth - 32, 620), H = 340;
canvas.width = W * dpr; canvas.height = H * dpr;
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
const c = canvas.getContext('2d');
c.scale(dpr, dpr);
```

## Verifying an egg headlessly (before it ever opens in a browser)

Math/sequencer logic:

```bash
node ~/projects/tools/egg-test.js comma.html '
  let t=0; for (let i=0;i<16;i++){ advance(t); t+=900; }
  assert(Math.abs(1200*Math.log2(base) + 64.52) < 0.01, "3-cycle drift");
  console.log("OK");'
```

Layout smoke test (do NOT use `--virtual-time-budget` — it hangs on rAF-loop
pages; this is the same recipe the egg-lab skill uses for molting):

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --timeout=12000 \
  --screenshot=/tmp/egg.png --window-size=1000,625 \
  "file://$PWD/egg.html"
```

Audio is the one thing these can't verify — that's always an ears check.

## Harvest (weekly, or when the chickens get fed)

```bash
python3 ~/projects/tools/egg_harvest.py        # report: new / unlisted / orphaned
```

Reviews before publishing are David's step: inspect each new egg in the
browser, iterate, thumbs-up, then commit + push. The nest
(`nest.html`) carries a hand-curated 8-dim concept vector per egg
(ratio · rhythm · psychoacoustics · illusion · process · visible math ·
playability · score) — new eggs need one scored and the MDS re-run
(layout script pattern: see `nest.html` header comment).
