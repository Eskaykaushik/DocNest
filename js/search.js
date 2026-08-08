/**
 * search.js
 * Shared command-palette search, used by the homepage and the tutorial page.
 * Renders a dropdown of matching tutorials, supports keyboard navigation,
 * and fires an onQueryChange hook so pages can do extra work (e.g. filter
 * learning paths live) when the query changes.
 */

import { debounce, escapeHtml } from "./utils.js";

export function createSearch({ onQueryChange = () => {} } = {}) {
  const input = document.getElementById("search-input");
  const wrap = document.getElementById("search-wrap");
  const dropdown = document.getElementById("search-dropdown");
  if (!input) return null;

  let index = [];

  function setIndex(tutorials) {
    index = tutorials || [];
  }

  function groupByCategory(tutorials) {
    const order = [];
    const byName = new Map();
    for (const tutorial of tutorials) {
      if (!byName.has(tutorial.category)) {
        byName.set(tutorial.category, []);
        order.push(tutorial.category);
      }
      byName.get(tutorial.category).push(tutorial);
    }
    return order.map((name) => ({ name, items: byName.get(name) }));
  }

  function matchesQuery(tutorial, query) {
    return (
      tutorial.title.toLowerCase().includes(query) ||
      tutorial.description.toLowerCase().includes(query) ||
      tutorial.category.toLowerCase().includes(query) ||
      tutorial.difficulty.toLowerCase().includes(query)
    );
  }

  function paletteRow(tutorial) {
    return `
      <a
        class="palette-row"
        role="option"
        href="tutorial.html?id=${encodeURIComponent(tutorial.id)}"
      >
        <span class="palette-row-title">${escapeHtml(tutorial.title)}</span>
        <span class="palette-row-desc">${escapeHtml(tutorial.description)}</span>
        <span class="palette-row-meta">
          <span>${escapeHtml(tutorial.category)}</span>
          <span>${escapeHtml(tutorial.difficulty)}</span>
          ${tutorial.readingTime ? `<span>${tutorial.readingTime} min</span>` : ""}
        </span>
      </a>
    `;
  }

  function renderPalette(query) {
    if (!query) {
      close();
      return;
    }

    const matches = index.filter((tutorial) => matchesQuery(tutorial, query));

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="palette-empty">No tutorials match "${escapeHtml(query)}"</div>`;
      open();
      return;
    }

    dropdown.innerHTML = groupByCategory(matches)
      .map(
        (group) => `
          <div class="palette-group">${escapeHtml(group.name)}</div>
          ${group.items.map(paletteRow).join("")}
        `
      )
      .join("");

    open();
  }

  function onKeydown(event) {
    const rows = () => Array.from(dropdown.querySelectorAll(".palette-row"));

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!wrap.classList.contains("is-open")) return;
      moveSelection(event.key === "ArrowDown" ? 1 : -1, rows());
    } else if (event.key === "Enter") {
      if (!wrap.classList.contains("is-open")) return;
      event.preventDefault();
      const selected = rows().find((r) => r.getAttribute("aria-selected") === "true");
      (selected || rows()[0])?.click();
    } else if (event.key === "Escape") {
      close();
    }
  }

  function moveSelection(delta, rows) {
    if (rows.length === 0) return;
    let current = rows.findIndex((r) => r.getAttribute("aria-selected") === "true");
    current = (current + delta + rows.length) % rows.length;
    rows.forEach((r, i) => r.setAttribute("aria-selected", String(i === current)));
    rows[current].scrollIntoView({ block: "nearest" });
  }

  function open() {
    wrap.classList.add("is-open");
  }

  function close() {
    wrap.classList.remove("is-open");
  }

  input.addEventListener(
    "input",
    debounce(() => {
      const query = input.value.trim();
      renderPalette(query);
      onQueryChange(query);
    }, 100)
  );
  input.addEventListener("keydown", onKeydown);
  input.addEventListener("blur", close);
  dropdown.addEventListener("mousedown", (event) => event.preventDefault());

  // "/" or Ctrl/Cmd+K anywhere on the page focuses the search box.
  document.addEventListener("keydown", (event) => {
    const isTypingElsewhere = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (isTypingElsewhere) return;

    if (event.key === "/") {
      event.preventDefault();
      input.focus();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });

  return { setIndex, input, open, close, renderPalette };
}
