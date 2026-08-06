/**
 * tutorial.js
 * Tutorial page controller: resolves the ?id= from the URL, loads the
 * matching Markdown file, renders the article, builds the table of
 * contents, and wires up previous/next navigation.
 */

import { fetchJson, fetchText, getQueryParam, calculateReadingTime, escapeHtml } from "./utils.js";
import { renderMarkdown, initCopyButtons } from "./markdown.js";

const contentEl = document.getElementById("markdown-content");
const titleEl = document.getElementById("tutorial-title");
const breadcrumbEl = document.getElementById("tutorial-breadcrumb");
const metaRowEl = document.getElementById("tutorial-meta-row");
const tocEl = document.getElementById("toc");
const paginationEl = document.getElementById("tutorial-pagination");

init();

async function init() {
  const id = getQueryParam("id");

  if (!id) {
    renderMissing("No tutorial was specified.");
    return;
  }

  try {
    const index = await fetchJson("data/tutorials.json");
    const currentIndex = index.findIndex((t) => t.id === id);
    const tutorial = index[currentIndex];

    if (!tutorial) {
      renderMissing(`No tutorial found with id "${id}".`);
      return;
    }

    document.title = `${tutorial.title} · DocNest`;

    const markdownText = await fetchText(tutorial.file);
    renderHeader(tutorial, markdownText);
    renderArticle(markdownText);
    buildTableOfContents();
    renderPagination(index, currentIndex);
    initCopyButtons(contentEl);
    observeActiveSection();
  } catch (err) {
    renderMissing(err.message);
    console.error(err);
  }
}

function renderHeader(tutorial, markdownText) {
  breadcrumbEl.innerHTML = `Docs / <span class="accent">${escapeHtml(tutorial.category)}</span>`;
  titleEl.textContent = tutorial.title;

  const readingTime = calculateReadingTime(markdownText);

  metaRowEl.innerHTML = `
    <span class="meta-chip">${clockIconSvg()} ${readingTime} min read</span>
    <span class="meta-chip">${tutorial.difficulty}</span>
    <span class="meta-chip">${tutorial.category}</span>
  `;
}

function renderArticle(markdownText) {
  contentEl.innerHTML = renderMarkdown(markdownText);
}

function renderMissing(message) {
  titleEl.textContent = "Tutorial not found";
  breadcrumbEl.textContent = "Docs";
  metaRowEl.innerHTML = "";
  tocEl.innerHTML = "";
  contentEl.innerHTML = `
    <div class="empty-state">
      <h3>We couldn't load that tutorial</h3>
      <p>${escapeHtml(message)}</p>
      <p><a href="index.html" style="color: var(--color-accent);">← Back to all tutorials</a></p>
    </div>
  `;
}

/** Build the table of contents from the H2/H3 headings marked.js just rendered. */
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

/** Highlight the TOC entry for whichever heading is currently in view. */
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

function renderPagination(index, currentIndex) {
  const prev = index[currentIndex - 1];
  const next = index[currentIndex + 1];

  paginationEl.innerHTML = `
    ${
      prev
        ? `<a class="pagination-link prev" href="tutorial.html?id=${encodeURIComponent(prev.id)}">
            <span class="pagination-direction">← Previous</span>
            <span class="pagination-title">${escapeHtml(prev.title)}</span>
          </a>`
        : `<span class="pagination-link pagination-placeholder"></span>`
    }
    ${
      next
        ? `<a class="pagination-link next" href="tutorial.html?id=${encodeURIComponent(next.id)}">
            <span class="pagination-direction">Next →</span>
            <span class="pagination-title">${escapeHtml(next.title)}</span>
          </a>`
        : `<span class="pagination-link pagination-placeholder"></span>`
    }
  `;
}

function clockIconSvg() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;vertical-align:-2px;">
    <circle cx="8" cy="8" r="6.25"/>
    <path d="M8 4.5V8l2.5 1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
