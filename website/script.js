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

  /* scroll reveal — applied broadly so every section animates in, not just the homepage cards */
  const revealEls = document.querySelectorAll(
    [
      ".solutions__row", ".solutions__photo", ".charger-card", ".clients-card", ".dashboard-card",
      ".station-card", ".why__item", ".sustain__metric", ".model", ".about__row",
      ".section-head", ".pagehead__kicker", ".pagehead h1", ".pagehead > .container > p:last-child",
      ".findcharger__inner > div", ".findcharger__inner > a", ".appteaser__shot", ".appteaser__feature",
      ".ctaband__item", ".whypartner__stat", ".swstats__stat", ".mission__statement", ".mission__body",
      ".network-feat > div", ".network-feat > ul", ".symbol__inner", ".jointeam__inner",
      ".calculator", ".legal__contact", ".step",
    ].join(", ")
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

  /* ecosystem interactive tabs (homepage) */
  const ecoTabs = document.querySelectorAll(".ecosystem__tab");
  if (ecoTabs.length) {
    ecoTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.target;
        ecoTabs.forEach((t) => {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        document.querySelectorAll(".ecosystem__panel").forEach((p) => {
          p.classList.toggle("is-active", p.id === "panel-" + target);
        });
      });
    });
  }

  /* cinematic hero — subtle scroll parallax on the background wrap (separate element from the zoom-in animation) */
  const cineWrap = document.querySelector(".cinehero__bg-wrap");
  if (cineWrap) {
    const onCineScroll = () => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.2) {
        cineWrap.style.transform = "translateY(" + y * 0.18 + "px)";
      }
    };
    window.addEventListener("scroll", onCineScroll, { passive: true });
  }

  /* footer year */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* franchise investment calculator — figures are Livanto Green's real franchise
     investment model (per charger); quantity/loan maths below are plain
     arithmetic over those real figures, never invented numbers. */
  const calcPower = document.getElementById("calcPower");
  if (calcPower) {
    const tiers = [
      { kw: "60 kW", investment: 1550000, eoi: 50000, income: 57000, assured: 15000, payback: "~2.3 yrs" },
      { kw: "90 kW", investment: 2050000, eoi: 50000, income: 71250, assured: 15000, payback: "~2.4 yrs" },
      { kw: "120 kW", investment: 2550000, eoi: 50000, income: 85500, assured: 20000, payback: "~2.5 yrs" },
      { kw: "180 kW", investment: 3000000, eoi: 50000, income: 118125, assured: 20000, payback: "~2.1 yrs" },
      { kw: "240 kW", investment: 3800000, eoi: 100000, income: 132000, assured: 30000, payback: "~2.4 yrs" },
      { kw: "360 kW", investment: 5000000, eoi: 200000, income: 181500, assured: 40000, payback: "~2.3 yrs" },
    ];

    const rupees = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
    const rupeesLakh = (n) => {
      if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2).replace(/\.00$/, "") + "Cr";
      if (n >= 100000) return "₹" + (n / 100000).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "L";
      return rupees(n);
    };

    const label = document.getElementById("calcPowerLabel");
    const qtyVal = document.getElementById("calcQtyVal");
    const qtyMinus = document.getElementById("calcQtyMinus");
    const qtyPlus = document.getElementById("calcQtyPlus");
    const fields = {
      investment: document.getElementById("calcInvestment"),
      eoi: document.getElementById("calcEoi"),
      income: document.getElementById("calcIncome"),
      assured: document.getElementById("calcAssured"),
      payback: document.getElementById("calcPayback"),
    };
    const loanDown = document.getElementById("loanDown");
    const loanRate = document.getElementById("loanRate");
    const loanTenure = document.getElementById("loanTenure");
    const loanDownLabel = document.getElementById("loanDownLabel");
    const loanRateLabel = document.getElementById("loanRateLabel");
    const loanTenureLabel = document.getElementById("loanTenureLabel");
    const loanAmountEl = document.getElementById("loanAmount");
    const loanEmiEl = document.getElementById("loanEmi");
    const loanInterestEl = document.getElementById("loanInterest");
    const printBody = document.getElementById("printSummaryBody");
    const printDate = document.getElementById("printDate");

    let qty = 1;

    const currentTier = () => tiers[Number(calcPower.value)];

    const render = () => {
      const t = currentTier();
      const investment = t.investment * qty;
      const eoi = t.eoi * qty;
      const income = t.income * qty;
      const assured = t.assured * qty;

      label.textContent = t.kw;
      qtyVal.textContent = String(qty);
      fields.investment.textContent = rupeesLakh(investment);
      fields.eoi.textContent = rupees(eoi);
      fields.income.textContent = rupees(income);
      fields.assured.textContent = rupees(assured);
      fields.payback.textContent = t.payback;

      // loan / EMI estimate — standard reducing-balance EMI formula over the
      // total investment, at whatever down payment/rate/tenure the visitor picks
      const downPct = Number(loanDown.value);
      const ratePct = Number(loanRate.value);
      const years = Number(loanTenure.value);
      loanDownLabel.textContent = downPct + "%";
      loanRateLabel.textContent = ratePct + "%";
      loanTenureLabel.textContent = years + (years === 1 ? " yr" : " yrs");

      const principal = investment * (1 - downPct / 100);
      const monthlyRate = ratePct / 100 / 12;
      const months = years * 12;
      const emi = monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
      const totalInterest = emi * months - principal;

      loanAmountEl.textContent = rupeesLakh(principal);
      loanEmiEl.textContent = rupees(emi);
      loanInterestEl.textContent = rupeesLakh(Math.max(totalInterest, 0));

      if (printBody) {
        printDate.textContent = "Generated " + new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        printBody.innerHTML = [
          ["Charger power", t.kw], ["Number of chargers", String(qty)],
          ["Total investment", rupeesLakh(investment)], ["Expression of Interest", rupees(eoi)],
          ["Projected monthly income*", rupees(income)], ["Assured minimum (24 mo.)*", rupees(assured)],
          ["Projected payback*", t.payback],
          ["Down payment", downPct + "%"], ["Loan amount", rupeesLakh(principal)],
          ["Interest rate (p.a.)", ratePct + "%"], ["Loan tenure", years + " yrs"],
          ["Estimated EMI / month", rupees(emi)], ["Total interest payable", rupeesLakh(Math.max(totalInterest, 0))],
        ].map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("");
      }
    };

    calcPower.addEventListener("input", render);
    loanDown.addEventListener("input", render);
    loanRate.addEventListener("input", render);
    loanTenure.addEventListener("input", render);
    qtyMinus.addEventListener("click", () => { qty = Math.max(1, qty - 1); render(); });
    qtyPlus.addEventListener("click", () => { qty = Math.min(10, qty + 1); render(); });

    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    if (downloadPdfBtn) downloadPdfBtn.addEventListener("click", () => window.print());

    render();
  }

  /* app showcase page — scroll-driven step highlight */
  const appSteps = document.querySelectorAll(".appflow__step");
  const appFill = document.getElementById("appflowFill");
  if (appSteps.length) {
    const total = appSteps.length;
    const aio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-active", entry.isIntersecting);
        });
        const activeIdx = Array.from(appSteps).findIndex((s) => s.classList.contains("is-active"));
        if (activeIdx > -1 && appFill) {
          appFill.style.height = ((activeIdx + 1) / total) * 100 + "%";
        }
      },
      { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" }
    );
    appSteps.forEach((s) => aio.observe(s));
  }
})();
