/**
 * markdown.js
 * Wraps marked.js + highlight.js (loaded from CDN as globals) to turn raw
 * Markdown into DocNest-styled HTML, and wires up copy-to-clipboard on
 * every rendered code block.
 */

import { slugify, escapeHtml } from "./utils.js";
import { flowFromCode } from "./code-flow.js";

let renderer = null;
let usedIds = null;
let flowSeq = 0;

const CONTENT_LINK = /^(?:\.{0,2}\/)*(tutorials|papers)\/([^/]+?)\.md(#.*)?$/;

function rewriteContentLink(href) {
  const match = href.match(CONTENT_LINK);
  if (!match) return href;
  const [, collection, id, hash = ""] = match;
  const page = collection === "papers" ? "paper.html" : "tutorial.html";
  return `${page}?id=${encodeURIComponent(id)}${hash}`;
}

/**
 * Build (once) a marked.js renderer customized for DocNest's markup:
 * - code blocks get a header with a language label + copy button
 * - tables are wrapped in a scrollable container
 * - headings get stable, slugified ids for the table of contents
 */
function getRenderer() {
  if (renderer) return renderer;

  renderer = new marked.Renderer();
  usedIds = new Set();

  renderer.link = (href, title, text) => {
    const target = rewriteContentLink(href || "");
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<a href="${escapeHtml(target)}"${titleAttr}>${text}</a>`;
  };

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
    const tokens = (infoString || "").trim().split(/\s+/);
    if (tokens[0] === "callout") {
      const variant = tokens[1] || "tl-dr";
      return `<div class="callout callout-${escapeHtml(variant)}">
        ${marked.parse(code.trim())}
      </div>\n`;
    }
    if (tokens[0] === "mermaid") {
      return `<div class="mermaid-diagram">${escapeHtml(code)}</div>\n`;
    }
    if (tokens[0] === "quiz") {
      return `<div class="quiz" data-quiz="${encodeURIComponent(code.trim())}"></div>\n`;
    }
    const language = tokens[0] || "text";
    const isTabbed = tokens.includes("tabs");
    const langInfo = hljs.getLanguage(language);
    const validLanguage = langInfo ? language : "plaintext";
    const highlighted = hljs.highlight(code, { language: validLanguage }).value;
    const label = langInfo?.name || (validLanguage === "plaintext" ? "text" : validLanguage);
    const flow = flowFromCode(code, language);
    let flowButton = "";
    let flowDrawer = "";

    if (flow) {
      flowSeq += 1;
      const flowId = `code-flow-${flowSeq}`;
      flowButton = `
          <button type="button" class="flow-btn" data-flow-lang="${escapeHtml(language)}"
            aria-pressed="false" aria-controls="${flowId}" title="Show the execution flow">
            ${flowIconSvg()}
            <span class="flow-label">Flow</span>
            <svg class="flow-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 6.5 8 10l4-3.5"/>
            </svg>
          </button>`;
      flowDrawer = `
        <div class="code-flow" id="${flowId}" aria-hidden="true" inert>
          <div class="code-flow-inner">
            <div class="code-flow-meta">
              <span class="code-flow-kicker">Execution flow</span>
              <span class="code-flow-count">${flow.steps} steps</span>
            </div>
            <div class="code-flow-diagram mermaid-diagram" data-diagram-fit="natural"></div>
          </div>
        </div>`;
    }

    return `
      <div class="code-block${flow ? " has-flow" : ""}"${isTabbed ? ` data-tab="${escapeHtml(label)}"` : ""}>
        <div class="code-block-header">
          <span class="code-lang">${escapeHtml(label)}</span>
          <div class="code-block-actions">
            ${flowButton}
            <button type="button" class="copy-btn" data-code="${encodeURIComponent(code)}">
              ${copyIconSvg()}
              <span class="copy-label">Copy</span>
            </button>
          </div>
        </div>
        <div class="code-stage">
          <div class="code-face"><pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre></div>
          ${flowDrawer}
        </div>
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

function flowIconSvg() {
  return `<svg class="flow-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="4" cy="3.5" r="1.6"/>
    <circle cx="12" cy="3.5" r="1.6"/>
    <circle cx="8" cy="12.5" r="1.6"/>
    <path d="M5.6 3.5h4.8M4 5.1v2.1a2.4 2.4 0 0 0 2.4 2.4h1.2M12 5.1v2.1a2.4 2.4 0 0 1-2.4 2.4H8.4"/>
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
  usedIds = new Set();
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

/**
 * Merge consecutive code fences tagged with the `tabs` keyword into a single
 * tabbed container. Each fence becomes a panel; a language tab bar is built
 * from each block's language label. Safe to call multiple times; already
 * grouped blocks are skipped via a marker attribute.
 *
 * Markdown authoring:
 *   ```python tabs
 *   print("hello")
 *   ```
 *   ```javascript tabs
 *   console.log("hello");
 *   ```
 *
 * @param {HTMLElement} container
 */
export function initCodeTabs(container) {
  const blocks = Array.from(container.querySelectorAll(".code-block[data-tab]:not([data-tabbed])"));
  if (blocks.length === 0) return;

  const groups = groupConsecutive(blocks);

  groups.forEach((run) => {
    if (run.length < 2) {
      // A lone `tabs` fence — render it as a normal code block.
      delete run[0].dataset.tab;
      return;
    }

    const tabs = document.createElement("div");
    tabs.className = "code-tabs";

    const bar = document.createElement("div");
    bar.className = "code-tabs-bar";
    const label = document.createElement("span");
    label.className = "code-tabs-label";
    label.textContent = "Language";
    bar.appendChild(label);

    run.forEach((block, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-tab-btn";
      button.textContent = block.dataset.tab;
      if (index === 0) button.classList.add("active");
      button.addEventListener("click", () => activateTab(tabs, index));
      bar.appendChild(button);

      block.setAttribute("data-tabbed", "true");
      delete block.dataset.tab;
      block.hidden = index !== 0;
    });

    run[0].parentNode.insertBefore(tabs, run[0]);
    tabs.appendChild(bar);
    run.forEach((block) => tabs.appendChild(block));
  });
}

/** Split adjacent sibling nodes into maximal consecutive runs. */
function groupConsecutive(nodes) {
  const groups = [];
  let run = [];
  let previous = null;

  for (const node of nodes) {
    if (previous && node.previousElementSibling !== previous) {
      groups.push(run);
      run = [];
    }
    run.push(node);
    previous = node;
  }
  if (run.length) groups.push(run);
  return groups;
}

function activateTab(tabs, index) {
  tabs.querySelectorAll(".code-tab-btn").forEach((button, i) => {
    button.classList.toggle("active", i === index);
  });
  tabs.querySelectorAll(".code-block").forEach((block, i) => {
    block.hidden = i !== index;
  });
}

/**
 * Render LaTeX math inside a container using KaTeX's auto-renderer, which is
 * loaded on-demand from the CDN (see <head> of paper.html). Scoped to a
 * single container so chat or other widgets are unaffected.
 * @param {HTMLElement} container
 */
export function initMath(container) {
  if (typeof window.renderMathInElement !== "function") return;

  window.renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\(", right: "\\)", display: false },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  });
}
