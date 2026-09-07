#!/usr/bin/env bash
# Brandcrew desktop — clone (or update) and open the Electron window.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mrosmanyt/brandcrew/main/scripts/install-desktop.sh | bash
# Or from a checkout:  bash scripts/install-desktop.sh
set -euo pipefail

REPO="${BRANDCREW_REPO:-https://github.com/mrosmanyt/brandcrew.git}"
DIR="${BRANDCREW_DIR:-$HOME/brandcrew}"
REF="${BRANDCREW_REF:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install from https://nodejs.org" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required." >&2
  exit 1
fi

if [ -d "$DIR/.git" ]; then
  echo "Updating $DIR …"
  git -C "$DIR" fetch origin "$REF"
  git -C "$DIR" checkout "$REF"
  git -C "$DIR" pull --ff-only origin "$REF" || true
else
  echo "Cloning $REPO → $DIR …"
  git clone --branch "$REF" --depth 1 "$REPO" "$DIR"
fi

cd "$DIR"
echo "Installing dependencies…"
npm install

echo "Opening Brandcrew desktop (Mission Control on http://127.0.0.1:43180)…"
echo "Put API keys / OAuth client ids in $DIR/.env (dev) or the app userData .env (packaged)."
npm run desktop:dev
