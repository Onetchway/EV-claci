# NAKJM Infrastructure — corporate website

A responsive, five-page marketing site for **NAKJM Infrastructure Pvt Ltd**, a
next-generation EPC company delivering turnkey civil, electrical and EV charging
infrastructure across India.

## Reference and content

The **structure and layout language** are modelled on
[bv.com (Black & Veatch)](https://www.bv.com/) — the utility bar and mega-nav,
the statement hero, the quick-links strip, the stats band, the three-card
solutions spotlight, the lifecycle rail, the project card grids and the closing
CTA banner all follow that pattern. Brand, colour and copy are NAKJM's own.

All **content** — mission, vision, core values, the three-pillar stack, the
execution flow, charging network tiers, hub anatomy, safety protocols, client
list, project economics and contact details — comes from the *NAKJM
Infrastructure* company profile deck. The project photography is extracted from
that same deck.

## Structure

```
nakjm-website/
├── index.html              # Home — hero, stats, problem/solution, stack,
│                           #   solutions, execution flow, projects, clients,
│                           #   safety, CTA
├── capabilities.html       # Three pillars in depth, charging networks,
│                           #   hub anatomy, execution flow, safety & QA
├── projects.html           # Marquee clients table + project galleries
├── about.html              # Mission, vision, values, footprint, workforce
├── contact.html            # Contact details + project enquiry form
├── assets/
│   ├── styles.css          # Design system + responsive layout
│   ├── script.js           # Nav, scroll reveal, animated counters, form
│   ├── logo.svg            # Wordmark (dark, for light backgrounds)
│   ├── logo-light.svg      # Wordmark (light, for the footer)
│   ├── favicon.svg
│   └── img/                # Project photography (17 images)
├── firebase.json           # Firebase Hosting config
├── deploy-gcs.sh           # One-command Cloud Storage deploy
└── DEPLOY-GOOGLE-CLOUD.md  # Step-by-step hosting guide
```

## Design system

| Token | Value | Used for |
|---|---|---|
| Navy | `#1B2A4A` / `#16233D` | Headings, nav, hero and footer backgrounds |
| Orange | `#E9722B` | Primary actions, stat figures, accents |
| Red | `#D6202A` | Logo mark only |
| Paper | `#F7F8FA` | Alternating section backgrounds |
| Type | Inter 400–800 | Everything |

## Run it locally

No build step, no dependencies:

```bash
cd nakjm-website
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly in a browser also works.

## Deploy

See **[DEPLOY-GOOGLE-CLOUD.md](DEPLOY-GOOGLE-CLOUD.md)** for a full walkthrough
of three Google Cloud options. The short version:

```bash
# Firebase Hosting — free HTTPS + custom domain (recommended)
npm install -g firebase-tools
firebase login
cd nakjm-website && firebase use --add
firebase deploy --only hosting

# or Cloud Storage bucket
./deploy-gcs.sh your-bucket-name your-project-id
```

## Notes

- Pure HTML/CSS/vanilla JS. The only external request is Google Fonts.
- Accessible: semantic landmarks, skip link, keyboard-operable nav, visible
  focus rings, `prefers-reduced-motion` support, and content that stays visible
  when JavaScript is unavailable.
- **The contact form is a front-end demo — it does not submit anywhere yet.**
  Wire it to a form service or to the `/backend` in this repository before
  launch. Handler: bottom of `assets/script.js`.
- Client names in the trust band are set as text. Swap in official logo files
  only once you have permission to use each mark.
