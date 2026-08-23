/* Livanto Green — shared site engine (nav, mobile menu, scroll reveal, text-split) */
(function () {
  "use strict";

  /* ---- Sticky nav state ---- */
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* Nav overlays whatever's directly under it — if that's a dark section
       (hero or .section--dark), the nav needs light text until it scrolls
       past it and picks up its own (light) scrolled background. */
    const firstSection = document.querySelector("main > section");
    if (firstSection && (firstSection.classList.contains("hero") || firstSection.classList.contains("section--dark"))) {
      nav.classList.add("nav--on-dark");
    }
  }

  /* ---- Active nav link — derived from the page filename, so the nav
     partial stays byte-identical across every page (no per-page templating) ---- */
  const page = location.pathname.split("/").pop().replace(".html", "") || "index";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === page) a.classList.add("is-active");
  });

  /* ---- Footer year ---- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Mobile menu ---- */
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (toggle && links && nav) {
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
  }

  /* ---- Split text into words wrapped for a mask reveal: <h1 data-split>Text here</h1>
     An optional data-delay-base="350" (ms) offsets the whole word stagger — used to
     sequence a hero headline after its eyebrow line has already appeared. ---- */
  document.querySelectorAll("[data-split]").forEach((el) => {
    const base = parseInt(el.dataset.delayBase || "0", 10);
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach((word, i) => {
      const wrap = document.createElement("span");
      wrap.className = "split-word";
      const inner = document.createElement("span");
      inner.textContent = word;
      inner.style.transitionDelay = base + i * 40 + "ms";
      wrap.appendChild(inner);
      el.appendChild(wrap);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });

  /* ---- Scroll reveal — any element with .reveal or [data-reveal] fades/slides in once ---- */
  const revealEls = document.querySelectorAll(".reveal, .reveal-mask, [data-split]");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));

  /* ---- Homepage hero: staged on-load entrance + scroll-scrubbed dissolve ---- */
  const hero = document.querySelector(".hero");
  if (hero) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("is-loaded")));

    if (!reduceMotion) {
      const scene = hero.querySelector(".hero__scene");
      const content = hero.querySelector(".hero__content");
      let ticking = false;
      const update = () => {
        const p = Math.min(Math.max(window.scrollY / hero.offsetHeight, 0), 1);
        if (scene) scene.style.transform = `scale(${1 + p * 0.08}) translateY(${p * -30}px)`;
        if (content) {
          content.style.opacity = String(1 - p * 1.4);
          content.style.transform = `translateY(${p * -40}px)`;
        }
        ticking = false;
      };
      window.addEventListener(
        "scroll",
        () => {
          if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
          }
        },
        { passive: true }
      );
    }
  }
})();
