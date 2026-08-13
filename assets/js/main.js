/* ==========================================================================
   mySecurity — Entry point
   Every behaviour lives in its own module; this file only wires them up.
   Each init is a no-op when its markup isn't on the page, so one bundle
   serves every page.
   ========================================================================== */

import { initTheme } from "./theme.js";
import { initNav } from "./nav.js";
import { initReveal } from "./reveal.js";
import { initAccordions, initTabs } from "./disclosure.js";
import { initFeed } from "./feed.js";
import { initCounters } from "./counters.js";
import { initForms } from "./form.js";
import { initYear } from "./util.js";

function boot() {
  initTheme();
  initNav();
  initReveal();
  initAccordions();
  initTabs();
  initFeed();
  initCounters();
  initForms();
  initYear();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
