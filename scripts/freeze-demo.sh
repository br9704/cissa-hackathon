#!/usr/bin/env bash
#
# Freeze the demo to a known state and prove it is the one the video was shot against.
#
#   ./scripts/freeze-demo.sh
#
# Run this before a take, and between takes if anything mutated. The corpus is
# deterministic from a seed, so "frozen" is a command rather than a ritual, and this
# writes a fingerprint so a later take can be checked against an earlier one instead of
# somebody remembering.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SEED="${CONTINUITY_SEED:-20260822}"
FREEZE="docs/demo-freeze.json"

echo "freezing the demo at seed $SEED"
echo ""

./supabase/local/reset.sh > /dev/null
CONTINUITY_SEED="$SEED" pnpm --filter @continuity/core seed 2>&1 | grep -E "generated|chain verified|firm id"
pnpm --filter @continuity/core materialize 2>&1 | grep -E "bus|scored"

echo ""
echo "fingerprint"

# Read the numbers the video will say out loud, so nobody has to remember them and
# nobody says one the screen is not showing.
FREEZE_TMP="$(mktemp)"
psql -d "${CONTINUITY_DB:-continuity_dev}" -tA -F$'\t' <<'SQL' > "$FREEZE_TMP"
select
  (select count(*) from events),
  (select count(*) from decisions),
  (select count(*) from artifacts),
  (select this_hash from events order by id desc limit 1),
  (select ok::text from verify_chain_summary((select id from firms order by created_at limit 1)));
SQL

read -r EVENTS DECISIONS ARTIFACTS HEAD CHAIN_OK < "$FREEZE_TMP"
rm -f "$FREEZE_TMP"

# "true", not "t". A boolean cast to text renders the full word, and psql's own display
# format renders "t", so the two look interchangeable right up until a comparison. The
# script refusing rather than writing a freeze file it could not stand behind is the part
# that worked.
if [ "$CHAIN_OK" != "true" ]; then
  echo "  the seeded chain does not verify. Refusing to call this frozen."
  exit 1
fi

cat > "$FREEZE" <<JSON
{
  "seed": $SEED,
  "frozen_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "events": $EVENTS,
  "decisions": $DECISIONS,
  "artifacts": $ARTIFACTS,
  "chain_head": "$HEAD",
  "chain_verifies": true,
  "note": "Read the numbers on screen before a take. This file records what the screen should be showing, so a take can be checked against it rather than against somebody's memory."
}
JSON

echo "  events      $EVENTS"
echo "  decisions   $DECISIONS"
echo "  artifacts   $ARTIFACTS"
echo "  chain head  ${HEAD:0:16}"
echo "  verifies    yes"
echo ""
echo "wrote $FREEZE"
echo ""
echo "Now run ./scripts/capture-beats.sh to take the screen captures."
