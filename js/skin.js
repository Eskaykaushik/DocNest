/* Skin manager — registry, toggle, persistence and change events.
   The pre-paint attribute is applied by js/theme.js; this module owns the UI
   and the public API. Adding a skin = registerSkin() here + a token block in
   css/skins.css. */

const STORAGE_KEY = "docnest.skin";
const DEFAULT_SKIN = "paper";
const FILTER_ID = "dn-wobble";
const DEFS_ID = "dn-skin-defs";

const ICONS = {
  sheet:
    '<svg class="skin-icon skin-icon-sheet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h5"/></svg>',
  pen:
    '<svg class="skin-icon skin-icon-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1L18 9l-3-3L5 16z"/><path d="M14 6l3 3"/><path d="M4 20l1-4"/></svg>',
};

const registry = new Map();
const listeners = new Set();

let current = DEFAULT_SKIN;
let initialized = false;

export function registerSkin({ id, label, icon = "sheet" } = {}) {
  if (!id) return null;
  registry.set(id, { id, label: label || id, icon });
  return id;
}

export function listSkins() {
  return Array.from(registry.values());
}

export function getSkin() {
  return current;
}

export function onSkinChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSkin(id, { persist = true } = {}) {
  const next = registry.has(id) ? id : DEFAULT_SKIN;
  current = next;
  document.documentElement.dataset.skin = next;

  if (next === "doodle") ensureFilter();

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the skin still applies for this session */
    }
  }

  syncButtons();
  listeners.forEach((listener) => listener(next));
  document.dispatchEvent(new CustomEvent("docnest:skinchange", { detail: { skin: next } }));
  return next;
}

export function cycleSkin() {
  const ids = Array.from(registry.keys());
  if (!ids.length) return current;
  const index = ids.indexOf(current);
  return setSkin(ids[(index + 1) % ids.length]);
}

function ensureFilter() {
  if (document.getElementById(DEFS_ID)) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = DEFS_ID;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.innerHTML = `<defs><filter id="${FILTER_ID}" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="1" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
  document.body.appendChild(svg);
}

function buildButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle skin-toggle";
  button.dataset.skinToggle = "";
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `${ICONS.sheet}${ICONS.pen}`;

  const nav = document.querySelector(".nav-actions");
  const themeToggle = nav?.querySelector("[data-theme-toggle]");
  if (themeToggle) themeToggle.before(button);
  else if (nav) nav.appendChild(button);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    cycleSkin();
  });

  return button;
}

function syncButtons() {
  const doodle = current === "doodle";
  const next = doodle ? "paper" : "doodle";
  document.querySelectorAll("[data-skin-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(doodle));
    button.setAttribute("aria-label", `Switch to ${next} skin`);
    button.title = `Switch to ${next} skin`;
  });
}

export function initSkin() {
  if (initialized) return { getSkin, setSkin, cycleSkin, onSkinChange, listSkins };
  initialized = true;

  registerSkin({ id: "paper", label: "Paper", icon: "sheet" });
  registerSkin({ id: "doodle", label: "Doodle", icon: "pen" });

  const booted = document.documentElement.dataset.skin;
  current = registry.has(booted) ? booted : DEFAULT_SKIN;
  document.documentElement.dataset.skin = current;

  if (current === "doodle") ensureFilter();
  if (document.querySelector(".nav-actions")) buildButton();
  syncButtons();

  return { getSkin, setSkin, cycleSkin, onSkinChange, listSkins };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSkin);
} else {
  initSkin();
}
