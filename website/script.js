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

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---- Scroll reveal — any element with .reveal/.reveal-mask/[data-split] animates in once.
     GSAP path: staggered per section, real easing, subtle scale-in for the plain .reveal
     items. CSS path (no GSAP / reduced-motion): the .is-in class transition in styles.css. ---- */
  const revealEls = document.querySelectorAll(".reveal, .reveal-mask, [data-split]");
  if (hasGsap && !reduceMotion) {
    revealEls.forEach((el) => el.classList.add("is-in")); // CSS end-state is the GSAP start-state's target; GSAP drives the actual motion
    const groups = new Map();
    revealEls.forEach((el) => {
      const parent = el.closest("section") || el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach((els) => {
      const plain = els.filter((el) => el.classList.contains("reveal"));
      const masks = els.filter((el) => el.classList.contains("reveal-mask") || el.hasAttribute("data-split"));
      if (plain.length) {
        gsap.fromTo(
          plain,
          { autoAlpha: 0, y: 26, scale: 0.985 },
          {
            autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out", stagger: 0.08,
            scrollTrigger: { trigger: plain[0], start: "top 88%", once: true },
          }
        );
      }
      masks.forEach((el) => {
        const words = el.querySelectorAll(".split-word > span");
        const target = words.length ? words : el;
        gsap.fromTo(
          target,
          { yPercent: 110 },
          { yPercent: 0, duration: 0.85, ease: "power4.out", stagger: words.length ? 0.035 : 0,
            scrollTrigger: { trigger: el, start: "top 90%", once: true } }
        );
      });
    });
  } else {
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
  }

  /* ---- Ecosystem flow (homepage) — nodes pop in left-to-right, connecting arrows draw between them ---- */
  const ecoFlow = document.querySelector(".ecosystem__flow");
  if (ecoFlow && hasGsap && !reduceMotion) {
    const items = Array.from(ecoFlow.children);
    gsap.set(items, { autoAlpha: 0 });
    gsap.set(ecoFlow.querySelectorAll(".ecosystem__node"), { autoAlpha: 0, y: 16, scale: 0.9 });
    gsap.set(ecoFlow.querySelectorAll(".ecosystem__arrow svg"), { autoAlpha: 0, scaleX: 0, transformOrigin: "left center" });
    const tl = gsap.timeline({ scrollTrigger: { trigger: ecoFlow, start: "top 82%", once: true } });
    items.forEach((el, i) => {
      const isNode = el.classList.contains("ecosystem__node");
      if (isNode) {
        tl.to(el, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.8)" }, i * 0.16);
      } else {
        tl.to(el, { autoAlpha: 1, duration: 0.15 }, i * 0.16)
          .to(el.querySelector("svg"), { autoAlpha: 1, scaleX: 1, duration: 0.4, ease: "power2.out" }, i * 0.16);
      }
    });
  }

  /* ---- Homepage hero: staged on-load entrance + scroll-scrubbed dissolve ---- */
  const hero = document.querySelector(".hero");
  if (hero) {
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("is-loaded")));

    if (!reduceMotion) {
      const scene = hero.querySelector(".hero__scene");
      const content = hero.querySelector(".hero__content");
      if (hasGsap) {
        if (scene) {
          gsap.to(scene, {
            scale: 1.08, yPercent: -14, ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 },
          });
        }
        if (content) {
          gsap.to(content, {
            autoAlpha: 0, y: -50, ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "65% top", scrub: 0.6 },
          });
        }
      } else {
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
        window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
      }
    }
  }

  /* ---- Pinned scroll storytelling (Technology "App" section): phone stays fixed while
     the active step highlights based on scroll position through the step list ---- */
  const appflow = document.querySelector(".appflow");
  if (appflow && hasGsap && !reduceMotion && window.innerWidth > 900) {
    const steps = appflow.querySelectorAll(".journey__step");
    const phone = appflow.querySelector(".appflow__phone");
    steps.forEach((step, i) => {
      ScrollTrigger.create({
        trigger: step,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => {
          step.classList.toggle("is-active", self.isActive);
          if (phone) phone.dataset.step = self.isActive ? i : phone.dataset.step;
        },
      });
    });
  }

  /* ---- Page-header parallax (dark pageheads + inner-page dark sections) ---- */
  if (hasGsap && !reduceMotion) {
    document.querySelectorAll(".pagehead--dark .pagehead__crumb, .pagehead--dark .type-eyebrow").forEach((el) => {
      gsap.to(el, { yPercent: -60, ease: "none", scrollTrigger: { trigger: el.closest(".pagehead"), start: "top top", end: "bottom top", scrub: 0.6 } });
    });
  }
})();
