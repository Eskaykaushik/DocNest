const CONSOLE_EGG =
  "\n%c DocNest %c a nest for your AI curiosity\n%c psst… try clicking the D mark a few times, or type hackable words in search.\n";
const CONSOLE_STYLE = [
  "color:#0d1117;background:#58a6ff;padding:2px 8px;border-radius:6px;font-weight:700;",
  "color:#f0f6fc;background:transparent;",
  "color:#8b949e;background:transparent;padding-left:2px;",
];

function getToast() {
  let toast = document.querySelector("#egg-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.id = "egg-toast";
    document.body.appendChild(toast);
  }
  return toast;
}

function showToast(message) {
  const toast = getToast();
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2800);
}

function flashEgg() {
  let flash = document.querySelector("#egg-flash");
  if (!flash) {
    flash = document.createElement("div");
    flash.className = "egg-flash";
    flash.id = "egg-flash";
    document.body.appendChild(flash);
  }
  flash.classList.add("active");
  clearTimeout(flashEgg._t);
  flashEgg._t = setTimeout(() => flash.classList.remove("active"), 300);
}

function burstParticles(color) {
  for (let i = 0; i < 16; i++) {
    const p = document.createElement("span");
    p.className = "egg-particle";
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - 40}px`);
    p.style.setProperty("--duration-stagger", `${500 + Math.random() * 400}ms`);
    p.style.setProperty("background", color);
    p.style.left = `${window.innerWidth / 2}px`;
    p.style.top = `${window.innerHeight / 2}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

function starfieldRain() {
  const colors = [
    "var(--color-accent)",
    "var(--color-accent-strong)",
    "#e3b341",
    "#f0f6fc",
  ];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span");
    s.className = "egg-star";
    const dx = (Math.random() - 0.5) * 140;
    const dy = -(100 + Math.random() * 240);
    s.style.setProperty("--dx", `${dx}px`);
    s.style.setProperty("--dy", `${dy}px`);
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    s.style.left = `${Math.random() * window.innerWidth}px`;
    s.style.bottom = `${Math.random() * 40 + 20}px`;
    s.style.animationDelay = `${Math.random() * 500}ms`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}

function initLogoEgg() {
  const brand = document.querySelector(".brand");
  const mark = document.querySelector(".brand-mark");
  if (!brand || !mark) return;
  let clicks = 0;
  let fired = false;
  brand.addEventListener("click", (event) => {
    if (!event.target.closest(".brand-mark")) return;
    if (fired) return;
    event.preventDefault();
    const now = Date.now();
    if (!mark._windowStart || now - mark._windowStart > 6000) {
      mark._windowStart = now;
      clicks = 0;
    }
    clicks += 1;
    if (clicks >= 5) {
      fired = true;
      flashEgg();
      brand.classList.remove("pulse");
      void brand.offsetWidth;
      brand.classList.add("pulse");
      setTimeout(() => brand.classList.remove("pulse"), 750);
      showToast("Nest initialized.");
    }
  });
}

function initTypedSecret() {
  let buffer = "";
  let timer = null;
  const SECRET = "docnest";
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    ) {
      return;
    }
    if (!/^[a-z]$/i.test(event.key)) return;
    buffer += event.key.toLowerCase();
    if (buffer.length > SECRET.length) buffer = buffer.slice(-SECRET.length);
    clearTimeout(timer);
    timer = setTimeout(() => {
      buffer = "";
    }, 3000);
    if (buffer === SECRET) {
      buffer = "";
      showToast("You found a hidden nest.");
    }
  });
}

function initSearchEgg() {
  const input = document.getElementById("search-input");
  const dropdown = document.getElementById("search-dropdown");
  if (!input || !dropdown) return;
  const EGG_WORDS = /\b(kirby|zelda|mario|pokemon|power)\b/i;
  let timer = null;
  function sync() {
    const query = input.value.trim();
    const match = EGG_WORDS.test(query);
    let row = dropdown.querySelector(".egg-search-row");
    if (!match) {
      if (row) row.remove();
      return;
    }
    if (row) return;
    row = document.createElement("div");
    row.className = "egg-search-row";
    row.innerHTML =
      '<span aria-hidden="true">◆</span> Power source detected: pure curiosity.';
    dropdown.appendChild(row);
    showToast("A wild easter egg appeared!");
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 160);
  });
}

function initThemeFlipEgg() {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;
  let flips = 0;
  let windowStart = 0;
  let fired = false;
  toggle.addEventListener("click", () => {
    if (fired) return;
    const now = Date.now();
    if (!windowStart || now - windowStart > 3000) {
      windowStart = now;
      flips = 0;
    }
    flips += 1;
    if (flips >= 5) {
      fired = true;
      burstParticles("var(--color-accent)");
      showToast("Dual-nature unlocked.");
    }
  });
}

function initKonamiEgg() {
  const SEQUENCE = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];
  let index = 0;
  let fired = false;
  document.addEventListener("keydown", (event) => {
    const expected = SEQUENCE[index];
    const key = event.key === "A" || event.key === "B" ? event.key.toLowerCase() : event.key;
    if (key !== expected) {
      index = key === SEQUENCE[0] ? 1 : 0;
      return;
    }
    index += 1;
    if (index === SEQUENCE.length) {
      index = 0;
      if (fired) return;
      fired = true;
      document.body.classList.add("nest-mode");
      showToast("Nest Mode.");
      setTimeout(() => document.body.classList.remove("nest-mode"), 1400);
    }
  });
}

function initGridRewardEgg() {
  let fired = false;
  window.addEventListener("docnest:all-revealed", () => {
    if (fired) return;
    fired = true;
    starfieldRain();
  });
}

function initConsoleEgg() {
  console.log(CONSOLE_EGG, ...CONSOLE_STYLE);
}

export function initEasterEggs() {
  initLogoEgg();
  initTypedSecret();
  initSearchEgg();
  initThemeFlipEgg();
  initKonamiEgg();
  initGridRewardEgg();
  initConsoleEgg();
}

initEasterEggs();