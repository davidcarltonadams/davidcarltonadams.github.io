'use strict';

// ─────────────────────────────────────────────────────────────
// KALEIDOSCOPE — Show Sequencer Config v2 (with-poetry interludes)
// Edit this file to update sequence, durations, or password.
// Durations are in seconds — cosmetic only (timer display).
// ─────────────────────────────────────────────────────────────

const SEQUENCE = [
  {
    id: 'scene-0',
    label: 'Scene 0',
    type: 'scene',
    duration: 489,
    src: 'audio/kaleidoscope/ccf/scene-0.mp3',
    crossfadeOut: 7,   // long fade into first interlude
  },
  {
    id: 'scene-1',
    label: 'Scene 1: Very Bad Day',
    type: 'scene',
    duration: 148,
    src: 'audio/kaleidoscope/ccf/scene-1-very-bad-day.mp3',
  },
  {
    id: 'interlude-1-2',
    label: 'Interlude 1→2: Threshold',
    type: 'interlude',
    duration: 283,
    src: 'audio/kaleidoscope/ccf/Interlude-1-2-threshold-with-poetry-kaleidoscope.mp3',
  },
  {
    id: 'scene-2',
    label: 'Scene 2: Cam and Wren',
    type: 'scene',
    duration: 259,
    src: 'audio/kaleidoscope/ccf/scene-2-cam-and-wren.mp3',
  },
  {
    id: 'interlude-2-3',
    label: 'Interlude 2→3: First Light',
    type: 'interlude',
    duration: 271,
    src: 'audio/kaleidoscope/ccf/Interlude-2-3-first-light-with-poetry-kaleidoscope.mp3',
  },
  {
    id: 'scene-3',
    label: 'Scene 3: Value',
    type: 'scene',
    duration: 239,
    src: 'audio/kaleidoscope/ccf/scene-3-value.mp3',
  },
  {
    id: 'interlude-3-4',
    label: 'Interlude 3→4: Naming',
    type: 'interlude',
    duration: 217,
    src: 'audio/kaleidoscope/ccf/Interlude-3-4-naming-with-poetry-kaleidoscope.mp3',
  },
  {
    id: 'scene-4',
    label: 'Scene 4: Complementary',
    type: 'scene',
    duration: 294,
    src: 'audio/kaleidoscope/ccf/scene-4-complementary.mp3',
  },
  {
    id: 'interlude-4-5',
    label: 'Interlude 4→5: Spectrum',
    type: 'interlude',
    duration: 174,
    src: 'audio/kaleidoscope/ccf/Interlude-4-5-spectrum-with-poetry-kaleidoscope.mp3',
  },
  {
    id: 'scene-5',
    label: 'Scene 5: Line and Form',
    type: 'scene',
    duration: 242,
    src: 'audio/kaleidoscope/ccf/scene-5-line-and-form.mp3',
  },
  {
    id: 'scene-6',
    label: 'Scene 6: Breath / Shape & Space',
    type: 'scene',
    duration: 240,   // truncated to 4:00; full 7:08 pending update
    src: 'audio/kaleidoscope/ccf/scene-6-breath.mp3',
  },
  {
    id: 'scene-7',
    label: 'Scene 7: Pizzicato',
    type: 'scene',
    duration: 314,
    src: 'audio/kaleidoscope/ccf/scene-7-pizzicato.mp3',
  },
  {
    id: 'outro',
    label: 'Outro: Home',
    type: 'scene',
    duration: 654,
    src: 'audio/kaleidoscope/ccf/outro-home.mp3',
  },
];

const SHOW_CONFIG = {
  password: 'kaleidoscope',
  crossfadeDefault: 3,   // seconds
  crossfadeMin: 0,
  crossfadeMax: 5,
  crossfadeStep: 0.5,
};
