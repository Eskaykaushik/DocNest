# DocNest

A lightweight, dependency-free documentation and tutorial engine. Write Markdown,
get a fast, searchable docs site — no build step, no framework, no backend.

> **Screenshots:** add `images/screenshot-home.png` (homepage) and
> `images/screenshot-tutorial.png` (tutorial page) and reference them here once
> the site is deployed.

## Features

- **Pure HTML, CSS, and vanilla JavaScript.** No React, no bundler, no `node_modules`.
- **Markdown-first content.** Every page is a `.md` file; layout and chrome are automatic.
- **Instant client-side search** across tutorial titles and descriptions.
- **Category filtering** generated automatically from your content.
- **Auto-generated table of contents** from `##`/`###` headings, with active-section
  highlighting as you scroll.
- **Automatic reading-time estimates** from each tutorial's word count.
- **Syntax-highlighted code blocks** (via highlight.js) with a one-click copy button.
- **Previous / next navigation** based on tutorial order in `tutorials.json`.
- **Dark, developer-focused UI** inspired by GitHub Docs, Stripe Docs, and MDN.
- **Fully keyboard accessible**, with visible focus states and semantic HTML throughout.

## Folder structure

```
DocNest/
├── index.html            Homepage: hero, search, categories, tutorial grid
├── tutorial.html          Tutorial page: article, TOC, prev/next
│
├── css/
│   ├── style.css           Layout, navbar, cards, buttons, forms, responsive rules
│   └── markdown.css        Typography and rendering rules for parsed Markdown
│
├── js/
│   ├── app.js               Homepage controller: load, search, filter, render cards
│   ├── tutorial.js          Tutorial page controller: load, render, TOC, pagination
│   ├── markdown.js          marked.js + highlight.js integration, copy buttons
│   └── utils.js              Shared helpers (reading time, slugify, fetch wrappers…)
│
├── data/
│   └── tutorials.json      The content index — one entry per tutorial
│
├── tutorials/
│   ├── welcome.md            Feature tour / Markdown reference
│   └── langchain.md          Longer technical example
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
highlight.js) via `<script>` tags in `index.html` and `tutorial.html` — there is
nothing to install locally.

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
     "difficulty": "Beginner",
     "file": "tutorials/deploying.md"
   }
   ```

3. **Done.** The homepage card, search index, category filter, table of contents,
   reading time, and previous/next links are all generated from that one entry.

The order of entries in `tutorials.json` determines the previous/next navigation
on each tutorial page.

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
- [ ] KaTeX for inline and block math
- [ ] A light theme alongside the current dark theme
- [ ] Blog mode (dated posts, an archive view, pagination)
- [ ] RSS/Atom feed generation
- [ ] Tagging, in addition to single-category classification
- [ ] Versioned documentation (multiple `tutorials.json` indexes)
- [ ] A small plugin hook system around the render pipeline
- [ ] PWA manifest + service worker for offline reading
- [ ] Multiple documentation collections in a single deployment

## License

MIT — use, modify, and redistribute freely.
