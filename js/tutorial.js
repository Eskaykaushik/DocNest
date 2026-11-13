/**
 * tutorial.js
 * Tutorial page wiring: supplies tutorial metadata, breadcrumbs and the
 * sidebar to the shared ContentPageController.
 */

import {
  calculateReadingTime,
  formatDate,
  escapeHtml,
} from "./utils.js";
import { ContentPageController, metaChip, clockIconSvg } from "./content-page.js";
import { initDeckButton } from "./deck.js";
import { buildSidebar, initSidebarDrawer } from "./sidebar.js";
import { createSearch } from "./search.js";

const deckButton = document.getElementById("deck-btn");

const elements = {
  content: document.getElementById("markdown-content"),
  title: document.getElementById("tutorial-title"),
  breadcrumb: document.getElementById("tutorial-breadcrumb"),
  metaRow: document.getElementById("tutorial-meta-row"),
  toc: document.getElementById("toc"),
  pagination: document.getElementById("tutorial-pagination"),
  related: document.getElementById("related-section"),
  feedback: document.getElementById("feedback-widget"),
  progressBar: document.getElementById("reading-progress"),
  sidebar: document.getElementById("sidebar"),
};

const search = createSearch();

const page = new ContentPageController({
  indexUrl: "data/tutorials.json",
  kind: "tutorial",
  elements,
  search,
  prepare: () => initSidebarDrawer(),
  sidebar: (index, id) => buildSidebar(elements.sidebar, index, id),
  title: (tutorial) => `${tutorial.title} · DocNest`,
  breadcrumb: (tutorial) => `
    <a href="index.html">Home</a>
    / <a href="browse.html?category=${encodeURIComponent(tutorial.category)}">${escapeHtml(tutorial.category)}</a>
    / <span class="accent">${escapeHtml(tutorial.title)}</span>
  `,
  metaChips: (tutorial, markdownText) => {
    const wordCount = markdownText.trim().split(/\s+/).filter(Boolean).length;
    return [
      metaChip(`${clockIconSvg()} ${calculateReadingTime(markdownText)} min read`),
      metaChip(escapeHtml(tutorial.difficulty)),
      metaChip(`${wordCount.toLocaleString()} words`),
      tutorial.subtopic ? metaChip(escapeHtml(tutorial.subtopic), "subtopic-chip") : "",
      tutorial.updated ? metaChip(`Updated ${formatDate(tutorial.updated)}`) : "",
    ];
  },
  headerExtras: (tutorial, markdownText) => {
    if (!deckButton || deckButton.dataset.bound === "true") return;
    deckButton.dataset.bound = "true";
    deckButton.hidden = false;

    const wordCount = markdownText.trim().split(/\s+/).filter(Boolean).length;
    initDeckButton({
      button: deckButton,
      entry: tutorial,
      articleEl: elements.content,
      url: new URL(`tutorial.html?id=${encodeURIComponent(tutorial.id)}`, window.location.href).href,
      readingTime: calculateReadingTime(markdownText),
      wordCount,
    });
  },
  related: (index, tutorial) =>
    index
      .filter((entry) => entry.category === tutorial.category && entry.id !== tutorial.id)
      .slice(0, 3)
      .map((entry) => ({
        href: `tutorial.html?id=${encodeURIComponent(entry.id)}`,
        title: entry.title,
        description: entry.description,
        meta: [
          entry.difficulty,
          ...(entry.updated ? [`Updated ${formatDate(entry.updated)}`] : []),
        ],
      })),
  relatedTitle: (tutorial) => `More in ${escapeHtml(tutorial.category)}`,
  paginationHref: (tutorial) => `tutorial.html?id=${encodeURIComponent(tutorial.id)}`,
  completionCtx: (index) => ({
    allCategories: [...new Set(index.map((tutorial) => tutorial.category))],
  }),
  missing: {
    title: "Tutorial not found",
    breadcrumb: "Docs",
    noun: "tutorial",
    backHref: "index.html",
    backLabel: "← Back to all tutorials",
    noId: "No tutorial was specified.",
    notFound: (id) => `No tutorial found with id "${id}".`,
  },
});

page.start();
