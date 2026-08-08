/**
 * utils.js
 * Small, dependency-free helper functions shared across the app.
 */

const WORDS_PER_MINUTE = 200;

/**
 * Estimate reading time from raw text (Markdown source is fine — the
 * word count is close enough once syntax characters are averaged out).
 * @param {string} text
 * @param {number} [wordsPerMinute]
 * @returns {number} whole minutes, minimum of 1
 */
export function calculateReadingTime(text, wordsPerMinute = WORDS_PER_MINUTE) {
  if (!text) return 1;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = wordCount / wordsPerMinute;
  return Math.max(1, Math.round(minutes));
}

/**
 * Read a query parameter from the current URL.
 * @param {string} name
 * @returns {string|null}
 */
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Slugify a heading string into a URL-safe, unique-ish id.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Format an ISO date string (YYYY-MM-DD) as a friendly label, e.g. "Aug 7, 2026".
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Debounce a function so it only fires after `delay` ms of inactivity.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 150) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Escape a string for safe insertion into HTML.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/**
 * Fetch and return the text contents of a file, throwing a readable
 * error if the request fails.
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load "${path}" (${response.status})`);
  }
  return response.text();
}

/**
 * Fetch and parse a JSON file, throwing a readable error if it fails.
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load "${path}" (${response.status})`);
  }
  return response.json();
}
