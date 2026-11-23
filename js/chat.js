/**
 * chat.js
 * Floating AI-teacher chat widget (k-mentor), used on every page. Streams
 * answers from the /api/teacher endpoint on Kaushix API and keeps a short
 * conversation history so the teacher stays context-aware between turns.
 */

import { renderMarkdown, initCopyButtons } from "./markdown.js";
import { initCodeFlows } from "./code-flow.js";
import { showToast } from "./effects.js";

const API_URL = "https://kaushix-api-service.onrender.com";
const ENDPOINT = "/api/teacher";
const HEALTH_ENDPOINT = "/api/health";
const REQUEST_TIMEOUT_MS = 15000;
const SLOW_HINT_MS = 2000;
const MAX_HISTORY_MESSAGES = 8;
const ANSWER_CACHE_KEY = "docnest.chat.answers.v1";
const MAX_CACHED_ANSWERS = 24;
const MAX_CACHED_LENGTH = 6000;

const TEACHER_NAME = "k-mentor";
const USER_NAME = "you";

const WELCOME =
  "Hi, I'm k-mentor — your AI teacher. Ask me anything about AI: how a " +
  "transformer works, what RAG actually is, or where to start learning.";

const SUGGESTIONS = [
  "Explain attention like I'm new to ML",
  "What's the difference between RAG and fine-tuning?",
  "Why do LLMs hallucinate?",
  "How do I start learning AI?",
];

const PERSONA_KEY = "docnest.persona";

const PERSONAS = {
  default: {
    label: "k-mentor",
    prefix: "",
    suggestions: SUGGESTIONS,
  },
  eli5: {
    label: "ELI5",
    prefix: "Explain your answer as if I'm five, with a simple everyday analogy.",
    suggestions: [
      "What is a neural network, simply?",
      "Why does an LLM need so much data?",
      "What is a token?",
    ],
  },
  engineer: {
    label: "Engineer",
    prefix: "Answer with precise technical detail, including tradeoffs and concrete examples.",
    suggestions: [
      "Compare RAG vs fine-tuning tradeoffs",
      "How does KV-cache work?",
      "When should I use an agent vs a chain?",
    ],
  },
  pirate: {
    label: "Pirate",
    prefix: "Answer in the voice of a friendly pirate, but keep the technical facts accurate.",
    suggestions: [
      "Explain transformers, matey",
      "What be retrieval-augmented generation?",
      "Why do LLMs make things up?",
    ],
  },
  haiku: {
    label: "Haiku",
    prefix: "Answer with a haiku followed by one short, plain-language explanation.",
    suggestions: [
      "What is attention?",
      "What is fine-tuning?",
      "What is an embedding?",
    ],
  },
};

const BUILTIN_ANSWERS = {
  default: [
    "**Attention is how a model decides which words matter most.**\n\n" +
      "Imagine reading *\"The cat sat on the mat because it was tired.\"* " +
      "To understand **\"it\"**, you look back at **\"cat\"**, not \"mat\". " +
      "Attention does that for every word, all at once.\n\n" +
      "- Each word asks: *which other words should I pay attention to?*\n" +
      "- It gets back a weighted mix of their meanings.\n" +
      "- Those weights are learned from lots of examples.\n\n" +
      "That's the whole move — a soft, learned *look here* signal. " +
      "Everything fancy in transformers is built on it.",
    "**RAG** gives the model fresh facts at question time. " +
      "**Fine-tuning** changes the model so it behaves differently all the time.\n\n" +
      "| | RAG | Fine-tuning |\n| --- | --- | --- |\n" +
      "| What changes | the context you pass in | the model's weights |\n" +
      "| Good for | facts, documents, recency | style, format, behaviour |\n" +
      "| Update cost | cheap — edit the docs | expensive — retrain |\n\n" +
      "**Rule of thumb:** if the answer depends on information that changes, " +
      "use RAG. If it depends on *how* the model answers, fine-tune. " +
      "Many real systems use both.",
    "Because language models are trained to produce **plausible next tokens**, " +
      "not to check facts.\n\n" +
      "- They have no built-in database of truth.\n" +
      "- Their knowledge is compressed into weights, so details get blurry.\n" +
      "- Nothing in the basic training loop says *\"I don't know.\"*\n\n" +
      "So when a question lands in a fuzzy corner, the model still completes " +
      "the pattern — fluently and confidently.\n\n" +
      "**To reduce it:** use retrieval (RAG), ask for citations and uncertainty, " +
      "lower the temperature, and verify anything high-stakes.",
    "A practical path, in order:\n\n" +
      "1. **Python + a little linear algebra** — vectors, matrices, dot products.\n" +
      "2. **How models learn** — loss, gradient descent, train/test split. " +
      "Scikit-learn is a great first stop.\n" +
      "3. **Neural networks** — backprop, then PyTorch or TensorFlow.\n" +
      "4. **Transformers** — attention, tokenization, then the original " +
      "*Attention Is All You Need* paper.\n" +
      "5. **Build something small end to end** — a classifier, a RAG bot, " +
      "a tiny fine-tune.\n\n" +
      "Don't collect courses. Ship one small project per topic and the pieces click.",
  ],
  eli5: [
    "It's a team of tiny helpers passing notes.\n\n" +
      "Each helper looks at one little bit of the problem, taps the next helper " +
      "on the shoulder, and says *\"I think this part matters.\"*<br>\n" +
      "The last helper gives the final answer.<br>\n" +
      "The team gets better by practising — every time it's wrong, everyone " +
      "turns their note up or down a little.\n\n" +
      "That's it: lots of tiny helpers, lots of practice.",
    "Think of learning to recognise dogs.\n\n" +
      "If you only see three dogs, you might decide *\"dogs are brown.\"* " +
      "See a million and you learn what makes a dog a dog — whatever its " +
      "colour, size, or pose.<br>\n" +
      "An LLM is doing that trick for **all of language**, so it needs a " +
      "huge pile of examples to spot every pattern.",
    "A token is a tiny Lego brick of text.\n\n" +
      "The word \"cat\" might be one brick. \"Unbelievable\" might be three: " +
      "\"un\", \"believ\", \"able\".<br>\n" +
      "The AI doesn't read words — it reads bricks, one at a time, and " +
      "guesses which brick comes next.",
  ],
  engineer: [
    "**RAG** and **fine-tuning** solve different problems.\n\n" +
      "- **RAG** externalizes knowledge: index documents, retrieve top-k at " +
      "query time, inject into context. Fresh data, citations, cheap updates. " +
      "Retrieval quality becomes your bottleneck, plus extra latency.\n" +
      "- **Fine-tuning** changes weights: durable behaviour and smaller " +
      "inference prompts. But it costs retraining, has no source attribution, " +
      "and can forget old skills.\n\n" +
      "**Decision rule:** knowledge changes → RAG. Behaviour or output shape " +
      "changes → fine-tuning. Most production systems use both — fine-tune " +
      "the style, retrieve the facts.",
    "During autoregressive decoding, each new token would otherwise recompute " +
      "attention over every previous token. The **KV-cache** stores each " +
      "layer's key and value projections so they are computed once.\n\n" +
      "- Without cache: O(n²) work per sequence, repeated every step.\n" +
      "- With cache: O(n) work per new token; memory grows with " +
      "n × layers × heads × d_head.\n\n" +
      "The tradeoff is memory: batch × sequence length drives cache size, " +
      "which is why long contexts need quantization, paging (PagedAttention), " +
      "or offloading. Prefix caching only helps when prompts share an exact prefix.",
    "A **chain** is a fixed graph: A → B → C. An **agent** picks the next step " +
      "at runtime.\n\n" +
      "Use a **chain** when the path is known, latency matters, and you want " +
      "determinism. Use an **agent** when the next action depends on " +
      "intermediate results — variable tool use, search, retries, branching.\n\n" +
      "Agents cost more tokens and are harder to debug. Mitigate with step " +
      "limits, tool allowlists, structured outputs, and traces.\n\n" +
      "**Default to a chain.** Promote to an agent only when you can name the " +
      "specific uncertainty it resolves.",
  ],
  pirate: [
    "Ahoy! A transformer be a ship that reads a whole sentence at once, " +
      "not one word at a time like them old recitation engines.<br>\n" +
      "Every word sends out a wee spyglass called a **query**, and every " +
      "other word holds up a lantern called a **key**. The query finds the " +
      "brightest lanterns — that be **attention**, savvy?<br>\n" +
      "Then it hauls aboard the matching cargo, the **values**, and charts " +
      "the next word. Stack a few decks o' that and ye have a proper " +
      "language vessel.",
    "RAG be like sendin' yer deckhand to the library before ye answer.<br>\n" +
      "First ye stow the documents in the hold — that's the index. When a " +
      "question arrives, yer deckhand fetches the few scrolls that match, " +
      "and the teacher reads those while craftin' the reply.<br>\n" +
      "Fresh facts, no guesswork, and ye can name the very page ye stole " +
      "'em from. Arrr.",
    "Because a language model be a storyteller, not a librarian, me hearty.<br>\n" +
      "It be trained to guess the next word — not to check the logbooks. " +
      "When it can't recall a fact, it still hoists a tale with a confident " +
      "flag, since smooth-sailin' words score well in trainin'.<br>\n" +
      "So trust but verify, Cap'n. Demand citations and keep a lantern handy.",
  ],
  haiku: [
    "Words glance at words,<br>\n" +
      "weights glow where the meaning sits —<br>\n" +
      "context finds its shape.\n\n" +
      "**In plain words:** attention lets each word look at the other words " +
      "and decide which ones matter for understanding it.",
    "A skilled hand reshapes<br>\n" +
      "the vessel for a new task —<br>\n" +
      "same hull, sharper course.\n\n" +
      "**In plain words:** fine-tuning trains an existing model a little more " +
      "on your own data, so it gets better at your particular job.",
    "A word becomes a point,<br>\n" +
      "meaning measured in distance —<br>\n" +
      "near things cluster close.\n\n" +
      "**In plain words:** an embedding turns text into numbers so that " +
      "similar ideas end up near each other in a big space.",
  ],
};

const TYPING_HTML =
  '<span class="chat-thinking">' +
  '<span class="typing"><span></span><span></span><span></span></span>' +
  '<span class="typing-text">thinking</span>' +
  "</span>";
const TIMING_MARKS = ["send", "firstChunk", "done"];

function readPersona() {
  try {
    const stored = localStorage.getItem(PERSONA_KEY);
    return PERSONAS[stored] ? stored : "default";
  } catch {
    return "default";
  }
}

function writePersona(id) {
  try {
    localStorage.setItem(PERSONA_KEY, id);
  } catch {
    /* storage unavailable — persona stays for this session */
  }
}

let persona = readPersona();

function emptySuggestions() {
  return PERSONAS[persona].suggestions;
}

function answerKey(id, question) {
  return `${id}\u0000${question}`;
}

function loadAnswerCache() {
  try {
    const raw = localStorage.getItem(ANSWER_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

let answerCache = loadAnswerCache();

function persistAnswerCache() {
  try {
    localStorage.setItem(ANSWER_CACHE_KEY, JSON.stringify(answerCache));
  } catch {
  }
}

function builtInAnswer(id, question) {
  const list = BUILTIN_ANSWERS[id];
  if (!list) return null;
  const index = PERSONAS[id].suggestions.indexOf(question);
  return index >= 0 && list[index] ? list[index] : null;
}

function getCachedAnswer(id, question) {
  const stored = answerCache[answerKey(id, question)];
  if (typeof stored === "string" && stored.trim()) return stored;
  return builtInAnswer(id, question);
}

function setCachedAnswer(id, question, text) {
  if (!text || !text.trim()) return;
  answerCache[answerKey(id, question)] = text.slice(0, MAX_CACHED_LENGTH);
  const keys = Object.keys(answerCache);
  if (keys.length > MAX_CACHED_ANSWERS) {
    keys.slice(0, keys.length - MAX_CACHED_ANSWERS).forEach((key) => {
      delete answerCache[key];
    });
  }
  persistAnswerCache();
}

const el = {
  launcher: document.getElementById("chat-launcher"),
  badge: document.getElementById("chat-badge"),
  panel: document.getElementById("chat-panel"),
  clear: document.getElementById("chat-clear"),
  close: document.getElementById("chat-close"),
  body: document.getElementById("chat-body"),
  input: document.getElementById("chat-input"),
  send: document.getElementById("chat-send"),
};

let history = [];
let firstOpen = true;
let warmupSent = false;
let slowHintTimer = null;
let activeAbort = null;
let requestCancelled = false;

const NEAR_BOTTOM_PX = 90;

if (el.launcher && el.panel) {
  init();
}

function init() {
  el.launcher.addEventListener("click", () => {
    const isOpen = el.panel.getAttribute("aria-hidden") === "false";
    isOpen ? closeChat() : openChat();
  });

  el.launcher.addEventListener("pointerenter", warmApi);
  el.launcher.addEventListener("focus", warmApi);

  el.close.addEventListener("click", closeChat);

  el.clear.addEventListener("click", resetConversation);

  initPersonaSelect();

  el.send.addEventListener("click", () => sendMessage());

  el.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.panel.getAttribute("aria-hidden") === "false") {
      closeChat();
      el.launcher.focus();
    }
  });

  // "Ask k-mentor" calls-to-action elsewhere on the page open the widget.
  document.querySelectorAll("[data-chat-scroll]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      if (el.panel.getAttribute("aria-hidden") !== "false") {
        openChat();
      }
    });
  });
}

/* --------------------------------------------------------------------- */
/* Warm-up and timing                                                     */
/* --------------------------------------------------------------------- */

function apiBase() {
  return API_URL.replace(/\/+$/, "");
}

function warmApi() {
  if (warmupSent) return;
  warmupSent = true;
  fetch(`${apiBase()}${HEALTH_ENDPOINT}`, { mode: "no-cors", keepalive: true }).catch(
    () => {}
  );
}

function mark(name) {
  try {
    performance.mark(`docnest.chat.${name}`);
  } catch {
    /* timing unavailable */
  }
}

function resetMarks() {
  try {
    TIMING_MARKS.forEach((name) => performance.clearMarks(`docnest.chat.${name}`));
  } catch {
    /* timing unavailable */
  }
}

function logTiming() {
  try {
    const marks = TIMING_MARKS.map((name) =>
      performance.getEntriesByName(`docnest.chat.${name}`).pop()
    );
    if (!marks[0] || !marks[2]) return;
    console.debug("k-mentor timing", {
      firstChunkMs: marks[1]
        ? Math.round(marks[1].startTime - marks[0].startTime)
        : null,
      totalMs: Math.round(marks[2].startTime - marks[0].startTime),
    });
  } catch {
    /* timing unavailable */
  }
}

function showSlowHint(bot) {
  clearSlowHint();
  slowHintTimer = setTimeout(() => {
    if (bot.wrap.classList.contains("streaming")) {
      bot.content.textContent = "waking up k-mentor…";
    }
  }, SLOW_HINT_MS);
}

function clearSlowHint() {
  if (slowHintTimer) clearTimeout(slowHintTimer);
  slowHintTimer = null;
}

function abortActiveRequest() {
  requestCancelled = true;
  if (activeAbort) activeAbort.abort();
  activeAbort = null;
  clearSlowHint();
}

function pushHistory(entry) {
  history.push(entry);
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES);
  }
}

async function withRetry(task, reset) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    reset();
    const controller = new AbortController();
    activeAbort = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await task(controller.signal);
    } catch (error) {
      const retryable =
        !requestCancelled &&
        attempt === 0 &&
        (error.name === "AbortError" || /API error 5\d\d/.test(error.message));
      if (!retryable) throw error;
    } finally {
      clearTimeout(timeout);
      if (activeAbort === controller) activeAbort = null;
    }
  }
  throw new Error("Request failed");
}

/* --------------------------------------------------------------------- */
/* Persona                                                                */
/* --------------------------------------------------------------------- */

function initPersonaSelect() {
  const header = el.panel.querySelector(".chat-panel-header");
  if (!header || header.querySelector(".chat-persona")) return;

  const select = document.createElement("select");
  select.className = "chat-persona";
  select.setAttribute("aria-label", "k-mentor persona");
  Object.entries(PERSONAS).forEach(([id, p]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = p.label;
    select.appendChild(option);
  });
  select.value = persona;
  select.addEventListener("change", () => {
    persona = PERSONAS[select.value] ? select.value : "default";
    writePersona(persona);
    renderChips();
    showToast(`k-mentor persona — ${PERSONAS[persona].label}`);
  });

  const actions = header.querySelector(".chat-header-actions");
  if (actions) header.insertBefore(select, actions);
  else header.appendChild(select);
}

/* --------------------------------------------------------------------- */
/* Open / close                                                           */
/* --------------------------------------------------------------------- */

function openChat() {
  warmApi();
  el.panel.setAttribute("aria-hidden", "false");
  el.launcher.setAttribute("aria-expanded", "true");
  el.launcher.classList.add("active");

  if (firstOpen) {
    firstOpen = false;
    hideBadge();
    addMessage(TEACHER_NAME, WELCOME, "bot");
    renderChips();
  }

  el.input.focus();
}

function closeChat() {
  el.panel.setAttribute("aria-hidden", "true");
  el.launcher.setAttribute("aria-expanded", "false");
  el.launcher.classList.remove("active");
}

function resetConversation() {
  abortActiveRequest();
  history = [];
  el.body.innerHTML = "";
  addMessage(TEACHER_NAME, WELCOME, "bot");
  renderChips();
  el.send.disabled = false;
  el.input.focus();
}

function hideBadge() {
  if (el.badge) el.badge.hidden = true;
}

/* --------------------------------------------------------------------- */
/* Rendering                                                              */
/* --------------------------------------------------------------------- */

function avatarSvg() {
  return `
    <span class="chat-avatar" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 9L12 4 2 9l10 5 10-5z"/>
        <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>
        <path d="M22 9v5"/>
      </svg>
    </span>`;
}

function revealMessage(wrap) {
  const content = wrap.querySelector(".chat-msg-content");
  if (!content || !content.children.length) return;
  Array.from(content.children).forEach((child, index) => {
    child.style.setProperty("--i", index);
  });
  wrap.classList.add("reveal");
}

function revealWords(wrap) {
  const content = wrap.querySelector(".chat-msg-content");
  if (!content) return 0;

  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest("pre, code, table, .code-block, .copy-btn")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let count = 0;
  nodes.forEach((node) => {
    const fragment = document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }
      const span = document.createElement("span");
      span.className = "chat-word";
      span.style.setProperty("--i", count++);
      span.textContent = part;
      fragment.appendChild(span);
    });
    node.parentNode.replaceChild(fragment, node);
  });

  if (!count) return 0;
  const step = Math.max(10, Math.min(48, Math.round(3200 / count)));
  content.style.setProperty("--step", `${step}ms`);
  wrap.classList.add("reveal-words");
  return count * step + 760;
}

function scrollToMessage(wrap) {
  if (!wrap) return;
  const bodyTop = el.body.getBoundingClientRect().top;
  const nodeTop = wrap.getBoundingClientRect().top;
  const target = el.body.scrollTop + (nodeTop - bodyTop) - 10;
  const max = el.body.scrollHeight - el.body.clientHeight;
  el.body.scrollTo({
    top: Math.max(0, Math.min(target, max)),
    behavior: "smooth",
  });
}

function addMessage(author, text, type, { scroll = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `chat-msg ${type}`;

  const stack = document.createElement("div");
  stack.className = "chat-msg-stack";

  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = author;
  stack.appendChild(label);

  const content = document.createElement("div");
  content.className = "chat-msg-content";

  if (type === "bot") {
    content.innerHTML = renderMarkdown(text);
    initCopyButtons(wrap);
    initCodeFlows(wrap);
  } else {
    content.textContent = text;
  }
  stack.appendChild(content);

  if (type === "bot") {
    wrap.insertAdjacentHTML("afterbegin", avatarSvg());
  }
  wrap.appendChild(stack);

  el.body.appendChild(wrap);
  if (type === "bot") revealMessage(wrap);
  if (scroll) scrollToBottom();
  return wrap;
}

function addStreamingMessage({ scroll = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg bot streaming";

  const stack = document.createElement("div");
  stack.className = "chat-msg-stack";

  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = TEACHER_NAME;
  stack.appendChild(label);

  const content = document.createElement("div");
  content.className = "chat-msg-content";
  content.innerHTML = TYPING_HTML;
  stack.appendChild(content);

  wrap.insertAdjacentHTML("afterbegin", avatarSvg());
  wrap.appendChild(stack);

  el.body.appendChild(wrap);
  if (scroll) scrollToBottom();
  return { wrap, content };
}

function finishStream(bot, answer, { reveal = false } = {}) {
  bot.content.innerHTML = renderMarkdown(answer);
  initCopyButtons(bot.wrap);
  initCodeFlows(bot.wrap);
  bot.wrap.classList.remove("streaming");
  if (reveal) revealWords(bot.wrap);
  scrollToBottom();
}

function addCachedMessage(text, onRefresh) {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg bot cached";

  const stack = document.createElement("div");
  stack.className = "chat-msg-stack";

  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = TEACHER_NAME;
  stack.appendChild(label);

  const content = document.createElement("div");
  content.className = "chat-msg-content";
  content.innerHTML = renderMarkdown(text);
  stack.appendChild(content);

  const note = document.createElement("div");
  note.className = "chat-cached-note";

  const tag = document.createElement("span");
  tag.className = "chat-cached-label";
  tag.textContent = "Cached answer";

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "chat-cached-refresh";
  refresh.textContent = "Refresh";
  refresh.addEventListener("click", onRefresh);

  note.append(tag, refresh);
  stack.appendChild(note);

  wrap.insertAdjacentHTML("afterbegin", avatarSvg());
  wrap.appendChild(stack);
  el.body.appendChild(wrap);
  initCopyButtons(wrap);
  initCodeFlows(wrap);
  const duration = revealWords(wrap);
  note.style.setProperty("--note-delay", `${Math.min(3600, duration + 120)}ms`);
  return { wrap, content, note, tag, refresh };
}

function renderChips() {
  el.body.querySelectorAll(".chat-chips").forEach((node) => node.remove());

  const wrap = document.createElement("div");
  wrap.className = "chat-chips";

  emptySuggestions().forEach((suggestion, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chat-chip";
    chip.style.setProperty("--i", index);
    chip.textContent = suggestion;
    chip.addEventListener("click", () => sendMessage(suggestion));
    wrap.appendChild(chip);
  });

  el.body.appendChild(wrap);
  scrollToBottom();
}

function scrollToBottom({ force = false, smooth = true } = {}) {
  if (!force && !isNearBottom()) return;
  el.body.scrollTo({
    top: el.body.scrollHeight,
    behavior: smooth ? "smooth" : "instant",
  });
}

function isNearBottom() {
  return (
    el.body.scrollHeight - el.body.scrollTop - el.body.clientHeight <=
    NEAR_BOTTOM_PX
  );
}

/* --------------------------------------------------------------------- */
/* API + send                                                             */
/* --------------------------------------------------------------------- */

async function askTeacher(message, signal) {
  const response = await fetch(`${apiBase()}${ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

async function openTeacherStream(message, signal) {
  const response = await fetch(`${apiBase()}${ENDPOINT}?stream=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("Streaming unavailable");
  }
  return response;
}

async function readEventStream(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let finished = false;

  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (!finished) {
      const boundary = buffer.match(/\r?\n\r?\n/);
      if (!boundary) break;

      const raw = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);

      for (const line of raw.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;

        if (payload === "[DONE]") {
          finished = true;
          break;
        }

        let frame;
        try {
          frame = JSON.parse(payload);
        } catch {
          continue;
        }

        if (frame.error) {
          throw new Error(String(frame.error));
        }
        if (typeof frame.content === "string" && frame.content) {
          fullText += frame.content;
          onDelta(fullText);
        }
      }
    }
  }

  return fullText;
}

async function streamTeacher(message, signal, onDelta) {
  const response = await openTeacherStream(message, signal);
  return readEventStream(response, onDelta);
}

async function sendMessage(preset, { forceLive = false, target = null } = {}) {
  const message = (typeof preset === "string" ? preset : el.input.value).trim();

  if (!message || el.send.disabled) return;

  const isSuggestion = PERSONAS[persona].suggestions.includes(message);
  const cached = forceLive ? null : getCachedAnswer(persona, message);

  el.input.value = "";

  if (cached) {
    addMessage(USER_NAME, message, "user", { scroll: false });
    pushHistory({ role: "user", content: message });
    const bubble = addCachedMessage(cached, () => {
      sendMessage(message, { forceLive: true, target: bubble });
    });
    pushHistory({ role: "assistant", content: cached });
    requestAnimationFrame(() => scrollToMessage(bubble.wrap));
    return;
  }

  if (!target) {
    addMessage(USER_NAME, message, "user", { scroll: false });
    pushHistory({ role: "user", content: message });
  }

  const prefix = PERSONAS[persona].prefix;
  const outgoing = prefix ? `${prefix}\n\n${message}` : message;

  requestCancelled = false;
  resetMarks();
  mark("send");

  el.send.disabled = true;
  const bot = target || addStreamingMessage({ scroll: false });
  if (!target) scrollToBottom({ force: true, smooth: false });
  if (target) {
    bot.wrap.classList.add("streaming");
    bot.wrap.classList.remove("error");
    bot.tag.textContent = "Fetching a fresh answer…";
    bot.refresh.disabled = true;
  }
  showSlowHint(bot);

  let firstDelta = false;
  let pendingText = null;
  let flushFrame = null;

  const cancelStreamFlush = () => {
    if (flushFrame) cancelAnimationFrame(flushFrame);
    flushFrame = null;
    pendingText = null;
  };

  const flushStream = () => {
    flushFrame = null;
    if (pendingText === null) return;
    bot.content.innerHTML = renderMarkdown(pendingText);
    pendingText = null;
    scrollToBottom({ smooth: false });
  };

  const resetBot = () => {
    firstDelta = false;
    cancelStreamFlush();
    bot.wrap.classList.add("streaming");
    bot.content.innerHTML = TYPING_HTML;
    clearSlowHint();
    showSlowHint(bot);
  };

  const onDelta = (fullText) => {
    if (!firstDelta) {
      firstDelta = true;
      mark("firstChunk");
      clearSlowHint();
    }
    pendingText = fullText;
    if (!flushFrame) flushFrame = requestAnimationFrame(flushStream);
  };

  try {
    let answer;
    try {
      answer = await withRetry(
        (signal) => streamTeacher(outgoing, signal, onDelta),
        resetBot
      );
      if (!answer || !answer.trim()) throw new Error("Empty stream response");
    } catch (streamError) {
      resetBot();
      answer = await withRetry((signal) => askTeacher(outgoing, signal), resetBot);
      onDelta(answer);
    }

    cancelStreamFlush();
    if (isSuggestion) setCachedAnswer(persona, message, answer);
    if (!target) pushHistory({ role: "assistant", content: answer });
    finishStream(bot, answer, { reveal: Boolean(target) });
    if (target) {
      bot.tag.textContent = "Live answer · cached";
      bot.refresh.disabled = false;
    }
    mark("done");
    logTiming();
  } catch (error) {
    if (requestCancelled) {
      if (target) {
        bot.tag.textContent = "Cached answer";
        bot.refresh.disabled = false;
      }
      return;
    }
    console.error("Teacher chat error:", error);
    cancelStreamFlush();
    clearSlowHint();
    bot.wrap.classList.remove("streaming");
    const fallback = target ? getCachedAnswer(persona, message) : null;
    if (fallback) {
      bot.content.innerHTML = renderMarkdown(fallback);
      bot.tag.textContent = "Cached answer";
    } else {
      bot.wrap.classList.add("error");
      bot.content.textContent =
        `! Couldn't reach the teacher — ${error.message}. ` +
        "Check your connection and try again in a moment.";
    }
    if (target) bot.refresh.disabled = false;
    scrollToBottom();
  } finally {
    clearSlowHint();
    el.send.disabled = false;
    el.input.focus();
  }
}
