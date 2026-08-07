# NAKJM Infrastructure — corporate website

The official website for **NAKJM Infrastructure Pvt. Ltd.**, built as a
statically-exported Next.js application and deployed to Firebase Hosting.

> **Building Tomorrow, Together.**

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, `output: "export"`) | Every page pre-renders to static HTML — nothing to keep warm, CDN-fast everywhere |
| UI | React 19 + TypeScript (strict) | `noUncheckedIndexedAccess` on; no `any` in the codebase |
| Styling | Tailwind CSS 3.4 with a custom token layer | No component library, no Bootstrap — every page is bespoke |
| Scroll | Lenis + GSAP ScrollTrigger | One shared ticker so pinned sections never jitter against inertial scroll |
| Micro-animation | Framer Motion | Reveals, staggers, page transitions, layout animation on the project filter |
| Forms | React Hook Form + Zod | Typed schema shared between the form and its error messages |
| Backend | Firebase Function (`asia-south1`) | Enquiry handler: stores to Firestore, then emails |

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in the values you need
npm run dev                    # http://localhost:3000
```

Nothing in `.env` is required to run locally. Analytics IDs are optional —
leave them blank and no analytics scripts are emitted at all.

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build + static export to `out/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next.js lint |
| `npm run serve` | Firebase Hosting emulator against `out/` |
| `npm run deploy` | Build, then deploy hosting only |
| `npm run deploy:all` | Build, then deploy hosting **and** functions |

---

## Structure

```
src/
├── app/                       route segments — one folder per page
│   ├── layout.tsx             shell: fonts, schema, header, footer, providers
│   ├── page.tsx               home
│   ├── services/[slug]/       six generated service pages
│   ├── projects/[slug]/       nine generated project pages
│   ├── sitemap.ts             generated from the data layer
│   ├── robots.ts
│   └── not-found.tsx          404
├── components/
│   ├── layout/                Header (dropdowns + mobile sheet), Footer, PageHero
│   ├── home/                  Hero, PinnedProcess, HorizontalProjects, Timeline…
│   ├── sections/              ProjectGallery (filterable masonry)
│   ├── forms/                 ContactForm
│   ├── ui/                    Reveal, SplitText, Counter, Button, ImageReveal…
│   ├── providers/             SmoothScroll (Lenis ↔ GSAP bridge)
│   └── shared/                ScrollProgress, WhatsAppFloat, PageTransition, Analytics
├── hooks/                     useGSAP, useReducedMotion, useScrollProgress
├── lib/
│   ├── site.ts                single source of truth for company facts + nav
│   ├── data/                  services, projects, company (timeline, sectors, news…)
│   ├── schema.ts              JSON-LD builders
│   ├── seo.ts                 buildMetadata()
│   └── validation.ts          Zod enquiry schema
└── types/
```

**All copy and data live in `src/lib/data/`.** To add a project or a service,
add an object there — the listing page, the detail page, `generateStaticParams`
and the sitemap all pick it up automatically.

---

## Design system

| Token | Value |
|---|---|
| Primary | `#001E4B` (`navy`) |
| Secondary | `#C1121F` (`crimson`) |
| Dark | `#0A0A0A` (`carbon`) · deepest navy `#00132F` |
| Gray | `#F7F7F7` (`mist`) |
| Text | `#111111` (`ink`) |
| Type | Inter — 300 / 400 / 500 / 700 / 900 |

Type is a fluid scale (`text-display`, `text-headline`, `text-title`,
`text-lede`, `text-eyebrow`) that interpolates with the viewport, so there are
no breakpoint jumps in headline size. Sections use `py-section`
(`clamp(6rem, 13vw, 14rem)`) — the whitespace is deliberate and load-bearing.

The house headline device is a two-part statement with the second phrase in
crimson, which `SectionHeading` and `PageHero` both take as an `accent` prop.

---

## Motion

Everything is progressive enhancement. **With JavaScript disabled the pages
render complete and readable**, and every effect is disabled under
`prefers-reduced-motion` — verified, not assumed.

- **Lenis + GSAP share one ticker** (`SmoothScroll`). Without this the two run
  on separate clocks and pinned sections visibly jitter.
- **`useGSAP`** wraps setup in a `gsap.context()` so tweens and ScrollTriggers
  revert together on unmount — the usual source of duplicated pins during
  client-side navigation.
- **Pinned process** (home): the left plate pins while nine stages scroll past,
  cross-fading images and advancing an 01/09 readout. Unpins below 1024px.
- **Horizontal project rail**: scrub-driven translation while pinned; falls back
  to a native swipeable rail on touch, which feels better than hijacked scroll.
- **Masked word reveals**, image wipe-reveals, scroll-linked parallax, magnetic
  buttons, animated counters, page-transition curtain, infinite logo marquee.

---

## SEO

- Per-page canonical, OpenGraph and Twitter card metadata via `buildMetadata()`
- JSON-LD: Organization, WebSite, LocalBusiness (site-wide); Service, CreativeWork
  (project), BreadcrumbList and FAQPage on the relevant pages
- `sitemap.xml` and `robots.txt` generated from the data layer
- Semantic landmarks, a skip link, and descriptive `alt` text throughout

**Set `NEXT_PUBLIC_SITE_URL` before deploying.** Every canonical, OG and sitemap
URL derives from it; left at the default, search engines are pointed at
`https://www.nakjiminfra.com`.

---

## The enquiry form

`functions/index.js` handles `POST /api/enquiry` (routed by the rewrite in
`firebase.json`). It:

1. Parses the multipart body with Busboy — 5 files, 10 MB each, never touching disk
2. Drops silently on a filled honeypot field
3. Validates required fields and email shape server-side, not just in the browser
4. **Writes to Firestore first**, so a mail outage can never lose a lead
5. Then emails the enquiry with attachments via SMTP

Configure the secrets before deploying functions:

```bash
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set MAIL_TO
```

If `SMTP_HOST` is unset the function still stores the lead and logs a warning —
it does not fail the visitor's submission.

`firestore.rules` denies all client access to the `enquiries` collection; only
the Admin SDK inside the function can write there.

---

## Deploying

```bash
npm install -g firebase-tools
firebase login
```

Set your project id in `.firebaserc` (currently `nakjm-infrastructure`), then:

```bash
npm run deploy       # hosting only
npm run deploy:all   # hosting + the enquiry function
```

`firebase.json` sets long-lived immutable caching on `/_next/static` and fonts,
30-day caching on images, `must-revalidate` on HTML, and security headers
(HSTS, nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy).

---

## Images

Static export has no image optimisation server, so `images.unoptimized` is on
and assets are pre-encoded instead: every JPEG in `public/images/` ships with a
matching WebP (2.69 MB → 1.20 MB across the set).

**Known limitation, worth stating plainly:** the project photography is
extracted from the company profile deck, where each slide is a single 1672×941
flattened image. That is the ceiling on their resolution — no processing
recovers detail the source does not contain. Replacing `public/images/*.jpg`
with the original photographs is the single biggest visual upgrade available to
this site.

---

## Before launch

- [ ] Set `NEXT_PUBLIC_SITE_URL` to the live origin
- [ ] Set the Firebase functions secrets above
- [ ] Add `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_GTM_ID` if analytics are wanted
- [ ] Replace deck-extracted photography with originals
- [ ] Confirm trademark permission for the client logos in `public/images/clients/`
      — a client relationship is not by itself a licence to display a mark
- [ ] Confirm the two partner spellings carried over from the source deck:
      **Norbeorker** (2020) and **Livanto Green** (2024)
