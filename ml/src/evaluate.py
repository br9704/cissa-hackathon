"""
Evaluate an adapter on the held out split.

Held out means held out: the split was made by the corpus generator before training, on a
seeded shuffle, and nothing in this file has ever seen it. Writes results/summary.json
with a provenance block, and that file is the only thing the product is allowed to quote.

    uv run python src/evaluate.py
    uv run python src/evaluate.py --adapter runs/current/adapters --limit 300
    uv run python src/evaluate.py --arm few_shot        # the fallback, no adapter
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from mlx_lm import generate, load

from tagger import LABELS, SYSTEM_PROMPT, parse, score

ROOT = Path(__file__).resolve().parent.parent
BASE_MODEL = "mlx-community/Qwen3.5-2B-MLX-bf16"
BASE_REVISION = "05ce45420036b812fe0be3f72cdc1fb62bae6891"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_dir(path: Path) -> str:
    """Hash of every file in the directory, in name order, so a rerun is comparable."""
    h = hashlib.sha256()
    for f in sorted(path.rglob("*")):
        if f.is_file():
            h.update(f.name.encode())
            h.update(sha256_file(f).encode())
    return h.hexdigest()


def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()
    except Exception:
        return "unknown"


def load_split(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


# Two examples per class for the fallback arm. Written out rather than sampled from the
# training set, so the fallback does not quietly depend on a file the adapter also used.
FEW_SHOT = [
    ("Raised vol_filter to 0.70\nvol_filter moved from 0.65 to 0.70.\nRealised vol has been running above the weekly average.",
     '{"label":"parameter_change","risk":false}'),
    ("Capped position size in the expiry window\nHard cap introduced inside the final session.\nTwo days after the flag we were carrying more into the close than the book is meant to hold.",
     '{"label":"risk_limit","risk":true}'),
    ("Switched to the exchange settlement file for settlement prices\nSettlement now comes from the exchange settlement file.\nThe previous source revised silently after the close.",
     '{"label":"data_handling","risk":false}'),
    ("Moved the roll to the morning session\nRoll executes in the morning session rather than at the close.\nThe close is where everyone else rolls and the slippage shows it.",
     '{"label":"execution","risk":false}'),
    ("Dropped the illiquid tail\nNames below the liquidity threshold are excluded rather than sized down.\nSized down still means we hold them in a stress.",
     '{"label":"universe","risk":true}'),
    ("Pinned the backtest environment\nBacktest runs against a pinned dependency set.\nTwo people got different numbers from the same code on the same data.",
     '{"label":"infra","risk":false}'),
    ("Required a second reader on live parameter changes\nChanges to live parameters need a second person before they take effect.\nNot because anyone got one wrong.",
     '{"label":"process","risk":false}'),
]


def build_messages(user_text: str, few_shot: bool) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if few_shot:
        for question, answer in FEW_SHOT:
            messages.append({"role": "user", "content": question})
            messages.append({"role": "assistant", "content": answer})
    messages.append({"role": "user", "content": user_text})
    return messages


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", default="runs/current/adapters")
    ap.add_argument("--arm", default="student", choices=["student", "few_shot", "base"])
    ap.add_argument("--limit", type=int, default=300)
    ap.add_argument("--split", default="data/mlx/test.jsonl")
    ap.add_argument("--out", default="results/summary.json")
    args = ap.parse_args()

    split_path = ROOT / args.split
    rows = load_split(split_path)[: args.limit]

    adapter_path = ROOT / args.adapter
    use_adapter = args.arm == "student"
    if use_adapter and not adapter_path.exists():
        raise SystemExit(
            f"no adapter at {adapter_path}. Train first, or evaluate the few_shot arm."
        )

    print(f"loading {BASE_MODEL} at {BASE_REVISION[:12]}")
    model, tokenizer = load(
        BASE_MODEL,
        adapter_path=str(adapter_path) if use_adapter else None,
        revision=BASE_REVISION,
    )

    truth: list[tuple[str, bool]] = []
    predicted: list[tuple[str, bool | None]] = []
    latencies: list[float] = []

    # Three warm ups, discarded. The first generation on this backend pays for graph
    # construction and would otherwise land in the p95.
    warm = rows[0]["messages"][1]["content"]
    for _ in range(3):
        prompt = tokenizer.apply_chat_template(
            build_messages(warm, args.arm == "few_shot"),
            add_generation_prompt=True,
            # Mandatory. Without it the chat template opens an unclosed think block and
            # the model reasons instead of answering, which reads exactly like a failed
            # fine-tune. Measured previously: 0 of 5 valid without, 5 of 5 with.
            enable_thinking=False,
        )
        generate(model, tokenizer, prompt=prompt, max_tokens=24, verbose=False)

    for i, row in enumerate(rows):
        user_text = row["messages"][1]["content"]
        expected = json.loads(row["messages"][2]["content"])
        truth.append((expected["label"], bool(expected["risk"])))

        prompt = tokenizer.apply_chat_template(
            build_messages(user_text, args.arm == "few_shot"),
            add_generation_prompt=True,
            enable_thinking=False,
        )
        start = time.perf_counter()
        raw = generate(model, tokenizer, prompt=prompt, max_tokens=24, verbose=False)
        latencies.append((time.perf_counter() - start) * 1000)
        predicted.append(parse(raw))

        if (i + 1) % 25 == 0:
            print(f"  {i + 1}/{len(rows)}")

    s = score(truth, predicted)
    latencies.sort()

    summary = {
        "arm": args.arm,
        "provenance": {
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "base_model": BASE_MODEL,
            "base_model_revision": BASE_REVISION,
            "adapter_path": str(args.adapter) if use_adapter else None,
            "adapter_sha256": sha256_dir(adapter_path) if use_adapter else None,
            "heldout_path": args.split,
            "heldout_sha256": sha256_file(split_path),
            "heldout_rows_scored": s.scored_on,
            "git_commit": git("rev-parse", "HEAD"),
            "git_dirty": bool(git("status", "--porcelain")),
        },
        "n": s.n,
        "invalid_outputs": s.invalid_outputs,
        "scored_on": s.scored_on,
        "scoring_note": (
            "Unparseable outputs are counted and excluded from the class metrics rather "
            "than scored as wrong. Scoring them as wrong blends a model that classified "
            "badly with one that did not answer into a number that describes neither."
        ),
        "accuracy": round(s.accuracy, 4),
        "macro_f1": round(s.macro_f1, 4),
        "risk_accuracy": round(s.risk_accuracy, 4),
        "per_class": [
            {
                "label": c.label,
                "precision": round(c.precision, 4),
                "recall": round(c.recall, 4),
                "f1": round(c.f1, 4),
                "support": c.support,
            }
            for c in s.per_class
        ],
        "confusion": s.confusion,
        "latency_ms": {
            "p50": round(latencies[len(latencies) // 2], 1),
            "p95": round(latencies[int(len(latencies) * 0.95)], 1),
            "mean": round(sum(latencies) / len(latencies), 1),
        },
    }

    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)

    # Keep both arms in one file so the trade-off is visible rather than two files that
    # can disagree about which one shipped.
    existing = json.loads(out.read_text()) if out.exists() else {"arms": {}}
    existing.setdefault("arms", {})[args.arm] = summary
    out.write_text(json.dumps(existing, indent=2) + "\n")

    print()
    print(f"arm            {args.arm}")
    print(f"macro F1       {s.macro_f1:.4f}")
    print(f"accuracy       {s.accuracy:.4f}")
    print(f"risk accuracy  {s.risk_accuracy:.4f}")
    print(f"unparseable    {s.invalid_outputs} of {s.n}")
    print(f"latency p50    {summary['latency_ms']['p50']} ms")
    print()
    for c in s.per_class:
        print(f"  {c.label:18} f1 {c.f1:.3f}  support {c.support}")
    print()
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
