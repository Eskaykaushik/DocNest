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
annotate.html          Annotate workspace: notebook library + ink editor

css/style.css          Layout, navbar, cards, buttons, theme tokens (dark + light)
css/markdown.css       Typography + rules for parsed Markdown
css/portal.css         Portal components: sidebar, palette, grids, chips, papers, chat
css/annotate.css       Annotate workspace: topbar, toolbars, page rail, stage, print rules

js/app.js              Homepage controller (card grid, topic/level filters)
js/tutorial.js         Tutorial reader controller
js/papers.js           Papers hub controller
js/paper.js            Paper reader controller
js/annotate.js         Annotate controller: library, import, tools, pages, export, print
js/draw.js             Canvas ink engine: pen/highlighter/eraser/shapes/text, gestures
js/annotator-store.js  IndexedDB store (docs + files) and .docnest.json export/import
js/pen.js              Global presentation pen overlay (all reader pages)
js/sidebar.js          Shared category sidebar tree + mobile drawer
js/search.js           Search command palette (tutorials) — "/" or Ctrl/⌘+K
js/markdown.js         marked.js + highlight.js wrapper; code tabs, callouts, quiz fence, KaTeX hook
js/quiz.js             Inline "check yourself" quizzes built from ```quiz fences
js/chat.js             k-mentor chat widget + persona selector
js/theme.js            Dark/light theme manager (localStorage "docnest.theme")
js/reveal.js           IntersectionObserver "summon" reveal system (homepage only)
js/easter.js           Homepage easter eggs (logo ×5, "docnest", search wink, Konami, …)
js/effects.js          Shared delight layer: toasts, particles, confetti, flash
js/progress.js         "Nest grows" store: XP, levels, streak, completion, navbar ring + Nest panel
js/badges.js           Badge definitions + evaluation (pure data/predicates)
js/utils.js            Shared helpers (reading time, slugify, fetch wrappers, debounce)

data/tutorials.json    Tutorial index  (one entry per tutorial)
data/papers.json       Papers index    (one entry per paper)
tutorials/*.md         Tutorial content
papers/*.md            Paper content
libs/                  Reserved for local vendoring (marked/highlight/KaTeX)
images/                Static images (docnest-diagram.svg, etc.)
```

Runtimes: marked.js + highlight.js (CDN) on tutorial-ish pages; plus KaTeX on
`paper.html`. `annotate.html` dynamically loads PDF.js 3.11.174 (UMD) from cdnjs
only when a PDF is opened or imported (see `ensurePdfLib` in `js/annotate.js`).
All loaded by `<script>` in the HTML `<head>`/`<body>`.
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
- `js/effects.js` is the shared delight layer (`showToast`, `flash`,
  `burstParticles`, `confetti`, `starfieldRain`, `celebrate`); toasts queue
  sequentially and particle effects no-op under `prefers-reduced-motion`.
- `js/progress.js` owns the "nest grows as you learn" loop: XP, levels, daily
  streak, read/completion tracking, egg + quiz recorders, and badge unlocking,
  persisted in localStorage under `"docnest.progress"`. It renders the navbar
  **level ring + Nest panel** (`initNestUI`, auto-run on import — so any page
  that imports it gets the ring). `attachCompletion({id,kind,category,minutes,
  ctx})` fires once when the reader scrolls near the end.
- `js/badges.js` is pure data + predicates (`BADGES`, `getBadge`,
  `evaluateBadges`); `js/progress.js` owns persistence/unlocking.
- `js/quiz.js` `initQuizzes(container, {onPerfect})` builds quizzes from
  ```quiz fences; call it after `renderMarkdown` on the reader pages.

The annotate workspace is its own three-module stack, isolated from the
render/reader code:

- `js/draw.js` `createSurface({ canvas, stage, onBeforeChange, onChange, onTap,
  onZoom })` is the canvas ink engine. It owns two offscreen ink caches
  (`inkCache` source-over, `hlCache` multiply for the highlighter) plus a
  `bgCache`, and composes them onto the visible canvas. Public API:
  `setPage`, `setZoom`, `getZoom`, `setTool`, `getTool`, `refreshInk`,
  `flattenPage` (used by export + print). `onTap` fires with a `{ x, y }` point
  in unzoomed page coordinates — note `openTextInput` in `js/annotate.js` takes
  that single point object, not `(x, y)`.
- `js/annotator-store.js` is the IndexedDB layer (`docnest-annotator` DB, `docs`
  + `files` stores) with an in-memory fallback; also handles `.docnest.json`
  export/import (doc graph + original PDF/image blobs as base64).
- `js/annotate.js` is the controller: library + editor views, blank/grid/ruled
  creation, image + PDF import, page rail, zoom, undo/redo, text overlay, PNG
  export, print prep (`#annot-print`), import/export, toasts, shortcuts.

Data model (`js/annotator-store.js` / `js/annotate.js`):

```
Doc  { id, name, created, updated, pages[], thumb, fileName?, fileType?, hasFile? }
Page { id, width, height, background: {type:"blank"|"grid"|"lines"|"image"|"pdf", dataUrl?, index?}, strokes[] }
Stroke { id, tool, color, width, points[{x,y,p}], text?, fontSize? }
```

Annotate blank-page paper now follows the theme: in dark mode the paper is
black (`#0d1117`) with theme-aware grid/ruled lines; in light mode white with
the existing lines. The implementation lives in `js/draw.js` (theme palettes +
`MutationObserver` repaint) and `js/annotate.js`/`css/annotate.css` (`--paper-bg`
+ default pen color per theme). Export/print use the light palette for
consistent output.

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
- **Quizzes** — a fenced block tagged `quiz` holding JSON renders an interactive
  "check yourself" card; a first-try perfect score awards XP + the
  Perfectionist badge:

  ````md
  ```quiz
  { "questions": [ { "q": "…?", "options": ["a", "b"], "answer": 1, "why": "…" } ] }
  ```
  ````

  `answer` is the zero-based index of the correct option. Keep the JSON on the
  fence's own lines (the whole block is encoded into the `.quiz` element).
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
- [x] Research-papers library (papers.json, hub + reader, 10 papers: Attention,
      RAG, Chain-of-Thought, ReAct, BERT, GPT-3, InstructGPT, LoRA,
      Self-Consistency, Tree of Thoughts)
- [x] KaTeX math rendering (papers)
- [x] Agent-eval companion series (eval-golden-datasets, eval-llm-judge, eval-harness-ci)
- [x] Annotate workspace (`annotate.html` + `js/draw.js` + `js/annotator-store.js`
      + `js/annotate.js`): stylus ink over PDFs/images/blank pages, IndexedDB
      library, PNG / print-to-PDF / `.docnest.json` export — see the module notes
      above
- [x] "Nest grows as you learn": XP/levels/daily streak, badges, navbar level
      ring + Nest panel, read checkmarks, shared effects layer (`effects.js`),
      inline quizzes, and k-mentor personas — `progress.js`/`badges.js`/
      `quiz.js`/`effects.js`

Planned / ideas:

- [x] Mermaid diagrams inside Markdown code fences
- [ ] Blog mode (dated posts, archive, pagination)
- [ ] RSS/Atom feed generation
- [ ] Versioned docs (multiple `tutorials.json` indexes)
- [ ] Plugin hook system around the render pipeline
- [ ] PWA manifest + service worker for offline reading
- [ ] Multiple doc collections in one deployment
- [x] Extended papers library: Transformer variations (BERT, GPT-3), alignment
      (InstructGPT/RLHF), efficiency (LoRA), and reasoning (Self-Consistency,
      Tree of Thoughts)

## Git workflow

- Feature work happens on `ui-polish`; releases merge into `main` and `dev`.
- Merge with fast-forward where possible; the repo uses short imperative commit
  messages.
- Remote: `git@github.com:Eskaykaushik/DocNest.git`. Local `main`/`dev` may lag
  their `origin/*` counterparts — `git fetch origin` before comparing.
- Do not push unless asked.