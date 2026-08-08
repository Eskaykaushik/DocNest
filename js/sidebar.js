/**
 * sidebar.js
 * Shared GFG-style sidebar tree, used by both the homepage and the tutorial
 * page. Groups tutorials by category, optionally collapsing into subtopics,
 * and highlights the currently open tutorial. Also wires up the mobile
 * off-canvas drawer.
 */

import { escapeHtml } from "./utils.js";

const GROUP_KEY = "docnest.sidebar"; // expanded/collapsed state, per group name

/**
 * Build (or rebuild) the sidebar inside `container`.
 * @param {HTMLElement} container
 * @param {Array} index          the tutorials.json index
 * @param {string} [activeId]    the currently open tutorial id, if any
 */
export function buildSidebar(container, index, activeId = null) {
  const groups = groupByCategory(index);

  container.innerHTML = `
    <p class="sidebar-label">All tutorials</p>
    ${groups.map((group) => renderGroup(group, activeId)).join("")}
  `;

  bindCollapsibles(container);
}

/**
 * Group the index into ordered categories, each with an optional list of
 * subtopics. Subtopics and category order follow first appearance.
 * @param {Array} index
 * @returns {Array<{name: string, tutorials: Array, subtopics: Array<{name: string, tutorials: Array}>}>}
 */
function groupByCategory(index) {
  const order = [];
  const byName = new Map();

  for (const tutorial of index) {
    if (!byName.has(tutorial.category)) {
      byName.set(tutorial.category, { name: tutorial.category, tutorials: [], subtopics: new Map() });
      order.push(tutorial.category);
    }

    const group = byName.get(tutorial.category);
    if (tutorial.subtopic) {
      if (!group.subtopics.has(tutorial.subtopic)) {
        group.subtopics.set(tutorial.subtopic, []);
      }
      group.subtopics.get(tutorial.subtopic).push(tutorial);
    } else {
      group.tutorials.push(tutorial);
    }
  }

  return order.map((name) => {
    const group = byName.get(name);
    return {
      name: group.name,
      tutorials: group.tutorials,
      subtopics: Array.from(group.subtopics, ([subtopic, tutorials]) => ({ name: subtopic, tutorials })),
    };
  });
}

function renderGroup(group, activeId) {
  const subtopicItems = group.subtopics
    .map(
      (subtopic) => `
        <li class="sidebar-subgroup" aria-expanded="${isExpanded(subtopic.name)}">
          <button type="button" class="sidebar-subgroup-header" aria-expanded="${isExpanded(subtopic.name)}">
            ${chevronSvg()}
            ${escapeHtml(subtopic.name)}
          </button>
          <ul class="sidebar-subgroup-items">
            ${subtopic.tutorials.map((t) => renderLink(t, activeId)).join("")}
          </ul>
        </li>
      `
    )
    .join("");

  const directItems = group.tutorials.map((t) => renderLink(t, activeId)).join("");
  const count = group.tutorials.length + group.subtopics.reduce((n, s) => n + s.tutorials.length, 0);

  return `
    <div class="sidebar-group" aria-expanded="${isExpanded(group.name)}">
      <button type="button" class="sidebar-group-header" aria-expanded="${isExpanded(group.name)}">
        ${categoryIcon(group.name)}
        <span>${escapeHtml(group.name)}</span>
        <span class="sidebar-group-count">${count}</span>
      </button>
      <ul class="sidebar-items">
        ${directItems}
        ${subtopicItems}
      </ul>
    </div>
  `;
}

function renderLink(tutorial, activeId) {
  const isActive = tutorial.id === activeId;
  return `
    <li>
      <a
        class="sidebar-link${isActive ? " active" : ""}"
        href="tutorial.html?id=${encodeURIComponent(tutorial.id)}"
        ${isActive ? 'aria-current="page"' : ""}
      >
        <span>${escapeHtml(tutorial.title)}</span>
        ${tutorial.difficulty ? `<span class="sidebar-difficulty">${escapeHtml(tutorial.difficulty)}</span>` : ""}
      </a>
    </li>
  `;
}

/** Wire up the collapsible group/subgroup headers and the mobile drawer. */
function bindCollapsibles(container) {
  container.querySelectorAll(".sidebar-group-header, .sidebar-subgroup-header").forEach((button) => {
    button.addEventListener("click", () => {
      const holder = button.closest(".sidebar-group, .sidebar-subgroup");
      const expanded = holder.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      holder.setAttribute("aria-expanded", String(next));
      button.setAttribute("aria-expanded", String(next));
      const key = button.textContent.trim();
      if (key) {
        const prefs = readPrefs();
        if (next) delete prefs[key];
        else prefs[key] = false;
        writePrefs(prefs);
      }
    });
  });
}

/** Wire the hamburger button + backdrop for the mobile drawer. Call once. */
export function initSidebarDrawer(toggleSelector = ".sidebar-toggle") {
  const toggle = document.querySelector(toggleSelector);
  const backdrop = document.querySelector(".sidebar-backdrop");
  if (!toggle) return;

  const close = () => document.body.classList.remove("sidebar-open");
  const open = () => document.body.classList.add("sidebar-open");

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("sidebar-open");
    isOpen ? close() : open();
  });

  backdrop?.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

/* --------------------------------------------------------------------- */
/* Collapse-state persistence (per group / subtopic name)                 */
/* --------------------------------------------------------------------- */

function isExpanded(name) {
  return !(name && readPrefs()[name] === false);
}

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(GROUP_KEY) || "{}");
  } catch {
    return {};
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(GROUP_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — collapsing just won't persist */
  }
}

/* --------------------------------------------------------------------- */
/* Icons                                                                  */
/* --------------------------------------------------------------------- */

/**
 * A small inline-SVG icon per category, GFG-card style. Falls back to a
 * generic document icon for unknown categories.
 * @param {string} category
 * @returns {string} svg markup
 */
export function categoryIcon(category) {
  const icons = {
    "Getting Started": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c2.5-1 5.5-1 8 0 2.5-1 5.5-1 8 0v12c-2.5-1-5.5-1-8 0-2.5-1-5.5-1-8 0V6z"/><path d="M12 6v12"/></svg>`,
    Python: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l5 5-5 5"/><path d="M12 17h8"/></svg>`,
    "Machine Learning": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="17" r="2.2"/><circle cx="12" cy="9" r="2.2"/><circle cx="18" cy="14" r="2.2"/><path d="M7 17l5-8 6 5"/></svg>`,
    "Deep Learning": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="18" cy="17" r="2"/><path d="M7.8 6.3l2.6 4M7.8 17.7l2.6-4M13.6 10.3l2.6-4M13.6 13.7l2.6 4"/></svg>`,
    "LLMs & Language Models": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.3c-1.2 0-2.3-.2-3.4-.6L4 21l1.2-3.6A8.38 8.38 0 1 1 21 11.5z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/></svg>`,
    Agents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 9v6M12 9v6M15 9v6"/><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M5.5 5.5v.01M18.5 18.5v.01"/></svg>`,
    "RAG & Retrieval": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/><path d="M11 8v6"/></svg>`,
    MLOps: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 8v5l3.5 2"/></svg>`,
    Evaluation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8.5 12.5l2 2 4-4.5"/><path d="M8.5 16.5l2 2 4-4.5"/></svg>`,
    Programming: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6l-5 6 5 6"/><path d="M16 6l5 6-5 6"/><path d="M13.5 4l-3 16"/></svg>`,
    General: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 18l9 5 9-5"/></svg>`,
  };
  return icons[category] ?? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/><path d="M9 14h6M9 17h4"/></svg>`;
}

function chevronSvg() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
