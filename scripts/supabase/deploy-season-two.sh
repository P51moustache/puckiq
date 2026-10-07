#!/usr/bin/env bash
# Deploys PuckIQ season two's backend to Supabase project yobqysvorsmcoselrtuq:
# League Room + player alert migrations, the register-alerts and live-poller Edge Functions, and
# (by hand, at the end) the every-minute cron that runs the poller.
#
#   scripts/supabase/deploy-season-two.sh
#
# Interactive on purpose: a browser login, the database password for `link`, and the CLI's own
# "push these migrations?" question. Stops at the first failing step. Nothing secret is written to disk.
set -euo pipefail

PROJECT_REF="yobqysvorsmcoselrtuq"
SUPABASE_CLI="supabase@2"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Supabase CLI through npx. This Mac has no global node, so fall back to Cursor's node with npm's npx
# from the pnpm store (same approach as scripts/store/eas.sh).
supabase() {
  if command -v npx >/dev/null 2>&1; then
    npx -y "$SUPABASE_CLI" "$@"
    return
  fi
  local node=/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node
  local npx_cli
  npx_cli=$(ls -d "$HOME"/Library/pnpm/store/*/links/@/npm/*/*/node_modules/npm/bin/npx-cli.js 2>/dev/null | head -1 || true)
  if [[ ! -x "$node" || -z "$npx_cli" ]]; then
    echo "deploy-season-two: no node/npx found (install Node, or Cursor + pnpm's npm)" >&2
    exit 1
  fi
  PATH="$(dirname "$node"):$PATH" "$node" "$npx_cli" -y "$SUPABASE_CLI" "$@"
}

step() {
  printf '\n==> %s\n' "$*"
}

step "1/6 Log in to Supabase (opens a browser)"
supabase login

step "2/6 Link this repo to project $PROJECT_REF (asks for the database password)"
supabase link --project-ref "$PROJECT_REF"

step "3/6 Apply database migrations"
cat <<'EOF'
`db push` applies EVERY local migration missing from the project's migration history. Expected:
  supabase/migrations/20261006000000_league_rooms.sql  League Room tables, RLS, RPCs
  supabase/migrations/20261006000100_alerts.sql        alert_devices, live_game_state, alert_log
  supabase/migrations/20261006000200_poller_tickets.sql  single-use tickets for the cron job
  supabase/migrations/20260926000000_app_feedback.sql  only if it was never pushed
If the dry run lists anything older, answer "n" at the next prompt and repair the history first
(supabase migration repair --status applied <version>) for migrations already applied by hand.
EOF
supabase db push --dry-run
supabase db push

step "4/6 Deploy register-alerts (public endpoint, JWT verification off)"
supabase functions deploy register-alerts --no-verify-jwt --use-api --project-ref "$PROJECT_REF"

step "5/6 Deploy live-poller (JWT verification off; it only runs with a single-use cron ticket)"
supabase functions deploy live-poller --no-verify-jwt --use-api --project-ref "$PROJECT_REF"

step "6/6 Schedule the poller (manual, in the SQL editor; no secrets involved)"
cat <<EOF
In https://supabase.com/dashboard/project/$PROJECT_REF/sql/new :
  a) Paste and run supabase/cron/live-poller.sql. It schedules the every-minute poller (each call
     carries a single-use ticket from public.issue_poller_ticket) and a daily retention cleanup
     (the privacy policy relies on it); unschedule lines are at the bottom.
  b) A minute later: select status_code, left(content::text, 200), created
                       from net._http_response order by created desc limit 3;
     Expect 200 {"ok":true,...}.
Optional: if the Expo project enforces push security, also run
  supabase secrets set EXPO_ACCESS_TOKEN=<token> --project-ref $PROJECT_REF
EOF

printf '\nDone. Season two backend deployed to %s.\n' "$PROJECT_REF"
