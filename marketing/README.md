# Livanto Green — Marketing Site (rebuild)

Next.js 14 (App Router) rebuild of the public marketing site, replacing the
static `../website` single-pager so the site can support real routing,
reusable components, and scroll-driven motion.

This was built incrementally, per an agreed step-by-step process. Current
state: **7 routes built** — `/`, `/solutions`, `/products`, `/technology`,
`/franchise`, `/about`, `/contact`. (`/network` was removed from
navigation and deleted per request — there was no real station-locator
data to back it; the real deployed-station photos it would have used now
live in the homepage's "Live on the ground" section instead.)

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
├── public/
│   ├── brand/                      # real photography (from Livanto_Profile.pdf)
│   └── products/                   # real product cutouts (from the "Hardware Portfolio" slide)
├── src/
│   ├── app/
│   │   ├── layout.js               # fonts, metadata, Navbar/Footer/SmoothScroll shell
│   │   ├── page.js                 # home: hero, ecosystem, solutions/products/tech
│   │   │                           #   previews, live deployments, franchise, final CTA
│   │   ├── globals.css             # design tokens + component layer
│   │   ├── solutions/page.js       # large storytelling blocks, no card grid
│   │   ├── products/{page.js,ProductsClient.jsx}  # power selector + full catalog
│   │   ├── technology/page.js      # scroll-driven phone + CMS + connectivity flow
│   │   ├── franchise/page.js       # real ROI calculator + real 7-step journey + landowner models
│   │   ├── about/page.js           # editorial: mission, market stats, clients, leadership
│   │   └── contact/page.js         # real contact info + enquiry-type selector
│   ├── components/
│   │   ├── Navbar.jsx / Footer.jsx
│   │   ├── Hero.jsx                # flagship hero: staggered entrance + scroll dissolve
│   │   ├── Card3D.jsx              # cursor-tilt 3D card, used across all pages
│   │   ├── Toggle.jsx              # sliding-pill segmented control
│   │   ├── ChargerGlyph.jsx        # abstract charger illustration (used on /solutions only —
│   │   │                           #   /products and the homepage now use real product photos)
│   │   ├── PhoneShowcase.jsx / PhoneScreens.jsx  # Electra-style scroll-driven app demo
│   │   ├── ConnectivityFlow.jsx    # animated vehicle→charger→cloud→CMS→app→driver flow
│   │   ├── FranchiseJourney.jsx    # interactive 7-step stepper (real steps, from lib/franchise.js)
│   │   ├── FranchiseCalculator.jsx # real, data-driven ROI calculator (6 franchise tiers)
│   │   ├── ContactForm.jsx
│   │   ├── StatCounter.jsx         # spring-animated number counter
│   │   ├── ScrollReveal.jsx / SmoothScrollProvider.jsx
│   │   └── SolutionBlock.jsx       # alternating large visual+copy block
│   └── lib/
│       ├── products.js             # real hardware catalog (Livanto Home/Wall/AC Dual/DC 60/120/240)
│       └── franchise.js            # real franchise investment model (6 tiers, from company xlsx)
└── tailwind.config.js               # brand colors, fluid display type scale
```

## Content sourcing

Every number and product name on this site comes from a real Livanto
Green source — nothing is invented:

- **Hardware**: the official company profile's "Hardware Portfolio" slide
  — Livanto Home (7.4kW), Livanto Wall (7.4/22kW), Livanto AC Dual (22kW),
  Livanto DC 60/120/240 (all dual-gun CCS2). Real product photography
  cropped from that same slide lives in `public/products/`.
- **Franchise economics** (`src/lib/franchise.js`): sourced verbatim from
  `Livanto_Franchise_BOM.xlsx` and `Livanto_Franchise_Investment_Model_New.xlsx`
  — investment, GST, down payment, EMI options, tariff structure,
  projected/assured income, payback period and ROI for all 6 charger
  tiers (60/90/120/180/240/360 kW). The franchise page's calculator reads
  directly from this file — update the file, not the component, if the
  model changes.
- **Franchise journey & models**: the real 7-step process (Partner → Land
  → Invest → Install → Operate → Revenue → Support) and the three
  landowner models (Full Investment / Revenue Share / Fixed Rental), both
  from the company profile.
- **About page**: real mission quote, real India EV-market stats (66.52%
  CAGR 2024–2030, Mordor Intelligence; 20M+ projected EVs by 2030; 1.6L+
  registered today), real client segments and OEM partners, real press
  mentions, and the CEO (Ashwani Dixit) as named leadership contact.
  Junior team members' personal phone numbers from the business-card PDF
  were deliberately **not** published on the public site (privacy —  a
  general business email is used instead).
- **Contact**: real business email (business@livantogreen.com) and both
  real office addresses (Noida, Lucknow), from the company profile and
  team business cards.
- **App**: features (find, reserve, OTP-based start, live monitoring,
  UPI/wallet payment, RFID) confirmed on livantogreen.com and the company
  profile's app screenshots.
- **Network**: only the `>95%` uptime commitment is a public, confirmed
  number — no live station/city/state count exists yet, so the old
  `/network` page (with placeholder stats) was removed rather than published
  with invented figures. Two real deployed-station photos (Lucknow,
  Dehradun) now live in the homepage instead.

Pricing exists in the source Excel files but is deliberately not surfaced
as a raw price list on the marketing pages (a "Get a quote" pattern is
used instead) — a design choice, not a data gap.

## Run it

```bash
cd marketing
npm install
npm run dev     # http://localhost:3100
```
