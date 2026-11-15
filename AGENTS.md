# AGENTS.md — DocNest project plan & working notes

This file is the source of truth for how DocNest is built, how to work on it,
and what's planned next. Read it before editing anything.

## What is DocNest

A lightweight, dependency-free documentation/tutorial engine. Write Markdown,
get a fast, searchable static site. No build step, no framework, no backend.

Two content libraries, same chrome:

- **Tutorials** — `index.html` (field-guide homepage) + `browse.html`
  (paginated catalogue) + `tutorial.html` (reader with sidebar tree).
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
index.html            Homepage: compact masthead, search, Learn/Papers/Continue modules
browse.html            Catalogue: track/level filters, search, pagination
tutorial.html          Tutorial reader: sidebar tree, TOC, prev/next
papers.html            Papers hub: stats, topic chips, local search
paper.html             Paper reader: paper header, KaTeX article, citation copy
annotate.html          Annotate workspace: notebook library + ink editor

css/style.css          Layout, navbar, cards, buttons, theme tokens (dark + light)
css/markdown.css       Typography + rules for parsed Markdown
css/diagram.css        Diagram Kit: framed plate, canvas sizing, shape strokes, cluster plates, trace states
css/portal.css         Portal components: sidebar, palette, grids, chips, papers, chat
css/skins.css          Skin layer: token overrides + scoped texture rules
css/annotate.css       Annotate workspace: topbar, toolbars, page rail, stage, print rules

js/app.js              Homepage controller (tracks, paper topics, continue)
js/browse.js           Catalogue controller (filters, URL state, pagination)
js/content-page.js     Shared reader pipeline: URL → index → Markdown → header, TOC, related, pagination, completion
js/tutorial.js         Tutorial page wiring: metadata, breadcrumbs, sidebar, related
js/deck.js             Tutorial → PPTX deck export (PptxGenJS CDN, lazy-loaded)
js/papers.js           Papers hub controller
js/paper.js            Paper page wiring: metadata, links, citation, math, related
js/annotate.js         Annotate controller: library, import, tools, pages, export, print
js/draw.js             Canvas ink engine: pen/highlighter/eraser/shapes/text, gestures
js/annotator-store.js  IndexedDB store (docs + files) and .docnest.json export/import
js/pen.js              Global presentation pen overlay (all reader pages)
js/sidebar.js          Shared category sidebar tree + mobile drawer
js/search.js           Search command palette (tutorials) — "/" or Ctrl/⌘+K
js/markdown.js         marked.js + highlight.js wrapper; code tabs, callouts, quiz fence, KaTeX hook
js/diagram.js          Diagram Kit: Mermaid render + theming + auto-orientation + click-to-trace
js/quiz.js             Inline "check yourself" quizzes built from ```quiz fences
js/chat.js             k-mentor chat widget + persona selector
js/theme.js            Appearance boot: theme + skin attributes before first paint
js/appearance.js       Skin × theme dropdown, registry, persistence, change events
js/reveal.js           IntersectionObserver "summon" reveal system (homepage only)
js/easter.js           Homepage easter eggs (logo ×5, "docnest", search wink, Konami, …)
js/effects.js          Shared delight layer: toasts, particles, confetti, flash
js/progress.js         "Nest grows" store: XP, levels, streak, completion, navbar ring + Nest panel
js/badges.js           Badge definitions + evaluation (pure data/predicates)
js/utils.js            Shared helpers (reading time, slugify, fetch wrappers, debounce)

data/tutorials.json    Tutorial index  (one entry per tutorial)
data/tracks.json       Track metadata for the homepage + catalogue filters
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
Fonts: all pages use Inter; JetBrains Mono for metadata/code; every page
headline uses the `--font-display` serif stack. Colors come from one global
token palette (see `--color-*` in `style.css`) — never hard-code colors. The
warm paper/ink palette and vermilion accent apply app-wide; only `--paper-*`
inside the annotate canvas stays local. Homepage easter eggs live in
`js/easter.js`.

Key shared modules:

- `js/content-page.js` exports `ContentPageController`, the shared reader
  pipeline. A page supplies `indexUrl`, `elements`, and hooks (`title`,
  `breadcrumb`, `metaChips`, `headerExtras`, `enhance`, `related`,
  `paginationHref`, `completionCtx`, `missing`); the controller owns URL
  resolution, fetching, article rendering, TOC + active-section tracking,
  feedback, pagination and completion. Tutorials and papers are thin configs;
  a new content type (blog post, docs page, case study) is a new config.
- `js/deck.js` turns a rendered tutorial into a `.pptx` deck. It reads the
  article DOM (not raw Markdown), plans cover → agenda → section bullets →
  code → diagrams → quiz → sources → closing, rasterises Mermaid SVGs to PNG
  at 2×, and lazy-loads PptxGenJS from a CDN on first click. Decks always use
  the warm-paper light palette; full section prose goes into speaker notes.
- `js/markdown.js` exposes `renderMarkdown`, `initCopyButtons`, `initCodeTabs`,
  and `initMath` (KaTeX auto-render, scoped to the article element).
- `js/diagram.js` is the Diagram Kit. `initDiagrams(container)` renders
  every `.mermaid-diagram`, pulls its Mermaid theme from the global CSS tokens
  (`--color-*`, `--chart-*`), and re-renders on theme or skin toggles.
  `initDiagramInteractions(container)` then post-processes rendered flowcharts:
  clicking a box lights it, its edges, and its direct neighbours while dimming
  the rest; Enter/Space toggles, Escape or a canvas click clears. Subgraphs
  (`subgraph … end`) render as dashed accent plates with a mono uppercase
  label, and tracing a node also lights the cluster that contains it. HTML
  labels are padded after render so long names are not clipped by the
  `foreignObject` viewport. Authors only write plain Mermaid — the component
  supplies frame, sizing, strokes, cluster styling and trace.
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

## Skins and the component contract

Appearance has two orthogonal axes:

- `data-theme="light|dark"` — colour temperature. Booted by `js/theme.js` in
  `<head>`, before first paint.
- `data-skin="paper|doodle"` — visual language. Also booted by `theme.js`
  (from `?skin=` or `localStorage`), then owned by `js/appearance.js`.

One control sets both: the navbar `<select>` lists every skin × theme pair
(`Doodle · Light`, `Doodle · Dark`, `Paper · Light`, `Paper · Dark`). Doodle is
the default skin; light/dark still follows the OS until the reader picks a
pair, after which both values persist in `localStorage`. Below 700px the
control collapses to a 38px icon so the navbar still fits at 390px; the native
menu keeps every pair. Annotate is excluded — it keeps its own theme toggle.

Keeping them separate matters: `js/draw.js` and `js/annotate.js` branch on
`dataset.theme === "light"`, so a third theme value would silently land in the
dark branch. A skin never touches that code.

**The contract.** Every visual primitive is a component token, declared once in
`:root` in `css/style.css`. Components consume the token; skins override the
token. Never restyle a component inside a skin block.

| Group | Tokens |
| --- | --- |
| Card | `--card-bg`, `--card-border`, `--card-radius`, `--card-shadow`, `--card-hover-shadow`, `--card-hover-lift` |
| Button | `--btn-bg`, `--btn-border`, `--btn-radius`, `--btn-shadow` |
| Icon control | `--control-bg`, `--control-border`, `--control-radius`, `--control-shadow` |
| Chip | `--chip-bg`, `--chip-border`, `--chip-radius` |
| Field | `--field-bg`, `--field-border`, `--field-radius` |
| Plate (callout, diagram, table, panel) | `--plate-bg`, `--plate-border`, `--plate-radius` |
| Code | `--code-border`, `--code-radius` |
| Type | `--heading-font`, `--heading-weight`, `--heading-tracking` |

`--card-radius` is a single value, so a skin can pass the asymmetric
hand-drawn form (`18px 6px 16px 8px / 8px 16px 6px 18px`) without new rules.

**Adding a skin**

1. Add a `[data-skin="<id>"]` token block in `css/skins.css`. Theme-specific
   colours go in `[data-theme="light"][data-skin="<id>"]` and
   `[data-theme="dark"][data-skin="<id>"]`; everything else (type, geometry,
   strokes) goes in the base block.
2. Register it in `js/appearance.js` (`SKINS`). The dropdown is generated from
   `SKINS × THEMES`, so a new skin appears in every theme automatically.
3. Structural rules that tokens cannot express (texture, rotation, SVG
   filters) go at the bottom of `skins.css`, scoped to `[data-skin="<id>"]`.
   Guard motion with `prefers-reduced-motion`.

`js/appearance.js` exports `getAppearance`, `setAppearance`, `SKINS` and
`THEMES`, and dispatches `docnest:appearancechange` on `document` — the
Diagram Kit listens to the root attributes directly.

The `doodle` skin is the worked example: `Caveat` + `Nunito` (added to the
existing Google Fonts request, same CDN), graph-paper ground, marker palette,
sketch shadows, and a `feTurbulence` displacement filter (`#dn-wobble`,
injected by `appearance.js`) applied only to diagram strokes so labels stay
crisp.

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
  "category": "Foundations",
  "subtopic": "Hosting",
  "difficulty": "Beginner",
  "tags": ["DevOps"],
  "featured": false,
  "readingTime": 5,
  "updated": "2026-08-08",
  "file": "tutorials/deploying.md"
}
```

Optional: `subtopic` (sidebar subgroups), `tags` (keywords searchable from the
palette — not rendered as chips), `featured` (fallback pick), `readingTime`
(precomputed minutes; keeps the homepage from fetching Markdown), `updated`
(chip). `category`
must match a `name` in `data/tracks.json`. Entry order in the JSON sets
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
- **Mermaid diagrams** — a fenced block tagged `mermaid` renders through the
  Diagram Kit (`css/diagram.css` + `js/diagram.js`). It is themed
  from the global tokens, fills the article width, and re-renders on theme
  toggle. Uses Mermaid v11 from CDN.

  Keep the same shape language everywhere so diagrams read as one system:

  | Shape | Mermaid | Use for |
  | --- | --- | --- |
  | Parallelogram | `[/Label/]` | inputs and outputs (documents, questions, answers) |
  | Rounded rect | `(Label)` | processing steps (chunk, embed, assemble) |
  | Cylinder | `[(Label)]` | stores (vector store, cache, database) |
  | Hexagon | `{{Label}}` | retrieval / search |
  | Circle | `((Label))` | models (LLM) |

  Flow top-down (`graph TD`). Wrap labels longer than ~9 characters onto two
  lines with `<br/>` so the canvas stays narrow and the boxes stay chunky.
  Avoid stadium `([ ])` (huge path data) and diamond `{ }` (very tall node).
  For training or agent loops, close the cycle with a dashed back edge
  (`U -.->|repeat| F`) rather than long-range backward edges across a stack —
  Mermaid draws the latter as cramped local loops.

  The component also picks the orientation. It renders the diagram as written;
  if the result would be squeezed at the canvas width, it tries the
  perpendicular direction and keeps whichever stays legible, so chains and
  pipelines settle vertical while wide fan-outs settle horizontal. Force it
  with a comment on the first line: `%% direction: TD`, `LR`, or `keep`
  (default is `auto`).

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
- Reader pages set `body.reader`: `.page-shell` narrows the tutorial tree to
  208px and `.tutorial-body` uses a 200px TOC rail, giving a ~640px article.
  Mermaid flowcharts cap at `--diagram-max-width` (360px) and wrap long labels
  onto two lines, so the shapes stay chunky without stretching the canvas.
- Content `id`s are slugs; page lookups use `?id=` query params.

## Verification checklist before shipping a change

- `node --check` all touched JS; validate both JSON indexes.
- Serve + headless-Chrome dump: all new pages render, no console errors.
  (favicon.ico 404 is pre-existing and expected.)
- Check dark **and** light theme (toggle → `data-theme="light"`, body bg flips).
- Check every skin × theme pair from the navbar dropdown (`?skin=…&theme=…`
  also works): attributes flip, the pair persists on reload, and paper stays
  visually identical to the original site.
- Check mobile breakpoint if layout shifts matter (< 1025px sidebar drawer).

## Roadmap

Done:

- [x] Compact homepage: masthead + search, Learn/Papers/Continue modules, and
      a paginated `browse.html` catalogue
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
- [x] AI-Assisted Coding track: vibe coding vs. engineering, AGENTS.md, context
      engineering, spec-driven development, and MCP — five sourced tutorials
- [x] Agents and reliability expansion: agent memory, multi-agent orchestration,
      agent security, structured outputs, reasoning models, and LLM
      observability — six sourced tutorials
- [x] AI System Design track: a design method plus support-assistant and
      batch-enrichment case studies
- [x] Skin system: component token contract + `data-skin` registry, with a
      doodle/whiteboard skin (chalkboard in dark) across the reader pages

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