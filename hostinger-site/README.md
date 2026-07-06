# ⚡ Electriva — EV Charging Network Website (Hostinger-ready)

A complete multi-page website for an EV charging network (design inspired by
**Ionity** and **Statiq**), built with **plain PHP + HTML + CSS + JavaScript**.

- ✅ **No database** — stations, pricing and FAQs live in simple PHP arrays
- ✅ **No build step, no composer, no npm** — upload and it runs
- ✅ Works on any shared hosting with PHP 7.4+ (Hostinger, cPanel, etc.)
- ✅ Contact / partner / newsletter forms email you via PHP `mail()` **and**
  save a backup copy to `storage/leads.csv`
- ✅ Fully responsive, animated counters, interactive station map (Leaflet +
  OpenStreetMap — free, no API key)

---

## 🚀 Upload to Hostinger (5 minutes)

1. **Get the zip** — a ready-made **`electriva-hostinger.zip`** sits next to
   this folder in the repository. (Or make your own: select all files *inside*
   this folder — not the folder itself — and create a `.zip`. Important:
   `index.php` must be at the top level of the zip.)
2. Log in to **hPanel → Websites → Manage → File Manager**.
3. Open the **`public_html`** folder (delete Hostinger's default
   `default.php` if present).
4. Click **Upload → select your zip → right-click the zip → Extract** into
   `public_html`.
5. Visit your domain — the site is live. 🎉

> Uploading to a subfolder instead (e.g. `public_html/ev/`)? Open `.htaccess`
> and change `ErrorDocument 404 /404.php` to `/ev/404.php`.

---

## ✏️ Make it yours (one file for almost everything)

| What to change | Where |
|---|---|
| Brand name, email, phone, WhatsApp, address, socials, headline stats | `includes/config.php` |
| Charging stations on the map & list | `data/stations.php` (copy a block, edit, save) |
| Tariffs / prices | array at the top of `pricing.php` |
| FAQ questions | array at the top of `faq.php` |
| Colours & fonts | `:root` variables at the top of `assets/css/style.css` |
| Logo icon | `assets/img/favicon.svg` + the inline SVG in `includes/header.php` |

After editing, re-upload only the changed file via File Manager.

---

## 📬 Making the forms deliver reliably

The forms already work via PHP `mail()`, but for inbox (not spam) delivery on
Hostinger:

1. hPanel → **Emails** → create a mailbox, e.g. `noreply@yourdomain.com`
   and another like `hello@yourdomain.com`.
2. In `includes/config.php`, set `CONTACT_EMAIL` to the address where you
   want to receive enquiries.
3. Every submission is **also** appended to `storage/leads.csv` — download it
   any time from File Manager. The folder is blocked from the web by
   `.htaccess`, so it stays private. (If the CSV never appears, give the
   `storage` folder write permission: File Manager → right-click → 755.)

---

## 📄 Pages

| File | Page |
|---|---|
| `index.php` | Home — hero, stats, how it works, chargers, app, testimonials |
| `network.php` | Station finder — search, city & type filters, interactive map |
| `pricing.php` | Per-kWh tariffs, Prime membership, cost examples |
| `business.php` | CoCo / PoCo / Franchise models + partner lead form |
| `about.php` | Mission, journey timeline, values, impact |
| `faq.php` | Grouped FAQ accordions |
| `contact.php` | 24×7 channels + contact form |
| `404.php` | Friendly error page (wired via `.htaccess`) |
| `form-handler.php` | Processes all three forms (validation, honeypot spam trap, mail + CSV) |

## 🗂 Folder structure

```
├── index.php  network.php  pricing.php  business.php
├── about.php  faq.php  contact.php  404.php  form-handler.php
├── .htaccess  robots.txt
├── includes/   config.php · header.php · footer.php   (blocked from web)
├── data/       stations.php                           (blocked from web)
├── storage/    leads.csv backup of form submissions   (blocked from web)
└── assets/     css/ · js/ · img/
```

## 🧪 Test locally (optional)

```bash
php -S localhost:8000
# open http://localhost:8000
```

Note: `mail()` usually doesn't send from a local machine — that part works
once the site is on Hostinger. Submissions still land in `storage/leads.csv`.
