/**
 * theme.js
 * Minimal theme manager. Resolves the effective theme from localStorage
 * (explicit choice) → prefers-color-scheme (OS preference), applies it to
 * <html data-theme>, and wires the navbar toggle button (sun/moon icon).
 *
 * Loaded as a regular (non-module) script in <head> so it runs before the
 * page paints, avoiding a flash of the wrong theme. localStorage is only
 * written when the user explicitly toggles — otherwise the theme follows
 * the OS live.
 */

(function () {
  const STORAGE_KEY = "docnest.theme";
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

  function systemPrefersLight() {
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  function currentTheme() {
    if (hasExplicitChoice()) return readStored();
    return systemPrefersLight() ? "light" : "dark";
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
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const sun = button.querySelector('[data-theme-icon="sun"]');
      const moon = button.querySelector('[data-theme-icon="moon"]');
      const isDark = theme === "dark";
      button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      button.setAttribute("aria-pressed", String(isDark));
      if (sun) sun.hidden = !isDark;
      if (moon) moon.hidden = isDark;
    });
  }

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    apply(next, true); // explicit choice → persist
  }

  // A user clicking the toggle overrides the OS preference from then on.
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;
    event.preventDefault();
    toggle();
  });

  // Keep the theme live when the OS preference changes, unless the user has
  // made an explicit choice that should win.
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onSystemChange = () => {
    if (!hasExplicitChoice()) apply(systemPrefersLight() ? "light" : "dark", false);
  };
  if (media.addEventListener) media.addEventListener("change", onSystemChange);
  else if (media.addListener) media.addListener(onSystemChange);

  apply(currentTheme(), false);

  // The toggle button lives in <body>, which parses after theme.js runs in
  // <head>. Re-sync the icon state once the DOM is available.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => updateToggle(currentTheme()));
  } else {
    updateToggle(currentTheme());
  }
})();