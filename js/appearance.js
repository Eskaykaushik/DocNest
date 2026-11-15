/* Appearance control — one dropdown for both axes: skin × theme.
   The pre-paint attributes are set by js/theme.js; this module owns the UI,
   persistence and change events. Adding a skin or theme = one entry below. */

const SKIN_KEY = "docnest.skin";
const THEME_KEY = "docnest.theme";
const DEFAULT_SKIN = "doodle";
const DEFAULT_THEME = "light";

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
  const root = document.documentElement;
  return {
    skin: root.dataset.skin || DEFAULT_SKIN,
    theme: root.dataset.theme === "dark" ? "dark" : DEFAULT_THEME,
  };
}

export function setAppearance({ skin, theme } = {}, { persist = true } = {}) {
  const current = getAppearance();
  const nextSkin = SKINS.some((item) => item.id === skin) ? skin : current.skin;
  const nextTheme = THEMES.some((item) => item.id === theme) ? theme : current.theme;
  const root = document.documentElement;

  root.dataset.skin = nextSkin;
  root.dataset.theme = nextTheme;

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
