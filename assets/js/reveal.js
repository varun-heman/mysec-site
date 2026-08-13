/* ==========================================================================
   mySecurity — Scroll reveal
   Adds .is-visible to [data-reveal] elements as they enter the viewport.
   Children of [data-reveal-group] are staggered.
   ========================================================================== */

export function initReveal() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Stagger group children before observing so the delay is already in place.
  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    const step = Number(group.dataset.revealStep || 60);
    Array.from(group.children).forEach((child, index) => {
      child.setAttribute("data-reveal", "");
      child.style.transitionDelay = `${Math.min(index * step, 400)}ms`;
    });
  });

  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;

  if (reduced || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );

  targets.forEach((el) => observer.observe(el));
}
