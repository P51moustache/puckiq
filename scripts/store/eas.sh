#!/bin/sh
# EAS CLI on this Mac, where Node only ships inside Cursor (no node/npx on the shell PATH).
#
#   scripts/store/eas.sh build --platform ios --profile production --non-interactive --auto-submit --no-wait
#   scripts/store/eas.sh build:list --platform ios --limit 3 --non-interactive
#
# Uses a real npx when one is on PATH; otherwise Cursor's node with npm's npx from the pnpm store.
set -e

if command -v npx >/dev/null 2>&1; then
  exec npx -y eas-cli@latest "$@"
fi

NODE=/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node
NPX_CLI=$(ls -d "$HOME"/Library/pnpm/store/*/links/@/npm/10.*/*/node_modules/npm/bin/npx-cli.js 2>/dev/null | head -1)
[ -n "$NPX_CLI" ] || NPX_CLI=$(ls -d "$HOME"/Library/pnpm/store/*/links/@/npm/*/*/node_modules/npm/bin/npx-cli.js 2>/dev/null | head -1)

if [ ! -x "$NODE" ] || [ -z "$NPX_CLI" ]; then
  echo "eas.sh: no node/npx found (install Node, or Cursor + pnpm's npm)" >&2
  exit 1
fi

# eas-cli spawns `node` itself, so put Cursor's node first on PATH.
PATH="$(dirname "$NODE"):$PATH"
export PATH
exec "$NODE" "$NPX_CLI" -y eas-cli@latest "$@"
