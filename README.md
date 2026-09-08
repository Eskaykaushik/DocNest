# DocNest

A lightweight, dependency-free documentation and tutorial engine. Write Markdown,
get a fast, searchable docs site — no build step, no framework, no backend.

> **Screenshots:** add `images/screenshot-home.png` (homepage) and
> `images/screenshot-tutorial.png` (tutorial page) and reference them here once
> the site is deployed.

## Features

- **Pure HTML, CSS, and vanilla JavaScript.** No React, no bundler, no `node_modules`.
- **Markdown-first content.** Every page is a `.md` file; layout and chrome are automatic.
- **Persistent sidebar tree** — tutorials grouped by category, with collapsible
  subtopics and the current page highlighted; collapses to an off-canvas drawer on mobile.
- **Scalable card-grid homepage** — a responsive tutorial-card grid with live category,
  difficulty, and tag filters, plus a curated "featured" spotlight band. Scales from a
  handful of tutorials to hundreds across many subjects (GATE, CS, general topics, …).
- **Search command palette** — press `/` or `Ctrl/⌘+K`, get grouped live results with
  full keyboard navigation; cards filter in real time as you type.
- **Category, difficulty, and tag filtering** generated automatically from your content
  (optional `tags` / `featured` fields in `tutorials.json`).
- **Auto-generated table of contents** from `##`/`###` headings, with active-section
  highlighting as you scroll.
- **Automatic reading-time estimates** from each tutorial's word count.
- **Syntax-highlighted code blocks** (via highlight.js) with a one-click copy button.
  Consecutive fences tagged `tabs` render as a single multi-language tabbed block.
- **Related tutorials** under each article, plus a "Was this helpful?" feedback widget.
- **Reading-progress bar** on every tutorial page.
- **Previous / next navigation** based on tutorial order in `tutorials.json`.
- **Dark + light themes** — developer-focused defaults inspired by GitHub Docs, Stripe
  Docs, and MDN, with a navbar toggle and OS-preference following.
- **Research-papers library** — a dedicated `papers.html` hub + `paper.html` reader for
  reading landmark AI papers as tutorials: paper header with authors/venue/year, arXiv
  and code links, one-click citation, TL;DR callouts, LaTeX math via KaTeX, related
  papers, and the same TOC/progress/prev-next chrome as tutorials.
- **Fully keyboard accessible**, with visible focus states and semantic HTML throughout.

## Folder structure

```
DocNest/
├── index.html            Homepage: hero, featured band, search, card grid
├── tutorial.html          Tutorial page: article, TOC, prev/next
├── papers.html            Papers hub: hero, topic/difficulty filters, local search
├── paper.html             Paper reader: paper header, KaTeX article, citation
│
├── css/
│   ├── style.css           Layout, navbar, cards, buttons, forms, responsive rules, theme tokens
│   ├── markdown.css        Typography and rendering rules for parsed Markdown
│   └── portal.css          Portal components: sidebar, palette, card grid, tabs, papers
│
├── js/
│   ├── app.js               Homepage controller: card grid, filters, featured, search palette
│   ├── tutorial.js          Tutorial page controller: render, TOC, related, feedback
│   ├── papers.js            Papers hub controller: stats, chips, local search, cards
│   ├── paper.js             Paper reader controller: header, KaTeX, related, citation
│   ├── sidebar.js           Shared sidebar tree + drawer (both pages)
│   ├── markdown.js          marked.js + highlight.js integration, copy buttons, code tabs, callouts, math
│   ├── theme.js             Dark/light theme manager + navbar toggle
│   └── utils.js             Shared helpers (reading time, slugify, fetch wrappers…)
│
├── data/
│   ├── tutorials.json      The content index — one entry per tutorial
│   └── papers.json         The papers index — one entry per paper
│
├── tutorials/
│   ├── welcome.md            Feature tour / Markdown reference
│   └── langchain.md          Longer technical example
│
├── papers/
│   └── attention-is-all-you-need.md   Example: a paper written as a tutorial
│
├── images/                 Images referenced from tutorials
└── libs/                   Reserved for local vendoring, if you choose not to use a CDN
```

## Getting started

DocNest is fully static — it just needs to be served, not built.

```bash
# from the DocNest/ folder, using any static file server:
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000` in a browser.

> Opening `index.html` directly via `file://` will not work, because the browser
> blocks `fetch()` requests to local files under that protocol. Any static server
> is enough.

Markdown parsing and syntax highlighting are loaded from a CDN (marked.js and
highlight.js) via `<script>` tags in `index.html` and `tutorial.html`; KaTeX for
paper math is loaded on `paper.html`. There is nothing to install locally.

## Adding a tutorial

Adding a new tutorial never requires touching any JavaScript or CSS.

1. **Write the content.** Create a new file in `tutorials/`, e.g. `tutorials/deploying.md`.
2. **Register it.** Add one entry to `data/tutorials.json`:

   ```json
   {
     "id": "deploying",
     "title": "Deploying a Static Site",
     "description": "Ship your site to any static host in under five minutes.",
     "category": "General",
     "subtopic": "Hosting",
     "difficulty": "Beginner",
     "updated": "2026-08-08",
     "file": "tutorials/deploying.md"
   }
   ```

   Optional fields:
   - `subtopic` — group a category into collapsible sub-sections in the sidebar
     (e.g. `Frameworks`, `Evaluation` under "AI & ML").
   - `tags` — an array of keywords shown as chips on cards and used in the
     tag filter, e.g. `["GATE", "Data Structures"]`. Great for cross-cutting
     subjects that aren't a single category.
   - `featured` — set `true` to surface the tutorial in the homepage spotlight
     band ("Popular right now"). If none are flagged, the "Getting Started"
     category is shown instead.
   - `updated` — ISO date (`YYYY-MM-DD`) shown as an "Updated …" chip.

3. **Done.** The homepage card grid, filters, featured band, sidebar tree,
   search index, table of contents, reading time, related tutorials, and
   previous/next links are all generated from that one entry.

The order of entries in `tutorials.json` determines the previous/next navigation
on each tutorial page.

## Adding a paper

The research-papers library (`papers.html`) works the same way as tutorials.

1. **Write the content.** Create a file in `papers/`, e.g. `papers/attention-is-all-you-need.md`.
   A paper tutorial usually follows: opening TL;DR callout, *Before you read*, the
   *problem*, *key idea*, *math* (LaTeX delimited by `$…$` / `$$…$$`, rendered via
   KaTeX), a *code walkthrough*, *why it works*, *key takeaways*, and a *cite this*
   block. Wrap a highlighted TL;DR in a `callout` code fence:
   ```` ```callout ```` … ```` ``` ````
2. **Register it.** Add one entry to `data/papers.json`:

   ```json
   {
     "id": "attention-is-all-you-need",
     "title": "Attention Is All You Need",
     "description": "The Transformer: pure self-attention instead of recurrence.",
     "authors": ["Ashish Vaswani", "Noam Shazeer", "…"],
     "year": 2017,
     "venue": "NeurIPS",
     "links": { "arxiv": "https://arxiv.org/abs/1706.03762", "code": "…" },
     "tags": ["Transformers", "LLMs"],
     "difficulty": "Intermediate",
     "featured": true,
     "updated": "2026-08-08",
     "file": "papers/attention-is-all-you-need.md"
   }
   ```

   Optional fields: `featured` (star on the card), `links.code` (repository/tutorial
   link; `links.arxiv` is always shown).
3. **Done.** Cards, topic/difficulty filter chips, local search, hero stats, related
   papers, and prev/next navigation are generated from that entry. Order in
   `papers.json` sets prev/next. Cross-link to matching tutorials with relative
   links like `../tutorials/rag.md`.

## Deployment

Because DocNest has no server-side logic, it can be deployed to any static host:

- **GitHub Pages** — push the `DocNest/` folder to a repository and enable Pages.
- **Netlify / Vercel (static export)** — point either at the folder; no build
  command is required.
- **Any object storage / CDN** — S3 + CloudFront, Cloudflare Pages, etc. Just upload
  the folder as-is.

There is no environment configuration, no API keys, and no database.

## Roadmap

DocNest's architecture — a Markdown renderer, a content index, and small,
single-responsibility modules — is designed so the following can be layered in
without a rewrite:

- [ ] Mermaid diagrams inside Markdown code fences
- [x] KaTeX for inline and block math (used by the papers library)
- [x] A light theme alongside the current dark theme
- [ ] Blog mode (dated posts, an archive view, pagination)
- [ ] RSS/Atom feed generation
- [x] Tagging, in addition to single-category classification
- [ ] Versioned documentation (multiple `tutorials.json` indexes)
- [ ] A small plugin hook system around the render pipeline
- [ ] PWA manifest + service worker for offline reading
- [ ] Multiple documentation collections in a single deployment

## License

MIT — use, modify, and redistribute freely.

