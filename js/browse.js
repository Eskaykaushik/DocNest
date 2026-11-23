/**
 * browse.js
 * Catalogue controller: track + level filters, local search, and URL-driven
 * pagination so only one page of cards is ever rendered.
 */

import { fetchJson, escapeHtml, getQueryParam, debounce } from "./utils.js";
import { createSearch } from "./search.js";
import { isRead, syncBadges } from "./progress.js";

const PAGE_SIZE = 24;

const state = {
  tutorials: [],
  tracks: [],
  query: "",
  track: "all",
  level: "all",
  page: 1,
};

const filtersEl = document.getElementById("browse-filters");
const resultsEl = document.getElementById("browse-results");
const gridEl = document.getElementById("browse-grid");
const paginationEl = document.getElementById("browse-pagination");
const searchInput = document.getElementById("browse-search-input");

const search = createSearch();

init();

async function init() {
  try {
    const [tracks, tutorials] = await Promise.all([
      fetchJson("data/tracks.json"),
      fetchJson("data/tutorials.json"),
    ]);

    state.tracks = tracks;
    state.tutorials = tutorials;

    readUrlState();
    search.setIndex(tutorials);
    renderFilters();
    bindEvents();
    render();
    syncBadges({ allCategories: [...new Set(tutorials.map((t) => t.category))] });
  } catch (err) {
    renderError(err);
  }
}

/* --------------------------------------------------------------------- */
/* URL state                                                              */
/* --------------------------------------------------------------------- */

function readUrlState() {
  const trackParam = getQueryParam("track");
  const categoryParam = getQueryParam("category");
  const levelParam = getQueryParam("level");
  const queryParam = getQueryParam("q");
  const pageParam = parseInt(getQueryParam("page"), 10);

  const byId = state.tracks.find((track) => track.id === trackParam);
  const byName = state.tracks.find((track) => track.name === categoryParam);

  state.track = byId ? byId.id : byName ? byName.id : "all";
  state.level = ["Beginner", "Intermediate", "Advanced"].includes(levelParam)
    ? levelParam
    : "all";
  state.query = (queryParam || "").trim().toLowerCase();
  state.page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  if (searchInput && queryParam) searchInput.value = queryParam;
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.track !== "all") params.set("track", state.track);
  if (state.level !== "all") params.set("level", state.level);
  if (state.query) params.set("q", state.query);
  if (state.page > 1) params.set("page", String(state.page));

  const query = params.toString();
  history.replaceState(null, "", `browse.html${query ? `?${query}` : ""}`);
}

/* --------------------------------------------------------------------- */
/* Filters                                                                */
/* --------------------------------------------------------------------- */

function renderFilters() {
  if (!filtersEl) return;

  const trackChips = [{ value: "all", label: "All tracks" }].concat(
    state.tracks.map((track) => ({ value: track.id, label: track.name }))
  );
  const levelChips = [{ value: "all", label: "All levels" }].concat(
    ["Beginner", "Intermediate", "Advanced"].map((level) => ({
      value: level,
      label: level,
    }))
  );

  filtersEl.innerHTML = `
    ${chipGroup("Filter by track", trackChips, "track", state.track)}
    ${chipGroup("Filter by level", levelChips, "level", state.level)}
  `;
}

function chipGroup(label, items, key, activeValue) {
  const buttons = items
    .map(
      (item) => `
        <button
          type="button"
          class="filter-chip${item.value === activeValue ? " active" : ""}"
          data-filter="${key}"
          data-value="${escapeHtml(item.value)}"
        >${escapeHtml(item.label)}</button>
      `
    )
    .join("");

  return `
    <div class="chip-group" role="group" aria-label="${label}">
      ${buttons}
    </div>
  `;
}

function bindEvents() {
  filtersEl?.addEventListener("click", (event) => {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;

    const key = chip.dataset.filter;
    if (key !== "track" && key !== "level") return;

    state[key] = chip.dataset.value;
    state.page = 1;
    render();
  });

  searchInput?.addEventListener(
    "input",
    debounce(() => {
      state.query = searchInput.value.trim().toLowerCase();
      state.page = 1;
      render();
    }, 150)
  );
}

/* --------------------------------------------------------------------- */
/* Rendering                                                              */
/* --------------------------------------------------------------------- */

function render() {
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), totalPages);

  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  renderFiltersState();
  renderResults(filtered.length, start, pageItems.length);
  renderGrid(pageItems);
  renderPagination(totalPages);
  writeUrlState();
}

function getFiltered() {
  const track = state.tracks.find((item) => item.id === state.track);
  const trackName = track ? track.name : null;

  return state.tutorials.filter((tutorial) => {
    if (trackName && tutorial.category !== trackName) return false;
    if (state.level !== "all" && tutorial.difficulty !== state.level) return false;
    if (state.query && !matchesQuery(tutorial, state.query)) return false;
    return true;
  });
}

function matchesQuery(tutorial, query) {
  return [
    tutorial.title,
    tutorial.description,
    tutorial.category,
    tutorial.subtopic,
    tutorial.difficulty,
    ...(tutorial.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function renderFiltersState() {
  filtersEl?.querySelectorAll(".filter-chip").forEach((chip) => {
    const key = chip.dataset.filter;
    chip.classList.toggle("active", chip.dataset.value === state[key]);
  });
}

function renderResults(total, start, count) {
  if (!resultsEl) return;

  if (total === 0) {
    resultsEl.textContent = "0 tutorials";
    return;
  }

  const first = start + 1;
  const last = start + count;
  resultsEl.textContent =
    total <= PAGE_SIZE
      ? `${total} tutorial${total === 1 ? "" : "s"}`
      : `${first}–${last} of ${total} tutorials`;
}

function renderGrid(tutorials) {
  if (!gridEl) return;

  if (tutorials.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <h3>Nothing here yet</h3>
        <p>Try a different track, level, or keyword.</p>
        <button type="button" class="empty-reset" id="browse-reset">Clear filters</button>
      </div>
    `;
    document.getElementById("browse-reset")?.addEventListener("click", resetFilters);
    return;
  }

  gridEl.innerHTML = tutorials.map(renderCard).join("");
}

function renderCard(tutorial) {
  const meta = [tutorial.difficulty]
    .filter(Boolean)
    .map(
      (item, index) =>
        `${index ? '<span class="meta-dot" aria-hidden="true">·</span>' : ""}<span>${escapeHtml(item)}</span>`
    )
    .join("");

  return `
    <article class="tutorial-card">
      <a href="tutorial.html?id=${encodeURIComponent(tutorial.id)}">
        <span class="card-category">${escapeHtml(tutorial.category)}</span>
        <h3 class="card-title">${escapeHtml(tutorial.title)}${
          isRead(tutorial.id)
            ? '<span class="card-read" aria-label="Completed" title="Completed">✓</span>'
            : ""
        }</h3>
        <p class="card-desc">${escapeHtml(tutorial.description)}</p>
        <div class="card-meta">${meta}</div>
      </a>
    </article>
  `;
}

function renderPagination(totalPages) {
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  const pages = pageList(state.page, totalPages);

  paginationEl.innerHTML = `
    <button type="button" class="page-btn" data-page="${state.page - 1}" ${
      state.page === 1 ? "disabled" : ""
    } aria-label="Previous page">←</button>
    ${pages
      .map((page) =>
        page === "…"
          ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
          : `<button type="button" class="page-btn${
              page === state.page ? " active" : ""
            }" data-page="${page}" ${
              page === state.page ? 'aria-current="page"' : ""
            }>${page}</button>`
      )
      .join("")}
    <button type="button" class="page-btn" data-page="${state.page + 1}" ${
      state.page === totalPages ? "disabled" : ""
    } aria-label="Next page">→</button>
  `;

  paginationEl.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = parseInt(button.dataset.page, 10);
      if (!Number.isFinite(page) || page < 1 || page > totalPages) return;
      state.page = page;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function pageList(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("…");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("…");
  items.push(total);

  return items;
}

function resetFilters() {
  state.query = "";
  state.track = "all";
  state.level = "all";
  state.page = 1;
  if (searchInput) searchInput.value = "";
  render();
}

function renderError(err) {
  if (resultsEl) resultsEl.textContent = "Catalogue unavailable";
  if (gridEl) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <h3>Couldn't load the catalogue</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
  console.error(err);
}
