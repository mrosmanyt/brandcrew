#!/usr/bin/env bash
# CINEM Pro desktop — open the Electron window against the cloud desk.
# Default: CINEM_DESK_MODE=cloud (https://app.cinem.tech). No local Postgres.
# Local Next + Docker: CINEM_DESK_MODE=local bash scripts/install-desktop.sh
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mrosmanyt/brandcrew/main/scripts/install-desktop.sh | bash
# Or from a checkout:  bash scripts/install-desktop.sh
set -euo pipefail

REPO="${BRANDCREW_REPO:-https://github.com/mrosmanyt/brandcrew.git}"
DIR="${BRANDCREW_DIR:-$HOME/brandcrew}"
REF="${BRANDCREW_REF:-main}"
MODE="${CINEM_DESK_MODE:-cloud}"

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

export CINEM_DESK_MODE="$MODE"
if [ "$MODE" = "local" ]; then
  echo "Opening local Next desk (needs Postgres on :5432 or Neon)…"
  npm run desktop:dev
else
  echo "Opening cloud desk https://app.cinem.tech — no local database."
  npm run desktop:cloud
fi
