# Electriva — Marketing Website

A modern, fully responsive public-facing marketing site for **Electriva**, a
leading EV Charging Point Operator (CPO) in India and a brand of Zivah
International Private Limited.

The design synthesises cues from four leading EV-charging sites:

| Reference | What we borrowed |
|-----------|------------------|
| [Ionity](https://www.ionity.eu/) | Premium dark hero, high-power emphasis, network focus |
| [Blink Charging](https://blinkcharging.com/) | Segmented solutions (residential / fleet / government) |
| [Monta](https://monta.com/) | Friendly software cards, app showcase, clear CTAs |
| [Statiq](https://www.statiq.in/) | Indian CPO context, animated stat counters, green identity |

Content (stats, products, partners, journey, business models) is taken from the
**“We Are Electriva” company profile**.

## Structure

```
website/
├── index.html      # single-page site (all sections, anchor nav)
├── styles.css      # design system + responsive layout
├── script.js       # nav, scroll-reveal, animated counters, lead form
└── assets/
    └── favicon.svg
```

## Sections

Hero · Trust bar · Traction stats · Solutions · Products · Software ecosystem ·
Network · Why Electriva · Sustainability · Franchise (CoCo / PoCo) · Journey
timeline · Contact form · Footer.

## Run it

It's a static site — no build step. Open `index.html` directly, or serve it:

```bash
cd website
python3 -m http.server 8080
# visit http://localhost:8080
```

## Notes

- Pure HTML/CSS/vanilla JS, no dependencies (fonts via Google Fonts).
- Accessible: semantic landmarks, keyboard-friendly nav, `prefers-reduced-motion`.
- The contact form is a front-end demo; wire it to the existing backend
  (`/backend`) or a form service to capture leads.
