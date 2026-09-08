/**
 * chat.js
 * Floating AI-teacher chat widget (k-mentor), used on the homepage and the
 * tutorial page. Calls the /api/teacher endpoint on Kaushix API with the
 * running conversation history so the teacher keeps context between turns.
 */

import { renderMarkdown, initCopyButtons } from "./markdown.js";

const API_URL = "https://kaushix-api-service.onrender.com";
const ENDPOINT = "/api/teacher";

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
let streamTimer = null;

const NEAR_BOTTOM_PX = 90;
const STREAM_TICK_MS = 13;
const STREAM_CHUNK = 3;

if (el.launcher && el.panel) {
  init();
}

function init() {
  el.launcher.addEventListener("click", () => {
    const isOpen = el.panel.getAttribute("aria-hidden") === "false";
    isOpen ? closeChat() : openChat();
  });

  el.close.addEventListener("click", closeChat);

  el.clear.addEventListener("click", resetConversation);

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
/* Open / close                                                           */
/* --------------------------------------------------------------------- */

function openChat() {
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
  clearStream();
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

function addMessage(author, text, type) {
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
  } else {
    content.textContent = text;
  }
  stack.appendChild(content);

  if (type === "bot") {
    wrap.insertAdjacentHTML("afterbegin", avatarSvg());
  }
  wrap.appendChild(stack);

  el.body.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function addStreamingMessage() {
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
  content.innerHTML =
    '<span class="typing"><span></span><span></span><span></span></span>';
  stack.appendChild(content);

  wrap.insertAdjacentHTML("afterbegin", avatarSvg());
  wrap.appendChild(stack);

  el.body.appendChild(wrap);
  scrollToBottom();
  return { wrap, content };
}

function streamResponse(bot, fullText) {
  return new Promise((resolve) => {
    if (!fullText) {
      bot.content.innerHTML = renderMarkdown(fullText);
      bot.wrap.classList.remove("streaming");
      resolve();
      return;
    }

    setTimeout(() => {
      let index = 0;
      streamTimer = setInterval(() => {
        index += STREAM_CHUNK;
        bot.content.textContent = fullText.slice(0, index);
        scrollToBottom({ smooth: false });

        if (index >= fullText.length) {
          clearInterval(streamTimer);
          streamTimer = null;
          bot.content.innerHTML = renderMarkdown(fullText);
          initCopyButtons(bot.wrap);
          bot.wrap.classList.remove("streaming");
          scrollToBottom();
          resolve();
        }
      }, STREAM_TICK_MS);
    }, 450);
  });
}

function clearStream() {
  if (streamTimer) {
    clearInterval(streamTimer);
    streamTimer = null;
  }
}

function renderChips() {
  const wrap = document.createElement("div");
  wrap.className = "chat-chips";

  SUGGESTIONS.forEach((suggestion, index) => {
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

async function askTeacher(message) {
  const response = await fetch(API_URL.replace(/\/+$/, "") + ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

async function sendMessage(preset) {
  const message = (typeof preset === "string" ? preset : el.input.value).trim();

  if (!message || el.send.disabled) return;

  el.input.value = "";
  addMessage(USER_NAME, message, "user");
  scrollToBottom({ force: true });
  history.push({ role: "user", content: message });

  el.send.disabled = true;
  const bot = addStreamingMessage();

  try {
    const answer = await askTeacher(message);
    history.push({ role: "assistant", content: answer });
    await streamResponse(bot, answer);
  } catch (error) {
    console.error("Teacher chat error:", error);
    clearStream();
    bot.wrap.classList.remove("streaming");
    bot.wrap.classList.add("error");
    bot.content.textContent =
      `! Couldn't reach the teacher — ${error.message}. ` +
      "Check your connection and try again in a moment.";
    scrollToBottom();
  } finally {
    el.send.disabled = false;
    el.input.focus();
  }
}
