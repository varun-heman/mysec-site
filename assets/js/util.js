/* ==========================================================================
   mySecurity — Small shared helpers
   ========================================================================== */

/** Fills every [data-year] element with the current year. */
export function initYear() {
  const year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = year;
  });
}
