// scores-data.js — graphic score prompts for davidcarltonadams.com/score.html
// Edit any text here; IDs are stable for linking (?n=01 etc.)
// Each entry: { id (1–30), category, text (use \n for line breaks) }

const SCORES = [

  // ── Listening / Attention ──────────────────────────────────────────────────
  { id:  1, category: "Listening / Attention",
    text: "Attend to what is already sounding.\nThis is the score." },

  { id:  2, category: "Listening / Attention",
    text: "Find the frequency between two notes.\nBegin there." },

  { id:  3, category: "Listening / Attention",
    text: "Listen for the harmonic you did not intend.\nPlay toward it." },

  { id:  4, category: "Listening / Attention",
    text: "Sustain a single pitch.\nWhen you hear it as a different pitch,\nyou are done." },

  { id:  5, category: "Listening / Attention",
    text: "Make a sound.\nThen make a sound that makes the first sound\nsound different." },

  // ── Duration / Time ───────────────────────────────────────────────────────
  { id:  6, category: "Duration / Time",
    text: "Play what you mean.\nWait.\nPlay what you mean now." },

  { id:  7, category: "Duration / Time",
    text: "The score is: continue." },

  { id:  8, category: "Duration / Time",
    text: "Begin.\nArrive somewhere else.\nThat is also the beginning." },

  { id:  9, category: "Duration / Time",
    text: "Hold a sound past the point\nwhere you know what it is." },

  { id: 10, category: "Duration / Time",
    text: "Take as long as it takes.\nThen take a little longer." },

  // ── Relation / Ensemble ───────────────────────────────────────────────────
  { id: 11, category: "Relation / Ensemble",
    text: "Begin in unison.\nDiverge." },

  { id: 12, category: "Relation / Ensemble",
    text: "Find where you and the room\nare the same temperature.\nPlay from there." },

  { id: 13, category: "Relation / Ensemble",
    text: "When you hear someone else,\nlet it change what you are doing.\nThis is the form." },

  { id: 14, category: "Relation / Ensemble",
    text: "Play until someone else begins.\nThen: become an overtone." },

  { id: 15, category: "Relation / Ensemble",
    text: "Interrupt yourself.\nContinue from the interruption." },

  // ── Emergence / Indeterminacy ─────────────────────────────────────────────
  { id: 16, category: "Emergence / Indeterminacy",
    text: "Do not prepare.\nBegin anyway." },

  { id: 17, category: "Emergence / Indeterminacy",
    text: "The sound you cannot control\nis the most important one." },

  { id: 18, category: "Emergence / Indeterminacy",
    text: "Play what is in the room.\nNot what you brought." },

  { id: 19, category: "Emergence / Indeterminacy",
    text: "emergent.\nwhatever that means for you, today." },

  { id: 20, category: "Emergence / Indeterminacy",
    text: "Something is already vibrating.\nMatch it.\nThen: move away slowly." },

  // ── Microtonality / Timbre ────────────────────────────────────────────────
  { id: 21, category: "Microtonality / Timbre",
    text: "Be as microtonal as the moment requires." },

  { id: 22, category: "Microtonality / Timbre",
    text: "Find a pitch between A and A.\nStay there for a while." },

  { id: 23, category: "Microtonality / Timbre",
    text: "Tune to the room, not the instrument.\nThey are different rooms." },

  { id: 24, category: "Microtonality / Timbre",
    text: "Play the 7th partial.\nOr what you imagine the 7th partial sounds like.\nClose enough." },

  { id: 25, category: "Microtonality / Timbre",
    text: "Let the overtones decide the melody." },

  // ── Voice / Body ──────────────────────────────────────────────────────────
  { id: 26, category: "Voice / Body",
    text: "Sound = breath = sound." },

  { id: 27, category: "Voice / Body",
    text: "Sing what you cannot play.\nPlay what you cannot sing.\nListen to the difference." },

  { id: 28, category: "Voice / Body",
    text: "The voice is also an instrument.\nThe instrument is also a voice.\nProceed accordingly." },

  // ── Space / Silence ───────────────────────────────────────────────────────
  { id: 29, category: "Space / Silence",
    text: "The silence after is also composed." },

  { id: 30, category: "Space / Silence",
    text: "Make a space large enough\nfor something unexpected to happen.\nWait." }

];
