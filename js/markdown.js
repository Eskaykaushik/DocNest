/**
 * markdown.js
 * Wraps marked.js + highlight.js (loaded from CDN as globals) to turn raw
 * Markdown into DocNest-styled HTML, and wires up copy-to-clipboard on
 * every rendered code block.
 */

import { slugify, escapeHtml } from "./utils.js";

let renderer = null;
let usedIds = null;

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
    const language = tokens[0] || "text";
    const isTabbed = tokens.includes("tabs");
    const langInfo = hljs.getLanguage(language);
    const validLanguage = langInfo ? language : "plaintext";
    const highlighted = hljs.highlight(code, { language: validLanguage }).value;
    const label = langInfo?.name || (validLanguage === "plaintext" ? "text" : validLanguage);

    return `
      <div class="code-block"${isTabbed ? ` data-tab="${escapeHtml(label)}"` : ""}>
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

/**
 * Render Mermaid diagrams inside a container. Mermaid is loaded from the CDN
 * as a global non-module script (see <head> of the reader pages). Each
 * ```mermaid fence becomes a `.mermaid-diagram` div holding the raw source;
 * this initializes Mermaid once with theme-aware tokens, renders every diagram
 * in the container, and re-renders on theme toggles so diagrams match the
 * active dark/light palette.
 * @param {HTMLElement} container
 */
export function initMermaid(container) {
  if (typeof window.mermaid !== "object") return;

  window.mermaid.initialize(mermaidConfig());
  window.mermaid.run({ nodes: container.querySelectorAll(".mermaid-diagram") });
  watchMermaidTheme();
}

function mermaidConfig() {
  return {
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: mermaidThemeVars(),
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    flowchart: { nodeSpacing: 42, rankSpacing: 42, padding: 12 },
    sequence: { useMaxWidth: true },
  };
}

function mermaidThemeVars() {
  const dark = document.documentElement.getAttribute("data-theme") !== "light";
  return dark
    ? {
        primaryColor: "#161b22",
        primaryTextColor: "#e6edf3",
        primaryBorderColor: "#30363d",
        lineColor: "#58a6ff",
        secondaryColor: "#1c2128",
        tertiaryColor: "#0d1117",
        clusterBkg: "#0d1117",
        clusterBorder: "#30363d",
        labelTextColor: "#e6edf3",
        edgeLabelBackground: "#161b22",
        nodeBorder: "#58a6ff",
        nodeTextColor: "#e6edf3",
        actorBkg: "#161b22",
        actorBorder: "#30363d",
        actorTextColor: "#e6edf3",
        activationBkgColor: "#1c2128",
        sequenceNumberColor: "#e6edf3",
        notesBkgColor: "#161b22",
        notesBorderColor: "#30363d",
        pie1: "#58a6ff",
        pie2: "#a371f7",
        pie3: "#d29922",
        pie4: "#3fb950",
        pie5: "#f778ba",
        pie6: "#db6d28",
        pie7: "#39c5cf",
        pie8: "#ff7b72",
        pie9: "#8b949e",
        pie10: "#e6edf3",
        pieStrokeWidth: "1.5px",
        pieTitleTextSize: "15px",
        pieSectionTextSize: "12px",
      }
    : {
        primaryColor: "#f6f8fa",
        primaryTextColor: "#1f2328",
        primaryBorderColor: "#d0d7de",
        lineColor: "#0969da",
        secondaryColor: "#f3f4f6",
        tertiaryColor: "#ffffff",
        clusterBkg: "#ffffff",
        clusterBorder: "#d0d7de",
        labelTextColor: "#1f2328",
        edgeLabelBackground: "#f6f8fa",
        nodeBorder: "#0969da",
        nodeTextColor: "#1f2328",
        actorBkg: "#f6f8fa",
        actorBorder: "#d0d7de",
        actorTextColor: "#1f2328",
        activationBkgColor: "#f3f4f6",
        sequenceNumberColor: "#1f2328",
        notesBkgColor: "#f6f8fa",
        notesBorderColor: "#d0d7de",
        pie1: "#0969da",
        pie2: "#8250df",
        pie3: "#9a6700",
        pie4: "#1a7f37",
        pie5: "#bf3989",
        pie6: "#bc4c00",
        pie7: "#1b7c83",
        pie8: "#cf222e",
        pie9: "#656d76",
        pie10: "#1f2328",
        pieStrokeWidth: "1.5px",
        pieTitleTextSize: "15px",
        pieSectionTextSize: "12px",
      };
}

function watchMermaidTheme() {
  const root = document.documentElement;
  if (root.dataset.mermaidWatched === "true") return;
  root.dataset.mermaidWatched = "true";

  const sources = new Map();
  document.querySelectorAll(".mermaid-diagram").forEach((node) => {
    sources.set(node, node.textContent);
  });

  const rerender = () => {
    if (typeof window.mermaid !== "object") return;
    window.mermaid.initialize(mermaidConfig());
    document.querySelectorAll(".mermaid-diagram").forEach((node) => {
      const source = sources.get(node) ?? node.dataset.mermaidSrc;
      if (source === undefined) return;
      node.replaceChildren(document.createTextNode(source));
    });
    window.mermaid.run({ nodes: document.querySelectorAll(".mermaid-diagram") });
  };

  new MutationObserver(rerender).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  document.querySelectorAll(".mermaid-diagram").forEach((node) => {
    node.dataset.mermaidSrc = node.textContent;
  });
}
