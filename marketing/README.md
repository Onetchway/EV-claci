# Livanto Green — Marketing Site (rebuild)

Next.js 14 (App Router) rebuild of the public marketing site, replacing the
static `../website` single-pager so the site can support real routing,
reusable components, and scroll-driven motion.

This is being built incrementally, one step at a time, per an agreed
step-by-step process. Current state: **design system + navbar/footer +
home hero**. Everything else (ecosystem, solutions, products, technology,
network, franchise, final CTA, and the remaining six pages) is still to
come.

## Stack

- **Next.js 14** (App Router), plain `.js`/`.jsx` — no TypeScript, to match
  the rest of this repo.
- **Tailwind CSS** for the design system (colors, fluid type scale via
  `clamp()`, spacing) — extended in `tailwind.config.js`, not the default
  palette.
- **Framer Motion** for scroll reveals, staggered entrances, and
  scroll-linked transforms (the hero's scale/parallax dissolve).
- **Lenis** for smooth scrolling.

No other animation library is included — GSAP/ScrollTrigger would only be
added later if a specific section (e.g. pinned/horizontal storytelling)
genuinely needs finer control than Framer Motion gives.

## Structure

```
marketing/
├── src/
│   ├── app/
│   │   ├── layout.js      # fonts, metadata, Navbar/Footer/SmoothScroll shell
│   │   ├── page.js        # home page (hero built; rest pending)
│   │   └── globals.css    # design tokens + component layer (@layer components)
│   └── components/
│       ├── Navbar.jsx     # sticky nav: transparent-over-hero → compact on scroll
│       ├── Footer.jsx
│       ├── Hero.jsx       # flagship hero: staggered entrance + scroll dissolve
│       ├── ScrollReveal.jsx
│       └── SmoothScrollProvider.jsx
└── tailwind.config.js     # brand colors, fluid display type scale
```

## Content sourcing

All product names, power ratings, connectors, and certifications must come
from **livantogreen.com** — nothing is invented. Confirmed so far:

- AC: 7.4 kW (Type-2)
- AC display/advertising: 22 kW AD Wall Charger (15.6" HD display)
- DC: 30 kW, 60 kW (ARAI certified, dual CCS2, dynamic load balancing),
  120 kW, 180 kW, 240 kW (dual CCS2), 360 kW — all CCS2
- App: station discovery, reservation, multi-mode payments (card/UPI/
  wallet), wallet balance, OTP-based session start, live session monitoring
- Backend: OCPP management, analytics dashboard, payments, 24/7 monitoring
- Network claim: ">95% uptime", no public station/city/state counts yet —
  use placeholders, not invented figures, until real numbers are supplied

Pricing exists on the source site but is deliberately not surfaced on the
marketing pages (a "Get a quote" pattern is used instead) — a design
choice, not a data gap.

## Run it

```bash
cd marketing
npm install
npm run dev     # http://localhost:3100
```
