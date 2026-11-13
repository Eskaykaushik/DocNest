/**
 * papers.js
 * Papers library hub controller: loads data/papers.json, renders hero stats,
 * topic filter chips, a local "search papers" box that filters by
 * title/author, and a responsive paper-card grid with skeleton + empty states.
 */

import { fetchJson, getQueryParam, debounce, escapeHtml } from "./utils.js";
import { createSearch, toPaperIndex } from "./search.js";
import { isRead, syncBadges } from "./progress.js";

const gridEl = document.getElementById("tutorial-grid");
const resultsEl = document.getElementById("grid-results");
const filtersEl = document.getElementById("path-filters");
const searchInput = document.getElementById("papers-search-input");
const heroStatsEl = document.getElementById("hero-stats");

let papers = [];
let activeTags = new Set();
let query = "";

const search = createSearch();
search.setIndex([]);

init();

async function init() {
  const tagParam = getQueryParam("tag");
  if (tagParam) activeTags = new Set([tagParam]);

  showSkeletons(6);

  try {
    papers = await fetchJson("data/papers.json");
    search.setIndex(toPaperIndex(papers));
    renderHeroStats(papers);
    renderFilters(papers);
    applyFilters();
    syncBadges({ allPaperIds: papers.map((p) => p.id) });
  } catch (err) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <h3>We couldn't load the papers library</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
    console.error(err);
  }
}

searchInput.addEventListener(
  "input",
  debounce(() => {
    query = searchInput.value.trim().toLowerCase();
    applyFilters();
  }, 120)
);

/* --------------------------------------------------------------------- */
/* Rendering                                                              */
/* --------------------------------------------------------------------- */

function showSkeletons(count) {
  gridEl.innerHTML = Array.from({ length: count }, () => '<div class="skeleton-card"></div>').join("");
}

function renderHeroStats(list) {
  const venues = new Set(list.map((p) => p.venue)).size;
  heroStatsEl.innerHTML = `
    <span class="meta-chip">${list.length} papers</span>
    <span class="meta-chip">${venues} venues</span>
    <span class="meta-chip">${new Set(list.flatMap((p) => p.tags || [])).size} topics</span>
  `;
}

function renderFilters(list) {
  const tags = [...new Set(list.flatMap((p) => p.tags || []))].sort();

  filtersEl.innerHTML = `
    <span class="chip-group" role="group" aria-label="Filter by topic">
      <button type="button" class="filter-chip chip-tag active" data-tag="">All topics</button>
      ${tags.map((tag) => `<button type="button" class="filter-chip chip-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}
    </span>
  `;

  filtersEl.hidden = false;

  filtersEl.querySelectorAll(".chip-tag").forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = chip.dataset.tag;
      value ? activeTags.add(value) : activeTags.clear();
      if (value) activeTags = new Set([value]);
      syncChips();
      applyFilters();
    });
  });

  syncChips();
}

function syncChips() {
  filtersEl.querySelectorAll(".chip-tag").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.tag
      ? activeTags.has(chip.dataset.tag)
      : activeTags.size === 0);
  });
}

function applyFilters() {
  const filtered = papers.filter((paper) => {
    if (activeTags.size && !(paper.tags || []).some((tag) => activeTags.has(tag))) return false;
    if (query) {
      const haystack = `${paper.title} ${paper.authors.join(" ")} ${paper.venue}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  resultsEl.textContent = `${filtered.length} of ${papers.length} papers`;

  if (filtered.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <h3>No papers match your filters</h3>
        <p>Try clearing a filter or searching a different author.</p>
        <button type="button" class="btn btn-ghost" id="clear-filters">Clear filters</button>
      </div>
    `;
    gridEl.querySelector("#clear-filters")?.addEventListener("click", () => {
      activeTags.clear();
      query = "";
      searchInput.value = "";
      syncChips();
      applyFilters();
    });
    return;
  }

  gridEl.innerHTML = filtered.map(renderCard).join("");
}

function renderCard(paper) {
  const tagBadge = paper.tags?.[0] ? escapeHtml(paper.tags[0]) : "Research";

  return `
    <article class="tutorial-card paper-card">
      <a href="paper.html?id=${encodeURIComponent(paper.id)}">
        <div class="card-top">
          <span class="card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3L17.5 4 15 3 12.5 4 10 3 7.5 4 5 3v14H4a2.5 2.5 0 0 0 0 5h15.5v-2.5H6.5a2.5 2.5 0 0 1 0-5"/>
              <path d="M5 12h13M9 8.5h5"/><path d="M9 11.5h5"/><path d="M9 14.5h3.5"/>
            </svg>
          </span>
          <span class="card-category">${tagBadge}</span>
          <span class="card-year">${paper.year}</span>
        </div>
        <h3 class="card-title">${escapeHtml(paper.title)}${
          isRead(paper.id)
            ? '<span class="card-read" aria-label="Completed" title="Completed">✓</span>'
            : ""
        }</h3>
      </a>
    </article>
  `;
}