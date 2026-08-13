/* ==========================================================================
   mySecurity — Header behaviour
   Sticky-header border, mobile menu, current-page marking.
   ========================================================================== */

function initStickyHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  const update = () => {
    header.classList.toggle("is-stuck", window.scrollY > 8);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initMobileMenu() {
  const button = document.querySelector("[data-menu-button]");
  const menu = document.querySelector("[data-menu]");
  if (!button || !menu) return;

  const setOpen = (open) => {
    menu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  button.addEventListener("click", () => {
    setOpen(!menu.classList.contains("is-open"));
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });

  // A resize past the breakpoint should never leave the body scroll-locked.
  window.matchMedia("(min-width: 981px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

function initCurrentPage() {
  const here = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll("[data-nav-links] a").forEach((link) => {
    const target = link.getAttribute("href");
    if (!target || target.startsWith("#") || target.startsWith("http")) return;
    if (target.split("/").pop() === here) {
      link.setAttribute("aria-current", "page");
    }
  });
}

export function initNav() {
  initStickyHeader();
  initMobileMenu();
  initCurrentPage();
}
