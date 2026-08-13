/* ==========================================================================
   mySecurity — Stat counters
   Counts a [data-count] value up once, the first time it scrolls into view.
   The element's markup already contains the final text, so this degrades to
   a plain static number with JS off or motion reduced.
   ========================================================================== */

const DURATION = 1100;

function format(value, decimals) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function animate(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;

  const decimals = (el.dataset.count.split(".")[1] || "").length;
  const prefix = el.dataset.countPrefix || "";
  const suffix = el.dataset.countSuffix || "";
  const start = performance.now();

  const frame = (now) => {
    const t = Math.min((now - start) / DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = prefix + format(target * eased, decimals) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

export function initCounters() {
  const targets = document.querySelectorAll("[data-count]");
  if (!targets.length) return;

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  ) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.6 }
  );

  targets.forEach((el) => observer.observe(el));
}
