// MTOK2 — reusable control widgets (WO-ui).
// Dial · Fader · Radio · Toggle · XYPad. No dependencies, no build step.
//
// Contract: a widget binds exactly ONE param name and talks to the store only
// (P.set / P.sub). It never touches audio nodes. Every widget registers itself
// in BOUND so ui.js can audit param coverage at boot (SPEC acceptance #3).
//
// Touch model: pointer events + setPointerCapture, scoped per widget by
// pointerId, so a dial drag and a keyboard chord can be live simultaneously.
// touch-action:none on every widget surface (CSS) — required or iOS Safari
// steals the drag for scrolling.

import { P } from './state.js?v=6';

// param name -> [widget descriptors] (audited by ui.js; >1 or 0 is a finding)
export const BOUND = new Map();

function claim(param, kind, node) {
  if (!BOUND.has(param)) BOUND.set(param, []);
  BOUND.get(param).push({ kind, node });
}

export function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}

// iOS: a tapped button keeps :focus and reads as stuck-selected, and the next
// tap elsewhere can look inert. Field report 2026-08-15, dev harness fix.
export function blurLater(node) {
  setTimeout(() => { try { node.blur(); } catch (_) {} }, 0);
}

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const fmt = v => (Math.round(v * 1000) / 1000).toFixed(2);

// ═══════════════════════════════════════════════════════════
// DIAL — vertical drag. Horizontal distance from the dial gives fine control
// (the further out your finger travels, the smaller the throw), so precision
// needs no modifier key — there isn't one on an iPad.
// ═══════════════════════════════════════════════════════════

// Track geometry. Angles are 0 = straight up, increasing clockwise (arcPath's
// convention), so the sweep runs from lower-left round to lower-right.
const ARC0 = -140, ARC1 = 140, ARC_R = 38;
const SWEEP = ((ARC1 - ARC0) + 360) % 360;
const ARC_LEN = 2 * Math.PI * ARC_R * (SWEEP / 360);
const THROW_PX = 170;                             // full 0→1 travel

// min/max/int let one dial serve absolute params (tempo BPM, tuplet index)
// without a second widget; fmtFn overrides the readout text.
export function Dial({ param, label, color = '#8a8ab0', size = 54,
                       min = 0, max = 1, int = false, fmtFn = null }) {
  const wrap = el('div', 'dial');
  wrap.style.setProperty('--dc', color);
  wrap.style.setProperty('--dsz', size + 'px');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('dial-face');
  const track = arcPath(50, 50, ARC_R, ARC0, ARC1);
  const bg = svgEl('path', { d: track, class: 'dial-track' });
  const fill = svgEl('path', { d: track, class: 'dial-fill' });
  const needle = svgEl('line', { class: 'dial-needle', x1: 50, y1: 50, x2: 50, y2: 20 });
  svg.append(bg, fill, needle);

  const cap = el('div', 'dial-label', label);
  const read = el('div', 'dial-read', '');
  wrap.append(svg, cap, read);

  // dash-offset drive: one path, stroke-dasharray reveals the filled portion
  fill.style.strokeDasharray = ARC_LEN;

  const span = max - min;
  const norm = val => clamp01((val - min) / span);
  const denorm = n => {
    const raw = min + clamp01(n) * span;
    return int ? Math.round(raw) : raw;
  };

  const dflt = P.get(param);
  let v = dflt;

  function render(val) {
    v = val;
    const n = norm(val);
    fill.style.strokeDashoffset = ARC_LEN * (1 - n);
    needle.setAttribute('transform', `rotate(${ARC0 + SWEEP * n} 50 50)`);
    read.textContent = fmtFn ? fmtFn(val) : (int ? String(val) : fmt(val));
  }
  render(v);
  P.sub(param, render);

  let pid = null, y0 = 0, x0 = 0, v0 = 0, moved = false, tapT = 0;

  wrap.addEventListener('pointerdown', e => {
    if (pid !== null) return;
    pid = e.pointerId; y0 = e.clientY; x0 = e.clientX; v0 = norm(v); moved = false;
    try { wrap.setPointerCapture(pid); } catch (_) {}
    wrap.classList.add('live');
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dy = y0 - e.clientY, dx = Math.abs(e.clientX - x0);
    if (Math.abs(dy) > 2 || dx > 2) moved = true;
    const precision = 1 / (1 + dx / 40);          // finger out = finer
    P.set(param, denorm(v0 + (dy / THROW_PX) * precision));
    e.preventDefault();
  }, { passive: false });

  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    wrap.classList.remove('live');
    if (!moved) {                                  // double-tap resets to default
      const now = performance.now();
      if (now - tapT < 320) P.set(param, dflt);
      tapT = now;
    }
    blurLater(wrap);
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);

  claim(param, 'dial', wrap);
  wrap.dataset.param = param;
  return wrap;
}

function svgEl(tag, attrs) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => {
    const rad = (a - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const sweep = ((a1 - a0) + 360) % 360;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

// ═══════════════════════════════════════════════════════════
// FADER — horizontal or vertical. Absolute on tap, then drags.
// ═══════════════════════════════════════════════════════════

export function Fader({ param, label, color = '#8a8ab0', vertical = false, tall = false }) {
  const wrap = el('div', 'fader' + (vertical ? ' vert' : '') + (tall ? ' tall' : ''));
  wrap.style.setProperty('--dc', color);
  const fill = el('div', 'fader-fill');
  const cap = el('div', 'fader-label', label);
  const read = el('div', 'fader-read', '');
  wrap.append(fill, cap, read);

  function render(val) {
    const pct = clamp01(val) * 100;
    if (vertical) fill.style.height = pct + '%';
    else fill.style.width = pct + '%';
    read.textContent = fmt(val);
  }
  render(P.get(param));
  P.sub(param, render);

  let pid = null;
  const fromEvent = e => {
    const b = wrap.getBoundingClientRect();
    return clamp01(vertical ? (b.bottom - e.clientY) / b.height
                            : (e.clientX - b.left) / b.width);
  };

  wrap.addEventListener('pointerdown', e => {
    if (pid !== null) return;
    pid = e.pointerId;
    try { wrap.setPointerCapture(pid); } catch (_) {}
    wrap.classList.add('live');
    P.set(param, fromEvent(e));
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    P.set(param, fromEvent(e));
    e.preventDefault();
  }, { passive: false });

  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null; wrap.classList.remove('live'); blurLater(wrap);
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);

  claim(param, 'fader', wrap);
  wrap.dataset.param = param;
  return wrap;
}

// ═══════════════════════════════════════════════════════════
// RADIO — exclusive int selector. options: [{value, label, badge?}]
// ═══════════════════════════════════════════════════════════

export function Radio({ param, label, options, color = '#8a8ab0', vertical = false }) {
  const wrap = el('div', 'radio' + (vertical ? ' vert' : ''));
  wrap.style.setProperty('--dc', color);
  if (label) wrap.append(el('div', 'radio-label', label));
  const row = el('div', 'radio-row');
  wrap.append(row);

  const btns = options.map(o => {
    const b = el('button', 'radio-btn');
    b.type = 'button';
    b.append(el('span', null, o.label));
    if (o.badge) b.append(el('sup', 'badge', o.badge));
    if (o.title) b.title = o.title;
    b.addEventListener('click', () => { P.set(param, o.value); blurLater(b); });
    b.dataset.value = o.value;
    row.append(b);
    return b;
  });

  function render(val) {
    btns.forEach((b, i) => b.classList.toggle('on', options[i].value === val));
  }
  render(P.get(param));
  P.sub(param, render);

  claim(param, 'radio', wrap);
  wrap.dataset.param = param;
  return wrap;
}

// ═══════════════════════════════════════════════════════════
// TOGGLE — 0/1 param (chord partials, keyXY targets, pedal).
// ═══════════════════════════════════════════════════════════

export function Toggle({ param, label, color = '#8a8ab0', momentary = false }) {
  const b = el('button', 'tog');
  b.type = 'button';
  b.style.setProperty('--dc', color);
  b.append(el('span', null, label));

  const render = v => b.classList.toggle('on', !!v);
  render(P.get(param));
  P.sub(param, render);

  if (momentary) {
    b.addEventListener('pointerdown', e => { P.set(param, 1); e.preventDefault(); }, { passive: false });
    const up = e => { P.set(param, 0); blurLater(b); e.preventDefault(); };
    b.addEventListener('pointerup', up, { passive: false });
    b.addEventListener('pointercancel', up, { passive: false });
    b.addEventListener('pointerleave', e => { if (e.buttons) up(e); });
  } else {
    b.addEventListener('click', () => { P.set(param, P.get(param) ? 0 : 1); blurLater(b); });
  }

  claim(param, 'toggle', b);
  b.dataset.param = param;
  return b;
}

// ═══════════════════════════════════════════════════════════
// XY PAD — publishes three params (x, y, touch). Dot trail on drag.
// ═══════════════════════════════════════════════════════════

export function XYPad({ px, py, ptouch, label, color = '#8a8ab0', crosshair = true }) {
  const wrap = el('div', 'xy');
  wrap.style.setProperty('--dc', color);
  const cv = el('canvas', 'xy-canvas');
  const cap = el('div', 'xy-label', label);
  wrap.append(cv, cap);

  const trail = [];
  let dpr = 1, W = 0, H = 0;

  function resize() {
    const b = wrap.getBoundingClientRect();
    if (!b.width || !b.height) return;
    dpr = window.devicePixelRatio || 1;
    W = b.width; H = b.height;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    draw();
  }

  function draw() {
    const c = cv.getContext('2d');
    if (!c || !W) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const x = P.get(px) * W, y = (1 - P.get(py)) * H;

    if (crosshair) {
      c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H);
      c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    // trail: oldest faintest
    trail.forEach((p, i) => {
      const a = (i + 1) / trail.length * 0.35;
      c.fillStyle = `rgba(255,255,255,${a})`;
      c.beginPath(); c.arc(p.x * W, (1 - p.y) * H, 3, 0, 6.284); c.fill();
    });
    const on = !!P.get(ptouch);
    c.fillStyle = on ? getComputedStyle(wrap).getPropertyValue('--dc').trim() || '#fff' : 'rgba(255,255,255,0.35)';
    c.beginPath(); c.arc(x, y, on ? 13 : 8, 0, 6.284); c.fill();
  }

  [px, py, ptouch].forEach(p => P.sub(p, draw));

  let pid = null;
  const pub = e => {
    const b = cv.getBoundingClientRect();
    const x = clamp01((e.clientX - b.left) / b.width);
    const y = clamp01(1 - (e.clientY - b.top) / b.height);
    trail.push({ x, y });
    if (trail.length > 24) trail.shift();
    P.set(px, x); P.set(py, y);
  };

  wrap.addEventListener('pointerdown', e => {
    if (pid !== null) return;
    pid = e.pointerId;
    try { wrap.setPointerCapture(pid); } catch (_) {}
    trail.length = 0;
    P.set(ptouch, 1); pub(e); draw();
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    pub(e); draw(); e.preventDefault();
  }, { passive: false });

  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null; P.set(ptouch, 0); draw(); blurLater(wrap);
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);

  claim(px, 'xy', wrap); claim(py, 'xy', wrap); claim(ptouch, 'xy', wrap);
  wrap._resize = resize;
  return wrap;
}

// ═══════════════════════════════════════════════════════════
// DEAD — a control that is present but not yet functional (REC/ML/undo).
// Wired on purpose: the wave-1 field report's panic button had no handler at
// all, which read as a broken instrument. A no-op with a reason is honest.
// ═══════════════════════════════════════════════════════════

export function Dead({ label, why = 'wave 2', color = '#555' }) {
  const b = el('button', 'tog dead');
  b.type = 'button';
  b.style.setProperty('--dc', color);
  b.append(el('span', null, label));
  b.title = why;
  b.setAttribute('aria-disabled', 'true');
  b.addEventListener('click', () => {
    b.classList.add('nope');
    setTimeout(() => b.classList.remove('nope'), 260);
    blurLater(b);
  });
  return b;
}

// Plain action button (SCRAM, preset save…) — always wired, always blurs.
export function Btn({ label, onTap, cls = '', color = '#8a8ab0' }) {
  const b = el('button', 'btn ' + cls);
  b.type = 'button';
  b.style.setProperty('--dc', color);
  b.append(el('span', null, label));
  b.addEventListener('click', () => { onTap(b); blurLater(b); });
  return b;
}
