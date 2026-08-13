/* ==========================================================================
   mySecurity — Theme toggle
   ========================================================================== */

const STORAGE_KEY = "mysec-theme";

function read() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

function write(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch (err) {
    /* Nothing to do — the toggle still works for this page view. */
  }
}

function apply(theme) {
  const root = document.documentElement;

  // Bound transition class keeps the flip smooth without leaving a global
  // transition on every element for the rest of the session.
  document.body.classList.add("is-theme-switching");
  root.setAttribute("data-theme", theme);

  window.setTimeout(() => {
    document.body.classList.remove("is-theme-switching");
  }, 260);

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
    btn.setAttribute("aria-pressed", String(theme === "light"));
  });
}

export function initTheme() {
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  if (!toggles.length) return;

  apply(document.documentElement.getAttribute("data-theme") || "dark");

  toggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      write(next);
      apply(next);
    });
  });

  // Follow the OS only while the visitor hasn't expressed a preference.
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = (event) => {
    if (read()) return;
    apply(event.matches ? "light" : "dark");
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", onChange);
  } else if (typeof media.addListener === "function") {
    media.addListener(onChange);
  }
}
