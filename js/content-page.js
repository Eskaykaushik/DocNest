/**
 * content-page.js
 * Shared reader pipeline for tutorials, papers, and future content types.
 * A page supplies its index, elements, metadata renderers and hooks; this
 * controller owns URL resolution, fetching, article rendering, the table of
 * contents, related items, pagination, feedback and completion tracking.
 */

import {
  fetchJson,
  fetchText,
  getQueryParam,
  calculateReadingTime,
  escapeHtml,
} from "./utils.js";
import { renderMarkdown, initCopyButtons, initCodeTabs } from "./markdown.js";
import { initDiagrams } from "./diagram.js";
import { initCodeFlows } from "./code-flow.js";
import { attachCompletion as trackCompletion, recordQuizPerfect } from "./progress.js";
import { initQuizzes } from "./quiz.js";

export function metaChip(content, className = "") {
  return `<span class="meta-chip${className ? ` ${className}` : ""}">${content}</span>`;
}

export function clockIconSvg() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;vertical-align:-2px;">
    <circle cx="8" cy="8" r="6.25"/>
    <path d="M8 4.5V8l2.5 1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export class ContentPageController {
  constructor(options) {
    this.options = options;
    this.elements = options.elements;
    this.index = [];
    this.entry = null;
    this.currentIndex = -1;
  }

  get contentEl() {
    return this.elements.content;
  }

  async start() {
    const id = getQueryParam(this.options.param || "id");

    this.initReadingProgress();
    this.options.prepare?.();

    if (!id) {
      this.renderMissing(this.options.missing.noId);
      return;
    }

    try {
      const index = await fetchJson(this.options.indexUrl);
      this.index = index;
      this.options.search?.setIndex(
        this.options.searchIndex ? this.options.searchIndex(index) : index
      );

      const currentIndex = index.findIndex((entry) => entry.id === id);
      const entry = index[currentIndex];

      if (!entry) {
        this.renderMissing(this.options.missing.notFound(id));
        return;
      }

      this.entry = entry;
      this.currentIndex = currentIndex;
      document.title = this.options.title(entry);
      this.options.sidebar?.(index, entry.id);
      this.options.onEntry?.(entry);

      const markdownText = await fetchText(entry.file);
      this.renderHeader(entry, markdownText);
      this.renderArticle(markdownText);
      this.renderTableOfContents();
      this.enhanceArticle(entry);
      this.renderRelated(index, entry);
      this.renderFeedback(entry.id);
      this.renderPagination(index, currentIndex);
      this.observeActiveSection();
      this.attachCompletion(entry, markdownText);
    } catch (err) {
      this.renderMissing(err.message);
      console.error(err);
    }
  }

  initReadingProgress() {
    const bar = this.elements.progressBar;
    if (!bar) return;

    const update = () => {
      const scrollable = document.documentElement;
      const max = scrollable.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.width = `${ratio * 100}%`;
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

  renderHeader(entry, markdownText) {
    const { breadcrumb, metaChips, headerExtras, feedback } = this.options;
    this.elements.breadcrumb.innerHTML = breadcrumb(entry);
    this.elements.title.textContent = entry.title;
    this.elements.metaRow.innerHTML = (metaChips?.(entry, markdownText) || []).join("");
    if (feedback) feedback.hidden = false;
    headerExtras?.(entry, markdownText, this);
  }

  renderArticle(markdownText) {
    this.contentEl.innerHTML = renderMarkdown(markdownText);
  }

  renderTableOfContents() {
    const headings = this.contentEl.querySelectorAll("h2, h3");

    if (headings.length === 0) {
      this.elements.toc.innerHTML = "";
      return;
    }

    const items = Array.from(headings)
      .map((heading) => {
        const level = heading.tagName === "H3" ? "level-3" : "level-2";
        return `<li class="${level}"><a href="#${heading.id}" data-target="${heading.id}">${heading.textContent}</a></li>`;
      })
      .join("");

    this.elements.toc.innerHTML = `
      <p class="toc-label">On this page</p>
      <ul class="toc-list">${items}</ul>
    `;
  }

  enhanceArticle(entry) {
    initDiagrams(this.contentEl);
    initCodeTabs(this.contentEl);
    initCopyButtons(this.contentEl);
    initCodeFlows(this.contentEl);
    initQuizzes(this.contentEl, { onPerfect: () => recordQuizPerfect(entry.id) });
    this.options.enhance?.(this.contentEl, entry);
  }

  observeActiveSection() {
    const tocEl = this.elements.toc;
    const links = tocEl.querySelectorAll(".toc-list a");
    if (links.length === 0) return;

    const headings = this.contentEl.querySelectorAll("h2, h3");

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

  renderRelated(index, entry) {
    const section = this.elements.related;
    const related = this.options.related?.(index, entry) || [];

    if (related.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    section.innerHTML = `
      <h2 class="related-title">${this.options.relatedTitle(entry)}</h2>
      <div class="related-grid">
        ${related
          .map(
            (item) => `
              <a class="related-card" href="${item.href}">
                <span class="related-card-title">${escapeHtml(item.title)}</span>
                <span class="related-card-desc">${escapeHtml(item.description)}</span>
                <span class="related-card-meta">
                  ${(item.meta || []).map((value) => `<span>${escapeHtml(value)}</span>`).join("")}
                </span>
              </a>
            `
          )
          .join("")}
      </div>
    `;
  }

  renderPagination(index, currentIndex) {
    const prev = index[currentIndex - 1];
    const next = index[currentIndex + 1];
    const href = this.options.paginationHref;

    const link = (entry, direction) => `
      <a class="pagination-link ${direction}" href="${href(entry)}">
        <span class="pagination-direction">${direction === "prev" ? "← Previous" : "Next →"}</span>
        <span class="pagination-title">${escapeHtml(entry.title)}</span>
      </a>
    `;

    this.elements.pagination.innerHTML = `
      ${prev ? link(prev, "prev") : `<span class="pagination-link pagination-placeholder"></span>`}
      ${next ? link(next, "next") : `<span class="pagination-link pagination-placeholder"></span>`}
    `;
  }

  renderFeedback(id) {
    const widget = this.options.feedback;
    if (!widget) return;

    const storageKey = `docnest.feedback.${id}`;
    widget.querySelectorAll(".feedback-btn").forEach((button) => {
      button.addEventListener("click", () => {
        widget.classList.add("voted");
        try {
          localStorage.setItem(storageKey, button.dataset.vote);
        } catch {
          /* storage unavailable — vote just won't persist */
        }
      });
    });

    try {
      if (localStorage.getItem(storageKey)) widget.classList.add("voted");
    } catch {
      /* ignore */
    }
  }

  attachCompletion(entry, markdownText) {
    trackCompletion({
      id: entry.id,
      kind: this.options.kind,
      category: entry.category,
      minutes: calculateReadingTime(markdownText),
      ctx: this.options.completionCtx?.(this.index, entry) || {},
    });
  }

  renderMissing(message) {
    const missing = this.options.missing;
    this.elements.title.textContent = missing.title;
    this.elements.breadcrumb.textContent = missing.breadcrumb;
    this.elements.metaRow.innerHTML = "";
    this.elements.toc.innerHTML = "";
    missing.reset?.(this);
    this.contentEl.innerHTML = `
      <div class="empty-state">
        <h3>We couldn't load that ${missing.noun}</h3>
        <p>${escapeHtml(message)}</p>
        <p><a href="${missing.backHref}" style="color: var(--color-accent);">${missing.backLabel}</a></p>
      </div>
    `;
  }
}
