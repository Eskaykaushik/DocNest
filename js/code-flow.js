import { initDiagrams } from "./diagram.js";

const SUPPORTED = {
  python: "python",
  py: "python",
  python3: "python",
  javascript: "javascript",
  js: "javascript",
  jsx: "javascript",
  typescript: "javascript",
  ts: "javascript",
  tsx: "javascript",
};

const MAX_NODES = 12;
const closeTimers = new WeakMap();

export function flowFromCode(code, language) {
  const lang = SUPPORTED[String(language || "").toLowerCase()];
  if (!lang) return null;

  const items = lang === "python" ? buildPython(code) : buildJavaScript(code);
  if (!items.length) return null;

  const builder = new FlowBuilder();
  emitList(items, builder);
  if (builder.nodes.length < 2) return null;

  return { source: builder.toMermaid(), steps: builder.nodes.length };
}

export function initCodeFlows(container = document) {
  if (!container || typeof container.querySelectorAll !== "function") return;

  if (typeof window.mermaid !== "object") {
    container.querySelectorAll(".flow-btn").forEach((button) => {
      button.hidden = true;
    });
    return;
  }

  container.querySelectorAll(".flow-btn:not([data-flow-bound])").forEach((button) => {
    button.dataset.flowBound = "true";
    button.addEventListener("click", () => toggleFlow(button));
  });
}

async function toggleFlow(button) {
  const block = button.closest(".code-block");
  const drawer = block?.querySelector(".code-flow");
  if (!block || !drawer) return;

  if (block.classList.contains("is-flow")) {
    closeFlow(button, drawer);
    return;
  }

  openFlow(button, drawer);
  if (drawer.dataset.ready === "true") {
    scheduleStageSync(drawer);
    return;
  }

  button.classList.add("is-loading");
  button.setAttribute("aria-busy", "true");
  drawer.classList.add("is-loading");

  const figure = drawer.querySelector(".code-flow-diagram");
  const count = drawer.querySelector(".code-flow-count");
  const flow = flowForBlock(block, button);

  if (!flow) {
    drawer.classList.remove("is-loading");
    if (count) count.textContent = "No steps found";
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
    drawer.dataset.ready = "true";
    scheduleStageSync(drawer);
    return;
  }

  if (count) count.textContent = `${flow.steps} steps`;
  figure.textContent = flow.source;

  await initDiagrams(drawer);

  drawer.classList.remove("is-loading");
  if (figure.querySelector("svg")) {
    drawer.classList.add("is-ready");
  } else {
    figure.textContent = "Could not draw this flow.";
    drawer.classList.add("is-error");
  }

  drawer.dataset.ready = "true";
  button.classList.remove("is-loading");
  button.removeAttribute("aria-busy");
  watchFlowSize(drawer);
  scheduleStageSync(drawer);
}

function openFlow(button, drawer) {
  const block = button.closest(".code-block");
  const stage = block.querySelector(".code-stage");
  const label = button.querySelector(".flow-label");
  const timer = closeTimers.get(stage);
  if (timer) clearTimeout(timer);

  stage.style.height = `${measureCodeHeight(stage)}px`;
  block.classList.add("is-flow");
  button.setAttribute("aria-pressed", "true");
  button.classList.add("is-open");
  button.title = "Back to code";
  if (label) label.textContent = "Code";
  drawer.setAttribute("aria-hidden", "false");
  drawer.inert = false;
}

function closeFlow(button, drawer) {
  const block = button.closest(".code-block");
  const stage = block.querySelector(".code-stage");
  const label = button.querySelector(".flow-label");

  stage.style.height = `${measureCodeHeight(stage)}px`;
  block.classList.remove("is-flow");
  button.setAttribute("aria-pressed", "false");
  button.classList.remove("is-open");
  button.title = "Show the execution flow";
  if (label) label.textContent = "Flow";
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;

  const timer = setTimeout(() => {
    if (!block.classList.contains("is-flow")) stage.style.height = "";
  }, 600);
  closeTimers.set(stage, timer);
}

function measureCodeHeight(stage) {
  const face = stage.querySelector(".code-face");
  if (!face) return Math.ceil(stage.getBoundingClientRect().height);

  const position = face.style.position;
  const transform = face.style.transform;
  face.style.position = "relative";
  face.style.transform = "none";
  const height = face.scrollHeight;
  face.style.position = position;
  face.style.transform = transform;
  return Math.ceil(height);
}

function measureFlowHeight(drawer) {
  const inner = drawer.querySelector(".code-flow-inner") || drawer;
  return Math.ceil(inner.scrollHeight);
}

function syncStageHeight(drawer) {
  const block = drawer.closest(".code-block");
  const stage = block?.querySelector(".code-stage");
  if (!block || !stage) return;
  const height = block.classList.contains("is-flow") ? measureFlowHeight(drawer) : measureCodeHeight(stage);
  stage.style.height = `${height}px`;
}

function scheduleStageSync(drawer) {
  requestAnimationFrame(() => requestAnimationFrame(() => syncStageHeight(drawer)));
}

function watchFlowSize(drawer) {
  if (drawer.dataset.flowObserved || typeof ResizeObserver !== "function") return;
  drawer.dataset.flowObserved = "true";

  const inner = drawer.querySelector(".code-flow-inner");
  if (!inner) return;

  new ResizeObserver(() => {
    if (drawer.closest(".code-block")?.classList.contains("is-flow")) syncStageHeight(drawer);
  }).observe(inner);
}

function flowForBlock(block, button) {
  const code = block.querySelector("pre code");
  if (!code) return null;
  return flowFromCode(code.textContent, button.dataset.flowLang);
}

class FlowBuilder {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.groups = [];
    this.stack = [];
    this.count = 0;
    this.truncated = false;
  }

  group() {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  }

  add(shape, label) {
    this.count += 1;
    const id = `n${this.count}`;
    this.nodes.push({ id, shape, label, group: this.group() });
    return id;
  }

  edge(from, to, label = "", dashed = false) {
    if (!from || !to || from === to) return;
    this.edges.push({ from, to, label, dashed });
  }

  open(label) {
    const id = `g${this.groups.length + 1}`;
    this.groups.push({ id, label, parent: this.group() });
    this.stack.push(id);
    return id;
  }

  close() {
    this.stack.pop();
  }

  toMermaid() {
    const root = { nodes: [], groups: [] };
    const groups = new Map();

    for (const group of this.groups) {
      const next = { ...group, nodes: [], groups: [] };
      groups.set(group.id, next);
      if (group.parent && groups.has(group.parent)) {
        groups.get(group.parent).groups.push(next);
      } else {
        root.groups.push(next);
      }
    }

    for (const node of this.nodes) {
      if (node.group && groups.has(node.group)) {
        groups.get(node.group).nodes.push(node);
      } else {
        root.nodes.push(node);
      }
    }

    const lines = [
      "graph TD",
      '  %%{init: {"flowchart": {"rankSpacing": 10, "nodeSpacing": 16, "padding": 12}}}%%',
    ];
    root.nodes.forEach((node) => lines.push(`  ${nodeLine(node)}`));
    root.groups.forEach((group) => appendGroup(lines, group, 1));

    this.edges.forEach((edge) => {
      const arrow = edge.dashed ? "-.->" : "-->";
      const label = edge.label ? `|${escapeMermaid(edge.label)}|` : "";
      lines.push(`  ${edge.from} ${arrow}${label} ${edge.to}`);
    });

    return lines.join("\n");
  }
}

function appendGroup(lines, group, depth) {
  const pad = "  ".repeat(depth);
  lines.push(`${pad}subgraph ${group.id}["${escapeMermaid(compactLabel(group.label))}"]`);
  lines.push(`${pad}  direction TB`);
  group.nodes.forEach((node) => lines.push(`${pad}  ${nodeLine(node)}`));
  group.groups.forEach((child) => appendGroup(lines, child, depth + 1));
  lines.push(`${pad}end`);
}

function nodeLine(node) {
  const label = wrapLabel(node.label);
  if (node.shape === "decision") return `${node.id}{{"${label}"}}`;
  if (node.shape === "output") return `${node.id}[/"${label}"/]`;
  return `${node.id}("${label}")`;
}

function emitList(items, builder) {
  let entry = null;
  let exits = [];

  for (let index = 0; index < items.length; index += 1) {
    if (builder.count >= MAX_NODES) {
      if (exits.length && !builder.truncated) {
        builder.truncated = true;
        const id = builder.add("process", `… ${items.length - index} more`);
        if (!entry) entry = id;
        connect(exits, id, builder);
      }
      break;
    }

    const result = emitItem(items[index], builder);
    if (!result) continue;

    if (result.entry) {
      if (!entry) entry = result.entry;
      connect(exits, result.entry, builder);
      exits = result.exits;
    } else if (result.exits && result.exits.length) {
      exits = result.exits;
    }
  }

  return { entry, exits };
}

function emitItem(item, builder) {
  switch (item.type) {
    case "func":
    case "class":
      return emitDefinition(item, builder);
    case "if":
      return emitIf(item, builder);
    case "loop":
      return emitLoop(item, builder);
    case "try":
      return emitTry(item, builder);
    case "output": {
      const id = builder.add("output", item.label);
      return { entry: id, exits: item.terminal ? [] : [{ from: id }] };
    }
    default:
      return emitStep(item, builder);
  }
}

function emitStep(item, builder) {
  const id = builder.add("process", item.label);
  let exits = [{ from: id }];

  if (item.body && item.body.length) {
    const body = emitList(item.body, builder);
    if (body.entry) {
      builder.edge(id, body.entry);
      exits = body.exits;
    }
  }

  return { entry: id, exits };
}

function emitDefinition(item, builder) {
  if (!definitionHasFlow(item)) return { entry: null, exits: null };

  builder.open(compactLabel(item.label));
  emitList(item.body || [], builder);
  builder.close();

  return { entry: null, exits: null };
}

function emitIf(item, builder) {
  const id = builder.add("decision", item.label);
  const exits = [];
  let branched = false;

  if (item.body && item.body.length) {
    const body = emitList(item.body, builder);
    if (body.entry) {
      branched = true;
      builder.edge(id, body.entry, "yes");
      exits.push(...body.exits);
    }
  }
  if (!branched) exits.push({ from: id, label: "yes" });

  if (item.elseBody && item.elseBody.length) {
    const other = emitList(item.elseBody, builder);
    if (other.entry) {
      builder.edge(id, other.entry, "no");
      exits.push(...other.exits);
    } else {
      exits.push({ from: id, label: "no" });
    }
  } else {
    exits.push({ from: id, label: "no" });
  }

  return { entry: id, exits };
}

function emitLoop(item, builder) {
  const id = builder.add("decision", item.label);

  if (item.body && item.body.length) {
    const body = emitList(item.body, builder);
    if (body.entry) {
      builder.edge(id, body.entry, "yes");
      body.exits.forEach((exit) => builder.edge(exit.from, id, "repeat", true));
    }
  }

  return { entry: id, exits: [{ from: id, label: "no" }] };
}

function emitTry(item, builder) {
  const id = builder.add("process", item.label || "try");
  let exits = [];
  const body = emitList(item.body || [], builder);

  if (body.entry) {
    builder.edge(id, body.entry);
    exits = body.exits.slice();
  } else {
    exits.push({ from: id });
  }

  (item.catches || []).forEach((branch) => {
    const catchId = builder.add("process", branch.label);
    builder.edge(id, catchId, branch.edge || "error", branch.dashed !== false);
    const nested = emitList(branch.body || [], builder);
    if (nested.entry) {
      builder.edge(catchId, nested.entry);
      exits.push(...nested.exits);
    } else {
      exits.push({ from: catchId });
    }
  });

  if (item.finallyBody && item.finallyBody.length) {
    const finalId = builder.add("process", "finally");
    exits.forEach((exit) => builder.edge(exit.from, finalId, exit.label, exit.dashed));
    const nested = emitList(item.finallyBody, builder);
    if (nested.entry) {
      builder.edge(finalId, nested.entry);
      exits = nested.exits;
    } else {
      exits = [{ from: finalId }];
    }
  }

  return { entry: id, exits };
}

function connect(exits, to, builder) {
  exits.forEach((exit) => builder.edge(exit.from, to, exit.label, exit.dashed));
}

function definitionHasFlow(item) {
  const body = item.body || [];
  if (item.type === "class" && !body.some((child) => child.type === "func")) return false;
  return body.some((child) => hasFlow(child));
}

function hasFlow(item) {
  if (item.type === "func" || item.type === "class") return definitionHasFlow(item);
  return true;
}

function buildPython(code) {
  const entries = pythonEntries(code);
  if (!entries.length) return [];

  let index = 0;
  let baseIndent = entries[0].indent;
  entries.forEach((entry) => {
    if (entry.indent < baseIndent) baseIndent = entry.indent;
  });

  function parseBody(parentIndent) {
    const next = entries[index];
    if (!next || next.indent <= parentIndent) return [];
    return buildBlock(next.indent);
  }

  function parseIfChain(item, indent) {
    let tail = item;
    while (index < entries.length && entries[index].indent === indent) {
      const text = entries[index].text;
      if (/^elif\b/.test(text)) {
        index += 1;
        const branch = classifyPython(text);
        branch.body = parseBody(indent);
        tail.elseBody = [branch];
        tail = branch;
        continue;
      }
      if (/^else\b/.test(text)) {
        index += 1;
        tail.elseBody = parseBody(indent);
        break;
      }
      break;
    }
  }

  function parseTryChain(item, indent) {
    while (index < entries.length && entries[index].indent === indent) {
      const text = entries[index].text;
      if (/^except\b/.test(text)) {
        index += 1;
        item.catches.push({
          label: pythonLabel(text),
          body: parseBody(indent),
          edge: "error",
          dashed: true,
        });
        continue;
      }
      if (/^else\b/.test(text)) {
        index += 1;
        item.catches.push({
          label: "else",
          body: parseBody(indent),
          edge: "ok",
          dashed: false,
        });
        continue;
      }
      if (/^finally\b/.test(text)) {
        index += 1;
        item.finallyBody = parseBody(indent);
        break;
      }
      break;
    }
  }

  function buildBlock(indent) {
    const items = [];

    while (index < entries.length) {
      const entry = entries[index];
      if (entry.indent < indent) break;
      if (entry.indent > indent) {
        index += 1;
        continue;
      }

      index += 1;
      const item = classifyPython(entry.text);
      if (!item) continue;

      if (item.body) {
        item.body = parseBody(indent);
        if (item.type === "if") parseIfChain(item, indent);
        if (item.type === "try") parseTryChain(item, indent);
      }

      items.push(item);
    }

    return items;
  }

  return buildBlock(baseIndent);
}

function pythonEntries(code) {
  const src = String(code || "").replace(/\r\n?/g, "\n");
  const entries = [];
  let buffer = "";
  let indent = 0;
  let lineIndent = 0;
  let started = false;
  let depth = 0;
  let triple = null;
  let i = 0;

  function flush() {
    const text = collapse(buffer);
    const nextIndent = lineIndent;
    buffer = "";
    indent = 0;
    lineIndent = 0;
    started = false;
    depth = 0;

    if (!text) return;
    if (text.startsWith("#")) return;
    if (text.startsWith("@")) return;
    if (/^[rRbBuUfF]{0,3}("""|''')/.test(text)) return;
    entries.push({ indent: nextIndent, text });
  }

  while (i < src.length) {
    const ch = src[i];

    if (ch === "\n") {
      if (triple) {
        buffer += "\n";
        i += 1;
        continue;
      }
      if (depth > 0) {
        buffer += " ";
        i += 1;
        continue;
      }
      flush();
      i += 1;
      continue;
    }

    if (!started) {
      if (ch === " " || ch === "\t") {
        indent += ch === "\t" ? 4 : 1;
        i += 1;
        continue;
      }
      started = true;
      lineIndent = indent;
    }

    if (!triple && ch === "#") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }

    if (triple) {
      if (src.startsWith(triple, i)) {
        buffer += triple;
        triple = null;
        i += 3;
        continue;
      }
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const three = src.slice(i, i + 3);
      if (three === '"""' || three === "'''") {
        triple = three;
        buffer += three;
        i += 3;
        continue;
      }

      const quote = ch;
      buffer += ch;
      i += 1;
      while (i < src.length) {
        const current = src[i];
        if (current === "\\") {
          buffer += current;
          if (i + 1 < src.length) buffer += src[i + 1];
          i += 2;
          continue;
        }
        buffer += current;
        i += 1;
        if (current === quote || current === "\n") break;
      }
      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") {
      depth += 1;
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
      buffer += ch;
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return entries;
}

function classifyPython(text) {
  const value = text.replace(/:\s*$/, "").trim();
  if (!value) return null;

  if (/^(async\s+def|def)\b/.test(value)) return pythonNode("func", pythonFunctionLabel(value));
  if (/^class\b/.test(value)) return pythonNode("class", pythonClassLabel(value));
  if (/^if\b/.test(value)) return pythonNode("if", value);
  if (/^(async\s+for|for|while)\b/.test(value)) return pythonNode("loop", value);
  if (/^(async\s+with|with)\b/.test(value)) return pythonNode("step", value);
  if (/^match\b/.test(value)) return pythonNode("step", value);
  if (/^try\b/.test(value)) {
    return { type: "try", label: "try", body: [], catches: [], finallyBody: [] };
  }
  if (/^(import|from)\b/.test(value)) return null;
  if (/^(pass|break|continue|del|global|nonlocal)\b/.test(value)) return null;
  if (literalAssignment(value)) return null;

  if (/^(return|yield|raise)\b/.test(value)) {
    return { type: "output", label: compactLabel(value), terminal: true };
  }
  if (/^(print|pprint)\s*\(/.test(value)) {
    return { type: "output", label: compactLabel(value), terminal: false };
  }

  return { type: "step", label: compactLabel(value), terminal: false };
}

function pythonLabel(text) {
  return compactLabel(text.replace(/:\s*$/, "").trim());
}

function pythonFunctionLabel(text) {
  const match = text.match(/^(async\s+def|def)\s+([A-Za-z_]\w*)\s*\(([\s\S]*)\)/);
  if (!match) return pythonLabel(text);

  const prefix = match[1] === "def" ? "def" : "async def";
  const name = match[2];
  const full = `${prefix} ${name}(${collapse(match[3])})`;
  return full.length <= 48 ? full : `${prefix} ${name}(…)`;
}

function pythonClassLabel(text) {
  const match = text.match(/^class\s+([A-Za-z_]\w*)/);
  if (!match) return pythonLabel(text);
  const full = pythonLabel(text);
  return full.length <= 48 ? full : `class ${match[1]}`;
}

function pythonNode(type, label) {
  const item = { type, label: pythonLabel(label), body: [] };
  if (type === "if") item.elseBody = [];
  return item;
}

function buildJavaScript(code) {
  const src = String(code || "").replace(/\r\n?/g, "\n");
  const root = [];
  const stack = [{ items: root }];
  let buffer = "";
  let parens = 0;
  let brackets = 0;
  let literal = 0;
  let i = 0;

  function current() {
    return stack[stack.length - 1].items;
  }

  function flush() {
    const text = collapse(buffer);
    buffer = "";
    if (!text) return;
    const item = classifyJavaScript(text);
    if (item) current().push(item);
  }

  while (i < src.length) {
    const ch = src[i];

    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      const string = readJsString(src, i);
      buffer += string.text;
      i = string.end;
      continue;
    }

    if (ch === "(") {
      parens += 1;
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === ")") {
      parens = Math.max(0, parens - 1);
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === "[") {
      brackets += 1;
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === "]") {
      brackets = Math.max(0, brackets - 1);
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === "{") {
      const header = collapse(buffer);
      if (parens === 0 && brackets === 0 && literal === 0 && isBlockHeader(header)) {
        buffer = "";
        const item = classifyJavaScriptHeader(header);
        if (item) {
          attachJavaScript(current(), item);
          stack.push(item.body ? { items: item.body } : { items: current() });
        } else {
          stack.push({ items: current() });
        }
        i += 1;
        continue;
      }
      literal += 1;
      buffer += ch;
      i += 1;
      continue;
    }

    if (ch === "}") {
      if (literal > 0) {
        literal -= 1;
        buffer += ch;
        i += 1;
        continue;
      }
      flush();
      if (stack.length > 1) stack.pop();
      i += 1;
      continue;
    }

    if (ch === ";" && parens === 0 && brackets === 0 && literal === 0) {
      flush();
      i += 1;
      continue;
    }

    buffer += ch === "\n" ? " " : ch;
    i += 1;
  }

  flush();
  return root;
}

function readJsString(src, start) {
  const quote = src[start];
  let i = start + 1;
  let text = quote;

  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      text += ch;
      if (i + 1 < src.length) text += src[i + 1];
      i += 2;
      continue;
    }
    text += ch;
    i += 1;
    if (ch === quote) break;
  }

  return { text, end: i };
}

function isBlockHeader(header) {
  if (!header) return true;
  if (/^(if|for|while|switch|catch|else|try|finally|do)\b/.test(header)) return true;
  if (/\bfunction\b/.test(header)) return true;
  if (/\bclass\b/.test(header)) return true;
  if (/=>\s*$/.test(header)) return true;
  if (/^(?:async\s+)?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*$/.test(header)) return true;
  return false;
}

function classifyJavaScriptHeader(raw) {
  let text = collapse(raw);
  text = text.replace(/^export\s+(default\s+)?/, "");

  if (/^else\s+if\b/.test(text)) return jsControlNode("elseif", text, "else if");
  if (/^else$/.test(text)) return { type: "else", body: [] };
  if (/^catch\b/.test(text)) return { type: "catch", label: jsControlLabel(text, "catch"), body: [] };
  if (/^finally$/.test(text)) return { type: "finally", body: [] };
  if (/^try$/.test(text)) {
    return { type: "try", label: "try", body: [], catches: [], finallyBody: [] };
  }
  if (/^if\b/.test(text)) return jsControlNode("if", text, "if");
  if (/^(for|while|do)\b/.test(text)) {
    return { type: "loop", label: jsLoopLabel(text), body: [] };
  }
  if (/^switch\b/.test(text)) return { type: "step", label: jsControlLabel(text, "switch"), body: [] };
  if (/\bfunction\b/.test(text)) return { type: "func", label: jsFunctionLabel(text), body: [] };
  if (/^class\b/.test(text)) return { type: "class", label: compactLabel(text), body: [] };
  if (/=>\s*$/.test(text)) return { type: "func", label: compactLabel(text), body: [] };
  if (/^[A-Za-z_$][\w$]*\s*\([^)]*\)\s*$/.test(text)) {
    return { type: "func", label: compactLabel(text), body: [] };
  }

  return null;
}

function classifyJavaScript(raw) {
  let text = collapse(raw).replace(/;\s*$/, "").trim();
  if (!text) return null;

  const caseMatch = text.match(/^(case\b[^:]*|default)\s*:\s*/);
  if (caseMatch) {
    text = text.slice(caseMatch[0].length).trim();
    if (!text) return null;
  }

  if (/^["']use strict["']$/.test(text)) return null;
  if (/^(import|export)\b/.test(text) && !/\b(function|class)\b/.test(text)) return null;
  if (/^(break|continue|debugger)\b/.test(text)) return null;
  if (literalAssignment(text)) return null;

  if (/^(return|throw)\b/.test(text)) {
    return { type: "output", label: compactLabel(text), terminal: true };
  }
  if (/^(console\.(log|warn|error|info|debug)|print)\s*\(/.test(text)) {
    return { type: "output", label: compactLabel(text), terminal: false };
  }

  return { type: "step", label: compactLabel(text), terminal: false };
}

function attachJavaScript(items, item) {
  const previous = items[items.length - 1];

  if (item.type === "elseif") {
    const tail = ifTail(previous);
    if (tail) {
      tail.elseBody = [item];
      return;
    }
  }

  if (item.type === "else") {
    const tail = ifTail(previous);
    if (tail) {
      tail.elseBody = item.body || [];
      return;
    }
  }

  if (item.type === "catch" && previous && previous.type === "try") {
    previous.catches.push({ label: item.label, body: item.body || [] });
    return;
  }

  if (item.type === "finally" && previous && previous.type === "try") {
    previous.finallyBody = item.body || [];
    return;
  }

  items.push(item);
}

function ifTail(node) {
  let tail = node;
  while (tail && tail.type === "if") {
    if (!tail.elseBody || tail.elseBody.length === 0) return tail;
    const next = tail.elseBody[0];
    if (next && next.type === "if") {
      tail = next;
      continue;
    }
    return null;
  }
  return null;
}

function jsControlNode(type, text, keyword) {
  const item = { type, label: jsControlLabel(text, keyword), body: [] };
  if (type === "if" || type === "elseif") item.elseBody = [];
  return item;
}

function jsControlLabel(text, keyword) {
  const open = text.indexOf("(");
  const close = text.lastIndexOf(")");
  if (open === -1 || close <= open) return compactLabel(`${keyword} ${text}`);
  return compactLabel(`${keyword} ${text.slice(open + 1, close).trim()}`);
}

function jsLoopLabel(text) {
  if (/^do\b/.test(text)) return "do";
  const open = text.indexOf("(");
  const close = text.lastIndexOf(")");
  const inner = open === -1 || close <= open ? text : text.slice(open + 1, close);
  const kind = text.startsWith("while") ? "while" : "for";
  return compactLabel(`${kind} ${inner.replace(/^\s*(const|let|var)\s+/, "").trim()}`);
}

function jsFunctionLabel(text) {
  const match = text.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)/);
  if (!match) return compactLabel(text);

  const prefix = /^async\b/.test(text) ? "async function" : "function";
  const full = `${prefix} ${match[1]}(${collapse(match[2])})`;
  return full.length <= 48 ? full : `${prefix} ${match[1]}(…)`;
}

function literalAssignment(value) {
  const match = value.match(/^(?:(?:export|const|let|var)\s+)*[^=]+?=\s*([\s\S]+)$/);
  if (!match) return false;

  const rhs = match[1].trim();
  if (rhs.length < 32) return false;

  const quoted = /^[rRbBuUfF]{0,3}("""|'''|"|'|`)/.test(rhs) && /("""|'''|"|'|`)$/.test(rhs);
  const grouped = /^[\[{(]/.test(rhs) && /[\]})]$/.test(rhs);
  return quoted || grouped;
}

function collapse(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function compactLabel(text) {
  let value = collapse(text);

  if (value.length > 58) {
    const open = value.indexOf("(");
    const close = value.lastIndexOf(")");
    if (open > 0 && close - open > 24) {
      value = `${value.slice(0, open + 1)}…${value.slice(close)}`;
    }
  }

  if (value.length > 58) {
    const cut = value.slice(0, 55);
    value = `${cut.replace(/\s+\S*$/, "")}…`;
  }

  return value;
}

function wrapLabel(text) {
  const value = compactLabel(text);
  if (value.length <= 28) return escapeMermaid(value);

  const words = value.split(/\s+/);
  let split = -1;
  let best = Infinity;

  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(" ");
    if (left.length > 34) break;
    const distance = Math.abs(left.length - value.length / 2);
    if (distance < best) {
      best = distance;
      split = index;
    }
  }

  if (split === -1) return escapeMermaid(value);

  const first = words.slice(0, split).join(" ");
  let second = words.slice(split).join(" ");
  if (second.length > 34) {
    second = `${second.slice(0, 33).replace(/\s+\S*$/, "")}…`;
  }

  return `${escapeMermaid(first)}<br/>${escapeMermaid(second)}`;
}

function escapeMermaid(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
