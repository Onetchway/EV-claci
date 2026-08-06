/* NAKJM Infrastructure — nav, scroll reveal, animated counters, enquiry form */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    // close the menu after tapping a link on small screens
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

  /* ---- scroll reveal ---- */
  var revealables = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
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
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    Array.prototype.forEach.call(revealables, function (el) {
      revealObserver.observe(el);
    });
  }

  /* ---- animated stat counters ---- */
  var counters = document.querySelectorAll("[data-count-to]");

  function runCounter(el) {
    var target = parseInt(el.getAttribute("data-count-to"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if (isNaN(target)) return;

    var duration = 1100;
    var start = null;

    function frame(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      // ease-out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (!reduceMotion && "IntersectionObserver" in window) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    Array.prototype.forEach.call(counters, function (el) {
      counterObserver.observe(el);
    });
  }

  /* ---- enquiry form ----------------------------------------------------
     Set FORM_ENDPOINT to a URL that accepts a POST (Formspree, Basin, a Cloud
     Function, or the /backend in this repository) and submissions are sent
     there over fetch. Leave it empty and the form falls back to opening the
     visitor's mail client with the enquiry pre-filled, so enquiries still
     reach the inbox on a purely static host.
     -------------------------------------------------------------------- */

  var FORM_ENDPOINT = "";
  var FORM_MAILTO = "connect@nakjiminfra.com";

  var form = document.getElementById("enquiry-form");
  var status = document.getElementById("form-status");

  function setStatus(msg, state) {
    if (!status) return;
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
