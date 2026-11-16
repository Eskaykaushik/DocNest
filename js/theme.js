/**
 * theme.js
 * Minimal theme manager. Resolves the effective theme from localStorage
 * (explicit choice) → the built-in default (dark), applies it to
 * <html data-theme>, and wires the navbar toggle button (sun/moon icon).
 *
 * Loaded as a regular (non-module) script in <head> so it runs before the
 * page paints, avoiding a flash of the wrong theme. localStorage is only
 * written when the user explicitly picks a pair — otherwise the default
 * Paper · Dark look is used.
 */

(function () {
  const STORAGE_KEY = "docnest.theme";
  const SKIN_KEY = "docnest.skin";
  const DEFAULT_SKIN = "paper";
  const DEFAULT_THEME = "dark";
  const root = document.documentElement;

  const STORAGE_UNAVAILABLE = Symbol("storage-unavailable");

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return STORAGE_UNAVAILABLE;
    }
  }

  function hasExplicitChoice() {
    const stored = readStored();
    return stored === "light" || stored === "dark";
  }

  function currentTheme() {
    if (hasExplicitChoice()) return readStored();
    return DEFAULT_THEME;
  }

  function apply(theme, persist) {
    root.setAttribute("data-theme", theme);
    updateToggle(theme);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* storage unavailable — the theme still applies for this session */
      }
    }
  }

  function updateToggle(theme) {
    const isDark = theme === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      button.setAttribute("aria-pressed", String(isDark));
    });
  }

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    apply(next, true); // explicit choice → persist
  }

  function urlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  }

  function initialSkin() {
    const param = urlParam("skin");
    if (param && /^[a-z0-9-]+$/.test(param)) {
      try {
        localStorage.setItem(SKIN_KEY, param);
      } catch {
        /* storage unavailable */
      }
      return param;
    }
    try {
      const stored = localStorage.getItem(SKIN_KEY);
      if (stored && /^[a-z0-9-]+$/.test(stored)) return stored;
    } catch {
      /* storage unavailable */
    }
    return DEFAULT_SKIN;
  }

  function applySkin(skin) {
    root.setAttribute("data-skin", skin);
  }

  // A user clicking the toggle overrides the default from then on.
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;
    event.preventDefault();
    toggle();
  });

  const themeParam = urlParam("theme");
  if (themeParam === "light" || themeParam === "dark") {
    try {
      localStorage.setItem(STORAGE_KEY, themeParam);
    } catch {
      /* storage unavailable */
    }
    apply(themeParam, false);
  } else {
    apply(currentTheme(), false);
  }

  // Skin boots here too, before first paint. Any slug is accepted so a skin
  // can be added without touching this file; js/appearance.js validates
  // against the registry and falls back to the default.
  applySkin(initialSkin());

  // The toggle button lives in <body>, which parses after theme.js runs in
  // <head>. Re-sync the icon state once the DOM is available.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => updateToggle(currentTheme()));
  } else {
    updateToggle(currentTheme());
  }
})();