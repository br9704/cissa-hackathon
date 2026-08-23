#!/usr/bin/env bash
# Serve the firm model locally.
#
# The app health checks FIRM_MODEL_URL and falls back to the existing retrieval path when it
# does not answer, so this being down is a degraded mode rather than an error. Nothing about
# the demo depends on remembering to start it, which is the point: a demo that breaks when a
# background process is not running is a demo that breaks on stage.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# --chat-template-args enable_thinking false is NOT optional, and leaving it out cost an hour.
#
# Qwen3.5 reasons by default. Without this flag the model spends its whole token budget
# thinking, returns finish_reason "length" with content null, and the route reports that the
# model returned nothing. It looks exactly like a broken fine tune. ml/src/serve.py already
# carried this warning in a comment for the tagger and this script did not inherit it, which
# is the argument for the flag living in the command rather than in a README.
exec "$HERE/.venv/bin/python" -m mlx_lm server \
  --model mlx-community/Qwen3.5-2B-MLX-bf16 \
  --adapter-path "$HERE/runs/firm/adapters" \
  --chat-template-args '{"enable_thinking":false}' \
  --port "${FIRM_MODEL_PORT:-8081}"
