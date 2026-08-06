/**
 * app.js
 * Homepage controller: loads the tutorial index, renders cards,
 * and wires up live search + category filtering.
 */

import { fetchJson, fetchText, calculateReadingTime, debounce, escapeHtml } from "./utils.js";

const state = {
  tutorials: [], // full index, enriched with readingTime
  activeCategory: "All",
  query: "",
};

const grid = document.getElementById("tutorials-grid");
const searchInput = document.getElementById("search-input");
const searchHint = document.getElementById("search-empty-hint");
const categoriesRow = document.getElementById("categories-row");

init();

async function init() {
  renderSkeletons(6);
  bindSearch();
  bindKeyboardShortcut();

  try {
    const index = await fetchJson("data/tutorials.json");
    state.tutorials = await enrichWithReadingTime(index);
    renderCategories(state.tutorials);
    renderCards(state.tutorials);
  } catch (err) {
    renderError(err);
  }
}

/**
 * Reading time is estimated from each tutorial's actual word count,
 * so cards and the tutorial page always agree.
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
  grid.innerHTML = Array.from({ length: count })
    .map(() => `<div class="skeleton-card" aria-hidden="true"></div>`)
    .join("");
}

function renderCategories(tutorials) {
  const categories = ["All", ...new Set(tutorials.map((t) => t.category))];

  categoriesRow.innerHTML = categories
    .map(
      (category) => `
        <button
          type="button"
          class="category-pill"
          data-category="${escapeHtml(category)}"
          aria-pressed="${category === state.activeCategory}"
        >${escapeHtml(category)}</button>
      `
    )
    .join("");

  categoriesRow.querySelectorAll(".category-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      state.activeCategory = pill.dataset.category;
      categoriesRow
        .querySelectorAll(".category-pill")
        .forEach((p) => p.setAttribute("aria-pressed", String(p === pill)));
      applyFilters();
    });
  });
}

function bindSearch() {
  const onSearch = debounce(() => {
    state.query = searchInput.value.trim().toLowerCase();
    applyFilters();
  }, 120);

  searchInput.addEventListener("input", onSearch);
}

/** Press "/" anywhere on the page to jump into the search box, GitHub-docs style. */
function bindKeyboardShortcut() {
  document.addEventListener("keydown", (event) => {
    const isTypingElsewhere = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (event.key === "/" && !isTypingElsewhere) {
      event.preventDefault();
      searchInput.focus();
    }
  });
}

function applyFilters() {
  const filtered = state.tutorials.filter((tutorial) => {
    const matchesCategory =
      state.activeCategory === "All" || tutorial.category === state.activeCategory;
    const matchesQuery =
      !state.query ||
      tutorial.title.toLowerCase().includes(state.query) ||
      tutorial.description.toLowerCase().includes(state.query);
    return matchesCategory && matchesQuery;
  });

  renderCards(filtered);
  searchHint.textContent = state.query
    ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} for "${searchInput.value.trim()}"`
    : "";
}

function renderCards(tutorials) {
  if (tutorials.length === 0) {
    grid.innerHTML = "";
    grid.insertAdjacentHTML(
      "afterend",
      `<div class="empty-state" id="empty-state">
        <h3>No tutorials match that search</h3>
        <p>Try a different keyword or clear the category filter.</p>
      </div>`
    );
    return;
  }

  document.getElementById("empty-state")?.remove();

  grid.innerHTML = tutorials
    .map(
      (tutorial, index) => `
        <a
          class="tutorial-card"
          href="tutorial.html?id=${encodeURIComponent(tutorial.id)}"
          style="animation-delay: ${Math.min(index * 40, 240)}ms"
        >
          <div class="card-top-row">
            <span class="card-category">${escapeHtml(tutorial.category)}</span>
            <span class="card-difficulty" data-level="${escapeHtml(tutorial.difficulty)}">
              ${escapeHtml(tutorial.difficulty)}
            </span>
          </div>
          <h3 class="card-title">${escapeHtml(tutorial.title)}</h3>
          <p class="card-description">${escapeHtml(tutorial.description)}</p>
          <div class="card-meta">
            ${clockIconSvg()}
            <span>${tutorial.readingTime ? `${tutorial.readingTime} min read` : "—"}</span>
          </div>
        </a>
      `
    )
    .join("");
}

function renderError(err) {
  grid.innerHTML = `<div class="empty-state">
    <h3>Couldn't load tutorials</h3>
    <p>${escapeHtml(err.message)}</p>
  </div>`;
  console.error(err);
}

function clockIconSvg() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="8" cy="8" r="6.25"/>
    <path d="M8 4.5V8l2.5 1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
