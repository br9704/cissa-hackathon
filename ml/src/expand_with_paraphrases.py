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



"""Programmatic question variants, for the rows the API never reached."""
REFUSAL_WRAPS = [
    "{}",
    "Quick one: {}",
    "Can you tell me, {}",
    "Do we have anything on this. {}",
    "I need to know for a handover. {}",
    "Somebody asked me this today. {}",
]


def refusal_variants(question: str, n: int) -> list[str]:
    """Vary the wrapper, keep the question.

    Refusals cannot be paraphrased by the API here (the free tier quota is gone) and they
    must not simply be duplicated: a model trained on the same string forty times memorises
    the string rather than the behaviour. Rotating a natural wrapper gives real lexical
    variety at zero cost, and the thing being learned is "decline when the subject is not in
    the record", which does not depend on how politely the question was asked.
    """
    body = question[0].lower() + question[1:] if question else question
    out: list[str] = []
    for wrap in REFUSAL_WRAPS[1:]:
        if len(out) >= n:
            break
        out.append(wrap.format(body))
    return out


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
        """Expand, and keep the refusal share from collapsing.

        The first run of this diluted refusals from 14 percent of the authored pairs to 6.6
        percent of the training set, purely because facts had cached paraphrases and the
        refusals did not. The model then learned exactly what that ratio taught it, and
        refusal accuracy went to zero. Refusals therefore get programmatic variants when the
        API never reached them, so the ratio that survives into training is the ratio that
        was intended.
        """
        out: list[dict[str, Any]] = []
        for row in rows:
            out.append(row)
            q = question_of(row)
            cached = [a for a in cache.get(q, [])[1:] if a not in reserved]
            if cached:
                for alt in cached:
                    out.append(with_question(row, alt))
                continue
            if "not in the record" in row["messages"][2]["content"].lower():
                for alt in refusal_variants(q, 4):
                    if alt not in reserved:
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
