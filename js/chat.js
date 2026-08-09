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
  widget: document.getElementById("chat-widget"),
  launcher: document.getElementById("chat-launcher"),
  panel: document.getElementById("chat-panel"),
  close: document.getElementById("chat-close"),
  body: document.getElementById("chat-body"),
  input: document.getElementById("chat-input"),
  send: document.getElementById("chat-send"),
};

let history = [];
let firstOpen = true;

if (el.launcher && el.panel) {
  init();
}

function init() {
  el.launcher.addEventListener("click", () => {
    const isOpen = el.panel.getAttribute("aria-hidden") === "false";
    isOpen ? closeChat() : openChat();
  });

  el.close.addEventListener("click", closeChat);

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

/* --------------------------------------------------------------------- */
/* Rendering                                                              */
/* --------------------------------------------------------------------- */

function addMessage(author, text, type) {
  const wrap = document.createElement("div");
  wrap.className = `chat-msg ${type}`;

  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = author;
  wrap.appendChild(label);

  if (type === "bot") {
    const content = document.createElement("div");
    content.className = "chat-msg-content";
    content.innerHTML = renderMarkdown(text);
    wrap.appendChild(content);
    initCopyButtons(wrap);
  } else {
    const content = document.createElement("div");
    content.className = "chat-msg-content";
    content.textContent = text;
    wrap.appendChild(content);
  }

  el.body.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function addTyping() {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg bot";
  wrap.id = "chat-typing";

  const label = document.createElement("span");
  label.className = "chat-msg-label";
  label.textContent = TEACHER_NAME;
  wrap.appendChild(label);

  const dots = document.createElement("div");
  dots.className = "typing";
  dots.innerHTML = "<span></span><span></span><span></span>";
  wrap.appendChild(dots);

  el.body.appendChild(wrap);
  scrollToBottom();
}

function removeTyping() {
  document.getElementById("chat-typing")?.remove();
}

function renderChips() {
  const wrap = document.createElement("div");
  wrap.className = "chat-chips";

  SUGGESTIONS.forEach((suggestion) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chat-chip";
    chip.textContent = suggestion;
    chip.addEventListener("click", () => sendMessage(suggestion));
    wrap.appendChild(chip);
  });

  el.body.appendChild(wrap);
  scrollToBottom();
}

function scrollToBottom() {
  el.body.scrollTop = el.body.scrollHeight;
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
  addMessage("you", message, "user");
  history.push({ role: "user", content: message });

  el.send.disabled = true;
  addTyping();

  try {
    const answer = await askTeacher(message);
    history.push({ role: "assistant", content: answer });
    removeTyping();
    addMessage(TEACHER_NAME, answer, "bot");
  } catch (error) {
    console.error("Teacher chat error:", error);
    removeTyping();
    addMessage(
      TEACHER_NAME,
      `! Couldn't reach the teacher — ${error.message}. Check your connection and try again in a moment.`,
      "error"
    );
  } finally {
    el.send.disabled = false;
    el.input.focus();
  }
}
