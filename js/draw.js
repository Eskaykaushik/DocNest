const SHAPE_TOOLS = new Set(["line", "rect", "ellipse", "arrow"]);
const PAPER_THEMES = {
  light: { bg: "#ffffff", line: "#dfe3ea", dot: "#c8d0da" },
  dark: { bg: "#0d1117", line: "#30363d", dot: "#263039" },
};

export function paperPalette(theme) {
  const key =
    theme === "light" || theme === "dark"
      ? theme
      : document.documentElement.dataset.theme === "light"
        ? "light"
        : "dark";
  return PAPER_THEMES[key];
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function pressureOf(event) {
  return event.pressure && event.pressure > 0 ? event.pressure : 0.5;
}

function drawDots(ctx, page, color, step) {
  ctx.fillStyle = color;
  const radius = 1.1;
  for (let y = step; y < page.height; y += step) {
    for (let x = step; x < page.width; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRuled(ctx, page, color, step) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = step; y < page.height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(page.width, y);
  }
  ctx.stroke();
}

function drawPen(ctx, stroke, alpha = 1) {
  const points = stroke.points;
  if (!points.length) return;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const pressure = ((a.p ?? 0.5) + (b.p ?? 0.5)) / 2;
    ctx.lineWidth = stroke.width * (0.35 + 0.65 * pressure);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawHighlight(ctx, stroke, alpha = 1) {
  const points = stroke.points;
  if (!points.length) return;
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.32 * alpha;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width * 4;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, (stroke.width * 4) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
}

function drawShape(ctx, stroke, alpha = 1) {
  const points = stroke.points;
  if (points.length < 2) return;
  const [a, b] = points;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (stroke.tool === "line") {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else if (stroke.tool === "rect") {
    ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (stroke.tool === "ellipse") {
    ctx.ellipse(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      Math.abs(b.x - a.x) / 2,
      Math.abs(b.y - a.y) / 2,
      0,
      0,
      Math.PI * 2
    );
  } else if (stroke.tool === "arrow") {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  if (stroke.tool === "arrow") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = Math.max(9, stroke.width * 3.2);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
}

function drawText(ctx, stroke, alpha = 1) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = stroke.color;
  ctx.font = `${stroke.fontSize || 20}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(stroke.text || "", stroke.points[0].x, stroke.points[0].y);
}

export function drawStroke(ctx, stroke, alpha = 1) {
  if (stroke.tool === "highlight") drawHighlight(ctx, stroke, alpha);
  else if (stroke.tool === "text") drawText(ctx, stroke, alpha);
  else if (SHAPE_TOOLS.has(stroke.tool)) drawShape(ctx, stroke, alpha);
  else drawPen(ctx, stroke, alpha);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq ? ((px - ax) * dx + (py - ay) * dy) / lengthSq : 0;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function strokeHit(stroke, point, tolerance) {
  const reach = stroke.width / 2 + tolerance;
  const points = stroke.points;
  if (stroke.tool === "text") {
    return Math.abs(point.x - points[0].x) < 120 && Math.abs(point.y - points[0].y) < 30;
  }
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y) < reach;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (distanceToSegment(point.x, point.y, a.x, a.y, b.x, b.y) < reach) return true;
  }
  return false;
}

function paintBackground(target, targetPage, src, scale, palette = paperPalette()) {
  const tctx = target.getContext("2d");
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, target.width, target.height);
  tctx.setTransform(scale, 0, 0, scale, 0, 0);
  tctx.globalCompositeOperation = "source-over";
  tctx.fillStyle = palette.bg;
  tctx.fillRect(0, 0, targetPage.width, targetPage.height);
  const background = targetPage.background || {};
  if (background.type === "grid") drawDots(tctx, targetPage, palette.dot, 24);
  else if (background.type === "lines") drawRuled(tctx, targetPage, palette.line, 34);
  if (src) {
    const ratio = Math.min(targetPage.width / src.width, targetPage.height / src.height);
    const w = src.width * ratio;
    const h = src.height * ratio;
    tctx.drawImage(src, (targetPage.width - w) / 2, (targetPage.height - h) / 2, w, h);
  }
}

export function flattenPage(page, source, scale, palette) {
  const out = makeCanvas(page.width * scale, page.height * scale);
  const octx = out.getContext("2d");
  paintBackground(out, page, source, scale, palette);
  octx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const stroke of page.strokes) if (stroke.tool !== "highlight") drawStroke(octx, stroke);
  octx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const stroke of page.strokes) if (stroke.tool === "highlight") drawStroke(octx, stroke);
  return out;
}

export function createSurface({ canvas, stage, onBeforeChange, onChange, onTap, onZoom }) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  let page = null;
  let source = null;
  let tool = { name: "pen", color: "#111827", width: 2 };
  let zoom = 1;
  let cacheScale = 1;
  let bgCache = null;
  let inkCache = null;
  let hlCache = null;
  let live = null;
  let drawing = false;
  let erasing = false;
  let erased = false;
  let gesture = null;
  let frame = 0;
  let lastPenAt = 0;
  const pointers = new Map();

  function renderStrokesTo(target, strokes, scale) {
    const tctx = target.getContext("2d");
    tctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const stroke of strokes) drawStroke(tctx, stroke);
  }

  function rebuildInk() {
    if (!page) return;
    inkCache = makeCanvas(page.width * cacheScale, page.height * cacheScale);
    hlCache = makeCanvas(page.width * cacheScale, page.height * cacheScale);
    renderStrokesTo(inkCache, page.strokes.filter((s) => s.tool !== "highlight"), cacheScale);
    renderStrokesTo(hlCache, page.strokes.filter((s) => s.tool === "highlight"), cacheScale);
  }

  function compose() {
    if (!page) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = zoom * dpr;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    if (bgCache) ctx.drawImage(bgCache, 0, 0, bgCache.width, bgCache.height, 0, 0, page.width, page.height);
    if (inkCache) ctx.drawImage(inkCache, 0, 0, inkCache.width, inkCache.height, 0, 0, page.width, page.height);
    if (hlCache) {
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(hlCache, 0, 0, hlCache.width, hlCache.height, 0, 0, page.width, page.height);
      ctx.globalCompositeOperation = "source-over";
    }
    if (live) drawStroke(ctx, live);
  }

  function refresh() {
    if (!page) return;
    cacheScale = Math.min(3, dpr * Math.max(1, zoom));
    canvas.width = Math.round(page.width * zoom * dpr);
    canvas.height = Math.round(page.height * zoom * dpr);
    canvas.style.width = `${page.width * zoom}px`;
    canvas.style.height = `${page.height * zoom}px`;
    bgCache = makeCanvas(page.width * cacheScale, page.height * cacheScale);
    paintBackground(bgCache, page, source, cacheScale);
    rebuildInk();
    compose();
  }

  function repaintBackground() {
    if (!page) return;
    bgCache = makeCanvas(page.width * cacheScale, page.height * cacheScale);
    paintBackground(bgCache, page, source, cacheScale);
    compose();
  }

  function scheduleFrame() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      compose();
    });
  }

  function toPage(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
      p: pressureOf(event),
    };
  }

  function startGesture() {
    const [a, b] = [...pointers.values()];
    gesture = {
      startZoom: zoom,
      d0: Math.hypot(a.x - b.x, a.y - b.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
    };
  }

  function handleGesture() {
    if (!gesture || pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    stage.scrollLeft = gesture.scrollLeft - (midX - gesture.midX);
    stage.scrollTop = gesture.scrollTop - (midY - gesture.midY);
    if (distance > 0 && gesture.d0 > 0) {
      const next = clamp(gesture.startZoom * (distance / gesture.d0), 0.35, 3);
      if (Math.abs(next - zoom) / zoom > 0.03) {
        zoom = next;
        refresh();
        if (onZoom) onZoom(zoom);
      }
    }
  }

  function eraseAt(point) {
    const hits = page.strokes.filter((stroke) => strokeHit(stroke, point, tool.width + 4));
    if (!hits.length) return;
    if (!erased) {
      if (onBeforeChange) onBeforeChange();
      erased = true;
    }
    const ids = new Set(hits.map((stroke) => stroke.id));
    page.strokes = page.strokes.filter((stroke) => !ids.has(stroke.id));
    rebuildInk();
    scheduleFrame();
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === "mouse") return;
    if (event.pointerType === "touch" && performance.now() - lastPenAt < 700) return;
    if (event.pointerType === "pen") lastPenAt = performance.now();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      live = null;
      drawing = false;
      erasing = false;
      startGesture();
      compose();
      return;
    }
    if (pointers.size > 2 || !page) return;
    canvas.setPointerCapture(event.pointerId);
    if (tool.name === "text") {
      event.preventDefault();
      if (onTap) onTap(toPage(event));
      return;
    }
    if (tool.name === "eraser") {
      erasing = true;
      erased = false;
      eraseAt(toPage(event));
      return;
    }
    if (onBeforeChange) onBeforeChange();
    drawing = true;
    live = { id: `s${Date.now()}${Math.random().toString(16).slice(2)}`, tool: tool.name, color: tool.color, width: tool.width, points: [toPage(event)] };
    scheduleFrame();
  }

  function onPointerMove(event) {
    if (event.pointerType === "pen") lastPenAt = performance.now();
    const record = pointers.get(event.pointerId);
    if (record) {
      record.x = event.clientX;
      record.y = event.clientY;
    }
    if (gesture && pointers.size >= 2) {
      handleGesture();
      return;
    }
    if (erasing) {
      eraseAt(toPage(event));
      return;
    }
    if (!drawing || !live) return;
    if (SHAPE_TOOLS.has(live.tool)) {
      live.points = [live.points[0], toPage(event)];
    } else {
      const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
      for (const ev of events) live.points.push(toPage(ev));
    }
    scheduleFrame();
  }

  function finishPointer(event) {
    pointers.delete(event.pointerId);
    if (gesture && pointers.size < 2) gesture = null;
    if (erasing) {
      erasing = false;
      if (erased && onChange) onChange();
      return;
    }
    if (!drawing || !live) return;
    drawing = false;
    page.strokes.push(live);
    live = null;
    rebuildInk();
    compose();
    if (onChange) onChange();
  }

  function cancelPointer(event) {
    pointers.delete(event.pointerId);
    if (gesture && pointers.size < 2) gesture = null;
    if (drawing || erasing) {
      drawing = false;
      erasing = false;
      live = null;
      compose();
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", cancelPointer);

  const themeObserver = new MutationObserver(() => repaintBackground());
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return {
    setPage(nextPage, nextSource) {
      page = nextPage;
      source = nextSource || null;
      live = null;
      refresh();
    },
    setTool(nextTool) {
      tool = { ...tool, ...nextTool };
    },
    getTool() {
      return { ...tool };
    },
    setZoom(nextZoom) {
      zoom = clamp(nextZoom, 0.35, 3);
      refresh();
    },
    getZoom() {
      return zoom;
    },
    getPage() {
      return page;
    },
    refresh,
    refreshInk() {
      rebuildInk();
      compose();
    },
    flatten(scale, palette) {
      if (!page) return null;
      return flattenPage(page, source, scale, palette);
    },
    destroy() {
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", finishPointer);
      canvas.removeEventListener("pointercancel", cancelPointer);
    },
  };
}
