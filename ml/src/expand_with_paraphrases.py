"""
Expand the QA set with the cached paraphrases, and keep the probe honest.

Two jobs, and the second is the one that matters.

The first is volume and diversity: each cached question contributes several natural
phrasings, so the model does not simply memorise one template per fact.

The second is that the fact probe must be made of phrasings the model NEVER SAW. If the
probe reuses a training phrasing, a high score measures recall of a template rather than
knowledge of a fact, which is precisely the criticism ml/README.md already levels at the
tagger's 1.0. So one paraphrase per probe question is reserved, excluded from training, and
used as the probe. Where no paraphrase exists, the probe question stays templated and is
counted separately, because a mixed probe reported as a single number would hide exactly the
thing the split exists to reveal.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml/data/firm"
CACHE = DATA / "paraphrase_cache.json"


def read(name: str) -> list[dict[str, Any]]:
    path = DATA / f"{name}.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def write(name: str, rows: list[dict[str, Any]]) -> None:
    with (DATA / f"{name}.jsonl").open("w") as fh:
        for r in rows:
            fh.write(json.dumps(r) + "\n")


def question_of(row: dict[str, Any]) -> str:
    return row["messages"][1]["content"]


def with_question(row: dict[str, Any], q: str) -> dict[str, Any]:
    msgs = [dict(m) for m in row["messages"]]
    msgs[1] = {"role": "user", "content": q}
    out = {k: v for k, v in row.items() if k != "messages"}
    out["messages"] = msgs
    return out


def main() -> None:
    cache: dict[str, list[str]] = json.loads(CACHE.read_text()) if CACHE.exists() else {}

    probe = read("fact_probe")
    held = read("test")

    # Reserve one unseen phrasing per probe question, and never train on it.
    reserved: set[str] = set()
    new_probe: list[dict[str, Any]] = []
    paraphrased_probe = 0
    for row in probe:
        q = question_of(row)
        options = cache.get(q) or []
        if options:
            chosen = options[0]
            reserved.add(chosen)
            paraphrased_probe += 1
            out = with_question(row, chosen)
            out["probe_phrasing"] = "paraphrased"
        else:
            out = dict(row)
            out["probe_phrasing"] = "templated"
        new_probe.append(out)

    def expand(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for row in rows:
            out.append(row)
            q = question_of(row)
            for alt in cache.get(q, [])[1:]:
                if alt in reserved:
                    continue
                out.append(with_question(row, alt))
        return out

    train = expand(read("train"))
    valid = expand(read("valid"))

    write("train", [{"messages": r["messages"]} for r in train])
    write("valid", [{"messages": r["messages"]} for r in valid])
    write("fact_probe", new_probe)
    write("test", held)

    manifest = json.loads((DATA / "manifest.json").read_text())
    manifest["paraphrase"] = {
        "model": "gemini-2.5-flash",
        "questions_paraphrased": len(cache),
        "probe_paraphrased": paraphrased_probe,
        "probe_templated": len(new_probe) - paraphrased_probe,
        "note": (
            "Questions were rephrased by an LLM; answers were never touched and remain "
            "assembled from ledger text. Probe items marked templated share their phrasing "
            "with training data, so their score measures template recall rather than "
            "generalisation and must be read separately."
        ),
    }
    manifest["train"] = len(train)
    manifest["valid"] = len(valid)
    manifest["hashes"] = {
        name: hashlib.sha256((DATA / f"{name}.jsonl").read_bytes()).hexdigest()
        for name in ["train", "valid", "test", "fact_probe"]
    }
    (DATA / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"train {len(train)}, valid {len(valid)}, probe {len(new_probe)}")
    print(f"probe phrasing: {paraphrased_probe} paraphrased, {len(new_probe) - paraphrased_probe} templated")


if __name__ == "__main__":
    main()
