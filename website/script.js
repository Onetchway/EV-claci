/* Livanto Green marketing site — interactions */
(function () {
  "use strict";

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

  /* lead form (demo handler) */
  const form = document.getElementById("leadForm");
  const note = document.getElementById("formNote");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      note.hidden = false;
      form.reset();
      setTimeout(() => (note.hidden = true), 5000);
    });
  }

  /* footer year */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- 3D tilt interactions ---------- */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tiltify(el, { max = 10, scale = 1 } = {}) {
    let raf = null;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * max * 2;
      const ry = (px - 0.5) * max * 2;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
      });
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
  }

  if (!reduceMotion) {
    document
      .querySelectorAll(".card, .product, .mini, .model, .tilt-card")
      .forEach((el) => tiltify(el, { max: 8, scale: 1.02 }));
  }

  /* ---------- 3D charger showcase: mouse parallax + slow auto-spin ---------- */
  const charger = document.getElementById("charger3d");
  const heroVisual = document.getElementById("heroVisual");
  if (charger && heroVisual && !reduceMotion) {
    let autoAngle = -22;
    let targetTiltX = 8;
    let targetTiltY = -22;
    let curTiltX = 8;
    let curTiltY = -22;
    let hovering = false;

    heroVisual.addEventListener("mousemove", (e) => {
      const r = heroVisual.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      hovering = true;
      targetTiltX = 8 + (0.5 - py) * 18;
      targetTiltY = -22 + (px - 0.5) * 34;
    });
    heroVisual.addEventListener("mouseleave", () => {
      hovering = false;
    });

    const tick = () => {
      if (!hovering) {
        autoAngle += 0.06;
        targetTiltY = -22 + Math.sin(autoAngle * 0.02) * 10;
        targetTiltX = 8;
      }
      curTiltX += (targetTiltX - curTiltX) * 0.06;
      curTiltY += (targetTiltY - curTiltY) * 0.06;
      charger.style.transform = `rotateX(${curTiltX}deg) rotateY(${curTiltY}deg)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Hero floating particles ---------- */
  const particleHost = document.getElementById("heroParticles");
  if (particleHost && !reduceMotion) {
    const count = window.innerWidth < 640 ? 10 : 22;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      const left = Math.random() * 100;
      const dur = 6 + Math.random() * 8;
      const delay = Math.random() * 10;
      const drift = (Math.random() - 0.5) * 60;
      p.style.left = left + "%";
      p.style.bottom = "-10px";
      p.style.setProperty("--px", drift + "px");
      p.style.animationDuration = dur + "s";
      p.style.animationDelay = "-" + delay + "s";
      particleHost.appendChild(p);
    }
  }

  /* ---------- Hero parallax on scroll ---------- */
  const heroBg = document.querySelector(".hero__bg");
  if (heroBg && !reduceMotion) {
    window.addEventListener(
      "scroll",
      () => {
        const y = Math.min(window.scrollY, 600);
        heroBg.style.transform = `translateY(${y * 0.15}px)`;
      },
      { passive: true }
    );
  }
})();
