# NAKJM Infrastructure — corporate website

A responsive, five-page marketing site for **NAKJM Infrastructure Pvt Ltd**, a
next-generation EPC company delivering turnkey civil, electrical and EV charging
infrastructure across India.

> **Building Tomorrow, Together.**

## Reference and source material

The **layout language** follows two established engineering-corporation sites:
[bv.com (Black & Veatch)](https://www.bv.com/) for the utility bar, quick-links
strip, capability sections and closing CTA banner, and
[larsentoubro.com (L&T)](https://www.larsentoubro.com/) for the full-bleed
statement hero, dark stat band, full-bleed feature strips and the overlaid
portfolio tiles.

**Brand, content and photography** all come from the *NAKJM Infrastructure*
company profile deck: the navy/red palette and logo, mission and vision, core
values, the three-pillar stack, the nine-stage execution flow, charging network
tiers, turnkey hub anatomy, safety protocols, the tier-1 OEM/CPO client list,
marquee project economics, operating footprint and contact details. The project
photography is extracted from that same deck at full render resolution.

## Structure

```
nakjm-website/
├── index.html              # Home — hero, stats, problem/solution, the stack,
│                           #   charging strip, mega hubs, execution flow,
│                           #   clients, safety, CTA
├── capabilities.html       # Three pillars, charging networks, hub anatomy,
│                           #   execution flow, safety & QA
├── projects.html           # Mega hubs, project economics, OEM/CPO deployments,
│                           #   industrial backend, beyond-EV work
├── about.html              # Mission, vision, values, impact, advantage,
│                           #   footprint, workforce
├── contact.html            # Contact details + project enquiry form
├── 404.html                # Branded not-found page
├── sitemap.xml             # The five public pages
├── robots.txt
├── assets/
│   ├── styles.css          # Design system + responsive layout
│   ├── script.js           # Nav, scroll reveal, animated counters, form
│   ├── logo.png            # Official logo, transparent background
│   ├── logo-light.png      # Official logo recoloured for the navy footer
│   ├── favicon.svg
│   └── img/                # Project photography
│       └── clients/        # The twelve OEM / CPO client marks
├── build.py                # Regenerates the pages from a shared shell
├── firebase.json           # Firebase Hosting config
├── deploy-gcs.sh           # One-command Cloud Storage deploy
└── DEPLOY-GOOGLE-CLOUD.md  # Step-by-step hosting guide
```

`build.py` emits the pages from one shared header/footer so the nav, footer and
contact details stay consistent. The committed HTML **is** the deliverable — you
can edit it directly and ignore the script, but if you change something shared
across all pages, editing `build.py` and re-running `python3 build.py` is less
error-prone.

## The enquiry form

`assets/script.js` starts with two constants:

```js
var FORM_ENDPOINT = "";                        // POST target
var FORM_MAILTO   = "connect@nakjiminfra.com"; // fallback
```

With `FORM_ENDPOINT` empty (the default) a submission opens the visitor's mail
client with every field pre-filled and addressed to `FORM_MAILTO` — so enquiries
reach you on a purely static host with no backend at all.

Set `FORM_ENDPOINT` to a URL that accepts a `POST` — a Formspree or Basin form,
a Cloud Function, or the `/backend` in this repository — and submissions are
sent there over `fetch` instead, with success and failure messages handled
in-page.

## Design system

| Token | Value | Used for |
|---|---|---|
| Navy 900 | `#00132F` | Utility bar, footer, hero scrim |
| Navy 800 | `#001E4B` | Brand navy — headings, dark sections, stat band |
| Red 600 | `#B90F19` | Brand red — accents, eyebrows, primary buttons |
| Ink / Body | `#0D1526` / `#4B566B` | Headings and body copy |
| Paper | `#F4F6F9` | Alternating section backgrounds |
| Display type | Montserrat 700/800 | Headlines, numerals, table headers |
| Body type | Inter 400–700 | Everything else |

Headlines follow the deck's device of setting the second phrase in red — in
markup that is `<span class="accent">`.

## Run it locally

No build step, no dependencies:

```bash
cd nakjm-website
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly in a browser also works.

## Deploy

See **[DEPLOY-GOOGLE-CLOUD.md](DEPLOY-GOOGLE-CLOUD.md)** for the full
walkthrough. The short version:

```bash
# Cloud Storage bucket — upload the files and make them public
./deploy-gcs.sh your-bucket-name your-project-id

# or Firebase Hosting — free HTTPS + custom domain
npm install -g firebase-tools && firebase login
cd nakjm-website && firebase use --add
firebase deploy --only hosting
```

## Accessibility

Semantic landmarks, a skip link, keyboard-operable navigation, visible focus
rings, `prefers-reduced-motion` support, and content that stays visible when
JavaScript is unavailable. All text was checked against its background: body
copy meets WCAG AA and the large display numerals meet the large-text
threshold. Verified free of horizontal overflow at 320, 390, 768, 1024 and
1440px.

## SEO

Every page carries a canonical URL, Open Graph and Twitter card tags, and a
theme colour. The homepage additionally emits `Organization` JSON-LD covering
the company name, logo, postal address and contact point. `sitemap.xml` and
`robots.txt` both point at `https://www.nakjiminfra.com` — **update `SITE` in
`build.py` and re-run it if the site is served from a different domain**,
otherwise the canonical tags will point at the wrong host.

## Before launch

- **Confirm the domain.** `SITE` in `build.py` is set to
  `https://www.nakjiminfra.com`. If you launch on a Cloud Storage bucket URL or
  a different domain, change it and re-run the build so the canonical, Open
  Graph and sitemap URLs are correct.
- **Decide how the form should deliver.** The mailto fallback works today; point
  `FORM_ENDPOINT` at a service if you want submissions posted server-side.
- **Client logos are taken from your company deck.** Confirm you hold permission
  to display each mark publicly — a client relationship does not by itself grant
  trademark use on a marketing site.
- **Photography is extracted from the deck.** Replace with original
  high-resolution files where you have them; several deck images are
  renders/visualisations rather than site photographs.
