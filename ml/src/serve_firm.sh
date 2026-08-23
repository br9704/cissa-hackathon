#!/usr/bin/env bash
# Serve the firm model locally.
#
# The app health checks FIRM_MODEL_URL and falls back to the existing retrieval path when it
# does not answer, so this being down is a degraded mode rather than an error. Nothing about
# the demo depends on remembering to start it, which is the point: a demo that breaks when a
# background process is not running is a demo that breaks on stage.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$HERE/.venv/bin/python" -m mlx_lm server \
  --model mlx-community/Qwen3.5-2B-MLX-bf16 \
  --adapter-path "$HERE/runs/firm/adapters" \
  --port "${FIRM_MODEL_PORT:-8081}"
