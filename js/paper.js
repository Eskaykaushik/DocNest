/**
 * paper.js
 * Paper reader controller: resolves the ?id= from the URL, loads the paper
 * from data/papers.json, renders the paper header (authors, venue, year,
 * arXiv/code links, citation) plus the tutorialized article with KaTeX math,
 * TOC, related papers, prev/next navigation, and feedback.
 */

import {
  fetchJson,
  fetchText,
  getQueryParam,
  calculateReadingTime,
  formatDate,
  escapeHtml,
} from "./utils.js";
import { renderMarkdown, initCopyButtons, initCodeTabs, initMath, initMermaid } from "./markdown.js";
import { createSearch } from "./search.js";

const contentEl = document.getElementById("markdown-content");
const titleEl = document.getElementById("paper-title");
const breadcrumbEl = document.getElementById("paper-breadcrumb");
const authorsEl = document.getElementById("paper-authors");
const metaRowEl = document.getElementById("paper-meta-row");
const linksBlock = document.getElementById("paper-links");
const citeBtn = document.getElementById("paper-cite-btn");
const tocEl = document.getElementById("toc");
const paginationEl = document.getElementById("paper-pagination");
const relatedSection = document.getElementById("related-section");
const feedbackWidget = document.getElementById("feedback-widget");
const progressBar = document.getElementById("reading-progress");

const search = createSearch();

init();

async function init() {
  const id = getQueryParam("id");

  initReadingProgress();
  initCiteButton();

  if (!id) {
    renderMissing("No paper was specified.");
    return;
  }

  try {
    const index = await fetchJson("data/papers.json");
    const currentIndex = index.findIndex((p) => p.id === id);
    const paper = index[currentIndex];

    if (!paper) {
      renderMissing(`No paper found with id "${id}".`);
      return;
    }

    document.title = `${paper.title} · DocNest`;
    window.__docnestPaper = paper;

    search.setIndex([]);
    renderHeader(paper);
    renderLinks(paper);

    const markdownText = await fetchText(paper.file);
    renderArticle(markdownText);
    buildTableOfContents();
    initMath(contentEl);
    initMermaid(contentEl);
    initCodeTabs(contentEl);
    initCopyButtons(contentEl);
    renderRelated(index, paper);
    initFeedback(paper.id);
    renderPagination(index, currentIndex);
    observeActiveSection();
  } catch (err) {
    renderMissing(err.message);
    console.error(err);
  }
}

/* --------------------------------------------------------------------- */
/* Header                                                                 */
/* --------------------------------------------------------------------- */

function renderHeader(paper) {
  const authorNames = paper.authors
    .map((name) => escapeHtml(name))
    .join(", ");

  breadcrumbEl.innerHTML = `
    <a href="index.html">Home</a>
    / <a href="papers.html">Papers</a>
    / <span class="accent">${escapeHtml(paper.title)}</span>
  `;
  titleEl.textContent = paper.title;
  authorsEl.textContent = authorNames;

  metaRowEl.innerHTML = `
    <span class="meta-chip">${escapeHtml(paper.venue)} · ${paper.year}</span>
    <span class="meta-chip">${escapeHtml(paper.difficulty)}</span>
    ${Array.isArray(paper.tags) ? paper.tags.map((t) => `<span class="meta-chip subtopic-chip">${escapeHtml(t)}</span>`).join("") : ""}
    ${paper.updated ? `<span class="meta-chip">Updated ${formatDate(paper.updated)}</span>` : ""}
  `;

  if (paper.featured) {
    const badge = document.createElement("span");
    badge.className = "meta-chip subtopic-chip paper-featured-chip";
    badge.textContent = "Featured";
    metaRowEl.appendChild(badge);
  }

  feedbackWidget.hidden = false;
}

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

  const container = linksBlock.querySelector(".paper-link-buttons");
  container.innerHTML = buttons.join("");
}

function initCiteButton() {
  citeBtn.addEventListener("click", () => {
    const paper = window.__docnestPaper;
    if (!paper) return;
    const citation = buildCitation(paper);
    navigator.clipboard
      .writeText(citation)
      .then(() => {
        citeBtn.classList.add("copied");
        citeBtn.lastChild.textContent = " Copied!";
        setTimeout(() => {
          citeBtn.classList.remove("copied");
          citeBtn.lastChild.textContent = " Cite";
        }, 1800);
      })
      .catch(() => {});
  });
}

function buildCitation(paper) {
  return `${paper.authors.join(", ")}. (${paper.year}). ${paper.title}. ${paper.venue}. ${paper.links?.arxiv ?? ""}`.trim();
}

/* --------------------------------------------------------------------- */
/* Article + TOC                                                          */
/* --------------------------------------------------------------------- */

function renderArticle(markdownText) {
  contentEl.innerHTML = renderMarkdown(markdownText);
}

function buildTableOfContents() {
  const headings = contentEl.querySelectorAll("h2, h3");

  if (headings.length === 0) {
    tocEl.innerHTML = "";
    return;
  }

  const items = Array.from(headings)
    .map((heading) => {
      const level = heading.tagName === "H3" ? "level-3" : "level-2";
      return `<li class="${level}"><a href="#${heading.id}" data-target="${heading.id}">${heading.textContent}</a></li>`;
    })
    .join("");

  tocEl.innerHTML = `
    <p class="toc-label">On this page</p>
    <ul class="toc-list">${items}</ul>
  `;
}

function observeActiveSection() {
  const links = tocEl.querySelectorAll(".toc-list a");
  if (links.length === 0) return;

  const headings = contentEl.querySelectorAll("h2, h3");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove("active"));
        const activeLink = tocEl.querySelector(`a[data-target="${entry.target.id}"]`);
        activeLink?.classList.add("active");
      });
    },
    { rootMargin: "-15% 0px -75% 0px", threshold: 0 }
  );

  headings.forEach((heading) => observer.observe(heading));
}

/* --------------------------------------------------------------------- */
/* Related + feedback                                                     */
/* --------------------------------------------------------------------- */

function renderRelated(index, current) {
  const related = index
    .filter((p) => p.id !== current.id)
    .map((p) => ({ paper: p, overlap: (p.tags || []).filter((t) => (current.tags || []).includes(t)).length }))
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .map((entry) => entry.paper)
    .slice(0, 3);

  if (related.length === 0) {
    relatedSection.hidden = true;
    return;
  }

  relatedSection.hidden = false;
  relatedSection.innerHTML = `
    <h2 class="related-title">Related papers</h2>
    <div class="related-grid">
      ${related
        .map(
          (paper) => `
            <a class="related-card" href="paper.html?id=${encodeURIComponent(paper.id)}">
              <span class="related-card-title">${escapeHtml(paper.title)}</span>
              <span class="related-card-desc">${escapeHtml(paper.description)}</span>
              <span class="related-card-meta">
                <span>${escapeHtml(paper.venue)} · ${paper.year}</span>
                <span>${escapeHtml(paper.difficulty)}</span>
              </span>
            </a>
          `
        )
        .join("")}
    </div>
  `;
}

function initFeedback(paperId) {
  const storageKey = `docnest.feedback.${paperId}`;
  const buttons = feedbackWidget.querySelectorAll(".feedback-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      feedbackWidget.classList.add("voted");
      try {
        localStorage.setItem(storageKey, button.dataset.vote);
      } catch {
        /* storage unavailable — vote just won't persist */
      }
    });
  });

  try {
    if (localStorage.getItem(storageKey)) {
      feedbackWidget.classList.add("voted");
    }
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------------- */
/* Progress + pagination                                                  */
/* --------------------------------------------------------------------- */

function initReadingProgress() {
  const update = () => {
    const scrollable = document.documentElement;
    const max = scrollable.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    progressBar.style.width = `${ratio * 100}%`;
  };

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    },
    { passive: true }
  );
  window.addEventListener("resize", update, { passive: true });
  update();
}

function renderPagination(index, currentIndex) {
  const prev = index[currentIndex - 1];
  const next = index[currentIndex + 1];

  const renderLink = (paper, direction) => `
    <a class="pagination-link ${direction}" href="paper.html?id=${encodeURIComponent(paper.id)}">
      <span class="pagination-direction">${direction === "prev" ? "← Previous" : "Next →"}</span>
      <span class="pagination-title">${escapeHtml(paper.title)}</span>
    </a>
  `;

  paginationEl.innerHTML = `
    ${prev ? renderLink(prev, "prev") : `<span class="pagination-link pagination-placeholder"></span>`}
    ${next ? renderLink(next, "next") : `<span class="pagination-link pagination-placeholder"></span>`}
  `;
}

/* --------------------------------------------------------------------- */
/* Missing state                                                          */
/* --------------------------------------------------------------------- */

function renderMissing(message) {
  titleEl.textContent = "Paper not found";
  breadcrumbEl.textContent = "Papers";
  authorsEl.textContent = "";
  metaRowEl.innerHTML = "";
  tocEl.innerHTML = "";
  linksBlock.querySelector(".paper-link-buttons").innerHTML = "";
  contentEl.innerHTML = `
    <div class="empty-state">
      <h3>We couldn't load that paper</h3>
      <p>${escapeHtml(message)}</p>
      <p><a href="papers.html" style="color: var(--color-accent);">← Back to the papers library</a></p>
    </div>
  `;
}