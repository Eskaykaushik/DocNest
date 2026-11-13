/**
 * paper.js
 * Paper page wiring: supplies paper metadata, links, citation, math and
 * related-paper ranking to the shared ContentPageController.
 */

import { formatDate, escapeHtml } from "./utils.js";
import { ContentPageController, metaChip } from "./content-page.js";
import { initMath } from "./markdown.js";
import { createSearch, toPaperIndex } from "./search.js";

const elements = {
  content: document.getElementById("markdown-content"),
  title: document.getElementById("paper-title"),
  breadcrumb: document.getElementById("paper-breadcrumb"),
  authors: document.getElementById("paper-authors"),
  metaRow: document.getElementById("paper-meta-row"),
  links: document.getElementById("paper-links"),
  citeBtn: document.getElementById("paper-cite-btn"),
  toc: document.getElementById("toc"),
  pagination: document.getElementById("paper-pagination"),
  related: document.getElementById("related-section"),
  feedback: document.getElementById("feedback-widget"),
  progressBar: document.getElementById("reading-progress"),
};

const search = createSearch();

function renderLinks(paper) {
  const buttons = [];

  if (paper.links?.arxiv) {
    buttons.push(`
      <a class="btn btn-primary paper-link-btn" href="${escapeHtml(paper.links.arxiv)}" target="_blank" rel="noopener">
        arXiv
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" style="width:12px;height:12px;">
          <path d="M4 12l8-8M6 4h6v6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    `);
  }

  if (paper.links?.code) {
    buttons.push(`
      <a class="btn btn-ghost paper-link-btn" href="${escapeHtml(paper.links.code)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" style="width:12px;height:12px;">
          <path d="M4 6l-2.25 2L4 10M12 6l2.25 2L12 10M9.5 4.5l-3 7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Code
      </a>
    `);
  }

  elements.links.querySelector(".paper-link-buttons").innerHTML = buttons.join("");
}

function buildCitation(paper) {
  return `${paper.authors.join(", ")}. (${paper.year}). ${paper.title}. ${paper.venue}. ${paper.links?.arxiv ?? ""}`.trim();
}

function initCiteButton() {
  elements.citeBtn.addEventListener("click", () => {
    const paper = window.__docnestPaper;
    if (!paper) return;
    navigator.clipboard
      .writeText(buildCitation(paper))
      .then(() => {
        elements.citeBtn.classList.add("copied");
        elements.citeBtn.lastChild.textContent = " Copied!";
        setTimeout(() => {
          elements.citeBtn.classList.remove("copied");
          elements.citeBtn.lastChild.textContent = " Cite";
        }, 1800);
      })
      .catch(() => {});
  });
}

const page = new ContentPageController({
  indexUrl: "data/papers.json",
  kind: "paper",
  elements,
  search,
  searchIndex: toPaperIndex,
  prepare: () => initCiteButton(),
  onEntry: (paper) => {
    window.__docnestPaper = paper;
  },
  title: (paper) => `${paper.title} · DocNest`,
  breadcrumb: (paper) => `
    <a href="index.html">Home</a>
    / <a href="papers.html">Papers</a>
    / <span class="accent">${escapeHtml(paper.title)}</span>
  `,
  metaChips: (paper) => [
    metaChip(`${escapeHtml(paper.venue)} · ${paper.year}`),
    metaChip(escapeHtml(paper.difficulty)),
    ...(Array.isArray(paper.tags)
      ? paper.tags.map((tag) => metaChip(escapeHtml(tag), "subtopic-chip"))
      : []),
    paper.updated ? metaChip(`Updated ${formatDate(paper.updated)}`) : "",
    paper.featured ? metaChip("Featured", "subtopic-chip paper-featured-chip") : "",
  ],
  headerExtras: (paper) => {
    elements.authors.textContent = paper.authors.map((name) => escapeHtml(name)).join(", ");
    renderLinks(paper);
  },
  enhance: (contentEl) => initMath(contentEl),
  related: (index, paper) =>
    index
      .filter((entry) => entry.id !== paper.id)
      .map((entry) => ({
        entry,
        overlap: (entry.tags || []).filter((tag) => (paper.tags || []).includes(tag)).length,
      }))
      .filter((candidate) => candidate.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3)
      .map(({ entry }) => ({
        href: `paper.html?id=${encodeURIComponent(entry.id)}`,
        title: entry.title,
        description: entry.description,
        meta: [`${entry.venue} · ${entry.year}`, entry.difficulty],
      })),
  relatedTitle: () => "Related papers",
  paginationHref: (paper) => `paper.html?id=${encodeURIComponent(paper.id)}`,
  completionCtx: (index) => ({ allPaperIds: index.map((paper) => paper.id) }),
  missing: {
    title: "Paper not found",
    breadcrumb: "Papers",
    noun: "paper",
    backHref: "papers.html",
    backLabel: "← Back to the papers library",
    noId: "No paper was specified.",
    notFound: (id) => `No paper found with id "${id}".`,
    reset: () => {
      elements.authors.textContent = "";
      elements.links.querySelector(".paper-link-buttons").innerHTML = "";
    },
  },
});

page.start();
