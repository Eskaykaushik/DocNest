import { createSurface, flattenPage, clamp } from "./draw.js";
import * as store from "./annotator-store.js";
import { getQueryParam, formatDate, escapeHtml, debounce } from "./utils.js";

const PDF_LIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const DEFAULT_WIDTH = 794;
const DEFAULT_HEIGHT = 1123;
const COLORS = ["#111827", "#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#ffffff"];
const WIDTHS = [1.5, 3, 5, 8];
const HISTORY_LIMIT = 60;

const els = {
  library: document.getElementById("annot-library"),
  grid: document.getElementById("annot-doc-grid"),
  empty: document.getElementById("annot-empty"),
  libCount: document.getElementById("annot-lib-count"),
  fileInput: document.getElementById("annot-file-input"),
  dropzone: document.getElementById("annot-dropzone"),
  editor: document.getElementById("annot-editor"),
  name: document.getElementById("annot-name"),
  status: document.getElementById("annot-save-status"),
  back: document.getElementById("annot-back"),
  tools: document.getElementById("annot-tools"),
  colors: document.getElementById("annot-colors"),
  colorInput: document.getElementById("annot-color-input"),
  widths: document.getElementById("annot-widths"),
  undo: document.getElementById("annot-undo"),
  redo: document.getElementById("annot-redo"),
  clear: document.getElementById("annot-clear"),
  stage: document.getElementById("annot-stage"),
  page: document.getElementById("annot-page"),
  canvas: document.getElementById("annot-canvas"),
  thumbs: document.getElementById("annot-thumbs"),
  addPage: document.getElementById("annot-add-page"),
  deletePage: document.getElementById("annot-delete-page"),
  prev: document.getElementById("annot-prev"),
  next: document.getElementById("annot-next"),
  pageLabel: document.getElementById("annot-page-label"),
  zoomOut: document.getElementById("annot-zoom-out"),
  zoomIn: document.getElementById("annot-zoom-in"),
  zoomLabel: document.getElementById("annot-zoom-label"),
  fit: document.getElementById("annot-fit"),
  exportPng: document.getElementById("annot-export-png"),
  print: document.getElementById("annot-print-btn"),
  exportJson: document.getElementById("annot-export-json"),
  importJson: document.getElementById("annot-import-json"),
  importInput: document.getElementById("annot-import-input"),
  printArea: document.getElementById("annot-print"),
  toast: document.getElementById("annot-toast"),
};

const state = {
  docs: [],
  doc: null,
  pageIndex: 0,
  pdf: null,
  pdfCanvas: new Map(),
  images: new Map(),
  tool: { name: "pen", color: COLORS[0], width: WIDTHS[1] },
  history: new Map(),
  zoom: 1,
};

let surface = null;
let toastTimer = 0;

function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function currentPage() {
  return state.doc ? state.doc.pages[state.pageIndex] : null;
}

function cleanName(filename) {
  return (filename || "Untitled").replace(/\.[^.]+$/, "") || "Untitled";
}

function safeName(name) {
  return (name || "docnest").replace(/[^\w.-]+/g, "-");
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("is-error", isError);
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 3200);
}

function createPage(template, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  return { id: uid("p"), width, height, background: { type: template }, strokes: [] };
}

function newDoc(name, pages, meta = {}) {
  const now = new Date().toISOString();
  return { id: uid("doc"), name, created: now, updated: now, pages, thumb: null, ...meta };
}

function setView(view) {
  els.library.hidden = view !== "library";
  els.editor.hidden = view !== "editor";
  document.body.classList.toggle("annot-editing", view === "editor");
}

function setUrl(id) {
  const url = id ? `annotate.html?id=${encodeURIComponent(id)}` : "annotate.html";
  history.replaceState(null, "", url);
}

async function ensurePdfLib() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PDF_LIB;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load the PDF engine"));
    document.head.appendChild(script);
  });
  if (!window.pdfjsLib) throw new Error("PDF engine unavailable");
  return window.pdfjsLib;
}

async function openPdf(bytes) {
  const lib = await ensurePdfLib();
  lib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  return lib.getDocument({ data: bytes }).promise;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    image.src = url;
  });
}

function imageFor(dataUrl) {
  if (state.images.has(dataUrl)) return Promise.resolve(state.images.get(dataUrl));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      state.images.set(dataUrl, image);
      resolve(image);
    };
    image.onerror = () => reject(new Error("Could not render image page"));
    image.src = dataUrl;
  });
}

async function renderPdfBackground(index) {
  if (state.pdfCanvas.has(index)) return state.pdfCanvas.get(index);
  if (!state.pdf) throw new Error("PDF source missing");
  const pdfPage = await state.pdf.getPage(index + 1);
  const viewport = pdfPage.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  state.pdfCanvas.set(index, canvas);
  return canvas;
}

async function sourceForPage(page) {
  const background = page.background || {};
  if (background.type === "pdf") return renderPdfBackground(background.index);
  if (background.type === "image") return imageFor(background.dataUrl);
  return null;
}

function renderLibrary() {
  return store.listDocs().then((docs) => {
    state.docs = docs;
    const count = docs.length;
    els.libCount.textContent = count ? `${count} notebook${count === 1 ? "" : "s"}` : "";
    els.empty.hidden = count > 0;
    els.grid.innerHTML = docs.map(docCard).join("");
  });
}

function docCard(doc) {
  const initial = escapeHtml((doc.name || "?").trim().charAt(0).toUpperCase() || "?");
  const thumb = doc.thumb
    ? `<img src="${doc.thumb}" alt="" loading="lazy" />`
    : `<span class="annot-doc-initial" aria-hidden="true">${initial}</span>`;
  const pages = `${doc.pages.length} page${doc.pages.length === 1 ? "" : "s"}`;
  return `
    <article class="annot-doc-card">
      <a class="annot-doc-open" href="annotate.html?id=${encodeURIComponent(doc.id)}" data-open="${doc.id}">
        <span class="annot-doc-thumb">${thumb}</span>
        <span class="annot-doc-body">
          <span class="annot-doc-name">${escapeHtml(doc.name)}</span>
          <span class="annot-doc-meta">${pages} · Updated ${formatDate(doc.updated.slice(0, 10))}</span>
        </span>
      </a>
      <button type="button" class="annot-doc-delete" data-delete="${doc.id}" title="Delete notebook" aria-label="Delete ${escapeHtml(doc.name)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
      </button>
    </article>`;
}

async function openDoc(id) {
  const doc = await store.getDoc(id);
  if (!doc) {
    showToast("Notebook not found", true);
    setView("library");
    setUrl(null);
    return;
  }
  state.doc = doc;
  state.pageIndex = 0;
  state.pdf = null;
  state.pdfCanvas = new Map();
  state.history = new Map();
  state.zoom = 1;
  els.name.value = doc.name;
  els.status.textContent = "";
  setView("editor");
  setUrl(doc.id);
  renderThumbs();
  if (doc.hasFile && doc.fileType === "application/pdf") {
    try {
      const blob = await store.getFile(doc.id);
      if (blob) state.pdf = await openPdf(await blob.arrayBuffer());
    } catch (error) {
      showToast("The source PDF could not be reopened", true);
    }
  }
  await loadPage(0);
  fitZoom();
}

async function loadPage(index) {
  if (!state.doc) return;
  state.pageIndex = clamp(index, 0, state.doc.pages.length - 1);
  const page = currentPage();
  let source = null;
  try {
    source = await sourceForPage(page);
  } catch (error) {
    showToast(error.message || "Could not render this page", true);
  }
  surface.setPage(page, source);
  surface.setZoom(state.zoom);
  updatePageUI();
}

function renderThumbs() {
  els.thumbs.innerHTML = state.doc.pages
    .map(
      (page, index) => `
      <button type="button" class="annot-thumb" data-page="${index}" aria-label="Page ${index + 1}">
        <span class="annot-thumb-num">${index + 1}</span>
        <span class="annot-thumb-lines" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>`
    )
    .join("");
}

function updatePageUI() {
  const total = state.doc.pages.length;
  els.pageLabel.textContent = `Page ${state.pageIndex + 1} / ${total}`;
  els.prev.disabled = state.pageIndex === 0;
  els.next.disabled = state.pageIndex === total - 1;
  els.deletePage.disabled = total <= 1;
  els.thumbs.querySelectorAll(".annot-thumb").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.page) === state.pageIndex);
  });
}

function updateZoomUI() {
  els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function fitZoom() {
  const page = currentPage();
  if (!page) return;
  const available = els.stage.clientWidth - 48;
  state.zoom = clamp(available / page.width, 0.4, 1.6);
  surface.setZoom(state.zoom);
  updateZoomUI();
}

function setZoom(next) {
  state.zoom = clamp(next, 0.35, 3);
  surface.setZoom(state.zoom);
  updateZoomUI();
}

function historyFor(pageId) {
  if (!state.history.has(pageId)) state.history.set(pageId, { undo: [], redo: [] });
  return state.history.get(pageId);
}

function pushUndo() {
  const page = currentPage();
  if (!page) return;
  const history = historyFor(page.id);
  history.undo.push(JSON.stringify(page.strokes));
  if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
  history.redo.length = 0;
}

function undo() {
  const page = currentPage();
  if (!page) return;
  const history = historyFor(page.id);
  if (!history.undo.length) return;
  history.redo.push(JSON.stringify(page.strokes));
  page.strokes = JSON.parse(history.undo.pop());
  surface.refreshInk();
  scheduleSave();
}

function redo() {
  const page = currentPage();
  if (!page) return;
  const history = historyFor(page.id);
  if (!history.redo.length) return;
  history.undo.push(JSON.stringify(page.strokes));
  page.strokes = JSON.parse(history.redo.pop());
  surface.refreshInk();
  scheduleSave();
}

async function makeThumb() {
  const page = currentPage();
  if (!page) return null;
  const scale = Math.min(0.4, 240 / page.width);
  const canvas = surface.flatten(scale);
  if (!canvas) return null;
  return canvas.toDataURL("image/jpeg", 0.7);
}

const scheduleSave = debounce(() => saveNow(), 700);

async function saveNow() {
  if (!state.doc || els.editor.hidden) return;
  els.status.textContent = "Saving…";
  try {
    const thumb = await makeThumb();
    if (thumb) state.doc.thumb = thumb;
    await store.saveDoc(state.doc);
    els.status.textContent = "Saved";
    setTimeout(() => {
      if (els.status.textContent === "Saved") els.status.textContent = "";
    }, 1400);
  } catch (error) {
    els.status.textContent = "Save failed";
    showToast("Could not save this notebook", true);
  }
}

function selectTool(name) {
  state.tool.name = name;
  surface.setTool({ name });
  els.tools.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === name);
  });
  els.canvas.style.cursor = name === "text" ? "text" : name === "eraser" ? "cell" : "crosshair";
}

function selectColor(color) {
  state.tool.color = color;
  surface.setTool({ color });
  els.colors.querySelectorAll("[data-color]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.color.toLowerCase() === color.toLowerCase());
  });
  els.colorInput.value = color;
}

function selectWidth(width) {
  state.tool.width = width;
  surface.setTool({ width });
  els.widths.querySelectorAll("[data-width]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.width) === width);
  });
}

function openTextInput(point) {
  const page = currentPage();
  if (!page) return;
  const { x, y } = point;
  const fontSize = 20 + state.tool.width * 2;
  const input = document.createElement("input");
  input.className = "annot-text-input";
  input.type = "text";
  input.style.left = `${x * state.zoom}px`;
  input.style.top = `${(y - fontSize) * state.zoom}px`;
  input.style.fontSize = `${fontSize * state.zoom}px`;
  input.style.color = state.tool.color;
  input.setAttribute("aria-label", "Text annotation");
  els.page.appendChild(input);
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const text = input.value.trim();
    input.remove();
    if (!text) {
      surface.refreshInk();
      return;
    }
    pushUndo();
    page.strokes.push({
      id: uid("s"),
      tool: "text",
      color: state.tool.color,
      width: state.tool.width,
      fontSize,
      points: [{ x, y }],
      text,
    });
    surface.refreshInk();
    scheduleSave();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      done = true;
      input.remove();
    }
  });
  input.addEventListener("blur", commit);
}

function addPage(template) {
  if (!state.doc) return;
  pushUndo();
  const base = currentPage();
  const page = createPage(template, base ? base.width : DEFAULT_WIDTH, base ? base.height : DEFAULT_HEIGHT);
  state.doc.pages.splice(state.pageIndex + 1, 0, page);
  state.pageIndex += 1;
  renderThumbs();
  loadPage(state.pageIndex);
  scheduleSave();
}

function deletePage() {
  if (!state.doc || state.doc.pages.length <= 1) {
    showToast("A notebook needs at least one page", true);
    return;
  }
  if (!confirm(`Delete page ${state.pageIndex + 1}?`)) return;
  state.doc.pages.splice(state.pageIndex, 1);
  state.pageIndex = clamp(state.pageIndex, 0, state.doc.pages.length - 1);
  renderThumbs();
  loadPage(state.pageIndex);
  scheduleSave();
}

function clearPage() {
  const page = currentPage();
  if (!page || !page.strokes.length) return;
  if (!confirm("Clear all ink on this page?")) return;
  pushUndo();
  page.strokes = [];
  surface.refreshInk();
  scheduleSave();
}

async function startBlank(template) {
  const names = { blank: "Blank note", grid: "Dot grid note", lines: "Ruled note" };
  const doc = newDoc(names[template] || "Blank note", [createPage(template)]);
  await store.saveDoc(doc);
  await openDoc(doc.id);
}

async function importPdf(file) {
  showToast("Reading PDF…");
  const pdf = await openPdf(await file.arrayBuffer());
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const pdfPage = await pdf.getPage(i);
    const viewport = pdfPage.getViewport({ scale: 1 });
    pages.push({
      id: uid("p"),
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      background: { type: "pdf", index: i - 1 },
      strokes: [],
    });
  }
  const doc = newDoc(cleanName(file.name), pages, {
    fileName: file.name,
    fileType: "application/pdf",
    hasFile: true,
  });
  await store.putFile(doc.id, file);
  await store.saveDoc(doc);
  await openDoc(doc.id);
  showToast(`${pages.length} page${pages.length === 1 ? "" : "s"} ready`);
}

async function importImage(file) {
  const image = await loadImageFromFile(file);
  const ratio = Math.min(1, 1400 / image.width);
  const width = Math.round(image.width * ratio);
  const height = Math.round(image.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const page = {
    id: uid("p"),
    width,
    height,
    background: { type: "image", dataUrl: canvas.toDataURL("image/jpeg", 0.85) },
    strokes: [],
  };
  const doc = newDoc(cleanName(file.name), [page]);
  await store.saveDoc(doc);
  await openDoc(doc.id);
}

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  for (const file of files) {
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        await importPdf(file);
      } else if (file.type.startsWith("image/")) {
        await importImage(file);
      } else {
        showToast(`Unsupported file: ${file.name}`, true);
      }
    } catch (error) {
      showToast(error.message || "Import failed", true);
    }
  }
}

function exportPng() {
  const page = currentPage();
  if (!page) return;
  const canvas = surface.flatten(2);
  canvas.toBlob((blob) => {
    store.download(`${safeName(state.doc.name)}-page-${state.pageIndex + 1}.png`, blob);
  }, "image/png");
}

async function printDoc() {
  if (!state.doc) return;
  els.status.textContent = "Preparing print…";
  els.printArea.innerHTML = "";
  for (let i = 0; i < state.doc.pages.length; i += 1) {
    const page = state.doc.pages[i];
    let source = null;
    try {
      source = await sourceForPage(page);
    } catch (error) {
      source = null;
    }
    const canvas = flattenPage(page, source, 1.6);
    const image = document.createElement("img");
    image.className = "annot-print-page";
    image.src = canvas.toDataURL("image/png");
    image.alt = `Page ${i + 1}`;
    els.printArea.appendChild(image);
  }
  els.status.textContent = "";
  window.print();
}

async function exportFile() {
  if (!state.doc) return;
  let blob = null;
  if (state.doc.hasFile) {
    try {
      blob = await store.getFile(state.doc.id);
    } catch (error) {
      blob = null;
    }
  }
  await store.exportDoc(state.doc, blob);
}

async function importFile(file) {
  try {
    const doc = await store.importDoc(file);
    await renderLibrary();
    await openDoc(doc.id);
    showToast("Notebook imported");
  } catch (error) {
    showToast(error.message || "Could not import that file", true);
  }
}

function buildToolbar() {
  els.colors.innerHTML = COLORS.map(
    (color) => `<button type="button" class="annot-swatch" data-color="${color}" style="--swatch:${color}" aria-label="Colour ${color}"></button>`
  ).join("");
  els.widths.innerHTML = WIDTHS.map(
    (width) =>
      `<button type="button" class="annot-width" data-width="${width}" aria-label="Stroke width ${width}"><span style="width:${Math.min(20, width * 2)}px;height:${Math.min(20, width * 2)}px"></span></button>`
  ).join("");
  selectColor(state.tool.color);
  selectWidth(state.tool.width);
  selectTool(state.tool.name);
}

function wireEvents() {
  els.grid.addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-delete]");
    if (remove) {
      if (!confirm("Delete this notebook? This cannot be undone.")) return;
      await store.deleteDoc(remove.dataset.delete);
      await renderLibrary();
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open) {
      event.preventDefault();
      await openDoc(open.dataset.open);
    }
  });

  els.fileInput.addEventListener("change", () => {
    handleFiles(els.fileInput.files);
    els.fileInput.value = "";
  });
  els.importInput.addEventListener("change", () => {
    if (els.importInput.files[0]) importFile(els.importInput.files[0]);
    els.importInput.value = "";
  });

  ["dragenter", "dragover"].forEach((type) =>
    document.addEventListener(type, (event) => {
      event.preventDefault();
      document.body.classList.add("is-dropping");
    })
  );
  ["dragleave", "drop"].forEach((type) =>
    document.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === "dragleave" && event.relatedTarget) return;
      document.body.classList.remove("is-dropping");
    })
  );
  document.addEventListener("drop", (event) => {
    if (event.dataTransfer && event.dataTransfer.files.length) handleFiles(event.dataTransfer.files);
  });

  els.dropzone.addEventListener("click", () => els.fileInput.click());
  document.getElementById("annot-upload-btn").addEventListener("click", () => els.fileInput.click());
  document.getElementById("annot-new-blank").addEventListener("click", () => startBlank("blank"));
  document.getElementById("annot-new-grid").addEventListener("click", () => startBlank("grid"));
  document.getElementById("annot-new-lines").addEventListener("click", () => startBlank("lines"));

  els.tools.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (button) selectTool(button.dataset.tool);
  });
  els.colors.addEventListener("click", (event) => {
    const button = event.target.closest("[data-color]");
    if (button) selectColor(button.dataset.color);
  });
  els.colorInput.addEventListener("input", () => selectColor(els.colorInput.value));
  els.widths.addEventListener("click", (event) => {
    const button = event.target.closest("[data-width]");
    if (button) selectWidth(Number(button.dataset.width));
  });

  els.undo.addEventListener("click", undo);
  els.redo.addEventListener("click", redo);
  els.clear.addEventListener("click", clearPage);
  els.back.addEventListener("click", () => {
    saveNow();
    setView("library");
    setUrl(null);
    renderLibrary();
  });
  els.name.addEventListener("change", () => {
    if (!state.doc) return;
    state.doc.name = els.name.value.trim() || "Untitled";
    els.name.value = state.doc.name;
    scheduleSave();
  });

  els.thumbs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (button) loadPage(Number(button.dataset.page));
  });
  els.addPage.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (button) addPage(button.dataset.add);
  });
  els.deletePage.addEventListener("click", deletePage);
  els.prev.addEventListener("click", () => loadPage(state.pageIndex - 1));
  els.next.addEventListener("click", () => loadPage(state.pageIndex + 1));

  els.zoomOut.addEventListener("click", () => setZoom(state.zoom / 1.2));
  els.zoomIn.addEventListener("click", () => setZoom(state.zoom * 1.2));
  els.fit.addEventListener("click", fitZoom);
  els.exportPng.addEventListener("click", exportPng);
  els.print.addEventListener("click", printDoc);
  els.exportJson.addEventListener("click", exportFile);
  els.importJson.addEventListener("click", () => els.importInput.click());

  els.stage.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(state.zoom * (event.deltaY < 0 ? 1.1 : 0.9));
  }, { passive: false });

  document.addEventListener("keydown", (event) => {
    if (els.editor.hidden) return;
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (meta && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (meta && key === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (meta) return;
    const toolKeys = { p: "pen", h: "highlight", e: "eraser", t: "text", l: "line", r: "rect", o: "ellipse", a: "arrow" };
    if (toolKeys[key]) {
      selectTool(toolKeys[key]);
      return;
    }
    if (key === "=" || key === "+") setZoom(state.zoom * 1.2);
    else if (key === "-") setZoom(state.zoom / 1.2);
    else if (key === "0") fitZoom();
    else if (event.key === "ArrowRight" || event.key === "PageDown") loadPage(state.pageIndex + 1);
    else if (event.key === "ArrowLeft" || event.key === "PageUp") loadPage(state.pageIndex - 1);
  });

  window.addEventListener("beforeunload", () => {
    if (state.doc && !els.editor.hidden) {
      state.doc.thumb = state.doc.thumb || null;
      store.saveDoc(state.doc);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.doc && !els.editor.hidden) saveNow();
  });
  window.addEventListener("resize", debounce(() => {
    if (!els.editor.hidden) updateZoomUI();
  }, 200));
}

function init() {
  surface = createSurface({
    canvas: els.canvas,
    stage: els.stage,
    onBeforeChange: pushUndo,
    onChange: scheduleSave,
    onTap: openTextInput,
    onZoom: (zoom) => {
      state.zoom = zoom;
      updateZoomUI();
    },
  });
  buildToolbar();
  wireEvents();
  renderLibrary();
  const id = getQueryParam("id");
  if (id) openDoc(id);
  else setView("library");
}

init();
