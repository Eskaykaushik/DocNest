/**
 * deck.js
 * Builds a downloadable PowerPoint deck from a rendered tutorial article.
 * PptxGenJS is loaded lazily from a CDN on the first click.
 */

import { showToast } from "./effects.js";

const PPTX_SRC = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";

const BG = "F4EFE4";
const INK = "1D1A16";
const MUTED = "6F6657";
const ACCENT = "B4451F";
const BORDER = "D8CDB8";
const SURFACE = "ECE5D7";
const CODE_BG = "0D1117";
const CODE_TEXT = "ECE5D7";
const CODE_MUTED = "8FA3A8";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.8;
const CONTENT_W = SLIDE_W - MARGIN * 2;

const MAX_SLIDES = 34;
const MAX_BULLETS = 5;
const MAX_BULLET_SLIDES = 2;
const MAX_CODE_LINES = 14;
const MAX_SOURCES = 6;

let pptxLoader = null;

function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  if (pptxLoader) return pptxLoader;

  pptxLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PPTX_SRC;
    script.async = true;
    script.onload = () =>
      window.PptxGenJS
        ? resolve(window.PptxGenJS)
        : reject(new Error("PptxGenJS did not load"));
    script.onerror = () => reject(new Error("Could not load the PPTX engine"));
    document.head.appendChild(script);
  });

  return pptxLoader;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textOf(el) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function firstSentence(text, max = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  return truncate(match ? match[1] : normalized, max);
}

function isSkippable(text) {
  return /^(next|previous|up next|that closes|wrapping up)\b/i.test(text) && text.length < 260;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function chunkLines(code, size) {
  const lines = code.replace(/\t/g, "  ").replace(/\r/g, "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += size) out.push(lines.slice(i, i + size));
  return out;
}

function collectSections(articleEl) {
  const sections = [];
  let current = null;

  const ensure = () => {
    if (!current) {
      current = { title: "Overview", bullets: [], notes: [], code: [], diagrams: [], quizzes: [], callout: null, sources: [] };
      sections.push(current);
    }
    return current;
  };

  Array.from(articleEl.children).forEach((el) => {
    if (el.matches("h2")) {
      current = { title: textOf(el), bullets: [], notes: [], code: [], diagrams: [], quizzes: [], callout: null, sources: [] };
      sections.push(current);
      return;
    }

    if (el.matches("h3")) {
      const text = textOf(el);
      if (text) ensure().notes.push(text);
      return;
    }

    if (el.matches("p")) {
      const text = textOf(el);
      if (!text || isSkippable(text)) return;
      ensure().notes.push(text);
      ensure().bullets.push(firstSentence(text));
      return;
    }

    if (el.matches("ul, ol")) {
      const section = ensure();
      const isSources = /^sources$/i.test(section.title);
      el.querySelectorAll(":scope > li").forEach((li) => {
        const text = textOf(li);
        if (!text) return;
        section.notes.push(text);
        section.bullets.push(firstSentence(text, 170));
        if (isSources) {
          li.querySelectorAll("a[href]").forEach((anchor) => {
            section.sources.push({
              text: textOf(anchor) || anchor.getAttribute("href"),
              href: anchor.href,
            });
          });
        }
      });
      return;
    }

    if (el.matches(".callout")) {
      const text = textOf(el);
      if (text) ensure().callout = truncate(text, 280);
      return;
    }

    if (el.matches(".code-tabs")) {
      const block = el.querySelector(".code-block:not([hidden])") || el.querySelector(".code-block");
      const lang = block?.querySelector(".code-lang")?.textContent.trim() || "";
      const code = block?.querySelector("pre code")?.textContent || "";
      if (code.trim()) ensure().code.push({ lang, code });
      return;
    }

    if (el.matches(".code-block")) {
      const lang = el.querySelector(".code-lang")?.textContent.trim() || "";
      const code = el.querySelector("pre code")?.textContent || "";
      if (code.trim()) ensure().code.push({ lang, code });
      return;
    }

    if (el.matches(".mermaid-diagram")) {
      ensure().diagrams.push(null);
      return;
    }

    if (el.matches(".quiz")) {
      const raw = el.getAttribute("data-quiz");
      if (!raw) return;
      try {
        ensure().quizzes.push(JSON.parse(decodeURIComponent(raw)));
      } catch {
        /* ignore malformed quiz data */
      }
      return;
    }

    if (el.matches(".table-wrap")) {
      el.querySelectorAll("tbody tr").forEach((row) => {
        const cells = Array.from(row.children).map(textOf);
        if (cells.length < 2) return;
        ensure().bullets.push(truncate(`${cells[0]}: ${cells.slice(1).join(" — ")}`, 170));
      });
      return;
    }

    if (el.matches("blockquote")) {
      const text = textOf(el);
      if (text) ensure().bullets.push(firstSentence(text));
    }
  });

  return sections
    .map((section, index) => ({ ...section, number: index + 1, notes: truncate(section.notes.join(" "), 2000) }))
    .filter(
      (section) =>
        section.bullets.length ||
        section.code.length ||
        section.diagrams.length ||
        section.quizzes.length ||
        section.sources.length ||
        section.callout
    );
}

async function svgToPng(svg) {
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || svg.clientWidth || 600;
  const height = viewBox.height || svg.clientHeight || 400;
  const screenWidth = svg.getBoundingClientRect().width || width;
  const unitScale = screenWidth / width || 1;
  const scale = 2;

  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const liveLabels = Array.from(svg.querySelectorAll("foreignObject"));
  const cloneLabels = Array.from(clone.querySelectorAll("foreignObject"));
  const ctm = svg.getScreenCTM();

  cloneLabels.forEach((target, index) => {
    const label = liveLabels[index];
    const text = textOf(label);

    if (!ctm || !text) {
      target.remove();
      return;
    }

    const rect = label.getBoundingClientRect();
    const point = new DOMPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    ).matrixTransform(ctm.inverse());
    const computed = parseFloat(getComputedStyle(label).fontSize) || 16;
    const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
    node.setAttribute("x", String(point.x));
    node.setAttribute("y", String(point.y));
    node.setAttribute("text-anchor", "middle");
    node.setAttribute("dominant-baseline", "middle");
    node.setAttribute("font-family", "Inter, Arial, sans-serif");
    node.setAttribute("font-size", String(computed / unitScale));
    node.setAttribute("fill", INK);
    node.textContent = text;
    target.parentNode.replaceChild(node, target);
  });

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Diagram could not be rasterised"));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = `#${BG}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function captureDiagrams(articleEl) {
  if (!articleEl.querySelector(".mermaid-diagram")) return [];

  const root = document.documentElement;
  const previous = root.dataset.theme;
  const needsLight = previous !== "light";

  if (needsLight) {
    root.dataset.theme = "light";
    await wait(900);
  }

  const images = [];
  try {
    for (const figure of articleEl.querySelectorAll(".mermaid-diagram")) {
      const svg = figure.querySelector("svg");
      if (!svg) {
        images.push(null);
        continue;
      }
      try {
        images.push(await svgToPng(svg));
      } catch {
        images.push(null);
      }
    }
  } finally {
    if (needsLight) root.dataset.theme = previous;
  }

  return images;
}

function planDeck(sections, diagrams) {
  const plan = [{ type: "cover" }];

  const agenda = sections
    .map((section) => section.title)
    .filter((title) => title && !/^sources$/i.test(title))
    .slice(0, 12);

  if (agenda.length > 1) plan.push({ type: "agenda", items: agenda });

  let diagramCursor = 0;

  for (const section of sections) {
    if (plan.length >= MAX_SLIDES - 1) break;

    if (section.sources.length) {
      chunk(section.sources, MAX_SOURCES).forEach((items, index) => {
        if (plan.length >= MAX_SLIDES - 1) return;
        plan.push({ type: "sources", section, items, continued: index > 0 });
      });
      continue;
    }

    const bulletChunks = chunk(section.bullets, MAX_BULLETS).slice(0, MAX_BULLET_SLIDES);

    if (!bulletChunks.length && section.callout) {
      plan.push({ type: "section", section, bullets: [], callout: section.callout, continued: false });
    }

    bulletChunks.forEach((bullets, index) => {
      if (plan.length >= MAX_SLIDES - 1) return;
      plan.push({
        type: "section",
        section,
        bullets,
        callout: index === 0 ? section.callout : null,
        continued: index > 0,
      });
    });

    section.code.forEach((block) => {
      chunkLines(block.code, MAX_CODE_LINES).forEach((lines, index) => {
        if (plan.length >= MAX_SLIDES - 1) return;
        plan.push({ type: "code", section, lang: block.lang, lines, continued: index > 0 });
      });
    });

    section.diagrams.forEach(() => {
      const image = diagrams[diagramCursor++];
      if (image && plan.length < MAX_SLIDES - 1) {
        plan.push({ type: "diagram", section, image });
      }
    });

    section.quizzes.forEach((quiz) => {
      (quiz.questions || []).slice(0, 3).forEach((question) => {
        if (plan.length >= MAX_SLIDES - 1) return;
        plan.push({ type: "quiz", section, question });
      });
    });
  }

  plan.push({ type: "closing" });
  return plan;
}

function kicker(slide, text) {
  slide.addText(text, {
    x: MARGIN,
    y: 0.52,
    w: CONTENT_W,
    h: 0.3,
    fontFace: "Consolas",
    fontSize: 10,
    color: ACCENT,
    charSpacing: 2,
  });
}

function heading(slide, text, options = {}) {
  slide.addText(text, {
    x: MARGIN,
    y: 0.86,
    w: CONTENT_W,
    h: 0.95,
    fontFace: "Georgia",
    fontSize: options.size || 26,
    color: INK,
    valign: "top",
    fit: "shrink",
  });
}

function rule(slide, pptx, y) {
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y,
    w: 1.3,
    h: 0.045,
    fill: { color: ACCENT },
    line: { color: ACCENT },
  });
}

function footer(slide, pptx, title, index, total) {
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 6.92,
    w: CONTENT_W,
    h: 0.012,
    fill: { color: BORDER },
    line: { color: BORDER },
  });
  slide.addText(`DocNest · ${truncate(title, 72)}`, {
    x: MARGIN,
    y: 7.0,
    w: CONTENT_W - 1.5,
    h: 0.28,
    fontFace: "Calibri",
    fontSize: 9,
    color: MUTED,
  });
  slide.addText(`${index} / ${total}`, {
    x: SLIDE_W - MARGIN - 1.3,
    y: 7.0,
    w: 1.3,
    h: 0.28,
    fontFace: "Calibri",
    fontSize: 9,
    color: MUTED,
    align: "right",
  });
}

function renderCover(slide, pptx, entry, meta) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.22,
    h: SLIDE_H,
    fill: { color: ACCENT },
    line: { color: ACCENT },
  });
  slide.addText("DOCNEST", {
    x: 0.9,
    y: 0.55,
    w: 4,
    h: 0.3,
    fontFace: "Consolas",
    fontSize: 11,
    color: ACCENT,
    charSpacing: 3,
  });
  slide.addText(String(entry.category || "Tutorial").toUpperCase(), {
    x: 0.9,
    y: 1.55,
    w: 10,
    h: 0.3,
    fontFace: "Consolas",
    fontSize: 11,
    color: MUTED,
    charSpacing: 2,
  });
  slide.addText(entry.title, {
    x: 0.9,
    y: 1.92,
    w: 11.2,
    h: 2.4,
    fontFace: "Georgia",
    fontSize: 38,
    color: INK,
    valign: "top",
    fit: "shrink",
  });
  slide.addText(
    `${entry.difficulty || "Tutorial"} · ${meta.readingTime} min read · ${meta.wordCount.toLocaleString()} words`,
    {
      x: 0.9,
      y: 4.45,
      w: 10.5,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 14,
      color: MUTED,
    }
  );
  rule(slide, pptx, 5.25);
  slide.addText("A DocNest tutorial, exported as slides.", {
    x: 0.9,
    y: 5.45,
    w: 8,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 12,
    color: MUTED,
  });
}

function renderAgenda(slide, pptx, items) {
  kicker(slide, "WHAT YOU'LL LEARN");
  heading(slide, "In this tutorial");
  rule(slide, pptx, 1.78);

  const half = Math.ceil(items.length / 2);
  const column = (list, start) =>
    list.map((title, index) => ({
      text: `${String(start + index).padStart(2, "0")}   ${truncate(title, 70)}`,
      options: { breakLine: true },
    }));

  slide.addText(column(items.slice(0, half), 1), {
    x: MARGIN,
    y: 2.02,
    w: 5.5,
    h: 4.4,
    fontFace: "Calibri",
    fontSize: 14,
    color: INK,
    valign: "top",
    lineSpacingMultiple: 1.3,
    paraSpaceAfterPt: 8,
  });
  slide.addText(column(items.slice(half), half + 1), {
    x: 6.85,
    y: 2.02,
    w: 5.6,
    h: 4.4,
    fontFace: "Calibri",
    fontSize: 14,
    color: INK,
    valign: "top",
    lineSpacingMultiple: 1.3,
    paraSpaceAfterPt: 8,
  });
}

function renderSection(slide, pptx, item) {
  const { section, bullets, callout, continued } = item;
  kicker(slide, `SECTION ${String(section.number).padStart(2, "0")}${continued ? " · CONTINUED" : ""}`);
  heading(slide, section.title);
  rule(slide, pptx, 1.82);

  const bodyHeight = callout ? 3.15 : 4.55;

  if (bullets.length) {
    slide.addText(
      bullets.map((text) => ({
        text,
        options: { bullet: { code: "25AA" }, breakLine: true },
      })),
      {
        x: MARGIN,
        y: 2.08,
        w: CONTENT_W,
        h: bodyHeight,
        fontFace: "Calibri",
        fontSize: 16,
        color: INK,
        valign: "top",
        lineSpacingMultiple: 1.2,
        paraSpaceAfterPt: 12,
      }
    );
  }

  if (callout) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: MARGIN,
      y: 5.45,
      w: CONTENT_W,
      h: 1.2,
      fill: { color: SURFACE },
      line: { color: ACCENT, width: 1 },
      rectRadius: 0.06,
    });
    slide.addText(callout, {
      x: MARGIN + 0.22,
      y: 5.55,
      w: CONTENT_W - 0.44,
      h: 1,
      fontFace: "Calibri",
      fontSize: 12,
      italic: true,
      color: INK,
      valign: "middle",
      fit: "shrink",
    });
  }

  if (section.notes) slide.addNotes(section.notes);
}

function renderCode(slide, pptx, item) {
  const { section, lang, lines, continued } = item;
  kicker(slide, `SECTION ${String(section.number).padStart(2, "0")} · CODE${continued ? " · CONTINUED" : ""}`);
  heading(slide, section.title, { size: 20 });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: MARGIN,
    y: 1.7,
    w: CONTENT_W,
    h: 4.95,
    fill: { color: CODE_BG },
    line: { color: CODE_BG },
    rectRadius: 0.06,
  });

  slide.addText(lang || "code", {
    x: MARGIN + 0.25,
    y: 1.84,
    w: 4,
    h: 0.26,
    fontFace: "Consolas",
    fontSize: 9,
    color: CODE_MUTED,
    charSpacing: 1,
  });

  slide.addText(
    lines.map((line) => ({
      text: line.length ? line : " ",
      options: { breakLine: true },
    })),
    {
      x: MARGIN + 0.25,
      y: 2.14,
      w: CONTENT_W - 0.5,
      h: 4.35,
      fontFace: "Consolas",
      fontSize: 10.5,
      color: CODE_TEXT,
      valign: "top",
      lineSpacingMultiple: 1.12,
    }
  );
}

function renderDiagram(slide, pptx, item) {
  const { section, image } = item;
  kicker(slide, `SECTION ${String(section.number).padStart(2, "0")} · DIAGRAM`);
  heading(slide, section.title, { size: 20 });

  const maxWidth = 11;
  const maxHeight = 4.85;
  const top = 1.65;
  const ratio = image.width / image.height || 1;
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  slide.addImage({
    data: image.dataUrl.replace(/^data:/, ""),
    x: (SLIDE_W - width) / 2,
    y: top + (maxHeight - height) / 2,
    w: width,
    h: height,
  });
}

function renderSources(slide, pptx, item) {
  const { items, continued } = item;
  kicker(slide, `SOURCES${continued ? " · CONTINUED" : ""}`);
  heading(slide, "Sources & further reading", { size: 24 });
  rule(slide, pptx, 1.72);

  items.forEach((source, index) => {
    const y = 1.98 + index * 0.78;
    slide.addText(truncate(source.text, 90), {
      x: MARGIN,
      y,
      w: CONTENT_W,
      h: 0.3,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: INK,
      valign: "top",
    });
    slide.addText(truncate(source.href, 110), {
      x: MARGIN,
      y: y + 0.28,
      w: CONTENT_W,
      h: 0.24,
      fontFace: "Consolas",
      fontSize: 9,
      color: MUTED,
      hyperlink: { url: source.href },
      valign: "top",
    });
  });
}

function renderQuiz(slide, pptx, item) {
  const { section, question } = item;
  kicker(slide, "CHECK YOURSELF");
  heading(slide, section.title, { size: 18 });

  slide.addText(question.q, {
    x: MARGIN,
    y: 1.85,
    w: CONTENT_W,
    h: 1.25,
    fontFace: "Calibri",
    fontSize: 20,
    bold: true,
    color: INK,
    valign: "top",
    fit: "shrink",
  });

  const letters = ["A", "B", "C", "D", "E", "F"];
  slide.addText(
    (question.options || []).map((option, index) => ({
      text: `${letters[index] || "·"}   ${option}`,
      options: { breakLine: true },
    })),
    {
      x: MARGIN,
      y: 3.25,
      w: CONTENT_W,
      h: 2.6,
      fontFace: "Calibri",
      fontSize: 15,
      color: INK,
      valign: "top",
      lineSpacingMultiple: 1.25,
      paraSpaceAfterPt: 10,
    }
  );

  const answer = (question.options || [])[question.answer];
  slide.addNotes(
    `Answer: ${letters[question.answer] || ""} — ${answer || ""}${question.why ? `. ${question.why}` : ""}`
  );
}

function renderClosing(slide, pptx, entry, meta) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.22,
    h: SLIDE_H,
    fill: { color: ACCENT },
    line: { color: ACCENT },
  });
  kicker(slide, "KEEP READING");
  slide.addText(entry.title, {
    x: MARGIN,
    y: 1.3,
    w: 11.2,
    h: 1.7,
    fontFace: "Georgia",
    fontSize: 30,
    color: INK,
    valign: "top",
    fit: "shrink",
  });
  slide.addText(meta.url, {
    x: MARGIN,
    y: 3.25,
    w: CONTENT_W,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    color: ACCENT,
    hyperlink: { url: meta.url },
  });
  rule(slide, pptx, 4.0);
  slide.addText("Exported from DocNest. Slides are a summary — read the full tutorial for the details.", {
    x: MARGIN,
    y: 4.25,
    w: 9.5,
    h: 0.8,
    fontFace: "Calibri",
    fontSize: 12,
    color: MUTED,
  });
}

function renderPlan(pptx, plan, entry, meta) {
  plan.forEach((item, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: BG };

    if (item.type === "cover") renderCover(slide, pptx, entry, meta);
    else if (item.type === "agenda") renderAgenda(slide, pptx, item.items);
    else if (item.type === "section") renderSection(slide, pptx, item);
    else if (item.type === "code") renderCode(slide, pptx, item);
    else if (item.type === "diagram") renderDiagram(slide, pptx, item);
    else if (item.type === "sources") renderSources(slide, pptx, item);
    else if (item.type === "quiz") renderQuiz(slide, pptx, item);
    else if (item.type === "closing") renderClosing(slide, pptx, entry, meta);

    if (item.type !== "cover") footer(slide, pptx, entry.title, index + 1, plan.length);
  });
}

export async function buildDeck({ entry, articleEl, url, readingTime, wordCount }) {
  const sections = collectSections(articleEl);
  const diagrams = await captureDiagrams(articleEl);
  const plan = planDeck(sections, diagrams);

  const PptxGenJS = await loadPptx();
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "DOCNEST_16X9", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "DOCNEST_16X9";
  pptx.author = "DocNest";
  pptx.title = entry.title;
  pptx.subject = entry.description || "DocNest tutorial";

  renderPlan(pptx, plan, entry, {
    readingTime,
    wordCount,
    url,
  });

  return { pptx, slideCount: plan.length };
}

export async function downloadDeck(options) {
  const { pptx, slideCount } = await buildDeck(options);
  await pptx.writeFile({ fileName: `docnest-${options.entry.id}.pptx` });
  return slideCount;
}

export function initDeckButton({ button, entry, articleEl, url, readingTime, wordCount }) {
  if (!button) return;

  const label = button.querySelector(".deck-label");

  button.addEventListener("click", async () => {
    if (button.disabled) return;

    const original = label?.textContent || "Download PPT";
    button.disabled = true;
    button.classList.add("is-busy");
    button.setAttribute("aria-busy", "true");
    if (label) label.textContent = "Building…";

    try {
      const slideCount = await downloadDeck({
        entry,
        articleEl,
        url,
        readingTime,
        wordCount,
      });
      showToast(`Deck downloaded — ${slideCount} slides`);
    } catch (error) {
      console.error(error);
      showToast("Couldn't build the deck — try again");
    } finally {
      button.disabled = false;
      button.classList.remove("is-busy");
      button.removeAttribute("aria-busy");
      if (label) label.textContent = original;
    }
  });
}
