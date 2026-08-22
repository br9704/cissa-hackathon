"""
Pick the adapter to ship, on the validation split.

mlx-lm writes the FINAL weights to adapters.safetensors and a numbered checkpoint every
save_every iterations. The final weights are not the best weights: in a previous project
on this machine, selecting on validation was worth eight macro F1 points over taking the
last iteration. Training loss falling is not evidence against that; it is usually the
reason for it.

    uv run python src/select_checkpoint.py
    uv run python src/select_checkpoint.py --limit 120

Writes the winner to runs/current/best/ and leaves every candidate in place, so the
choice can be re-examined rather than taken on trust.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from mlx_lm import generate, load

from tagger import SYSTEM_PROMPT, parse, score

ROOT = Path(__file__).resolve().parent.parent
BASE_MODEL = "mlx-community/Qwen3.5-2B-MLX-bf16"
BASE_REVISION = "05ce45420036b812fe0be3f72cdc1fb62bae6891"


def candidates(adapter_dir: Path) -> list[tuple[str, Path]]:
    """
    Every checkpoint, plus the final weights, newest last.

    The final weights are included as a candidate rather than assumed to be the answer.
    Sometimes they are; the point is that it is measured.
    """
    found: list[tuple[int, str, Path]] = []
    for f in sorted(adapter_dir.glob("*_adapters.safetensors")):
        m = re.match(r"(\d+)_adapters\.safetensors", f.name)
        if m:
            found.append((int(m.group(1)), f"iter {m.group(1)}", f))
    final = adapter_dir / "adapters.safetensors"
    if final.exists():
        found.append((10**9, "final", final))
    found.sort()
    return [(name, path) for _, name, path in found]


def evaluate_candidate(path: Path, rows: list[dict], adapter_dir: Path, limit: int) -> float:
    """
    Load one candidate and score it.

    The weights file is copied over adapters.safetensors because that is the name load()
    looks for, and the original is restored afterwards. Copying rather than renaming means
    an interrupted run leaves every candidate intact.
    """
    original = adapter_dir / "adapters.safetensors"
    backup = adapter_dir / "adapters.safetensors.selecting"
    restore = False
    if path.name != "adapters.safetensors":
        if original.exists():
            shutil.copy2(original, backup)
            restore = True
        shutil.copy2(path, original)

    try:
        model, tokenizer = load(BASE_MODEL, adapter_path=str(adapter_dir), revision=BASE_REVISION)
        truth = []
        predicted = []
        for row in rows[:limit]:
            expected = json.loads(row["messages"][2]["content"])
            truth.append((expected["label"], bool(expected["risk"])))
            prompt = tokenizer.apply_chat_template(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": row["messages"][1]["content"]},
                ],
                add_generation_prompt=True,
                # See the README. Without this the template opens an unclosed think block
                # and every candidate scores zero, which looks like a training failure.
                enable_thinking=False,
            )
            predicted.append(parse(generate(model, tokenizer, prompt=prompt, max_tokens=24, verbose=False)))
        return score(truth, predicted).macro_f1
    finally:
        if restore:
            shutil.move(backup, original)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapters", default="runs/current/adapters")
    ap.add_argument("--valid", default="data/mlx/valid.jsonl")
    ap.add_argument("--limit", type=int, default=120)
    args = ap.parse_args()

    adapter_dir = ROOT / args.adapters
    rows = [json.loads(l) for l in (ROOT / args.valid).read_text().splitlines() if l.strip()]

    found = candidates(adapter_dir)
    if not found:
        raise SystemExit(f"no adapter checkpoints in {adapter_dir}")

    print(f"{len(found)} candidates, scored on {min(args.limit, len(rows))} validation rows")
    results: list[tuple[str, Path, float]] = []
    for name, path in found:
        f1 = evaluate_candidate(path, rows, adapter_dir, args.limit)
        results.append((name, path, f1))
        print(f"  {name:12}  macro F1 {f1:.4f}")

    best_name, best_path, best_f1 = max(results, key=lambda r: r[2])
    final_f1 = next((f1 for name, _, f1 in results if name == "final"), None)

    best_dir = ROOT / "runs" / "current" / "best"
    best_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_path, best_dir / "adapters.safetensors")
    config = adapter_dir / "adapter_config.json"
    if config.exists():
        shutil.copy2(config, best_dir / "adapter_config.json")

    (best_dir / "selection.json").write_text(
        json.dumps(
            {
                "selected": best_name,
                "macro_f1_on_validation": round(best_f1, 4),
                "final_iteration_macro_f1": round(final_f1, 4) if final_f1 is not None else None,
                "points_gained_over_final": (
                    round((best_f1 - final_f1) * 100, 1) if final_f1 is not None else None
                ),
                "validation_rows": min(args.limit, len(rows)),
                "candidates": {name: round(f1, 4) for name, _, f1 in results},
                "note": (
                    "Selected on the validation split, never on the test split. The test "
                    "split is scored once, by evaluate.py, after this."
                ),
            },
            indent=2,
        )
        + "\n"
    )

    print()
    print(f"selected {best_name} at macro F1 {best_f1:.4f}")
    if final_f1 is not None and best_name != "final":
        print(f"that is {(best_f1 - final_f1) * 100:+.1f} points over the final iteration")
    print(f"wrote {best_dir.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
