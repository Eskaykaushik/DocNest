const nav = document.querySelector(".nav-actions");

function initNavMenu() {
  if (!nav || nav.querySelector(".nav-menu")) return;

  const links = [...nav.querySelectorAll("a.nav-link")];
  if (!links.length) return;

  const menu = document.createElement("div");
  menu.className = "nav-menu";
  menu.innerHTML = `
    <button
      type="button"
      class="nav-menu-toggle"
      aria-label="Open navigation"
      aria-expanded="false"
      aria-controls="nav-menu-panel"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
    <div class="nav-menu-panel" id="nav-menu-panel" hidden></div>
  `;

  const toggle = menu.querySelector(".nav-menu-toggle");
  const panel = menu.querySelector(".nav-menu-panel");

  for (const link of links) {
    const item = link.cloneNode(true);
    item.className = "nav-menu-link";
    panel.appendChild(item);
  }

  nav.insertBefore(menu, nav.firstChild);

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  }

  function addNestEntry() {
    if (panel.querySelector(".nav-menu-nest")) return true;
    const ring = nav.querySelector(".level-ring");
    if (!ring) return false;

    const nest = document.createElement("button");
    nest.type = "button";
    nest.className = "nav-menu-link nav-menu-nest";
    nest.textContent = "Your nest";
    nest.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(false);
      ring.click();
    });
    panel.appendChild(nest);
    return true;
  }

  if (!addNestEntry()) {
    const observer = new MutationObserver(() => {
      if (addNestEntry()) observer.disconnect();
    });
    observer.observe(nav, { childList: true });
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(panel.hidden);
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (panel.hidden || event.target.closest(".nav-menu")) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  const wide = window.matchMedia("(min-width: 561px)");
  wide.addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavMenu);
} else {
  initNavMenu();
}
