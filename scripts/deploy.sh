#!/usr/bin/env bash
#
# Deploy Continuity.
#
#   ./scripts/deploy.sh preflight   check everything without changing anything
#   ./scripts/deploy.sh db          push migrations and seed the hosted project
#   ./scripts/deploy.sh web         build and deploy the web app
#   ./scripts/deploy.sh all         db then web
#
# Every step is idempotent and every failure says what a human has to do, because the
# thing that blocks this deploy is a human action and a script that just says "error" is
# a script somebody has to reverse engineer at 3am.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mblock\033[0m %s\n' "$1"; }

FAILED=0

preflight() {
  echo "preflight"
  echo ""

  if command -v pnpm >/dev/null 2>&1; then ok "pnpm $(pnpm -v)"; else bad "pnpm is not installed"; FAILED=1; fi
  if command -v vercel >/dev/null 2>&1; then ok "vercel cli present"; else bad "vercel cli is not installed: npm i -g vercel"; FAILED=1; fi
  if command -v supabase >/dev/null 2>&1; then ok "supabase cli present"; else bad "supabase cli is not installed"; FAILED=1; fi

  if vercel whoami >/dev/null 2>&1; then
    ok "vercel authenticated as $(vercel whoami 2>/dev/null | tail -1)"
  else
    bad "vercel is not logged in. Run: vercel login"
    FAILED=1
  fi

  # The one that actually blocks, so it gets the clearest message.
  if supabase projects list >/dev/null 2>&1; then
    ok "supabase authenticated"
  else
    bad "supabase is not logged in. THIS IS THE ONE THING BLOCKING DEPLOY."
    echo "          Run:  supabase login"
    echo "          Then: supabase link --project-ref <your-project-ref>"
    FAILED=1
  fi

  if [ -f "$ROOT/.env.local" ]; then
    ok ".env.local present"
    for key in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
      if grep -q "^$key=" "$ROOT/.env.local"; then ok "  $key set"; else bad "  $key missing"; FAILED=1; fi
    done
    # Server-only keys must NOT carry the VITE_ prefix: anything prefixed is compiled into
    # the JavaScript that ships to a browser.
    if grep -qE "^VITE_(SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY)" "$ROOT/.env.local"; then
      bad "  a service role or API key is VITE_ prefixed, which publishes it to the browser"
      FAILED=1
    fi
  else
    warn ".env.local not present. The app runs on the local corpus without it."
  fi

  echo ""
  echo "build"
  echo ""
  if pnpm run check >/dev/null 2>&1; then ok "guards and tests"; else bad "pnpm check fails"; FAILED=1; fi
  if pnpm --filter @continuity/web exec vite build >/dev/null 2>&1; then ok "web build"; else bad "web build fails"; FAILED=1; fi

  echo ""
  if [ "$FAILED" -eq 0 ]; then
    echo "ready to deploy."
  else
    echo "not ready. Fix the blocked items above."
  fi
  return "$FAILED"
}

db() {
  echo "database"
  echo ""
  if ! supabase projects list >/dev/null 2>&1; then
    bad "supabase is not logged in. Run: supabase login && supabase link --project-ref <ref>"
    return 1
  fi

  echo "pushing migrations"
  supabase db push --linked || return 1
  ok "migrations applied"

  echo ""
  echo "seeding"
  # The seed refuses to leave a ledger that fails verification, so a successful exit here
  # means the chain it just wrote verifies.
  pnpm --filter @continuity/core seed || return 1
  ok "seeded and chain verified"

  echo ""
  echo "scoring"
  pnpm --filter @continuity/core materialize || return 1
  ok "knowledge scores materialised"
}

web() {
  echo "web"
  echo ""
  if ! vercel whoami >/dev/null 2>&1; then
    bad "vercel is not logged in. Run: vercel login"
    return 1
  fi

  cd "$ROOT/apps/web"
  echo "deploying apps/web to production"
  echo ""
  echo "  Root Directory must be apps/web in the Vercel project settings, with"
  echo "  'Include files outside the Root Directory' ticked so the workspace lockfile"
  echo "  is present. A repo-root deploy will not find vercel.json or the api directory."
  echo ""
  vercel --prod || return 1
  ok "deployed"
}

case "${1:-preflight}" in
  preflight) preflight ;;
  db)        db ;;
  web)       web ;;
  all)       preflight && db && web ;;
  *)         echo "usage: ./scripts/deploy.sh <preflight|db|web|all>"; exit 1 ;;
esac
