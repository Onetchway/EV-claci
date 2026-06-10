# ElectriVa — Corporate Website

A fast, fully-responsive, **static** marketing website for **ElectriVa** (a brand of
Zivah International Private Limited) — a leading EV Charging Point Operator in India.

The design takes inspiration from leading EV-charging brands (Statiq, Blink Charging,
IONITY, Monta) and follows the ElectriVa brand guidelines (green + dark-green palette,
"Powering the Future of Electric Mobility").

## ✨ What's inside

| Page | File | Purpose |
|------|------|---------|
| Home | `index.html` | Hero, capabilities, products, traction, software, EPC, CTA |
| Solutions | `solutions.html` | Software/CSMS, turnkey EPC, business model |
| Products | `products.html` | AC, DC fast chargers & battery swapping |
| Network | `network.html` | Coverage, stats, partnerships, customer ecosystem |
| Franchise | `franchise.html` | PoCo partner model + application form |
| About | `about.html` | Story, timeline, mission & values |
| Contact | `contact.html` | Contact info + enquiry form |

Plus: `404.html`, `robots.txt`, `sitemap.xml`, `.htaccess`, brand assets and a tiny
vanilla-JS file. **No build step, no dependencies** — pure HTML/CSS/JS.

## 🚀 Deploy to Hostinger (or any host)

This is a plain static site, so it works on virtually any hosting:

### Option A — Hostinger (hPanel / shared hosting)
1. Log in to Hostinger → **hPanel** → **Files → File Manager**.
2. Open the `public_html` folder of your domain.
3. Upload **the contents of this `website/` folder** (not the folder itself) — i.e.
   `index.html`, the `css/`, `js/`, `assets/` folders, `.htaccess`, etc. should sit
   directly inside `public_html`.
   - Easiest: zip the contents, upload the zip, then "Extract" inside File Manager.
4. Visit your domain — the site is live. The included `.htaccess` enables clean URLs,
   gzip, caching and the custom 404 page automatically.

### Option B — FTP
Connect with FileZilla using your Hostinger FTP credentials and upload everything
inside `website/` to `public_html`.

### Option C — Netlify / Vercel / GitHub Pages / Cloudflare Pages
Drag-and-drop the `website/` folder (or point the host at it). Set the publish
directory to `website`. No build command needed.

## 🛠 Run locally
Just open `index.html` in a browser, or serve the folder:
```bash
cd website
python3 -m http.server 8080
# open http://localhost:8080
```

## 🎨 Customising
- **Colours & fonts:** edit the CSS variables at the top of `css/styles.css` (`:root`).
- **Logo/favicon:** `assets/favicon.svg` and the inline SVG in each header.
- **Content:** all copy lives directly in the HTML files.
- **Contact / franchise forms:** currently use a front-end demo handler
  (`js/main.js`). To actually receive submissions, point the `<form>` `action`
  to a service such as [Formspree](https://formspree.io), Web3Forms, or your own
  endpoint, and remove the `data-demo` attribute.
- **Domain references:** update `electriva.in`, phone numbers and email addresses
  (search the project) and the URLs in `sitemap.xml` / `robots.txt`.

---
© ElectriVa · Zivah International Private Limited.
