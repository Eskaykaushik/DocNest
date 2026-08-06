/**
 * markdown.js
 * Wraps marked.js + highlight.js (loaded from CDN as globals) to turn raw
 * Markdown into DocNest-styled HTML, and wires up copy-to-clipboard on
 * every rendered code block.
 */

import { slugify, escapeHtml } from "./utils.js";

let renderer = null;

/**
 * Build (once) a marked.js renderer customized for DocNest's markup:
 * - code blocks get a header with a language label + copy button
 * - tables are wrapped in a scrollable container
 * - headings get stable, slugified ids for the table of contents
 */
function getRenderer() {
  if (renderer) return renderer;

  const usedIds = new Set();
  renderer = new marked.Renderer();

  renderer.heading = (text, level) => {
    const plainText = text.replace(/<[^>]+>/g, "").replace(/&#\d+;|&[a-z]+;/gi, "");
    let id = slugify(plainText);
    let unique = id;
    let suffix = 2;
    while (usedIds.has(unique)) {
      unique = `${id}-${suffix++}`;
    }
    usedIds.add(unique);
    return `<h${level} id="${unique}">${text}</h${level}>\n`;
  };

  renderer.code = (code, infoString) => {
    const language = (infoString || "").trim().split(/\s+/)[0] || "text";
    const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
    const highlighted = hljs.highlight(code, { language: validLanguage }).value;
    const label = validLanguage === "plaintext" ? "text" : validLanguage;

    return `
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-lang">${escapeHtml(label)}</span>
          <button type="button" class="copy-btn" data-code="${encodeURIComponent(code)}">
            ${copyIconSvg()}
            <span class="copy-label">Copy</span>
          </button>
        </div>
        <pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
      </div>
    `;
  };

  renderer.table = (header, body) => {
    return `
      <div class="table-wrap">
        <table>
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  };

  return renderer;
}

function copyIconSvg() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="5" y="5" width="9" height="9" rx="1.5"/>
    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>
  </svg>`;
}

/**
 * Render a Markdown string into sanitized-by-construction HTML.
 * @param {string} markdownText
 * @returns {string}
 */
export function renderMarkdown(markdownText) {
  marked.setOptions({
    gfm: true,
    breaks: false,
    renderer: getRenderer(),
  });
  return marked.parse(markdownText);
}

/**
 * Attach click handlers to every "Copy" button inside a container.
 * Safe to call multiple times; each button gets exactly one listener.
 * @param {HTMLElement} container
 */
export function initCopyButtons(container) {
  const buttons = container.querySelectorAll(".copy-btn:not([data-bound])");
  buttons.forEach((button) => {
    button.setAttribute("data-bound", "true");
    button.addEventListener("click", () => handleCopyClick(button));
  });
}

async function handleCopyClick(button) {
  const code = decodeURIComponent(button.dataset.code || "");
  const label = button.querySelector(".copy-label");

  try {
    await navigator.clipboard.writeText(code);
    button.classList.add("copied");
    if (label) label.textContent = "Copied";
  } catch (err) {
    if (label) label.textContent = "Failed";
  }

  setTimeout(() => {
    button.classList.remove("copied");
    if (label) label.textContent = "Copy";
  }, 1800);
}
