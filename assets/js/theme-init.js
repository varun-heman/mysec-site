/* ==========================================================================
   mySecurity — Theme bootstrap
   Loaded synchronously in <head> so the correct theme is on <html> before
   the first paint. Deliberately tiny and dependency-free: everything else
   about theming lives in theme.js.
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "mysec-theme";
  var stored = null;

  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    /* Private mode or blocked storage — fall through to the OS preference. */
  }

  var theme =
    stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";

  document.documentElement.setAttribute("data-theme", theme);
})();
