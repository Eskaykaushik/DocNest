import * as store from "./annotator-store.js";

const HTML2CANVAS_LIB = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const PAGE_WIDTH = 840;
const PAGE_RATIO = 1.414;
const SCALE = 2;
const JPEG_QUALITY = 0.85;

function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function ensureHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HTML2CANVAS_LIB;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load the page renderer"));
    document.head.appendChild(script);
  });
  if (!window.html2canvas) throw new Error("Page renderer unavailable");
  return window.html2canvas;
}

async function captureArticle(html2canvas, title, sourceEl) {
  const wrap = document.createElement("div");
  wrap.className = "markdown-content";
  wrap.style.cssText =
    `position:fixed;top:0;left:-20000px;box-sizing:border-box;width:${PAGE_WIDTH}px;` +
    "padding:64px;background:#ffffff;color:#111827;animation:none;opacity:1;";

  const heading = document.createElement("h1");
  heading.textContent = title;
  heading.style.cssText = "font-size:38px;font-weight:700;margin:0 0 36px;line-height:1.15;letter-spacing:-0.02em;";
  wrap.appendChild(heading);

  const body = document.createElement("div");
  body.innerHTML = sourceEl.innerHTML;
  wrap.appendChild(body);

  const previousTheme = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", "light");
  document.body.appendChild(wrap);

  try {
    return await html2canvas(wrap, {
      scale: SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
  } finally {
    wrap.remove();
    document.documentElement.setAttribute("data-theme", previousTheme || "dark");
  }
}

function sliceIntoPages(canvas) {
  const sliceHeight = Math.round(PAGE_WIDTH * PAGE_RATIO * SCALE);
  const pages = [];
  for (let y = 0; y < canvas.height; y += sliceHeight) {
    const height = Math.min(sliceHeight, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = height;
    const ctx = slice.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, height, 0, 0, canvas.width, height);
    pages.push({
      id: uid("p"),
      width: PAGE_WIDTH,
      height: Math.round(height / SCALE),
      background: { type: "image", dataUrl: slice.toDataURL("image/jpeg", JPEG_QUALITY) },
      strokes: [],
    });
  }
  return pages;
}

function makeThumb(firstPage) {
  const image = new Image();
  return new Promise((resolve) => {
    image.onload = () => {
      const width = 260;
      const height = Math.round((image.height / image.width) * width) || 1;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    image.onerror = () => resolve(null);
    image.src = firstPage.background.dataUrl;
  });
}

export async function openInNotebook({ title, sourceEl, button }) {
  if (!sourceEl || !sourceEl.innerHTML.trim()) throw new Error("There is no content to send to the notebook");

  const busyLabel = button ? button.innerHTML : "";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing notebook…";
  }

  try {
    const html2canvas = await ensureHtml2Canvas();
    const canvas = await captureArticle(html2canvas, title, sourceEl);
    const pages = sliceIntoPages(canvas);
    const doc = {
      id: uid("doc"),
      name: title,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      pages,
      thumb: null,
    };
    if (pages.length) doc.thumb = await makeThumb(pages[0]);
    await store.saveDoc(doc);
    window.location.href = `annotate.html?id=${encodeURIComponent(doc.id)}`;
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.innerHTML = busyLabel;
    }
    throw error;
  }
}
