# Livanto Green — Marketing Website

A modern, fully responsive public-facing marketing site for **Livanto Green**,
an EV Charging Point Operator (CPO) building an AC/DC charging network across
India — with a real "Apply now" form for franchise and site partnership
enquiries, wired straight into the Livanto Green CRM.

The design synthesises cues from leading EV-charging sites:

| Reference | What we borrowed |
|-----------|------------------|
| [Ionity](https://www.ionity.eu/) | Premium dark hero, high-power emphasis, network focus |
| [Electra](https://www.go-electra.com/en/) | Confident, product-led storytelling |
| [Fastned](https://www.fastnedcharging.com/en) | Clean, driver-first UX, simple charger line-up |
| [ChargeZone](https://www.chargezone.co.in/) | Indian CPO context, franchise/partnership focus |

## Structure

```
website/
├── index.html      # single-page site (all sections, anchor nav)
├── styles.css       # design system + responsive layout
├── script.js        # nav, scroll-reveal, entity-type toggle, apply form
└── assets/
    └── favicon.svg
```

## Sections

Hero · Who we serve · Why Livanto Green · Solutions · Products · Software
ecosystem · Network · Why us · Sustainability · Franchise models · **Apply
now (the lead-capture form)** · About · Contact.

## The "Apply now" form → CRM pipeline

`#apply` is a single form covering all five ways someone can get in touch:
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
before the `script.js` tag in `index.html`:

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

- Pure HTML/CSS/vanilla JS, no dependencies (fonts via Google Fonts).
- Accessible: semantic landmarks, keyboard-friendly nav, `prefers-reduced-motion`.
- All copy is deliberately honest/placeholder-free of unverified numbers —
  swap in real traction stats, city coverage, and contact details
  (`hello@livantogreen.com` is a placeholder) once you have them.
- Deploy this as a static site (Firebase Hosting is the natural fit
  alongside the CRM's Firebase project) pointed at `livantogreen.com`,
  separate from the CRM's own `app.livantogreen.com` deployment.
