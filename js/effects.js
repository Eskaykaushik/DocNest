/**
 * effects.js
 * Shared delight layer: toasts, particle bursts, confetti and screen flashes.
 * Used by the easter eggs and the "nest grows as you learn" progress loop.
 * All particle effects no-op under prefers-reduced-motion; toasts still show.
 */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

const CONFETTI_COLORS = [
  "var(--color-accent)",
  "var(--color-accent-strong)",
  "var(--color-success)",
  "#e3b341",
  "#f0f6fc",
];

export function showToast(message, duration = 2600) {
  toastQueue.push({ message, duration });
  if (!toastBusy) runToastQueue();
}

const toastQueue = [];
let toastBusy = false;

function ensureToast() {
  let toast = document.querySelector("#egg-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.id = "egg-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  return toast;
}

function runToastQueue() {
  const next = toastQueue.shift();
  if (!next) {
    toastBusy = false;
    return;
  }
  toastBusy = true;
  const toast = ensureToast();
  toast.textContent = next.message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(runToastQueue, 240);
  }, next.duration);
}

export function flash() {
  let node = document.querySelector("#egg-flash");
  if (!node) {
    node = document.createElement("div");
    node.className = "egg-flash";
    node.id = "egg-flash";
    document.body.appendChild(node);
  }
  node.classList.add("active");
  clearTimeout(flash._t);
  flash._t = setTimeout(() => node.classList.remove("active"), 300);
}

function spawnParticles({ colors, count, origin, spread, lift, size, className, duration }) {
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement("span");
    p.className = className;
    const angle = Math.random() * Math.PI * 2;
    const dist = spread * (0.4 + Math.random());
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - lift}px`);
    p.style.setProperty("--duration-stagger", `${450 + Math.random() * 500}ms`);
    if (size) {
      const s = size * (0.6 + Math.random() * 0.8);
      p.style.width = `${s}px`;
      p.style.height = `${s}px`;
    }
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), duration);
  }
}

export function burstParticles(color, origin) {
  if (REDUCED.matches) return;
  spawnParticles({
    colors: [color],
    count: 16,
    origin,
    spread: 120,
    lift: 40,
    className: "egg-particle",
    duration: 1000,
  });
}

export function confetti(options = {}) {
  if (REDUCED.matches) return;
  spawnParticles({
    colors: options.colors || CONFETTI_COLORS,
    count: options.count ?? 30,
    origin: options.origin,
    spread: options.spread ?? 180,
    lift: options.lift ?? 140,
    size: options.size ?? 9,
    className: "egg-particle",
    duration: 1100,
  });
}

export function starfieldRain() {
  if (REDUCED.matches) return;
  const colors = [
    "var(--color-accent)",
    "var(--color-accent-strong)",
    "#e3b341",
    "#f0f6fc",
  ];
  for (let i = 0; i < 26; i += 1) {
    const s = document.createElement("span");
    s.className = "egg-star";
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * 140}px`);
    s.style.setProperty("--dy", `${-(100 + Math.random() * 240)}px`);
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    s.style.left = `${Math.random() * window.innerWidth}px`;
    s.style.bottom = `${Math.random() * 40 + 20}px`;
    s.style.animationDelay = `${Math.random() * 500}ms`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}

export function celebrate(message, options = {}) {
  flash();
  confetti(options);
  if (message) showToast(message);
}
