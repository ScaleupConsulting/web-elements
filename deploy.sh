#!/bin/bash
# Deploy the web-elements static site to Cloudflare Pages (project: web-elements).
#
# web-elements was migrated off SiteGround onto Cloudflare Pages. These static
# HTML widgets are served at https://web-elements.scaleupconsulting.com.au/,
# which is a custom domain on the "web-elements" Pages project.
#
# Requires:
#   CLOUDFLARE_API_TOKEN  - a token with the "Account > Cloudflare Pages > Edit" permission.
#   CLOUDFLARE_ACCOUNT_ID - defaults below to the ScaleUp Consulting account.
#
# Usage (token kept out of the repo):
#   CLOUDFLARE_API_TOKEN="$(cat ~/.cloudflare.token)" ./deploy.sh

set -euo pipefail
cd "$(dirname "$0")"

: "${CLOUDFLARE_ACCOUNT_ID:=7712e91b5f4da103400245e15f94babe}"
export CLOUDFLARE_ACCOUNT_ID

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is not set (needs Cloudflare Pages: Edit)." >&2
  exit 1
fi

# Stage static assets only: drop VCS, editor, server-side (PHP), tooling, and secret files
# so none of them are published to the public Pages site.
DIST="$(mktemp -d)"
trap 'rm -rf "$DIST"' EXIT
rsync -a \
  --exclude='.git' --exclude='.gitignore' --exclude='.idea' --exclude='.vscode' \
  --exclude='*.php' --exclude='*.sh' --exclude='password.txt' \
  --exclude='wp-content' --exclude='vendor' \
  ./ "$DIST"/

# Deploy from inside the staged dir so wrangler does not pick up an unrelated
# functions/ directory from the current working tree as Pages Functions.
# wrangler is pinned to 4.75.x because this host runs Node 20 (4.76+ requires Node 22).
cd "$DIST"
npx --yes wrangler@4.75.0 pages deploy . \
  --project-name=web-elements --branch=main --commit-dirty=true
