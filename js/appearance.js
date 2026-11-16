/* Appearance control — one dropdown for both axes: skin × theme.
   js/theme.js sets the pre-paint attributes; this module owns the UI,
   persistence, the diagram wobble filter, and reconciles the attributes with
   the saved choice if the boot script was stale or blocked. Adding a skin or
   theme = one entry below. */

const SKIN_KEY = "docnest.skin";
const THEME_KEY = "docnest.theme";
const DEFAULT_SKIN = "paper";
const DEFAULT_THEME = "dark";
const FILTER_ID = "dn-wobble";
const DEFS_ID = "dn-skin-defs";

export const SKINS = [
  { id: "doodle", label: "Doodle" },
  { id: "paper", label: "Paper" },
];

export const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

let select = null;
let observer = null;

export function getAppearance() {
  return { skin: resolveSkin(), theme: resolveTheme() };
}

function storedValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function resolveSkin() {
  const attr = document.documentElement.dataset.skin;
  if (SKINS.some((item) => item.id === attr)) return attr;
  const saved = storedValue(SKIN_KEY);
  if (SKINS.some((item) => item.id === saved)) return saved;
  return DEFAULT_SKIN;
}

function resolveTheme() {
  const attr = document.documentElement.dataset.theme;
  if (THEMES.some((item) => item.id === attr)) return attr;
  const saved = storedValue(THEME_KEY);
  if (THEMES.some((item) => item.id === saved)) return saved;
  return DEFAULT_THEME;
}

export function setAppearance({ skin, theme } = {}, { persist = true } = {}) {
  const current = getAppearance();
  const nextSkin = SKINS.some((item) => item.id === skin) ? skin : current.skin;
  const nextTheme = THEMES.some((item) => item.id === theme) ? theme : current.theme;
  const root = document.documentElement;

  root.dataset.skin = nextSkin;
  root.dataset.theme = nextTheme;

  if (nextSkin === "doodle") ensureFilter();

  if (persist) {
    try {
      localStorage.setItem(SKIN_KEY, nextSkin);
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      /* storage unavailable — the choice still applies for this session */
    }
  }

  syncSelect();
  document.dispatchEvent(
    new CustomEvent("docnest:appearancechange", {
      detail: { skin: nextSkin, theme: nextTheme },
    }),
  );
  return { skin: nextSkin, theme: nextTheme };
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

function optionValue(skin, theme) {
  return `${skin}:${theme}`;
}

function buildSelect() {
  const control = document.createElement("span");
  control.className = "appearance-control";

  const el = document.createElement("select");
  el.className = "appearance-select";
  el.dataset.appearanceSelect = "";
  el.setAttribute("aria-label", "Theme");

  SKINS.forEach((skin) => {
    THEMES.forEach((theme) => {
      const option = document.createElement("option");
      option.value = optionValue(skin.id, theme.id);
      option.textContent = `${skin.label} · ${theme.label}`;
      el.appendChild(option);
    });
  });

  el.addEventListener("change", () => {
    const [skin, theme] = el.value.split(":");
    setAppearance({ skin, theme });
  });

  control.append(el);
  return control;
}

function syncSelect() {
  if (!select) return;
  const { skin, theme } = getAppearance();
  select.value = optionValue(skin, theme);
}

function watchRoot() {
  if (observer) return;
  observer = new MutationObserver(syncSelect);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-skin", "data-theme"],
  });
}

export function initAppearance() {
  if (select) return getAppearance();

  const nav = document.querySelector(".nav-actions");
  if (!nav) return getAppearance();

  // Reconcile the root attributes with the saved choice before drawing the
  // control. js/theme.js normally does this before first paint; this keeps the
  // page and the dropdown in agreement if that script was cached or blocked.
  const root = document.documentElement;
  const appearance = getAppearance();
  if (root.dataset.skin !== appearance.skin) root.dataset.skin = appearance.skin;
  if (root.dataset.theme !== appearance.theme) root.dataset.theme = appearance.theme;
  if (appearance.skin === "doodle") ensureFilter();

  const control = buildSelect();
  select = control.querySelector("select");

  const search = nav.querySelector(".search-wrap");
  const ring = nav.querySelector(".level-ring");
  if (search) search.after(control);
  else if (ring) ring.before(control);
  else nav.appendChild(control);

  syncSelect();
  watchRoot();
  return getAppearance();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppearance);
} else {
  initAppearance();
}
