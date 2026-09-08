# AGENTS.md — DocNest project plan & working notes

This file is the source of truth for how DocNest is built, how to work on it,
and what's planned next. Read it before editing anything.

## What is DocNest

A lightweight, dependency-free documentation/tutorial engine. Write Markdown,
get a fast, searchable static site. No build step, no framework, no backend.

Two content libraries, same chrome:

- **Tutorials** — `index.html` (card-grid homepage) + `tutorial.html` (reader
  with sidebar tree).
- **Research papers** — `papers.html` (library hub) + `paper.html` (reader with
  paper header, KaTeX math, citation). Papers are real papers written as
  tutorials: TL;DR, problem, key idea, math, code, takeaways, cite-this.

Plus a full-site **k-mentor chat** widget (all four pages) and a **dark/light
theme** toggle.

## Commands

No build tooling, no package.json. Verification is:

```bash
# syntax-check all JS (no node_modules needed — plain ESM)
for f in js/*.js; do node --check "$f"; done

# validate content indexes
python3 -c "import json; [json.load(open(f)) for f in ('data/tutorials.json','data/papers.json')]"

# serve locally (file:// won't work — fetch() is blocked there)
python3 -m http.server 8457
```

Smoke-test rendering with headless Chrome:

```bash
google-chrome --headless=new --no-sandbox --disable-gpu \
  --virtual-time-budget=6000 --dump-dom "http://localhost:8457/papers.html"
```

(CDP/`WebSocket` scripting in Node is available if deeper DOM checks are needed;
`WebSocket` is global in Node ≥ 22.)

## Architecture & file map

```
index.html            Homepage: minimal summoned-hero + scroll-reveal card grid
tutorial.html          Tutorial reader: sidebar tree, TOC, prev/next
papers.html            Papers hub: hero stats, topic/difficulty chips, local search
paper.html             Paper reader: paper header, KaTeX article, citation copy

css/style.css          Layout, navbar, cards, buttons, theme tokens (dark + light)
css/markdown.css       Typography + rules for parsed Markdown
css/portal.css         Portal components: sidebar, palette, grids, chips, papers, chat

js/app.js              Homepage controller (card grid, topic/level filters)
js/tutorial.js         Tutorial reader controller
js/papers.js           Papers hub controller
js/paper.js            Paper reader controller
js/sidebar.js          Shared category sidebar tree + mobile drawer
js/search.js           Search command palette (tutorials) — "/" or Ctrl/⌘+K
js/markdown.js         marked.js + highlight.js wrapper; code tabs, callouts, KaTeX hook
js/chat.js             k-mentor chat widget
js/theme.js            Dark/light theme manager (localStorage "docnest.theme")
js/reveal.js           IntersectionObserver "summon" reveal system (homepage only)
js/easter.js           Homepage easter eggs (logo ×5, "docnest", search wink, Konami, …)
js/utils.js            Shared helpers (reading time, slugify, fetch wrappers, debounce)

data/tutorials.json    Tutorial index  (one entry per tutorial)
data/papers.json       Papers index    (one entry per paper)
tutorials/*.md         Tutorial content
papers/*.md            Paper content
libs/                  Reserved for local vendoring (marked/highlight/KaTeX)
images/                Static images (docnest-diagram.svg, etc.)
```

Runtimes: marked.js + highlight.js (CDN) on tutorial-ish pages; plus KaTeX on
`paper.html`. All loaded by `<script>` in the HTML `<head>`/`<body>`.
Fonts: all pages use Inter; JetBrains Mono for code. Colors come from a
developer token palette (see `--color-*` in `style.css`) — never hard-code
colors. The homepage uses a `[data-reveal]` summon-on-scroll system
(`js/reveal.js`): elements start invisible and fade/rise in via
IntersectionObserver with a `--reveal-delay` stagger; `prefers-reduced-motion`
renders them instantly. Homepage easter eggs live in `js/easter.js`.

Key shared modules:

- `js/markdown.js` exposes `renderMarkdown`, `initCopyButtons`, `initCodeTabs`,
  `initMath` (KaTeX auto-render, scoped to the article element), and
  `initMermaid` (Mermaid render, theme-aware + re-renders on toggle).
- `js/search.js` `createSearch()` indexes tutorials only (per design decision —
  papers have their own hub-local search box in `papers.js`).

## Content authoring conventions

### Adding a tutorial

1. Write `tutorials/<id>.md`.
2. Add an entry to `data/tutorials.json`:

```json
{
  "id": "deploying",
  "title": "Deploying a Static Site",
  "description": "Ship your site to any static host in under five minutes.",
  "category": "General",
  "subtopic": "Hosting",
  "difficulty": "Beginner",
  "tags": ["DevOps"],
  "featured": false,
  "updated": "2026-08-08",
  "file": "tutorials/deploying.md"
}
```

Optional: `subtopic` (sidebar subgroups), `tags` (keywords searchable from the
palette — not rendered as chips), `featured` (reserved; homepage has no
spotlight band anymore), `updated` (chip). Entry order in the JSON sets
prev/next navigation.

### Adding a paper

1. Write `papers/<id>.md` with the tutorialized structure.
2. Add an entry to `data/papers.json`: `id, title, description, authors[],
   year, venue, links{arxiv?, code?}, tags[], difficulty, featured, updated,
   file`.
3. Related/prev/next come from `papers.json` order; related papers are ranked
   by shared tags.

### Markdown features to use

- **Callout / TL;DR** — a fenced block whose info string is `callout` (optionally
  `callout <variant>`):

  ````md
  ```callout
  **In one sentence:** …
  ```
  ````

- **Tabbed code** — consecutive fences tagged `tabs` group into one tabbed block.
- **Math** — LaTeX with `$…$` (inline) / `$$…$$` (display); rendered by KaTeX
  on paper pages only. Avoid stray `_` underlines inside `$…$` (marked parses
  emphasis before KaTeX; single `_` is safe, pairs are not).
- **Mermaid diagrams** — a fenced block tagged `mermaid` renders a themed
  diagram (flowchart/sequence/etc.) on tutorial and paper pages; re-renders
  automatically on theme toggle. Uses Mermaid v11 from CDN.
- **Internal links** are relative to the page URL (the site root), so from any
  content file use `../tutorials/rag.md` or `../papers/react-synergizing-reasoning-and-acting.md`.
  Verify targets actually exist — filenames must match exactly.

### Rules of the codebase

- **No code comments** unless explicitly requested.
- Vanilla JS + ESM only; no new dependencies — if a new lib is needed, vendor
  it in `libs/` per `libs/README.md` or announce the CDN addition.
- Use the CSS custom properties (`--color-*`, `--radius-*`, `--duration-*`, …)
  defined for the theme system — never hard-code colors; both themes depend on
  the tokens.
- Keep parity: new pages reuse existing classes/layout so geometry matches
  (`paper-shell` overrides the 2-column `.page-shell` grid for the no-sidebar
  paper reader).
- Content `id`s are slugs; page lookups use `?id=` query params.

## Verification checklist before shipping a change

- `node --check` all touched JS; validate both JSON indexes.
- Serve + headless-Chrome dump: all new pages render, no console errors.
  (favicon.ico 404 is pre-existing and expected.)
- Check dark **and** light theme (toggle → `data-theme="light"`, body bg flips).
- Check mobile breakpoint if layout shifts matter (< 1025px sidebar drawer).

## Roadmap

Done:

- [x] Card-grid homepage: minimal text-only hero (Inter-bold, shimmer accent),
      "summoned" content — slow staggered scroll-reveals (`js/reveal.js`),
      topic/level chips + search (tags included in search matches), easter eggs
      (`js/easter.js`)
- [x] Dark + light themes with navbar toggle + OS preference following
- [x] Tagging (`tags` / `featured` fields)
- [x] Research-papers library (papers.json, hub + reader, 4 papers: Attention,
      RAG, Chain-of-Thought, ReAct)
- [x] KaTeX math rendering (papers)
- [x] Agent-eval companion series (eval-golden-datasets, eval-llm-judge, eval-harness-ci)

Planned / ideas:

- [x] Mermaid diagrams inside Markdown code fences
- [ ] Blog mode (dated posts, archive, pagination)
- [ ] RSS/Atom feed generation
- [ ] Versioned docs (multiple `tutorials.json` indexes)
- [ ] Plugin hook system around the render pipeline
- [ ] PWA manifest + service worker for offline reading
- [ ] Multiple doc collections in one deployment
- [ ] Future papers: Transformer variations, evals, agents (extend `papers/`)

## Git workflow

- Feature work happens on `ui-polish`; releases merge into `main` and `dev`.
- Merge with fast-forward where possible; the repo uses short imperative commit
  messages.
- Remote: `git@github.com:Eskaykaushik/DocNest.git`. Local `main`/`dev` may lag
  their `origin/*` counterparts — `git fetch origin` before comparing.
- Do not push unless asked.