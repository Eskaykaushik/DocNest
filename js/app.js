/**
 * app.js
 * Homepage controller: loads the tutorial index, renders the scalable
 * card-grid landing (with tag + difficulty filters), spotlights featured
 * tutorials, and wires the navbar search so typing filters cards live.
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
  category: "all",
  difficulty: "all",
  tags: new Set(),
};

const grid = document.getElementById("tutorial-grid");
const resultsEl = document.getElementById("grid-results");

const search = createSearch({
  onQueryChange: (query) => {
    state.query = query.trim().toLowerCase();
    applyFilters();
  },
});

init();

async function init() {
  renderSkeletons(8);
  bindNavLinks();

  try {
    const index = await fetchJson("data/tutorials.json");
    state.tutorials = await enrichWithReadingTime(index);
    search.setIndex(state.tutorials);
    renderFilters(index);
    renderGrid(state.tutorials);
    renderFeatured(index);
    renderHeroStats(index);
    scrollToCategory(getQueryParam("category"));
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
    `<span>${paths} topics</span>`,
    `<span>${index.length} tutorials</span>`,
    `<span>from Python to MLOps</span>`,
  ].join("");
}

/**
 * Featured tutorials are surfaced in the spotlight band. If none are
 * flagged yet, fall back to the "Getting Started" category.
 */
function renderFeatured(index) {
  const container = document.getElementById("featured");
  if (!container) return;

  const explicit = index.filter((t) => t.featured).slice(0, 3);
  const fallback = index.filter((t) => t.category === "Getting Started");
  const picks = (explicit.length ? explicit : fallback).slice(0, 3);
  if (picks.length === 0) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  let html = "";
  if (picks.length > 0) {
    html = `
      <div class="featured-picks">
        <h3 class="featured-picks-label">Popular right now</h3>
        <ul>
          ${picks
            .map(
              (tutorial) => `
                <li>
                  <a class="featured-link" href="tutorial.html?id=${encodeURIComponent(tutorial.id)}">
                    <span class="featured-link-icon" aria-hidden="true">${categoryIcon(tutorial.category)}</span>
                    <span class="featured-link-body">
                      <span class="featured-link-title">${escapeHtml(tutorial.title)}</span>
                      <span class="featured-link-meta">
                        <span>${escapeHtml(tutorial.category)}</span>
                        ${tutorial.readingTime ? `<span>${tutorial.readingTime} min</span>` : ""}
                      </span>
                    </span>
                  </a>
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
    `;
  }

  container.insertAdjacentHTML("beforeend", html);
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
  grid.innerHTML = Array.from({ length: count })
    .map(() => `<div class="skeleton-card" aria-hidden="true"></div>`)
    .join("");
}

/* --------------------------------------------------------------------- */
/* Navbar                                                                 */
/* --------------------------------------------------------------------- */

/** "Learning Paths" clears any active filter so the grid shows everything. */
function bindNavLinks() {
  document.querySelectorAll('a[href="#learning-paths"]').forEach((link) => {
    link.addEventListener("click", () => clearFilters());
  });
}

/* --------------------------------------------------------------------- */
/* Filter chips                                                           */
/* --------------------------------------------------------------------- */

function renderFilters(index) {
  const container = document.getElementById("path-filters");
  if (!container) return;

  const categories = [...new Set(index.map((t) => t.category))].sort();
  const difficulties = [...new Set(index.map((t) => t.difficulty))].sort();
  const tags = [...new Set(index.flatMap((t) => t.tags || []))].sort();

  let chips = chipGroup(
    "Filter by topic",
    [{ value: "all", label: "All topics" }].concat(
      categories.map((name) => ({ value: name, label: name }))
    ),
    "category",
    state.category
  );

  if (tags.length > 0) {
    chips += chipGroup(
      "Filter by tag",
      tags.map((name) => ({ value: name, label: name })),
      "tag",
      ""
    );
  }

  chips += chipGroup(
    "Filter by level",
    [{ value: "all", label: "All levels" }].concat(
      difficulties.map((name) => ({ value: name, label: name }))
    ),
    "difficulty",
    state.difficulty
  );

  container.innerHTML = chips;
  container.hidden = false;

  container.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (chip.dataset.tag) {
        const tag = chip.dataset.tag;
        if (state.tags.has(tag)) state.tags.delete(tag);
        else state.tags.add(tag);
      } else if (chip.dataset.category) {
        state.category = chip.dataset.category;
      } else {
        state.difficulty = chip.dataset.difficulty;
      }
      updateChipStates();
      applyFilters();
    });
  });
}

function chipGroup(label, items, key, activeValue) {
  const buttons = items
    .map((item) => {
      const isActive =
        key === "tag"
          ? state.tags.has(item.value)
          : item.value === activeValue;
      const binding =
        key === "tag" ? `data-tag="${escapeHtml(item.value)}"` : `data-${key}="${escapeHtml(item.value)}"`;
      return `
        <button
          type="button"
          class="filter-chip${isActive ? " active" : ""}"
          ${binding}
        >${escapeHtml(item.label)}</button>
      `;
    })
    .join("");
  return `
    <div class="chip-group" role="group" aria-label="${label}">
      ${buttons}
    </div>
  `;
}

function updateChipStates() {
  document.querySelectorAll("#path-filters .filter-chip").forEach((chip) => {
    if (chip.dataset.tag) {
      chip.classList.toggle("active", state.tags.has(chip.dataset.tag));
    } else if (chip.dataset.category) {
      chip.classList.toggle("active", chip.dataset.category === state.category);
    } else {
      chip.classList.toggle("active", chip.dataset.difficulty === state.difficulty);
    }
  });
}

function clearFilters() {
  state.query = "";
  state.category = "all";
  state.difficulty = "all";
  state.tags.clear();
  if (search.input) search.input.value = "";
  updateChipStates();
  applyFilters();
}

/** Scroll offset for cross-page deep links (?category=). */
function scrollToCategory(category) {
  if (!category) return;
  const target = document.getElementById("tutorial-grid");
  const anchor = document.querySelector(`#path-filters [data-category="${CSS.escape(category)}"]`);
  if (anchor) {
    anchor.classList.add("active");
    state.category = category;
    updateChipStates();
    applyFilters();
  }
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* --------------------------------------------------------------------- */
/* Card grid                                                              */
/* --------------------------------------------------------------------- */

function renderGrid(tutorials) {
  grid.innerHTML = tutorials.map(renderCard).join("");
}

function renderCard(tutorial) {
  return `
    <article
      class="tutorial-card"
      data-category="${escapeHtml(tutorial.category)}"
      data-difficulty="${escapeHtml(tutorial.difficulty)}"
      data-tags="${escapeHtml((tutorial.tags || []).join(" "))}"
      data-searchable="${escapeHtml(
        `${tutorial.title} ${tutorial.description} ${tutorial.category} ${tutorial.difficulty} ${(tutorial.tags || []).join(" ")}`
      ).toLowerCase()}"
    >
      <a href="tutorial.html?id=${encodeURIComponent(tutorial.id)}">
        <div class="card-top">
          <span class="card-icon" aria-hidden="true">${categoryIcon(tutorial.category)}</span>
          <span class="card-category">${escapeHtml(tutorial.category)}</span>
        </div>
        <h3 class="card-title">${escapeHtml(tutorial.title)}</h3>
        <p class="card-desc">${escapeHtml(tutorial.description)}</p>
        <div class="card-meta">
          <span class="card-difficulty badge-${escapeHtml(
            tutorial.difficulty.toLowerCase()
          )}">${escapeHtml(tutorial.difficulty)}</span>
          ${tutorial.readingTime ? `<span class="card-minread">${tutorial.readingTime} min</span>` : ""}
        </div>
        ${tutorial.tags && tutorial.tags.length ? `<div class="card-tags">${tutorial.tags
          .map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`)
          .join("")}</div>` : ""}
      </a>
    </article>
  `;
}

/* --------------------------------------------------------------------- */
/* Live filtering across cards                                            */
/* --------------------------------------------------------------------- */

function applyFilters() {
  const query = state.query;
  const category = state.category;
  const difficulty = state.difficulty;
  const tags = state.tags;
  const hasFilters =
    query !== "" || category !== "all" || difficulty !== "all" || tags.size > 0;
  let matchCount = 0;

  grid.querySelectorAll(".tutorial-card").forEach((card) => {
    const matchesQuery = !query || card.dataset.searchable.includes(query);
    const matchesCategory = category === "all" || card.dataset.category === category;
    const matchesDifficulty =
      difficulty === "all" || card.dataset.difficulty === difficulty;
    const matchesTags =
      tags.size === 0 || Array.from(tags).every((tag) => card.dataset.tags.split(" ").includes(tag));
    const matches = matchesQuery && matchesCategory && matchesDifficulty && matchesTags;
    card.hidden = !matches;
    if (matches) matchCount++;
  });

  resultsEl.textContent = hasFilters || matchCount !== state.tutorials.length
    ? `${matchCount} tutorial${matchCount === 1 ? "" : "s"}`
    : "";

  if (matchCount === 0 && state.tutorials.length > 0) {
    ensureEmptyState();
  } else {
    document.getElementById("empty-state")?.remove();
  }
}

function ensureEmptyState() {
  document.getElementById("empty-state")?.remove();
  grid.insertAdjacentHTML(
    "beforeend",
    `<div class="empty-state" id="empty-state">
      <h3>No tutorials match your filters</h3>
      <p>Try a different topic, level, or keyword.</p>
      <button type="button" class="empty-reset" id="empty-reset">Clear filters</button>
    </div>`
  );
  document.getElementById("empty-reset")?.addEventListener("click", clearFilters);
}

/* --------------------------------------------------------------------- */
/* Misc                                                                   */
/* --------------------------------------------------------------------- */

function renderError(err) {
  grid.innerHTML = `<div class="empty-state">
    <h3>Couldn't load tutorials</h3>
    <p>${escapeHtml(err.message)}</p>
  </div>`;
  console.error(err);
}