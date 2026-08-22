"""
Serve the tagger locally.

    uv run python src/serve.py

A thin wrapper over mlx_lm.server that gets two flags right, both of which are easy to
omit and expensive to omit.

    --adapter-path, not a fused model. Fusing writes a second full copy of the weights to
    disk for no benefit here; adapters apply at load time.

    --chat-template-args '{"enable_thinking":false}'. Without it the model reasons instead
    of answering and every response is unparseable. It looks exactly like a broken
    fine-tune, which is why it is in the command rather than in a README somewhere.

The app calls this when TAGGER_URL is set and falls back to a remote route otherwise, and
the UI says which one produced a tag.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE_MODEL = "mlx-community/Qwen3.5-2B-MLX-bf16"

adapter = ROOT / "runs" / "current" / "best"
if not adapter.exists():
    adapter = ROOT / "runs" / "current" / "adapters"
if not adapter.exists():
    sys.exit("no adapter found. Train first, or run the few_shot arm through evaluate.py")

cmd = [
    sys.executable, "-m", "mlx_lm", "server",
    "--model", BASE_MODEL,
    "--adapter-path", str(adapter),
    "--chat-template-args", '{"enable_thinking":false}',
    "--port", "8080",
]
print(" ".join(cmd))
raise SystemExit(subprocess.call(cmd))
