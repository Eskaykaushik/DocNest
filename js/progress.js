/**
 * progress.js
 * "Nest grows as you learn": XP, levels, reading completions, daily streak,
 * badges and discovered easter eggs. Persisted in localStorage under
 * "docnest.progress". Also renders the navbar level ring + Nest panel.
 */

import { evaluateBadges, BADGES } from "./badges.js";
import { showToast, confetti } from "./effects.js";

const KEY = "docnest.progress";
const RING_CIRCUMFERENCE = 2 * Math.PI * 15;

const XP = { tutorial: 20, paper: 40, egg: 5, quiz: 15, streak: 10 };

const LEVELS = [
  { name: "Hatchling", min: 0 },
  { name: "Fledgling", min: 60 },
  { name: "Nestling", min: 160 },
  { name: "Explorer", min: 320 },
  { name: "Scholar", min: 560 },
  { name: "Architect", min: 880 },
  { name: "Sage", min: 1300 },
];

function emptyState() {
  return {
    xp: 0,
    read: {},
    streak: { count: 0, last: "" },
    badges: [],
    eggs: [],
    perfect: {},
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      streak: { ...base.streak, ...(parsed.streak || {}) },
    };
  } catch {
    return emptyState();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — progress just won't persist */
  }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayDiff(a, b) {
  return Math.round((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);
}

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function getState() {
  return read();
}

export function isRead(id) {
  return Boolean(read().read[id]);
}

export function getLevel(xp = read().xp) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (xp >= LEVELS[i].min) index = i;
  }
  const current = LEVELS[index];
  const next = LEVELS[index + 1];
  const span = next ? next.min - current.min : 1;
  return {
    index,
    level: index + 1,
    name: current.name,
    min: current.min,
    next: next ? next.min : null,
    progress: next ? Math.min(1, (xp - current.min) / span) : 1,
    toNext: next ? next.min - xp : 0,
  };
}

function touchStreak(state) {
  const today = todayStr();
  const { last, count } = state.streak;
  if (last === today) return false;
  if (last && dayDiff(today, last) === 1) {
    state.streak = { count: count + 1, last: today };
  } else {
    state.streak = { count: 1, last: today };
  }
  return true;
}

function applyUnlocks(state, ctx) {
  const unlocked = evaluateBadges(state, ctx);
  unlocked.forEach((id) => state.badges.push(id));
  return unlocked;
}

function finish(state, xpGained, unlocked, levelUp) {
  write(state);
  emit("docnest:progress", { state });
  unlocked.forEach((id) => {
    const badge = BADGES.find((b) => b.id === id);
    confetti({ count: 22 });
    showToast(`Badge unlocked — ${badge ? badge.name : id}`);
    emit("docnest:badge", { id });
  });
  if (levelUp) {
    confetti({ count: 40, spread: 220 });
    showToast(`Level ${levelUp.level} — ${levelUp.name}`);
    emit("docnest:levelup", levelUp);
  }
  return { xpGained, unlocked, levelUp };
}

export function markRead(id, options = {}) {
  const { kind = "tutorial", category = null, minutes = 0, ctx = {} } = options;
  const state = read();
  if (state.read[id]) {
    return { isNew: false, xpGained: 0, unlocked: [], levelUp: null };
  }
  state.read[id] = { at: Date.now(), kind, category, minutes };
  let xpGained = kind === "paper" ? XP.paper : XP.tutorial;
  if (touchStreak(state)) xpGained += XP.streak;
  const beforeIndex = getLevel(state.xp).index;
  state.xp += xpGained;
  const levelUp = getLevel(state.xp).index > beforeIndex ? getLevel(state.xp) : null;
  const unlocked = applyUnlocks(state, ctx);
  const result = finish(state, xpGained, unlocked, levelUp);
  return { isNew: true, ...result };
}

export function recordEgg(id) {
  const state = read();
  if (state.eggs.includes(id)) return { isNew: false };
  state.eggs.push(id);
  const beforeIndex = getLevel(state.xp).index;
  state.xp += XP.egg;
  const levelUp = getLevel(state.xp).index > beforeIndex ? getLevel(state.xp) : null;
  const unlocked = applyUnlocks(state, {});
  finish(state, XP.egg, unlocked, levelUp);
  return { isNew: true };
}

export function recordQuizPerfect(id) {
  const state = read();
  if (state.perfect[id]) return { isNew: false };
  state.perfect[id] = true;
  const beforeIndex = getLevel(state.xp).index;
  state.xp += XP.quiz;
  const levelUp = getLevel(state.xp).index > beforeIndex ? getLevel(state.xp) : null;
  const unlocked = applyUnlocks(state, {});
  finish(state, XP.quiz, unlocked, levelUp);
  return { isNew: true };
}

/** Re-check context badges (needs the full index) without awarding XP. */
export function syncBadges(ctx = {}) {
  const state = read();
  const unlocked = applyUnlocks(state, ctx);
  if (unlocked.length) finish(state, 0, unlocked, null);
  return unlocked;
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit("docnest:progress", { state: read() });
  refreshNestUI();
}

/**
 * Trigger completion once the reader has scrolled to (near) the end.
 * Marking is idempotent; the celebration only fires the first time.
 */
export function attachCompletion({ id, kind, category, minutes, ctx = {} }) {
  let done = isRead(id);
  const onScroll = () => {
    if (done) return;
    const el = document.documentElement;
    const ratio =
      el.scrollHeight > el.clientHeight
        ? (el.scrollTop + el.clientHeight) / el.scrollHeight
        : 1;
    if (ratio < 0.92) return;
    done = true;
    window.removeEventListener("scroll", onScroll);
    const result = markRead(id, { kind, category, minutes, ctx });
    if (result.isNew) {
      const label = kind === "paper" ? "Paper" : "Tutorial";
      showToast(`${label} complete — +${result.xpGained} XP`);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* --------------------------------------------------------------------- */
/* Navbar level ring + Nest panel                                         */
/* --------------------------------------------------------------------- */

let ringEl = null;
let panelEl = null;

function ringMarkup() {
  return `
    <svg class="level-ring-svg" viewBox="0 0 36 36" aria-hidden="true">
      <circle class="level-ring-track" cx="18" cy="18" r="15" />
      <circle class="level-ring-fill" cx="18" cy="18" r="15" />
    </svg>
    <span class="level-ring-label"></span>
  `;
}

function statMarkup(label, value) {
  return `<div class="nest-stat"><span class="nest-stat-value">${value}</span><span class="nest-stat-label">${label}</span></div>`;
}

function badgeMarkup(badge, unlocked) {
  return `
    <div class="nest-badge${unlocked ? " unlocked" : ""}${badge.secret && !unlocked ? " secret" : ""}"
         title="${badge.desc}" aria-label="${badge.name}: ${badge.desc}">
      <span class="nest-badge-icon" aria-hidden="true">${badge.secret && !unlocked ? "?" : badge.icon}</span>
      <span class="nest-badge-name">${badge.secret && !unlocked ? "Locked" : badge.name}</span>
    </div>`;
}

function panelMarkup(state) {
  const level = getLevel(state.xp);
  const tutorials = Object.values(state.read).filter((r) => r.kind !== "paper").length;
  const papers = Object.values(state.read).filter((r) => r.kind === "paper").length;
  const nextText = level.next ? `${level.toNext} XP to ${LEVELS[level.index + 1].name}` : "Top of the nest";
  return `
    <div class="nest-panel-head">
      <div>
        <p class="nest-panel-eyebrow">Your nest</p>
        <p class="nest-panel-level">Lv ${level.level} · ${level.name}</p>
      </div>
      <button type="button" class="nest-panel-close" aria-label="Close">✕</button>
    </div>
    <div class="nest-xp">
      <div class="nest-xp-bar"><span style="width:${Math.round(level.progress * 100)}%"></span></div>
      <p class="nest-xp-text">${state.xp} XP · ${nextText}</p>
    </div>
    <div class="nest-stats">
      ${statMarkup("tutorials", tutorials)}
      ${statMarkup("papers", papers)}
      ${statMarkup("day streak", state.streak.count)}
      ${statMarkup("badges", `${state.badges.length}/${BADGES.length}`)}
    </div>
    <p class="nest-panel-sub">Badges</p>
    <div class="nest-badges">
      ${BADGES.map((b) => badgeMarkup(b, state.badges.includes(b.id))).join("")}
    </div>
    <button type="button" class="nest-reset">Reset progress</button>
  `;
}

function renderRing() {
  if (!ringEl) return;
  const level = getLevel();
  const label = ringEl.querySelector(".level-ring-label");
  const fill = ringEl.querySelector(".level-ring-fill");
  if (label) label.textContent = String(level.level);
  if (fill) {
    fill.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    fill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - level.progress));
  }
  ringEl.setAttribute("aria-label", `Your nest — level ${level.level}, ${level.name}`);
}

function refreshNestUI() {
  renderRing();
  if (panelEl && !panelEl.hidden) {
    panelEl.innerHTML = panelMarkup(getState());
  }
}

function closePanel() {
  if (!panelEl) return;
  panelEl.hidden = true;
  ringEl?.setAttribute("aria-expanded", "false");
}

function openPanel() {
  if (!panelEl) return;
  panelEl.innerHTML = panelMarkup(getState());
  panelEl.hidden = false;
  ringEl?.setAttribute("aria-expanded", "true");
}

export function initNestUI() {
  const nav = document.querySelector(".nav-actions");
  if (!nav || ringEl) return;

  ringEl = document.createElement("button");
  ringEl.type = "button";
  ringEl.className = "level-ring";
  ringEl.setAttribute("aria-haspopup", "dialog");
  ringEl.setAttribute("aria-expanded", "false");
  ringEl.innerHTML = ringMarkup();

  panelEl = document.createElement("div");
  panelEl.className = "nest-panel";
  panelEl.setAttribute("role", "dialog");
  panelEl.setAttribute("aria-label", "Your nest");
  panelEl.hidden = true;

  const searchWrap = nav.querySelector(".search-wrap");
  if (searchWrap) nav.insertBefore(ringEl, searchWrap);
  else nav.appendChild(ringEl);
  nav.appendChild(panelEl);

  ringEl.addEventListener("click", (event) => {
    event.stopPropagation();
    panelEl.hidden ? openPanel() : closePanel();
  });
  panelEl.addEventListener("click", (event) => {
    if (event.target.closest(".nest-panel-close")) closePanel();
    if (event.target.closest(".nest-reset")) {
      resetProgress();
      closePanel();
      showToast("Progress reset.");
    }
  });
  document.addEventListener("click", (event) => {
    if (panelEl.hidden) return;
    if (event.target.closest(".nest-panel") || event.target.closest(".level-ring")) return;
    closePanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });
  window.addEventListener("docnest:progress", refreshNestUI);

  refreshNestUI();
}

if (document.querySelector(".nav-actions")) {
  initNestUI();
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNestUI);
}
