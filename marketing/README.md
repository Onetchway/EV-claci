# Livanto Green — Marketing Site (rebuild)

Next.js 14 (App Router) rebuild of the public marketing site, replacing the
static `../website` single-pager so the site can support real routing,
reusable components, and scroll-driven motion.

This was built incrementally, per an agreed step-by-step process. Current
state: **all 8 routes built** — `/`, `/solutions`, `/products`,
`/technology`, `/network`, `/franchise`, `/about`, `/contact`. Remaining
polish work: real product/station photography (currently an abstract
`ChargerGlyph` illustration stands in), a live network map once station
data is public, and real franchise ROI figures once commercial terms are
finalized (the franchise page deliberately routes to a custom-quote CTA
instead of showing invented numbers).

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
│   │   ├── layout.js               # fonts, metadata, Navbar/Footer/SmoothScroll shell
│   │   ├── page.js                 # home: hero, ecosystem, solutions/products/tech
│   │   │                           #   previews, network stats, franchise, final CTA
│   │   ├── globals.css             # design tokens + component layer
│   │   ├── solutions/page.js       # large storytelling blocks, no card grid
│   │   ├── products/{page.js,ProductsClient.jsx}  # power selector + full catalog
│   │   ├── technology/page.js      # scroll-driven phone + CMS + connectivity flow
│   │   ├── network/page.js         # stats (real + honest placeholders) + finder shell
│   │   ├── franchise/page.js       # journey stepper + "Livanto provides" + no-invented-ROI CTA
│   │   ├── about/page.js           # editorial: mission, approach, values
│   │   └── contact/page.js         # real contact info + enquiry-type selector
│   ├── components/
│   │   ├── Navbar.jsx / Footer.jsx
│   │   ├── Hero.jsx                # flagship hero: staggered entrance + scroll dissolve
│   │   ├── Card3D.jsx              # cursor-tilt 3D card, used across all pages
│   │   ├── Toggle.jsx              # sliding-pill segmented control
│   │   ├── ChargerGlyph.jsx        # abstract charger illustration (stand-in for photography)
│   │   ├── PhoneShowcase.jsx / PhoneScreens.jsx  # Electra-style scroll-driven app demo
│   │   ├── ConnectivityFlow.jsx    # animated vehicle→charger→cloud→CMS→app→driver flow
│   │   ├── FranchiseJourney.jsx    # interactive 7-step stepper
│   │   ├── ContactForm.jsx
│   │   ├── StatCounter.jsx         # spring-animated number counter
│   │   ├── ScrollReveal.jsx / SmoothScrollProvider.jsx
│   │   └── SolutionBlock.jsx       # alternating large visual+copy block
│   └── lib/products.js             # single source of truth for hardware specs
└── tailwind.config.js               # brand colors, fluid display type scale
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
