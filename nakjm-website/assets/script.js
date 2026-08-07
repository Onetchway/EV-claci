/* NAKJM Infrastructure — navigation, motion and the enquiry form.

   Everything motion-related is progressive enhancement: the CSS renders the
   page fully legible without JavaScript, and every effect below is skipped
   when the visitor has asked for reduced motion. */
(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = motionQuery.matches;
  var canObserve = "IntersectionObserver" in window;

  /* ---- current year in footer ---- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---- mobile navigation ---- */
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-menu");

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      menu.setAttribute("data-open", String(!open));
    });

    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        menu.setAttribute("data-open", "false");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        toggle.setAttribute("aria-expanded", "false");
        menu.setAttribute("data-open", "false");
        toggle.focus();
      }
    });
  }

  /* ---- dropdown menus --------------------------------------------------
     Desktop opens them on hover/focus purely in CSS. Below the nav
     breakpoint each group becomes a tap-to-open accordion driven by the
     button that CSS reveals there. */

  Array.prototype.forEach.call(document.querySelectorAll(".nav__group"), function (group) {
    var expander = group.querySelector(".nav__expand");
    if (!expander) { return; }

    expander.addEventListener("click", function () {
      var open = group.getAttribute("data-open") === "true";
      group.setAttribute("data-open", String(!open));
      expander.setAttribute("aria-expanded", String(!open));
    });
  });

  // Escape closes any open desktop dropdown by moving focus out of it
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") { return; }
    var openDrop = document.activeElement && document.activeElement.closest(".nav__group");
    if (openDrop) {
      var parent = openDrop.querySelector(".nav__parent");
      if (parent) { parent.focus(); }
    }
  });

  /* ---- scroll progress bar + condensed nav -----------------------------
     Both read the same scroll position, so they share one rAF-throttled
     handler rather than each attaching their own scroll listener. */

  var progressBar = document.querySelector(".progress__bar");
  var nav = document.querySelector(".nav");
  var toTop = document.querySelector(".totop");
  var parallaxEls = document.querySelectorAll("[data-parallax]");
  var ticking = false;

  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    var y = window.scrollY || doc.scrollTop;

    if (progressBar) {
      var pct = scrollable > 0 ? (y / scrollable) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
    }
    if (nav) {
      nav.classList.toggle("is-stuck", y > 120);
    }
    if (toTop) {
      toTop.classList.toggle("is-shown", y > 700);
    }
    if (parallaxEls.length && !reduceMotion) {
      var vh = window.innerHeight;
      Array.prototype.forEach.call(parallaxEls, function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) { return; }
        var depth = parseFloat(el.getAttribute("data-parallax")) || 0.12;
        // -1 at the top of the viewport, +1 at the bottom
        var mid = (rect.top + rect.height / 2 - vh / 2) / (vh / 2);
        el.style.transform = "translate3d(0," + (mid * depth * 60).toFixed(2) + "px,0)";
      });
    }
    ticking = false;
  }

  function requestScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }

  if (progressBar || nav || toTop || parallaxEls.length) {
    window.addEventListener("scroll", requestScroll, { passive: true });
    window.addEventListener("resize", requestScroll);
    onScroll();
  }

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---- hero entrance ---- */
  var hero = document.querySelector(".hero");
  if (hero && !reduceMotion) {
    window.requestAnimationFrame(function () { hero.classList.add("is-ready"); });
  }

  /* Split any [data-split] element into per-word spans so they can rise in
     sequence. Runs before the reveal observer is wired up below. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-split]"), function (el) {
    if (reduceMotion) { return; }
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3 && child.textContent.trim()) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (word) {
            if (!word.trim()) { frag.appendChild(document.createTextNode(word)); return; }
            var span = document.createElement("span");
            span.textContent = word;
            frag.appendChild(span);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    el.classList.add("split-word");
    Array.prototype.forEach.call(el.querySelectorAll("span"), function (sp, i) {
      sp.style.transitionDelay = (i * 55) + "ms";
    });
  });

  /* ---- reveal on scroll -------------------------------------------------
     One observer drives .reveal, .rise, .fade-in, .mask-up, [data-stagger]
     and the timeline items. Each element is unobserved once it has played. */

  var revealSelector = ".reveal, .rise, .fade-in, .mask-up, [data-stagger], .tl-item, .img-reveal, .split-word, .eyebrow, .numblock";
  var revealables = document.querySelectorAll(revealSelector);

  // give every staggered child an increasing delay
  Array.prototype.forEach.call(document.querySelectorAll("[data-stagger]"), function (group) {
    var stepMs = parseInt(group.getAttribute("data-stagger"), 10);
    if (isNaN(stepMs)) { stepMs = 90; }
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.transitionDelay = (i * stepMs) + "ms";
    });
  });

  if (reduceMotion || !canObserve) {
    Array.prototype.forEach.call(revealables, function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    Array.prototype.forEach.call(revealables, function (el) {
      revealObserver.observe(el);
    });
  }

  /* ---- animated counters ---- */

  function runCounter(el) {
    var target = parseFloat(el.getAttribute("data-count-to"));
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    if (isNaN(target)) { return; }

    var duration = 1300;
    var start = null;

    function frame(ts) {
      if (start === null) { start = ts; }
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString("en-IN") + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.classList.add("counted");
      }
    }
    window.requestAnimationFrame(frame);
  }

  var counters = document.querySelectorAll("[data-count-to]");
  if (!reduceMotion && canObserve) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    Array.prototype.forEach.call(counters, function (el) {
      counterObserver.observe(el);
    });
  }

  /* ---- pinned process sequence -----------------------------------------
     As each step scrolls through the middle of the viewport it becomes the
     active one: the matching image cross-fades in, and the readout and
     progress track update. Below 900px the CSS unpins the column and shows
     every step, so this only needs to run on wider screens. */

  var processRoot = document.querySelector("[data-process]");

  if (processRoot && !reduceMotion && canObserve) {
    var steps = processRoot.querySelectorAll(".process__step");
    var frames = processRoot.querySelectorAll(".process__frame");
    var readoutNow = processRoot.querySelector("[data-process-now]");
    var track = processRoot.querySelector("[data-process-track]");
    var total = steps.length;
    var activeIndex = -1;

    function setActive(i) {
      if (i === activeIndex || i < 0 || i >= total) { return; }
      activeIndex = i;

      Array.prototype.forEach.call(steps, function (s, n) {
        s.classList.toggle("is-active", n === i);
      });
      Array.prototype.forEach.call(frames, function (f, n) {
        f.classList.toggle("is-active", n === i);
      });
      if (readoutNow) {
        readoutNow.textContent = ("0" + (i + 1)).slice(-2);
      }
      if (track) {
        track.style.width = (((i + 1) / total) * 100) + "%";
      }
    }

    var stepObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var idx = parseInt(entry.target.getAttribute("data-step"), 10) - 1;
            setActive(idx);
          }
        });
      },
      // a thin band across the middle of the viewport decides what is "current"
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    Array.prototype.forEach.call(steps, function (s) { stepObserver.observe(s); });
    setActive(0);
  } else if (processRoot) {
    // reduced motion / no observer: show the first frame and mark all steps read
    var firstFrame = processRoot.querySelector(".process__frame");
    if (firstFrame) { firstFrame.classList.add("is-active"); }
    Array.prototype.forEach.call(
      processRoot.querySelectorAll(".process__step"),
      function (s) { s.classList.add("is-active"); }
    );
  }

  /* ---- timeline fill ----------------------------------------------------
     The red line grows to follow the last dot that has entered view. */

  var timeline = document.querySelector("[data-timeline]");
  if (timeline && !reduceMotion) {
    var fill = timeline.querySelector(".timeline__fill");
    var items = timeline.querySelectorAll(".tl-item");

    function updateFill() {
      if (!fill || !items.length) { return; }
      var mid = window.innerHeight * 0.62;
      var tlTop = timeline.getBoundingClientRect().top;
      var reached = 0;

      Array.prototype.forEach.call(items, function (item) {
        var r = item.getBoundingClientRect();
        if (r.top < mid) { reached = r.top - tlTop + 12; }
      });
      fill.style.height = Math.max(0, reached) + "px";
    }

    var tlTicking = false;
    window.addEventListener("scroll", function () {
      if (!tlTicking) {
        tlTicking = true;
        window.requestAnimationFrame(function () { updateFill(); tlTicking = false; });
      }
    }, { passive: true });
    window.addEventListener("resize", updateFill);
    updateFill();
  }

  /* ---- enquiry form ----------------------------------------------------
     Set FORM_ENDPOINT to a URL that accepts a POST (Formspree, Basin, a Cloud
     Function, or the /backend in this repository) and submissions are sent
     there over fetch. Leave it empty and the form falls back to opening the
     visitor's mail client with the enquiry pre-filled, so enquiries still
     reach the inbox on a purely static host. */

  var FORM_ENDPOINT = "";
  var FORM_MAILTO = "connect@nakjiminfra.com";

  var form = document.getElementById("enquiry-form");
  var status = document.getElementById("form-status");

  function setStatus(msg, state) {
    if (!status) { return; }
    status.textContent = msg;
    status.setAttribute("data-state", state || "ok");
    status.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center"
    });
  }

  function fieldValue(f, key) {
    return f.elements[key] && f.elements[key].value.trim();
  }

  function buildMailto(f) {
    var subject = "Project enquiry — " + (fieldValue(f, "company") || "NAKJM website");
    var lines = [
      "Name: " + (fieldValue(f, "name") || "—"),
      "Company: " + (fieldValue(f, "company") || "—"),
      "Email: " + (fieldValue(f, "email") || "—"),
      "Phone: " + (fieldValue(f, "phone") || "—"),
      "Scope of work: " + (fieldValue(f, "scope") || "—"),
      "Site location: " + (fieldValue(f, "location") || "—"),
      "",
      "Project details:",
      fieldValue(f, "message") || "—"
    ];
    return "mailto:" + FORM_MAILTO +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var name = fieldValue(form, "name") || "there";
      var button = form.querySelector('button[type="submit"]');

      if (!FORM_ENDPOINT) {
        window.location.href = buildMailto(form);
        setStatus(
          "Thanks, " + name + ". Your email client should now be open with the " +
          "enquiry filled in — press send and we will reply within one working " +
          "day. If nothing opened, email " + FORM_MAILTO + " directly."
        );
        return;
      }

      if (button) { button.disabled = true; }
      setStatus("Sending your enquiry…");

      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      })
        .then(function (res) {
          if (!res.ok) { throw new Error("Request failed: " + res.status); }
          form.reset();
          setStatus(
            "Thanks, " + name + ". Your enquiry is with us and we will reply " +
            "within one working day."
          );
        })
        .catch(function () {
          setStatus(
            "Sorry — that did not send. Please email " + FORM_MAILTO +
            " or call +91 99715 35940 and we will pick it up straight away."
          );
        })
        .then(function () {
          if (button) { button.disabled = false; }
        });
    });
  }
})();
