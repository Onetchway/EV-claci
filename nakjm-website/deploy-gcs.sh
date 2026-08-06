#!/usr/bin/env bash
#
# Deploy the NAKJM website to a public Google Cloud Storage bucket.
#
#   ./deploy-gcs.sh <bucket-name> [project-id]
#
# Example:
#   ./deploy-gcs.sh nakjm-website nakjm-infra
#
# Requires the gcloud CLI, authenticated with `gcloud auth login`.
# See DEPLOY-GOOGLE-CLOUD.md for the full walkthrough.

set -euo pipefail

BUCKET="${1:-}"
PROJECT="${2:-}"

if [[ -z "$BUCKET" ]]; then
  echo "Usage: $0 <bucket-name> [project-id]" >&2
  exit 1
fi

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "$PROJECT" ]]; then
  echo "==> Setting project to $PROJECT"
  gcloud config set project "$PROJECT"
fi

# Create the bucket only if it does not already exist.
if ! gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  echo "==> Creating bucket gs://$BUCKET"
  gcloud storage buckets create "gs://$BUCKET" \
    --location=asia-south1 \
    --uniform-bucket-level-access
else
  echo "==> Bucket gs://$BUCKET already exists"
fi

echo "==> Making bucket contents publicly readable"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member=allUsers \
  --role=roles/storage.objectViewer >/dev/null

echo "==> Configuring index and 404 pages"
gcloud storage buckets update "gs://$BUCKET" \
  --web-main-page-suffix=index.html \
  --web-error-page=404.html

echo "==> Uploading site files"
gcloud storage rsync "$SITE_DIR" "gs://$BUCKET" \
  --recursive \
  --delete-unmatched-destination-objects \
  --exclude='^\.git/.*|.*\.sh$|.*\.md$|.*\.py$|^firebase\.json$'

echo "==> Setting cache headers on static assets"
gcloud storage objects update "gs://$BUCKET/assets/**" \
  --cache-control="public, max-age=604800" >/dev/null 2>&1 || true
gcloud storage objects update "gs://$BUCKET/*.html" \
  --cache-control="public, max-age=300" >/dev/null 2>&1 || true

echo
echo "Done. The site is live at:"
echo "  https://storage.googleapis.com/$BUCKET/index.html"
echo
echo "For a custom domain with HTTPS, see DEPLOY-GOOGLE-CLOUD.md (Option A, step 7)."
