/**
 * theme.js
 * Light/dark theme toggle. The current theme lives on the <html> element as
 * `data-theme="dark" | "light"`, persisted in localStorage. The highlight.js
 * stylesheet (atom-one-dark / atom-one-light) is swapped to match.
 *
 * An inline script in the <head> already set `data-theme` before first paint,
 * so this module only wires up the toggle button and keeps state in sync.
 */

const THEME_KEY = "docnest.theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function swapHighlightTheme(theme) {
  const hl = document.getElementById("hljs-theme");
  if (!hl) return;
  hl.href = hl.href.replace(
    theme === "light" ? "atom-one-dark" : "atom-one-light",
    theme === "light" ? "atom-one-light" : "atom-one-dark"
  );
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  swapHighlightTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable — theme just won't persist */
  }
}

export function initThemeToggle() {
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;

  const sync = () => {
    toggle.setAttribute("aria-pressed", String(currentTheme() === "dark"));
    toggle.setAttribute(
      "aria-label",
      currentTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
  };

  toggle.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
    sync();
  });

  sync();
}

initThemeToggle();