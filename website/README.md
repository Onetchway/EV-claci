# Livanto Green — Marketing Website

A modern, fully responsive public-facing marketing site for **Livanto Green**,
an EV Charging Point Operator (CPO) building an AC/DC charging network across
India — with a real "Apply now" form for franchise and site partnership
enquiries, wired straight into the Livanto Green CRM.

The design follows the actual visual grammar of Electra, bp pulse and
Statiq — reviewed directly from reference screenshots, not guessed from
memory:

| Reference | What we borrowed |
|-----------|------------------|
| [Electra](https://www.go-electra.com/en/) | Bold navy type on white, full-bleed real photography, pill buttons with a circular icon chip, no eyebrow-pill/card-grid template repeated on every section |
| [Statiq](https://www.statiq.in/) | Franchise-page structure: numbered process steps, investment breakdown |
| [bp pulse](https://www.bppulse.com/) | Real client-photography treatment, feature-grid pacing |

## Structure

A real multi-page site — separate HTML files with their own URLs, not one
page with anchor links:

```
website/
├── index.html       # Home — hero, real client logos, stat band, teasers, footer CTA
├── solutions.html    # Full solutions list (residential, highways, fleet, government)
├── products.html      # Individual charger cards — Home/Wall/AC Dual/DC 60/120/240
├── software.html      # Software ecosystem — driver & operator features, CMS preview
├── network.html        # Live stations (Lucknow, Dehradun) + network facts
├── franchise.html       # Franchise/site-partner models, 7-step process, investment table
├── apply.html             # The lead-capture application form (see below)
├── about.html              # Company + press/government-engagement strip
├── contact.html             # Contact details + link to apply.html
├── styles.css        # design system + responsive layout (single Inter typeface)
├── script.js         # nav, scroll-reveal, entity-type toggle, apply form
└── assets/
    ├── logo.png                    # real Livanto Green logo
    ├── hero-charging.jpg           # real Livanto charger + Tata Curvv.ev photo
    ├── station-lucknow.jpg / station-dehradun.jpg   # real live station photos
    ├── charger-*.jpg               # individual product photos, one per SKU
    ├── clients-*.jpg               # real client logos, grouped by segment
    └── favicon.svg
```

Every page shares the same header/footer markup (no build step, so it's
duplicated per file — standard for a plain static site); update all nine
files together when nav or footer links change.

## The "Apply now" form → CRM pipeline

`apply.html` carries a single form covering all five ways someone can get in touch:
Franchise partnership, Site/land partnership, Bulk charger purchase,
Corporate/fleet charging, and RWA/institutional. The selected option maps
straight onto a **CRM lead type** (`FRANCHISE` / `SITE` / `CHARGER_SALE` /
`CORPORATE` / `RWA`).

On submit, `script.js` POSTs the form as JSON to the CRM's public endpoint:

```
POST https://app.livantogreen.com/api/public/apply
```

That route (`crm/src/app/api/public/apply/route.ts`) validates the payload,
creates a new lead directly in Firestore via the Admin SDK (source
`WEBSITE`, stage `NEW`, unassigned — any Sales Manager/Admin can pick it up
or reassign it from the CRM's Leads view), and logs a `CREATED` activity
entry. No login or API key is required — it's a public intake endpoint, the
same pattern as the CRM's other `/api/public/*` routes, just reachable
cross-origin since this site and the CRM live on different domains.

If the CRM ever moves off `app.livantogreen.com`, update the endpoint in one
of two ways:
- Edit `APPLY_ENDPOINT` at the top of `script.js`, **or**
- Set `window.LIVANTO_APPLY_ENDPOINT` in an inline `<script>` tag before
  `script.js` loads (no code change needed on this side).

The CRM route only accepts requests from an allow-listed set of origins
(`PUBLIC_WEBSITE_ORIGINS` env var on the CRM, defaulting to
`livantogreen.com` + `www.livantogreen.com` + localhost for testing) — add
this site's real domain there if it changes.

A hidden honeypot field plus a submit-timing check on the server flag (not
block) suspiciously fast/bot-like submissions with a `flag:fast-submit` tag,
so a human can still review and dismiss them from the CRM rather than real
enquiries silently vanishing.

## Run it

It's a static site — no build step. Open `index.html` directly, or serve it:

```bash
cd website
python3 -m http.server 8080
# visit http://localhost:8080
```

To test the form against a local CRM dev server instead of production, add
before the `script.js` tag in `apply.html`:

```html
<script>window.LIVANTO_APPLY_ENDPOINT = "http://localhost:3100/api/public/apply";</script>
```

## Deploying to livantogreen.com (Firebase Hosting)

This folder has its own `firebase.json` + `.firebaserc`, targeting a
dedicated Firebase Hosting site (`livanto-green-web`) in the same Firebase
project as the CRM (`livanto-278b5`) — kept separate from the CRM's own App
Hosting backend at `app.livantogreen.com`.

One-time setup (Cloud Shell, from inside this `website/` directory):

```bash
firebase login --reauth
firebase hosting:sites:create livanto-green-web --project livanto-278b5
firebase deploy --only hosting:website
```

Then, in the [Firebase Console](https://console.firebase.google.com/project/livanto-278b5/hosting/sites) →
Hosting → the `livanto-green-web` site → **Add custom domain**, add both
`livantogreen.com` and `www.livantogreen.com`, and follow the verification
steps shown there. Firebase will give you the DNS records (A records and/or
a TXT verification record) to set at your domain registrar (GoDaddy) — this
replaces whatever A records are currently there (a prior session found the
domain's A records pointing at GoDaddy's own parking/forwarding service,
which is why the domain wasn't resolving).

To redeploy after future edits, just re-run `firebase deploy --only
hosting:website` from this directory.

## Notes

- Pure HTML/CSS/vanilla JS, no dependencies, no build step (fonts via Google Fonts).
- Accessible: semantic landmarks, keyboard-friendly nav, `prefers-reduced-motion`.
- Real logos and photos are sourced from Livanto Green's own company profile
  deck (client logo cards, live station photos, hardware line-up) — not
  stock imagery or illustration.
- All copy is deliberately honest/placeholder-free of unverified numbers —
  swap in real traction stats and city coverage once you have them.
  `info@livantogreen.com` is the live contact address used throughout.
- Deploy this as a static site (Firebase Hosting is the natural fit
  alongside the CRM's Firebase project) pointed at `livantogreen.com`,
  separate from the CRM's own `app.livantogreen.com` deployment.
