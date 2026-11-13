/**
 * app.js
 * Homepage controller: compact masthead, tutorial tracks, paper topics, and
 * a continue row drawn from reading history.
 */

import { fetchJson, escapeHtml } from "./utils.js";
import { createSearch } from "./search.js";
import { getState, syncBadges } from "./progress.js";

const trackIndexEl = document.getElementById("track-index");
const paperTopicsEl = document.getElementById("paper-topics");
const continueModule = document.getElementById("continue-module");
const continueListEl = document.getElementById("continue-list");
const browseAllCount = document.getElementById("browse-all-count");

const state = {
  tutorials: [],
  tracks: [],
  papers: [],
};

const search = createSearch();

init();

async function init() {
  try {
    const [tracks, tutorials, papers] = await Promise.all([
      fetchJson("data/tracks.json"),
      fetchJson("data/tutorials.json"),
      fetchJson("data/papers.json"),
    ]);

    state.tracks = tracks;
    state.tutorials = tutorials;
    state.papers = papers;

    search.setIndex(tutorials);
    renderTracks(tracks, tutorials);
    renderPaperTopics(papers);
    renderContinue(tutorials, papers);
    renderBrowseAll(tutorials.length);
    syncBadges({ allCategories: [...new Set(tutorials.map((t) => t.category))] });
  } catch (err) {
    renderError(err);
  }
}

function renderTracks(tracks, tutorials) {
  if (!trackIndexEl) return;

  trackIndexEl.innerHTML = tracks
    .map((track) => {
      const count = tutorials.filter((t) => t.category === track.name).length;
      return moduleRow({
        href: `browse.html?track=${encodeURIComponent(track.id)}`,
        name: track.name,
        count,
      });
    })
    .join("");
}

function renderPaperTopics(papers) {
  if (!paperTopicsEl) return;

  const counts = new Map();
  for (const paper of papers) {
    for (const tag of paper.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  paperTopicsEl.innerHTML = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(
      ([tag, count]) => `
        <a class="topic-chip" href="papers.html?tag=${encodeURIComponent(tag)}">
          ${escapeHtml(tag)}<span>${count}</span>
        </a>
      `
    )
    .join("");
}

function renderContinue(tutorials, papers) {
  if (!continueModule || !continueListEl) return;

  const read = getState().read;
  const latest = Object.entries(read)
    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];

  if (!latest) return;

  const [id, entry] = latest;
  const isPaper = entry.kind === "paper";
  const item = isPaper
    ? papers.find((p) => p.id === id)
    : tutorials.find((t) => t.id === id);

  if (!item) return;

  continueListEl.innerHTML = moduleRow({
    href: isPaper
      ? `paper.html?id=${encodeURIComponent(id)}`
      : `tutorial.html?id=${encodeURIComponent(id)}`,
    name: item.title,
    count: entry.minutes ? `${entry.minutes} min` : "",
  });
  continueModule.hidden = false;
}

function moduleRow({ href, name, count = "" }) {
  return `
    <a class="module-row" href="${href}">
      <span class="module-name">${escapeHtml(name)}</span>
      <span class="module-leader" aria-hidden="true"></span>
      <span class="module-count">${escapeHtml(String(count))}</span>
      <span class="module-arrow" aria-hidden="true">→</span>
    </a>
  `;
}

function renderBrowseAll(count) {
  if (browseAllCount) browseAllCount.textContent = String(count);
}

function renderError(err) {
  if (trackIndexEl) {
    trackIndexEl.innerHTML = `
      <div class="empty-state">
        <h3>Couldn't load the field guide</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
  console.error(err);
}
