"""
Append the model's own existence to the ledger.

This is the detail worth having. A fine tune is normally a file on somebody's laptop with a
name like adapters.safetensors and no provenance at all: you cannot tell what it was trained
on, from which base, or what it scored, and six months later nobody can either.

Here the model's existence is an EVENT in the same append only, hash chained ledger it was
trained on. Which means the claim "we trained a model on our own record" is verifiable by the
same mechanism as every other claim in the product, rather than by trusting a slide.

It writes through the normal event path. Nothing about this is special cased, and that is the
point: if it needed a back door it would not be evidence of anything.

    python ml/src/anchor_model.py            writes the event to a local jsonl the app reads
    DATABASE_URL=... python ml/src/anchor_model.py --db     appends to Postgres for real
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "ml/results/firm_model_summary.json"
ADAPTER = ROOT / "ml/runs/firm/adapters/adapters.safetensors"
CONFIG = ROOT / "ml/configs/lora_firm.yaml"
OUT = ROOT / ".continuity-model-events.jsonl"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def base_revision() -> str:
    """The pinned base SHA, read from the config rather than remembered.

    An unpinned base means a rerun months later is a different experiment wearing the same
    config file, and this provenance block would be quietly lying.
    """
    for line in CONFIG.read_text().splitlines():
        if line.strip().startswith("revision:"):
            return line.split(":", 1)[1].strip().strip('"')
    return "unpinned"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", action="store_true", help="append to Postgres via DATABASE_URL")
    args = ap.parse_args()

    if not RESULTS.exists():
        sys.exit("no eval results. Run eval_firm.py first: a model with no measured result is not a claim.")
    if not ADAPTER.exists():
        sys.exit("no adapter. Train first.")

    summary = json.loads(RESULTS.read_text())
    arms = summary.get("arms", {})
    base = arms.get("A_base_untuned", {})
    tuned = arms.get("D_firm_model", {})

    payload = {
        "kind": "model_trained",
        "base_model": "mlx-community/Qwen3.5-2B-MLX-bf16",
        "base_revision": base_revision(),
        "adapter_sha256": sha256_file(ADAPTER),
        "data_hashes": summary.get("data", {}).get("hashes", {}),
        "train_rows": summary.get("data", {}).get("train"),
        "eval": {
            # Both numbers, always. The tuned score on its own is not a claim, it is half of
            # one, and the half that is easy to misread.
            "base_fact_accuracy": base.get("fact_accuracy"),
            "tuned_fact_accuracy": tuned.get("fact_accuracy"),
            "base_refusal_accuracy": base.get("refusal_accuracy"),
            "tuned_refusal_accuracy": tuned.get("refusal_accuracy"),
            "probe_items": tuned.get("fact_items"),
            "scoring": summary.get("scoring", {}).get("method"),
        },
        "caveat": summary.get("honest_reading", {}).get("the_caveat_that_matters"),
    }

    if args.db:
        url = os.environ.get("DATABASE_URL")
        if not url:
            sys.exit("DATABASE_URL is not set")
        # Through the normal event path, so the trigger chains it exactly like any other row.
        sql = (
            "insert into events (firm_id, kind, payload, actor_member_id) "
            "select id, 'model_trained', %s::jsonb, null from firms limit 1"
        )
        try:
            import psycopg  # noqa: PLC0415
        except ImportError:
            sys.exit("psycopg is not installed in this venv. Use the jsonl path, or install it.")
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (json.dumps(payload),))
            conn.commit()
        print("appended model_trained to the events table")
        return

    with OUT.open("a") as fh:
        fh.write(json.dumps(payload) + "\n")
    print(f"wrote {OUT}")
    print(f"  adapter  {payload['adapter_sha256'][:16]}")
    print(f"  base     {payload['base_revision'][:16]}")
    print(f"  eval     base {payload['eval']['base_fact_accuracy']} to tuned {payload['eval']['tuned_fact_accuracy']}")


if __name__ == "__main__":
    main()
