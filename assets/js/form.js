/* ==========================================================================
   mySecurity — Form submission
   Progressive enhancement over Netlify Forms: without JS the form posts
   normally and Netlify shows its own confirmation; with JS we post in the
   background and swap in an inline success message.
   ========================================================================== */

function setStatus(el, message, ok) {
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.style.borderColor = ok ? "" : "var(--border-strong)";
  el.style.color = ok ? "" : "var(--muted)";
  el.style.backgroundColor = ok ? "" : "var(--surface)";
}

export function initForms() {
  document.querySelectorAll("[data-form]").forEach((form) => {
    const status = form.querySelector("[data-form-status]");
    const submit = form.querySelector("[type='submit']");
    const original = submit ? submit.textContent : "";

    form.addEventListener("submit", async (event) => {
      // Let the browser handle validation messaging first.
      if (!form.checkValidity()) return;

      event.preventDefault();

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Sending…";
      }

      try {
        const body = new URLSearchParams(new FormData(form)).toString();

        const response = await fetch(form.getAttribute("action") || "/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body
        });

        if (!response.ok) throw new Error(`Request failed: ${response.status}`);

        form.reset();
        setStatus(
          status,
          "Thanks — your request is in. A specialist will reply within one business day.",
          true
        );
        if (submit) submit.textContent = "Sent";
        return;
      } catch (error) {
        setStatus(
          status,
          "We couldn't send that from here. Please email hello@mysecurity.ai and we'll pick it up right away.",
          false
        );
      }

      if (submit) {
        submit.disabled = false;
        submit.textContent = original;
      }
    });
  });
}
