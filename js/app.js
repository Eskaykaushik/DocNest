/**
 * app.js
 * Homepage controller: loads the tutorial index, renders AI-focused learning
 * paths (grouped by category), and wires the navbar search so that typing
 * filters paths live and opens the command-palette dropdown.
 */

import {
  fetchJson,
  fetchText,
  calculateReadingTime,
  getQueryParam,
  escapeHtml,
} from "./utils.js";
import { categoryIcon } from "./sidebar.js";
import { createSearch } from "./search.js";

const state = {
  tutorials: [], // full index, enriched with readingTime
  query: "",
  collapsedPaths: new Set(),
};

const learningPaths = document.getElementById("learning-paths");

const search = createSearch({
  onQueryChange: (query) => {
    state.query = query.trim().toLowerCase();
    applyFilters();
  },
});

init();

async function init() {
  renderSkeletons(3);
  bindNavLinks();

  try {
    const index = await fetchJson("data/tutorials.json");
    state.tutorials = await enrichWithReadingTime(index);
    search.setIndex(state.tutorials);
    renderPaths(state.tutorials);
    renderHeroStats(index);
    scrollToPath(getQueryParam("category"));
  } catch (err) {
    renderError(err);
  }
}

/** Fill the hero with live numbers so it never goes stale. */
function renderHeroStats(index) {
  const statsEl = document.getElementById("hero-stats");
  if (!statsEl) return;
  const paths = new Set(index.map((t) => t.category)).size;
  statsEl.innerHTML = [
    `<span>${paths} learning paths</span>`,
    `<span>${index.length} tutorials</span>`,
    `<span>from Python to MLOps</span>`,
  ].join("");
}

/**
 * Reading time is estimated from each tutorial's actual word count,
 * so the homepage and the tutorial page always agree.
 */
async function enrichWithReadingTime(index) {
  return Promise.all(
    index.map(async (tutorial) => {
      try {
        const text = await fetchText(tutorial.file);
        return { ...tutorial, readingTime: calculateReadingTime(text) };
      } catch {
        return { ...tutorial, readingTime: null };
      }
    })
  );
}

function renderSkeletons(count) {
  learningPaths.innerHTML = Array.from({ length: count })
    .map(() => `<div class="skeleton-path" aria-hidden="true"></div>`)
    .join("");
}

/* --------------------------------------------------------------------- */
/* Navbar                                                                 */
/* --------------------------------------------------------------------- */

/** "Learning Paths" clears any active filter so the scroll shows everything. */
function bindNavLinks() {
  document.querySelectorAll('a[href="#learning-paths"]').forEach((link) => {
    link.addEventListener("click", () => {
      if (search.input.value) {
        search.input.value = "";
        state.query = "";
        applyFilters();
      }
    });
  });
}

/* --------------------------------------------------------------------- */
/* Learning paths                                                         */
/* --------------------------------------------------------------------- */

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

/** Scroll to (and briefly highlight) a learning path from ?category=. */
function scrollToPath(category) {
  if (!category) return;
  const path = learningPaths.querySelector(
    `.learning-path[data-category="${CSS.escape(category)}"]`
  );
  if (!path) return;
  setPathExpanded(path, true);
  path.scrollIntoView({ behavior: "smooth", block: "start" });
  path.classList.add("flash");
  setTimeout(() => path.classList.remove("flash"), 1600);
}

function renderPaths(tutorials) {
  const groups = groupByCategory(tutorials);

  learningPaths.innerHTML = groups.map((group, index) => renderPath(group, index)).join("");
  bindPathToggles();
}

function renderPath(group, index) {
  const isCollapsed = state.collapsedPaths.has(group.name);
  const step = String(index + 1).padStart(2, "0");

  return `
    <section class="learning-path" data-category="${escapeHtml(group.name)}">
      <button
        type="button"
        class="path-header"
        aria-expanded="${String(!isCollapsed)}"
        data-path="${escapeHtml(group.name)}"
      >
        <span class="path-step" aria-hidden="true">${step}</span>
        <span class="path-icon" aria-hidden="true">${categoryIcon(group.name)}</span>
        <span class="path-name">${escapeHtml(group.name)}</span>
        <span class="path-count">
          ${group.items.length} tutorial${group.items.length === 1 ? "" : "s"}
        </span>
        <span class="path-chevron" aria-hidden="true">${chevronSvg()}</span>
      </button>
      <div class="path-items-wrap">
        <ul class="path-items">
          ${group.items.map(renderItem).join("")}
        </ul>
      </div>
    </section>
  `;
}

function renderItem(tutorial) {
  return `
    <li class="path-item">
      <a
        href="tutorial.html?id=${encodeURIComponent(tutorial.id)}"
        data-searchable="${escapeHtml(
          `${tutorial.title} ${tutorial.description} ${tutorial.category} ${tutorial.difficulty}`
        ).toLowerCase()}"
      >
        <span class="path-item-title">${escapeHtml(tutorial.title)}</span>
        <span class="path-item-desc">${escapeHtml(tutorial.description)}</span>
        <span class="path-item-meta">
          ${tutorial.readingTime ? `<span>${tutorial.readingTime} min read</span>` : ""}
          <span>${escapeHtml(tutorial.difficulty)}</span>
        </span>
      </a>
    </li>
  `;
}

function bindPathToggles() {
  learningPaths.querySelectorAll(".path-header").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.closest(".learning-path");
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      setPathExpanded(path, !isExpanded);
      const name = button.dataset.path;
      if (isExpanded) state.collapsedPaths.add(name);
      else state.collapsedPaths.delete(name);
    });
  });
}

function setPathExpanded(path, expanded) {
  const header = path.querySelector(".path-header");
  header?.setAttribute("aria-expanded", String(expanded));
  path.classList.toggle("is-expanded", expanded);
  path.classList.toggle("is-collapsed", !expanded);
}

/* --------------------------------------------------------------------- */
/* Live filtering across paths                                            */
/* --------------------------------------------------------------------- */

function applyFilters() {
  const query = state.query;
  let matchCount = 0;

  learningPaths.querySelectorAll(".learning-path").forEach((section) => {
    let visible = 0;
    section.querySelectorAll(".path-item").forEach((item) => {
      const matches = !query || item.dataset.searchable.includes(query);
      item.hidden = !matches;
      if (matches) visible++;
    });
    section.hidden = visible === 0;

    if (query && visible > 0) {
      setPathExpanded(section, true);
    } else if (!query) {
      const name = section.querySelector(".path-header")?.dataset.path;
      setPathExpanded(section, !(name && state.collapsedPaths.has(name)));
    }

    matchCount += visible;
  });

  if (matchCount === 0 && state.tutorials.length > 0) {
    ensureEmptyState(query);
  } else {
    document.getElementById("empty-state")?.remove();
  }
}

function ensureEmptyState(query) {
  document.getElementById("empty-state")?.remove();
  learningPaths.insertAdjacentHTML(
    "beforeend",
    `<div class="empty-state" id="empty-state">
      <h3>No tutorials match that search</h3>
      <p>Try a different keyword, like "agent" or "python".</p>
    </div>`
  );
}

/* --------------------------------------------------------------------- */
/* Misc                                                                   */
/* --------------------------------------------------------------------- */

function renderError(err) {
  learningPaths.innerHTML = `<div class="empty-state">
    <h3>Couldn't load tutorials</h3>
    <p>${escapeHtml(err.message)}</p>
  </div>`;
  console.error(err);
}

function chevronSvg() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
