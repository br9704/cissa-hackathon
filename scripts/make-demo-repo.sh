#!/usr/bin/env bash
#
# Builds the demo research repository the video and the CLI walkthrough use.
#
# Generated rather than committed, for two reasons. A git repository nested inside another
# git repository is a mess that confuses every tool that walks the tree, and the commits
# here need to be reproducible: the video is shot against a frozen state, and a repo
# somebody has poked at by hand is not one.
#
#   ./scripts/make-demo-repo.sh
#   cd demo/vol-desk-repo && continuity status
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$ROOT/demo/vol-desk-repo"

rm -rf "$REPO"
mkdir -p "$REPO"
cd "$REPO"

git init -q
git config user.name "Priya Raghunathan"
git config user.email "priya@meridianbasis.example"
git config commit.gpgsign false

mkdir -p strategies/india_carry research config

cat > README.md <<'EOF'
# vol-desk

A synthetic research repository for the Continuity demo. Nothing here is a real strategy,
and none of these numbers came from anywhere.
EOF

cat > config/live.yaml <<'EOF'
india_carry:
  vol_filter: 0.65
  expiry_cap: 0.80
  entry_threshold: 0.55
EOF

cat > strategies/india_carry/filter.py <<'EOF'
"""Realised versus implied vol gate for the India carry book."""

VOL_FILTER = 0.65


def gate(realised: float, implied: float) -> bool:
    return realised / implied < VOL_FILTER
EOF

git add -A
git commit -q -m "Initial vol desk scaffold"

# A commit that is deliberately NOT material, so `status` has something to say no to.
cat > README.md <<'EOF'
# vol-desk

A synthetic research repository for the Continuity demo. Nothing here is a real strategy,
and none of these numbers came from anywhere.

## Layout

    config/       live parameters
    strategies/   the books
    research/     notebooks
EOF
git add -A
git commit -q -m "Document the repository layout"

# The commit the video is about.
sed -i '' 's/vol_filter: 0.65/vol_filter: 0.70/' config/live.yaml 2>/dev/null \
  || sed -i 's/vol_filter: 0.65/vol_filter: 0.70/' config/live.yaml
sed -i '' 's/VOL_FILTER = 0.65/VOL_FILTER = 0.70/' strategies/india_carry/filter.py 2>/dev/null \
  || sed -i 's/VOL_FILTER = 0.65/VOL_FILTER = 0.70/' strategies/india_carry/filter.py

git add -A
git commit -q -m "Raise vol_filter to 0.70 after the August drawdown flag

0.68 was tested and rejected, too slow to re-enter."

echo "built $REPO"
git --no-pager log --oneline
