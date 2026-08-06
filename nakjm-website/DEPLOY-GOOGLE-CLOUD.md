# Hosting the NAKJM website on Google Cloud

The site is plain HTML, CSS, JS and images — there is no build step and no server
code. That means you can host it as static files, which is the cheapest and
simplest option on Google Cloud.

Three routes are covered below. **If you just want it live quickly with a real
domain and free HTTPS, use Option B (Firebase Hosting).** If you specifically
want to upload files into a bucket by hand, use Option A.

| | Option A — Cloud Storage | Option B — Firebase Hosting | Option C — Cloud Run |
|---|---|---|---|
| Setup effort | Low | Lowest | Medium |
| HTTPS on your domain | Needs a Load Balancer (paid) | Free, automatic | Free, automatic |
| CDN | Extra setup | Built in | Built in |
| Cost at low traffic | ~₹0–50/month | Free tier usually covers it | Scales to zero |
| Best when | You want raw file control | You want a live public site fast | You will add a backend later |

Prerequisite for all options: a Google account and a Google Cloud project. If
you have never used Google Cloud, start at <https://console.cloud.google.com>
and create a project (note its **Project ID** — it is not the same as the
project name).

---

## Option A — Cloud Storage bucket (direct file upload)

This is the "just upload the files" route. You can do the whole thing in the
browser, no command line needed.

### A1. Create a project

1. Go to <https://console.cloud.google.com>.
2. Click the project dropdown in the top bar → **New Project**.
3. Name it e.g. `nakjm-infra` → **Create**.
4. Wait for it to finish, then make sure it is selected in the top bar.

> Billing: Cloud Storage requires billing to be enabled on the project. Go to
> **Billing** in the left menu and link a billing account. At this site's size
> and traffic, the cost is typically a few rupees a month, and new accounts get
> free credit.

### A2. Create the bucket

1. In the left menu choose **Cloud Storage → Buckets** → **Create**.
2. **Name**: must be globally unique across all of Google Cloud. If you own the
   domain, using the domain name (e.g. `nakinfrajm.com`) makes step A7 easier.
   Otherwise pick something like `nakjm-website-2026`.
3. **Location type**: Region → `asia-south1 (Mumbai)` — closest to your users in
   India.
4. **Storage class**: Standard.
5. **Access control**: choose **Uniform**.
6. **Important**: uncheck **Enforce public access prevention on this bucket**.
   You cannot serve a public website with it enabled.
7. Click **Create**.

### A3. Upload the site files

1. Open the bucket you just created.
2. Click **Upload files** and select every file from the `nakjm-website` folder:
   `index.html`, `about.html`, `capabilities.html`, `projects.html`,
   `contact.html`.
3. Click **Upload folder** and select the `assets` folder. This uploads
   `styles.css`, `script.js`, the logos and the `img` folder in one go.

The bucket should now contain the five HTML files plus an `assets/` folder.

> **Folder structure matters.** The pages reference `assets/styles.css`, so
> `assets` must sit next to the HTML files at the top level of the bucket, not
> inside another folder. If the site loads as unstyled text, this is why.

### A4. Make the files public

1. In the bucket, open the **Permissions** tab.
2. Click **Grant access**.
3. **New principals**: type `allUsers`.
4. **Role**: choose **Cloud Storage → Storage Object Viewer**.
5. **Save**, then confirm **Allow public access** on the warning dialog.

### A5. Set the front page

1. Still in the bucket, open the **Configuration** tab (on some layouts this is
   under the bucket's overflow menu → **Edit website configuration**).
2. Set **Index (main) page suffix** to `index.html`.
3. Set **Error (404) page** to `index.html`.
4. Save.

### A6. Check it is live

Open:

```
https://storage.googleapis.com/YOUR-BUCKET-NAME/index.html
```

The site should load with images and styling. **At this point it is live on the
public internet.** Options A7 and beyond are only about putting it on your own
domain.

### A7. Put it on your own domain with HTTPS

The bucket URL above is public but ugly, and `https://` on your own domain needs
one more piece: an HTTPS Load Balancer. This is the part that costs money
(roughly ₹1,500–2,000/month for the forwarding rule), which is why **Firebase
Hosting (Option B) is usually the better choice for a marketing site.**

If you still want the Load Balancer route:

1. **Network Services → Load balancing** → **Create load balancer**.
2. Choose **Application Load Balancer (HTTP/S)** → **Public facing (external)**
   → **Global**.
3. **Frontend**: protocol HTTPS, create a new **Google-managed SSL certificate**
   for `nakinfrajm.com` and `www.nakinfrajm.com`. Reserve a new static IP.
4. **Backend**: **Create a backend bucket**, point it at your bucket, and tick
   **Enable Cloud CDN**.
5. Create the load balancer and copy the static IP address it gives you.
6. At your domain registrar, create an **A record** pointing `@` (and `www`) to
   that IP.
7. Wait — the managed certificate takes 15–60 minutes to go from PROVISIONING to
   ACTIVE. The site will show a certificate error until it does.

### A8. Updating the site later

Re-upload the changed files into the bucket (overwriting is fine). If a change
does not show up, it is browser or CDN caching — hard-refresh with
`Ctrl+Shift+R`, and if you enabled Cloud CDN, use **Cache invalidation** on the
load balancer.

### A8-alt. Doing all of A with one command

If you have the `gcloud` CLI installed (<https://cloud.google.com/sdk/docs/install>),
the included script does steps A2–A5 and the upload in one go:

```bash
cd nakjm-website
chmod +x deploy-gcs.sh
gcloud auth login
./deploy-gcs.sh your-bucket-name your-project-id
```

Re-run the same command any time you want to push updates.

---

## Option B — Firebase Hosting (recommended)

Firebase is part of Google Cloud. This gets you a global CDN, free automatic
HTTPS and a free custom domain, and it is genuinely a two-minute job.

### B1. Install the CLI

You need Node.js installed first (<https://nodejs.org>), then:

```bash
npm install -g firebase-tools
```

### B2. Log in

```bash
firebase login
```

A browser window opens — sign in with the Google account that owns the project.

### B3. Connect the folder to a project

```bash
cd nakjm-website
firebase use --add
```

Pick your Google Cloud project from the list. (If it does not appear, open
<https://console.firebase.google.com>, click **Add project**, and select your
existing Google Cloud project.)

A `firebase.json` is already included in this folder, with sensible cache
headers, so you do **not** need to run `firebase init hosting`. If you do run
it, answer:

- Public directory: `.` (a single dot)
- Configure as a single-page app: **No**
- Overwrite `index.html`: **No** ← important, this would delete the homepage

### B4. Go live

```bash
firebase deploy --only hosting
```

The command prints your live URL, something like:

```
https://nakjm-infra.web.app
```

**The site is now live.** Every future update is the same one command.

### B5. Add your own domain

1. Open <https://console.firebase.google.com> → your project → **Hosting**.
2. Click **Add custom domain** and enter `nakinfrajm.com`.
3. Firebase shows you TXT and A records — add them at your domain registrar.
4. Wait for verification (usually under an hour). The SSL certificate is issued
   automatically and free.

### B6. Preview before publishing

To show a draft to someone without touching the live site:

```bash
firebase hosting:channel:deploy preview
```

This gives a temporary URL that expires after 7 days.

---

## Option C — Cloud Run (container)

Only worth it if you plan to add a backend later (a real contact-form handler,
an API, server-side rendering). For static files it is more moving parts than
you need.

### C1. Add a Dockerfile

Create `Dockerfile` inside `nakjm-website`:

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 8080
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]
```

Cloud Run requires the container to listen on the port in `$PORT`, which
defaults to 8080 — hence the `sed` line.

### C2. Deploy

```bash
cd nakjm-website
gcloud run deploy nakjm-website \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated
```

Answer **yes** when it offers to enable the required APIs and create an Artifact
Registry repository. After a few minutes it prints a live `https://...run.app`
URL with HTTPS already working.

### C3. Custom domain

```bash
gcloud beta run domain-mappings create \
  --service nakjm-website \
  --domain nakinfrajm.com \
  --region asia-south1
```

Then add the DNS records it prints at your registrar.

---

## Troubleshooting

**The page loads but has no styling or images.**
The `assets` folder is not sitting next to the HTML files. Check the bucket root
contains `index.html` and `assets/` as siblings.

**"Access denied" or the browser downloads a file instead of showing it.**
The `allUsers` / Storage Object Viewer permission from step A4 was not applied,
or public access prevention is still enforced on the bucket.

**403 when creating the bucket.**
Billing is not enabled on the project.

**The contact form does not send anything.**
That is expected — it is currently a front-end demo. To make it work, either
point it at a form service (Formspree, Basin) by setting the `<form>` action, or
wire it to the existing `/backend` in this repository. The form is in
`contact.html` and its submit handler is at the bottom of `assets/script.js`.

**Bucket name already taken.**
Cloud Storage bucket names are globally unique across every Google Cloud
customer. Add a suffix, e.g. `nakjm-website-2026`.

---

## Which should you actually pick?

For a company marketing site like this one, **Option B (Firebase Hosting)** is
the right answer: free HTTPS, free custom domain, global CDN, and updates are a
single `firebase deploy`. Option A is the better fit only if a requirement says
the files must live in a Cloud Storage bucket you control directly.
