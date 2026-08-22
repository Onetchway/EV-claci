/* Livanto Green marketing site — interactions */
(function () {
  "use strict";

  /* Where the application form submits to — the CRM's public API.
     Override by setting window.LIVANTO_APPLY_ENDPOINT before this script
     runs (e.g. a small inline <script> tag) if the CRM ever moves. */
  const APPLY_ENDPOINT = window.LIVANTO_APPLY_ENDPOINT || "https://app.livantogreen.com/api/public/apply";

  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");

  /* sticky nav state */
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* mobile menu */
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      links.classList.remove("is-open");
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  /* scroll reveal */
  const revealEls = document.querySelectorAll(
    ".section-head, .card, .product, .mini, .stat, .model, .timeline li, .fact, .map-list li, .software__phone, .hero__copy, .bigfig"
  );
  revealEls.forEach((el) => el.classList.add("reveal"));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = (entry.target.dataset.delay || (i % 4) * 60) + "ms";
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));

  /* animated counters */
  const fmt = (n) => n.toLocaleString("en-IN");
  const animateCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const numEl = el.querySelector(".stat__num") || el;
    const dur = 1500;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      numEl.textContent = fmt(val) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const counters = document.querySelectorAll("[data-count]");
  const cio = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          cio.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((el) => cio.observe(el));

  /* entity type toggle — Firm applicants get company/GSTIN fields */
  const entityToggle = document.getElementById("entityToggle");
  const firmFields = document.getElementById("firmFields");
  if (entityToggle && firmFields) {
    entityToggle.addEventListener("change", (e) => {
      if (e.target.name === "entityType") {
        firmFields.hidden = e.target.value !== "FIRM";
      }
    });
  }

  /* application form — submits straight to the CRM's public intake API */
  const pageLoadedAt = Date.now();
  const applyForm = document.getElementById("applyForm");
  const applyNote = document.getElementById("applyNote");
  const applySubmit = document.getElementById("applySubmit");

  function showApplyNote(message, ok) {
    if (!applyNote) return;
    applyNote.textContent = message;
    applyNote.hidden = false;
    applyNote.className = "form-note " + (ok ? "form-note--ok" : "form-note--err");
  }

  if (applyForm) {
    applyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!applyForm.checkValidity()) {
        applyForm.reportValidity();
        return;
      }

      const data = new FormData(applyForm);
      // Honeypot: a real visitor never fills this in — bots that
      // autofill every visible-looking field usually do.
      if (data.get("website")) return;

      const entityType = data.get("entityType") || "INDIVIDUAL";
      const payload = {
        interest: data.get("interest"),
        name: data.get("name"),
        phone: data.get("phone"),
        email: data.get("email") || undefined,
        city: data.get("city"),
        state: data.get("state") || undefined,
        message: data.get("message") || undefined,
        entityType,
        company: entityType === "FIRM" ? (data.get("company") || undefined) : undefined,
        gstin: entityType === "FIRM" ? (data.get("gstin") || undefined) : undefined,
        // Simple timing check server-side — a form submitted in under a
        // couple of seconds of the page loading is almost certainly a bot.
        loadedAtMs: pageLoadedAt,
      };

      applySubmit.disabled = true;
      applySubmit.textContent = "Submitting…";
      applyNote.hidden = true;

      try {
        const res = await fetch(APPLY_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
        showApplyNote("Thanks — your application is in. Our team will be in touch shortly.", true);
        applyForm.reset();
        firmFields && (firmFields.hidden = true);
      } catch (err) {
        showApplyNote(err.message || "Couldn't submit right now — please try again in a moment.", false);
      } finally {
        applySubmit.disabled = false;
        applySubmit.textContent = "Submit application";
      }
    });
  }

  /* footer year */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
