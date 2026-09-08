const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

export function initReveal(root = document) {
  const nodes = root.querySelectorAll("[data-reveal]");
  if (!nodes.length) return;

  if (REDUCED.matches || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("revealed"));
    window.dispatchEvent(new CustomEvent("docnest:all-revealed"));
    return;
  }

  let remaining = nodes.length;
  const finish = (node) => {
    node.classList.add("revealed");
    remaining -= 1;
    if (remaining === 0) {
      observer.disconnect();
      window.dispatchEvent(new CustomEvent("docnest:all-revealed"));
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          finish(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -4% 0px" }
  );

  nodes.forEach((node) => observer.observe(node));
}