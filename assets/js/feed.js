/* ==========================================================================
   mySecurity — Demo event feed
   Cycles illustrative events through the hero console so the product feels
   alive. Purely presentational: no network, no data.
   ========================================================================== */

const EVENTS = [
  { icon: "camera", level: "info", title: "Loading dock — person detected after hours", meta: "CAM-14 · CONFIDENCE 0.97" },
  { icon: "gate", level: "info", title: "Visitor vehicle cleared at main gate", meta: "ANPR · KA-05-HJ-2291" },
  { icon: "alert", level: "alert", title: "Perimeter line crossed — east fence", meta: "ZONE 3 · GUARD NOTIFIED" },
  { icon: "user", level: "info", title: "Contractor checked in — badge issued", meta: "LOBBY · VALID 4H" },
  { icon: "asset", level: "info", title: "Cold-room temperature back in range", meta: "SENSOR T-08 · 3.1 °C" },
  { icon: "door", level: "info", title: "Server room unlocked by authorised staff", meta: "DOOR B2 · PIN + FACE" },
  { icon: "alert", level: "alert", title: "Smoke signature detected in bay 2", meta: "FIRE PANEL · ESCALATED" },
  { icon: "camera", level: "info", title: "Camera 07 obstruction cleared", meta: "SELF-HEAL · 41 S DOWNTIME" },
  { icon: "gate", level: "info", title: "Delivery slot opened for scheduled van", meta: "GATE 2 · PO-88431" },
  { icon: "asset", level: "info", title: "Generator fuel level below threshold", meta: "ASSET G-01 · 18%" }
];

const MAX_ITEMS = 5;
const INTERVAL = 3200;

/* How long an incident from the site plan stays pinned to the top of the
   stream before the ambient rotation reclaims its slot. Long enough to read,
   short enough that the stream doesn't stall. */
const PIN_MS = 9000;

function buildItem(event, index) {
  const li = document.createElement("li");
  li.className = "feed__item";
  li.dataset.level = event.level;
  if (index === 0) li.classList.add("is-new");

  const glyph = document.createElement("span");
  glyph.className = "feed__glyph";
  glyph.innerHTML =
    `<svg aria-hidden="true"><use href="assets/img/icons.svg#icon-${event.icon}"></use></svg>`;

  const body = document.createElement("div");
  body.innerHTML =
    `<p class="feed__title">${event.title}</p>` +
    `<p class="feed__meta">${event.meta}</p>`;

  li.append(glyph, body);
  return li;
}

export function initFeed() {
  const list = document.querySelector("[data-feed]");
  if (!list) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cursor = 0;

  /* Incidents raised by the site plan. They sit above the ambient rotation
     for a while, then expire — so what the plan is showing and what the
     stream is reporting stay in agreement. */
  let pinned = [];

  const visible = () => {
    const now = Date.now();
    pinned = pinned.filter((p) => now < p.until);
    return pinned
      .map((p) => p.event)
      .concat(
        Array.from({ length: MAX_ITEMS }, (_, i) => EVENTS[(cursor + i) % EVENTS.length])
      )
      .slice(0, MAX_ITEMS);
  };

  const render = () => {
    list.replaceChildren(...visible().map(buildItem));
  };

  render();

  /* The plan dispatches these; going through an event rather than a direct
     call keeps the two able to exist without each other. */
  document.addEventListener("mysec:incident", (e) => {
    const d = e.detail || {};
    pinned.unshift({
      until: Date.now() + PIN_MS,
      event: {
        icon: d.icon || "alert",
        /* Carry the severity through. Hardcoding "alert" here would have made
           every incident look identical in the stream, which is exactly the
           distinction the plan is drawing. */
        level: d.level || "alert",
        title: d.title || "Incident detected",
        meta: d.meta || ""
      }
    });
    pinned = pinned.slice(0, 2);
    render();
  });

  if (reduced) return;

  let timer = null;

  const tick = () => {
    cursor = (cursor + 1) % EVENTS.length;
    render();
  };

  const start = () => {
    if (timer === null) timer = window.setInterval(tick, INTERVAL);
  };

  const stop = () => {
    window.clearInterval(timer);
    timer = null;
  };

  // Don't burn cycles on a feed nobody is looking at.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { threshold: 0.15 }
    ).observe(list);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
}
