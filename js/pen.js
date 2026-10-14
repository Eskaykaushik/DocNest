import { drawStroke } from "./draw.js";

const PEN_HOLD_MS = 1600;
const PEN_FADE_MS = 900;
const LASER_TRAIL_MS = 650;
const LASER_COLOR = "#ff3b30";
const PEN_WIDTH = 3;
const LASER_TIP_RADIUS = 5;

const ICONS = {
  launcher:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  laser:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
  pen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>',
  clear:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
};

const canvas = document.createElement("canvas");
canvas.className = "pen-layer";
canvas.setAttribute("aria-hidden", "true");

const toolbar = document.createElement("div");
toolbar.className = "pen-toolbar";
toolbar.setAttribute("role", "toolbar");
toolbar.setAttribute("aria-label", "Presentation ink tools");
toolbar.hidden = true;
toolbar.innerHTML = `
  <button type="button" class="pen-tool" data-pen-tool="laser" title="Laser pointer" aria-label="Laser pointer">${ICONS.laser}</button>
  <button type="button" class="pen-tool" data-pen-tool="pen" title="Fading pen" aria-label="Fading pen">${ICONS.pen}</button>
  <button type="button" class="pen-tool" data-pen-tool="clear" title="Clear ink" aria-label="Clear ink">${ICONS.clear}</button>
`;

const launcher = document.createElement("button");
launcher.type = "button";
launcher.className = "pen-launcher";
launcher.setAttribute("aria-label", "Presentation ink");
launcher.setAttribute("aria-pressed", "false");
launcher.title = "Presentation ink (Esc to exit)";
launcher.innerHTML = ICONS.launcher;

const root = document.createElement("div");
root.className = "pen-widget";
root.appendChild(toolbar);
root.appendChild(launcher);
document.body.appendChild(canvas);
document.body.appendChild(root);

const ctx = canvas.getContext("2d");

let dpr = window.devicePixelRatio || 1;
let active = false;
let tool = "laser";
let marks = [];
let laser = null;
let penStroke = null;
let drawing = false;
let rafId = 0;

function inkColor() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "#111827" : "#f0f6fc";
}

function pressureOf(event) {
  return event.pressure && event.pressure > 0 ? event.pressure : 0.5;
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  schedule();
}

function schedule() {
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function markAlpha(mark, now) {
  if (now < mark.holdUntil) return 1;
  const t = (now - mark.holdUntil) / PEN_FADE_MS;
  return t >= 1 ? 0 : 1 - t;
}

function drawLaser(now) {
  if (!laser || !laser.points.length) return;
  if (laser.live) laser.points[laser.points.length - 1].t = now;
  laser.points = laser.points.filter((point) => now - point.t < LASER_TRAIL_MS);
  const points = laser.points;
  if (!points.length) {
    laser = null;
    return;
  }
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = LASER_COLOR;
  ctx.shadowColor = LASER_COLOR;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const alpha = Math.max(0, 1 - (now - b.t) / LASER_TRAIL_MS);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const tip = points[points.length - 1];
  ctx.globalAlpha = Math.max(0, 1 - (now - tip.t) / LASER_TRAIL_MS);
  ctx.shadowBlur = 18;
  ctx.fillStyle = LASER_COLOR;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, LASER_TIP_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function frame() {
  rafId = 0;
  const now = performance.now();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  drawLaser(now);

  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const alpha = markAlpha(marks[i], now);
    if (alpha <= 0) {
      marks.splice(i, 1);
      continue;
    }
    drawStroke(ctx, marks[i].stroke, alpha);
  }

  if (penStroke) drawStroke(ctx, penStroke.stroke, 1);

  if (marks.length || penStroke || (laser && laser.points.length)) schedule();
}

function addLaserPoint(x, y) {
  if (!laser) laser = { points: [], live: true };
  laser.live = true;
  laser.points.push({ x, y, t: performance.now() });
  schedule();
}

function startPen(event) {
  drawing = true;
  canvas.setPointerCapture(event.pointerId);
  penStroke = {
    stroke: {
      tool: "pen",
      color: inkColor(),
      width: PEN_WIDTH,
      points: [{ x: event.clientX, y: event.clientY, p: pressureOf(event) }],
    },
  };
  schedule();
}

function finishPen() {
  if (!penStroke) return;
  penStroke.holdUntil = performance.now() + PEN_HOLD_MS;
  marks.push(penStroke);
  penStroke = null;
  drawing = false;
  schedule();
}

function onDown(event) {
  if (!active || event.button > 0) return;
  event.preventDefault();
  if (tool === "pen") startPen(event);
  else addLaserPoint(event.clientX, event.clientY);
}

function onMove(event) {
  if (!active) return;
  if (tool === "pen") {
    if (!drawing || !penStroke) return;
    event.preventDefault();
    const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    for (const ev of events) {
      penStroke.stroke.points.push({ x: ev.clientX, y: ev.clientY, p: pressureOf(ev) });
    }
    schedule();
    return;
  }
  if (!laser || !laser.live) return;
  event.preventDefault();
  addLaserPoint(event.clientX, event.clientY);
}

function onUp(event) {
  if (tool === "pen") {
    if (!drawing) return;
    finishPen();
    return;
  }
  if (laser && event.pointerId !== undefined) {
    laser.live = false;
    schedule();
  }
}

function onLeave() {
  if (laser && laser.live) {
    laser.live = false;
    schedule();
  }
}

function clearInk() {
  marks = [];
  laser = null;
  penStroke = null;
  drawing = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (active) schedule();
}

function setTool(next) {
  tool = next;
  toolbar.querySelectorAll("[data-pen-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.penTool === next);
  });
}

function setActive(next) {
  active = next;
  canvas.classList.toggle("is-active", active);
  launcher.classList.toggle("is-active", active);
  launcher.setAttribute("aria-pressed", String(active));
  toolbar.hidden = !active;
  document.body.classList.toggle("pen-active", active);
  if (!active) clearInk();
}

canvas.addEventListener("pointerdown", onDown);
canvas.addEventListener("pointermove", onMove);
canvas.addEventListener("pointerup", onUp);
canvas.addEventListener("pointercancel", onUp);
canvas.addEventListener("pointerleave", onLeave);
window.addEventListener("resize", resize);

launcher.addEventListener("click", () => setActive(!active));

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pen-tool]");
  if (!button) return;
  const next = button.dataset.penTool;
  if (next === "clear") clearInk();
  else setTool(next);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && active) setActive(false);
});

setTool("laser");
resize();
