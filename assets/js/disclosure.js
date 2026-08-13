/* ==========================================================================
   mySecurity — Accordion & tabs
   Both are plain ARIA disclosure patterns; no library, no markup generation.
   ========================================================================== */

function closePanel(panel) {
  panel.style.height = `${panel.scrollHeight}px`;
  requestAnimationFrame(() => {
    panel.style.height = "0px";
  });
}

function openPanel(panel) {
  panel.style.height = `${panel.scrollHeight}px`;
  panel.addEventListener(
    "transitionend",
    () => {
      // Let the panel size to its content once the animation has landed, so
      // reflowing text (or a resize) doesn't get clipped.
      if (panel.dataset.open === "true") panel.style.height = "auto";
    },
    { once: true }
  );
}

export function initAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((accordion) => {
    const triggers = accordion.querySelectorAll("[data-accordion-trigger]");
    const exclusive = accordion.dataset.accordion === "exclusive";

    triggers.forEach((trigger) => {
      const panel = document.getElementById(
        trigger.getAttribute("aria-controls")
      );
      if (!panel) return;

      const expanded = trigger.getAttribute("aria-expanded") === "true";
      panel.dataset.open = String(expanded);
      panel.style.height = expanded ? "auto" : "0px";

      trigger.addEventListener("click", () => {
        const isOpen = trigger.getAttribute("aria-expanded") === "true";

        if (exclusive && !isOpen) {
          triggers.forEach((other) => {
            if (other === trigger) return;
            const otherPanel = document.getElementById(
              other.getAttribute("aria-controls")
            );
            if (!otherPanel || other.getAttribute("aria-expanded") !== "true") {
              return;
            }
            other.setAttribute("aria-expanded", "false");
            otherPanel.dataset.open = "false";
            closePanel(otherPanel);
          });
        }

        trigger.setAttribute("aria-expanded", String(!isOpen));
        panel.dataset.open = String(!isOpen);
        if (isOpen) closePanel(panel);
        else openPanel(panel);
      });
    });
  });
}

export function initTabs() {
  document.querySelectorAll("[data-tabs]").forEach((group) => {
    const tabs = Array.from(group.querySelectorAll("[role='tab']"));
    if (!tabs.length) return;

    const select = (tab) => {
      tabs.forEach((other) => {
        const selected = other === tab;
        const panel = document.getElementById(
          other.getAttribute("aria-controls")
        );
        other.setAttribute("aria-selected", String(selected));
        other.setAttribute("tabindex", selected ? "0" : "-1");
        if (panel) panel.hidden = !selected;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => select(tab));

      tab.addEventListener("keydown", (event) => {
        const index = tabs.indexOf(tab);
        let next = null;

        if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
        if (event.key === "ArrowLeft") {
          next = tabs[(index - 1 + tabs.length) % tabs.length];
        }
        if (event.key === "Home") next = tabs[0];
        if (event.key === "End") next = tabs[tabs.length - 1];

        if (!next) return;
        event.preventDefault();
        select(next);
        next.focus();
      });
    });

    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  });
}
