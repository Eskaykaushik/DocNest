/* Diagram Kit — renders, themes, orients and traces every Mermaid block. */

const SELECTOR = ".mermaid-diagram";
function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function chartPalette() {
  return Array.from({ length: 8 }, (_, i) => token(`--chart-${i + 1}`, "#b4451f"));
}

function themeVariables() {
  const surface = token("--color-surface", "#1a1714");
  const surfaceHover = token("--color-surface-hover", "#221e1a");
  const border = token("--color-border", "#2e2924");
  const text = token("--color-text", "#ece5d7");
  const accent = token("--color-accent", "#e07a4f");
  const bg = token("--color-bg", "#12100e");
  const clusterBg = token("--diagram-cluster-bg", surfaceHover);
  const clusterBorder = token("--diagram-cluster-border", border);
  const chart = chartPalette();

  return {
    primaryColor: surface,
    primaryTextColor: text,
    primaryBorderColor: border,
    lineColor: accent,
    secondaryColor: surfaceHover,
    tertiaryColor: bg,
    clusterBkg: clusterBg,
    clusterBorder: clusterBorder,
    labelTextColor: text,
    edgeLabelBackground: bg,
    nodeBorder: accent,
    nodeTextColor: text,
    actorBkg: surface,
    actorBorder: border,
    actorTextColor: text,
    activationBkgColor: surfaceHover,
    sequenceNumberColor: text,
    notesBkgColor: surface,
    notesBorderColor: border,
    pie1: chart[0],
    pie2: chart[1],
    pie3: chart[2],
    pie4: chart[3],
    pie5: chart[4],
    pie6: chart[5],
    pie7: chart[6],
    pie8: chart[7],
    pieStrokeWidth: "1.5px",
    pieTitleTextSize: "15px",
    pieSectionTextSize: "12px",
  };
}

function mermaidConfig() {
  return {
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: themeVariables(),
    fontFamily: token("--font-ui", "Inter, ui-sans-serif, system-ui, sans-serif"),
    flowchart: {
      nodeSpacing: 26,
      rankSpacing: 18,
      padding: 20,
      subGraphTitleMargin: { top: 10, bottom: 8 },
    },
    sequence: { useMaxWidth: true },
  };
}

let renderCount = 0;
let queue = Promise.resolve();

const VERTICAL = new Set(["TD", "TB", "BT"]);
const MIN_SCALE = 0.85;
const FLIP_GAIN = 1.15;
const MAX_HEIGHT_RATIO = 3.2;
const MAX_UPSCALE = 1.35;

function diagramWidth() {
  const value = parseFloat(token("--diagram-max-width", "360px"));
  return Number.isFinite(value) ? value : 360;
}

function directionOf(source) {
  const match = source.match(/^\s*(?:graph|flowchart)\s+(TB|TD|BT|RL|LR)\b/im);
  return match ? match[1].toUpperCase() : null;
}

function forcedDirection(source) {
  const match = source.match(/%%\s*direction\s*:\s*(TB|TD|BT|RL|LR|keep|auto)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function setDirection(source, direction) {
  return source.replace(/^(\s*(?:graph|flowchart)\s+)(TB|TD|BT|RL|LR)\b/im, `$1${direction}`);
}

function flipDirection(direction) {
  return VERTICAL.has(direction) ? "LR" : "TD";
}

function measure(svg, width) {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  const naturalWidth = parts[2];
  const naturalHeight = parts[3];
  if (!naturalWidth || !naturalHeight) return null;
  const scale = Math.min(width / naturalWidth, MAX_UPSCALE);
  return { scale, height: naturalHeight * scale, naturalWidth };
}

async function draw(source) {
  renderCount += 1;
  try {
    const { svg } = await window.mermaid.render(`diagram-${renderCount}`, source);
    return svg;
  } catch {
    return null;
  }
}

async function pick(source) {
  const authored = directionOf(source);
  const forced = forcedDirection(source);

  if (authored && forced && forced !== "AUTO" && forced !== "KEEP") {
    return { svg: await draw(setDirection(source, forced)), direction: forced };
  }

  const first = await draw(source);
  if (!first || !authored || forced === "KEEP") return { svg: first, direction: authored };

  const width = diagramWidth();
  const base = measure(first, width);
  if (!base || base.scale >= MIN_SCALE) return { svg: first, direction: authored };

  const other = flipDirection(authored);
  const second = await draw(setDirection(source, other));
  const flipped = second ? measure(second, width) : null;
  if (flipped && flipped.scale > base.scale * FLIP_GAIN && flipped.height <= width * MAX_HEIGHT_RATIO) {
    return { svg: second, direction: other };
  }
  return { svg: first, direction: authored };
}

async function render(figures, container) {
  if (typeof window.mermaid !== "object") return;
  window.mermaid.initialize(mermaidConfig());

  for (const figure of figures) {
    const source = figure.dataset.mermaidSrc;
    if (!source) continue;
    const { svg, direction } = await pick(source);
    if (!svg) continue;
    const box = measure(svg, diagramWidth());
    if (box) {
      const fit = figure.dataset.diagramFit === "natural" ? box.naturalWidth : box.naturalWidth * MAX_UPSCALE;
      const width = Math.min(diagramWidth(), fit);
      figure.style.setProperty("--diagram-max-width", `${Math.round(width)}px`);
    }
    figure.innerHTML = svg;
    roomForLabels(figure.querySelector("svg"));
    if (direction) figure.dataset.direction = direction.toLowerCase();
  }

  initDiagramInteractions(container);
}

function roomForLabels(svg) {
  if (!svg) return;
  const pad = 10;
  svg.querySelectorAll("foreignObject").forEach((fo) => {
    const width = parseFloat(fo.getAttribute("width"));
    if (!Number.isFinite(width) || width <= 0) return;
    fo.setAttribute("width", String(width + pad));
    fo.setAttribute("x", String((parseFloat(fo.getAttribute("x")) || 0) - pad / 2));
  });
}

function schedule(figures, container) {
  queue = queue.then(() => render(figures, container)).catch(() => {});
  return queue;
}

function watchTheme() {
  const root = document.documentElement;
  if (root.dataset.mermaidWatched === "true") return;
  root.dataset.mermaidWatched = "true";

  new MutationObserver(() => {
    schedule(Array.from(document.querySelectorAll(SELECTOR)), document);
  }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-skin"] });
}

export function initDiagrams(container = document) {
  const figures = Array.from(container.querySelectorAll(SELECTOR));
  if (!figures.length || typeof window.mermaid !== "object") return Promise.resolve();

  figures.forEach((figure) => {
    if (!figure.dataset.mermaidSrc) figure.dataset.mermaidSrc = figure.textContent;
  });

  watchTheme();
  return render(figures, container);
}

function nodeKey(id) {
  const match = id.match(/-flowchart-(.+)-\d+$/);
  return match ? match[1] : null;
}

function edgeEndpoints(pair, nodes) {
  for (let i = 1; i < pair.length - 1; i += 1) {
    if (pair[i] !== "_") continue;
    const from = pair.slice(0, i);
    const to = pair.slice(i + 1);
    if (nodes.has(from) && nodes.has(to)) return [from, to];
  }
  return null;
}

export function initDiagramInteractions(container = document) {
  container.querySelectorAll(SELECTOR).forEach((figure) => {
    const svg = figure.querySelector("svg");
    if (!svg || svg.dataset.traceReady === "true") return;

    const nodes = new Map();
    svg.querySelectorAll("g.node").forEach((group) => {
      const key = nodeKey(group.id);
      if (key) nodes.set(key, group);
    });
    if (!nodes.size) return;

    svg.dataset.traceReady = "true";

    const links = [];
    svg.querySelectorAll("path.flowchart-link").forEach((path) => {
      const match = path.id.match(/-L_(.+)_(\d+)$/);
      if (!match) return;
      const pair = edgeEndpoints(match[1], nodes);
      if (pair) links.push({ from: pair[0], to: pair[1], el: path });
    });

    const clusters = [];
    svg.querySelectorAll("g.cluster").forEach((group) => {
      const rect = group.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const members = new Set();
      nodes.forEach((node, key) => {
        const box = node.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) {
          members.add(key);
        }
      });
      if (members.size) clusters.push({ el: group, members });
    });

    const adjacency = new Map();
    nodes.forEach((_, key) => adjacency.set(key, new Set()));
    links.forEach(({ from, to }) => {
      adjacency.get(from)?.add(to);
      adjacency.get(to)?.add(from);
    });

    figure.querySelector(".diagram-bar")?.remove();

    const bar = document.createElement("div");
    bar.className = "diagram-bar";
    bar.hidden = true;

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "diagram-clear";
    clearButton.textContent = "Clear";

    bar.append(clearButton);
    figure.append(bar);

    let active = null;

    const clear = () => {
      active = null;
      svg.classList.remove("is-tracing");
      nodes.forEach((group) => group.classList.remove("is-lit", "is-self"));
      links.forEach((link) => link.el.classList.remove("is-lit"));
      clusters.forEach((cluster) => cluster.el.classList.remove("is-lit"));
      bar.hidden = true;
    };

    const trace = (key) => {
      if (active === key) {
        clear();
        return;
      }
      active = key;
      svg.classList.add("is-tracing");
      nodes.forEach((group, nodeId) => {
        group.classList.toggle("is-self", nodeId === key);
        group.classList.toggle("is-lit", nodeId === key || adjacency.get(key).has(nodeId));
      });
      links.forEach((link) => {
        link.el.classList.toggle("is-lit", link.from === key || link.to === key);
      });
      clusters.forEach((cluster) => {
        const lit = Array.from(cluster.members).some(
          (member) => member === key || adjacency.get(key).has(member),
        );
        cluster.el.classList.toggle("is-lit", lit);
      });
      bar.hidden = false;
    };

    nodes.forEach((group, key) => {
      const label = group.textContent.replace(/\s+/g, " ").trim();
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      if (label) group.setAttribute("aria-label", `Trace connections for ${label}`);
      group.addEventListener("click", (event) => {
        event.stopPropagation();
        trace(key);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          trace(key);
        }
        if (event.key === "Escape") clear();
      });
    });

    figure.addEventListener("click", (event) => {
      if (event.target.closest("g.node, .diagram-clear")) return;
      clear();
    });
    svg.addEventListener("keydown", (event) => {
      if (event.key === "Escape") clear();
    });
    clearButton.addEventListener("click", clear);
  });
}
