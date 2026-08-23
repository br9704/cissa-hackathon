"""
Training data FROM the ledger.

The whole claim of the firm model rests on one property: every answer in this file is
assembled out of text the ledger already contains. Nothing is written by a model, nothing is
paraphrased on the answer side, nothing is inferred. If that property breaks, the model is
trained on invention and the demo becomes a liability the first time a judge checks an
answer against the record.

The question side is different, and deliberately so. See paraphrase_questions.py: templated
questions produce a model that only answers templated questions, which is exactly the
weakness ml/README.md already admits about the tagger. Questions get rephrased, answers do
not.

Four kinds, and the fourth is not optional:

  fact       why a parameter sits where it does, from the decision's recorded why
  genealogy  what a decision replaced and why the old approach was dropped
  persona    a member's decisions in that member's own recorded voice
  refusal    questions the ledger cannot answer, answered "that is not in the record"

Without the refusals the model hallucinates confidently, and a Q and A session ends the
pitch. They are roughly a fifth of the set on purpose.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "ml/data/firm/corpus.json"
OUT = ROOT / "ml/data/firm"

SYSTEM = (
    "You are the decision record for Meridian Basis Partners. You answer only from what the "
    "desk has written down. If the record does not contain the answer, you say so."
)

REFUSAL = "That is not in the record."


def load() -> dict[str, Any]:
    return json.loads(CORPUS.read_text())


def iso_day(ts: str) -> str:
    return ts[:10]


def ref(day: str, strategy: str) -> str:
    """The citation that travels INSIDE the answer text.

    Chips around an answer are lost the moment the text is copied into an email or read
    aloud. A reference inside the sentence survives, and it is what lets a listener check a
    claim without the app in front of them.
    """
    return f"(ledger {day}, {strategy})"


def chat(question: str, answer: str, kind: str) -> dict[str, Any]:
    return {
        "kind": kind,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ],
    }


def build(corpus: dict[str, Any], rng: random.Random) -> list[dict[str, Any]]:
    members = {m["id"]: m for m in corpus["members"]}
    strategies = {s["id"]: s for s in corpus["strategies"]}
    decisions = {d["id"]: d for d in corpus["decisions"]}
    rows: list[dict[str, Any]] = []

    def sname(sid: str | None) -> str:
        return strategies[sid]["name"] if sid in strategies else "the desk"

    def mname(mid: str | None) -> str:
        return members[mid]["displayName"] if mid in members else "the desk"

    # ---- fact ------------------------------------------------------------------
    for d in corpus["decisions"]:
        day = iso_day(d["occurredAt"])
        strat = sname(d["strategyId"])
        cite = ref(day, strat)
        who = mname(d["authorMemberId"])

        # The recorded why, in the first person of whoever wrote it, plus the citation.
        answer = f"{d['why'].rstrip('.')}. {cite}"
        rows.append(chat(f"Why is {d['title'].lower()} the way it is on {strat}?", answer, "fact"))

        # What changed is a separate question from why, and the record holds both.
        rows.append(
            chat(
                f"What changed on {strat} when {who} recorded \"{d['title']}\"?",
                f"{d['whatChanged'].rstrip('.')}. {cite}",
                "fact",
            )
        )

        # Alternatives are half of why a decision record is worth keeping.
        if d["alternatives"]:
            alts = "; ".join(a.rstrip(".") for a in d["alternatives"])
            rows.append(
                chat(
                    f"What else was considered for \"{d['title']}\" on {strat}?",
                    f"Rejected: {alts}. The reasoning that won was: "
                    f"{d['why'].rstrip('.')}. {cite}",
                    "fact",
                )
            )

    # ---- genealogy -------------------------------------------------------------
    for link in corpus["links"]:
        parent = decisions.get(link["parent"])
        child = decisions.get(link["child"])
        if not parent or not child:
            continue
        strat = sname(child["strategyId"])
        cite = ref(iso_day(child["occurredAt"]), strat)
        rows.append(
            chat(
                f"What did \"{child['title']}\" replace on {strat}, and why was the old "
                f"approach dropped?",
                f"It {link['relation'].replace('_', ' ')} \"{parent['title']}\". "
                f"The earlier record said: {parent['why'].rstrip('.')}. "
                f"The change was made because {child['why'].rstrip('.')}. {cite}",
                "genealogy",
            )
        )

    # ---- persona register ------------------------------------------------------
    sessions = {s["id"]: s for s in corpus["sessions"]}
    by_member: dict[str, list[str]] = {}
    for t in corpus["turns"]:
        if t["role"] != "human":
            continue
        session = sessions.get(t["sessionId"])
        if not session:
            continue
        by_member.setdefault(session["memberId"], []).append(t["text"])

    for mid, texts in by_member.items():
        who = mname(mid)
        member_decisions = [d for d in corpus["decisions"] if d["authorMemberId"] == mid]
        for text in texts:
            # The voice is the person's own recorded sentence. It is quoted, not imitated.
            if member_decisions:
                d = rng.choice(member_decisions)
                cite = ref(iso_day(d["occurredAt"]), sname(d["strategyId"]))
            else:
                cite = ""
            rows.append(
                chat(
                    f"What did {who} say about how they worked?",
                    f"{text.rstrip('.')}. {cite}".strip(),
                    "persona",
                )
            )

        for d in member_decisions[:6]:
            strat = sname(d["strategyId"])
            rows.append(
                chat(
                    f"{who} made a change to {strat}. What was their reasoning?",
                    f"{d['why'].rstrip('.')}. {ref(iso_day(d['occurredAt']), strat)}",
                    "persona",
                )
            )

    # ---- refusals --------------------------------------------------------------
    #
    # THE PROPORTION HERE IS THE WHOLE BALLGAME, and the first run proved it the hard way.
    #
    # Version one produced 33 refusals against 686 answerable pairs, under five percent. The
    # fine tune duly learned the dominant pattern, which is "produce a confident ledger style
    # answer", and refusal accuracy collapsed from 12 out of 12 on the untuned base to 0 out
    # of 12 on the tuned model. Facts went from 0 to 9 out of 36 in the same run, so the
    # tuning worked; it just also taught the model that declining is never the answer.
    #
    # That trade is unacceptable for this product specifically. The pitch is a record that
    # only says what the desk actually wrote down, and a model that invents a plausible
    # answer about a book nobody runs is worse than no model at all in front of somebody
    # checking.
    #
    # So refusals are now generated at scale from the corpus itself rather than hand listed,
    # targeting roughly a fifth of the set. Four families, and the last two matter most,
    # because refusing "the capital of France" is easy and refusing a question that LOOKS
    # exactly like a ledger question is the skill being trained.
    outside = [
        "What is the capital of France?",
        "How do I bake sourdough bread?",
        "What is the weather in Melbourne tomorrow?",
        "Who won the football on the weekend?",
        "Write me a poem about the sea.",
        "What is our headcount plan for next year?",
        "How much is everyone on the desk paid?",
        "What should I have for lunch?",
        "Which broker gives the best commission rates?",
        "What is the firm's legal entity structure?",
        "When does the office close for Christmas?",
        "What is the market going to do next week?",
        "Should I buy this stock?",
        "What is the firm's view on interest rates?",
        "Summarise the news this morning.",
        "How many people work here?",
        "What is the wifi password?",
        "Book me a meeting room for Thursday.",
    ]
    for q in outside:
        rows.append(chat(q, REFUSAL, "refusal"))

    real_names = {s["name"] for s in corpus["strategies"]}
    invented_books = [
        "Nikkei gamma scalp", "Brazil rates carry", "the crypto basis book",
        "European power spread", "the FX momentum sleeve", "the convertible arb book",
        "the US small cap sleeve", "the gold vol book", "Korea single stock futures",
        "the credit index book",
    ]
    for name in invented_books:
        if name in real_names:
            continue
        for template in [
            "Why is the stop loss set where it is on {}?",
            "Who runs {} and what did they change last?",
            "What did we learn from the drawdown on {}?",
            "What is the position limit on {}?",
            "Why did we stop trading {}?",
        ]:
            rows.append(chat(template.format(name), REFUSAL, "refusal"))

    # Real book, parameter that does not exist. This is the hardest family and the one a
    # judge will reach for: every proper noun in the question is real except one.
    invented_params = [
        "max_drawdown_halt", "skew_floor", "gamma_ladder", "borrow_cutoff",
        "overnight_var_cap", "liquidity_ratio", "hedge_band",
    ]
    for st in corpus["strategies"]:
        for param in invented_params[:4]:
            rows.append(
                chat(f"Why is {param} set where it is on {st['name']}?", REFUSAL, "refusal")
            )

    # Real book, a person who does not work here.
    invented_people = ["Sarah Whitfield", "Tom Reilly", "Anders Holm", "Wei Zhang"]
    real_people = {m["displayName"] for m in corpus["members"].values()} if isinstance(corpus["members"], dict) else {m["displayName"] for m in corpus["members"]}
    for who in invented_people:
        if who in real_people:
            continue
        rows.append(chat(f"What did {who} change on the desk?", REFUSAL, "refusal"))
        rows.append(chat(f"Why did {who} leave?", REFUSAL, "refusal"))

    # Things the record deliberately does not hold about real people. The transparency
    # principle cuts both ways: the ledger holds decisions, not personnel files.
    for who in [mname(m) for m in list(members)[:5]]:
        for q in [
            f"What is {who}'s home address and phone number?",
            f"How much does {who} earn?",
            f"What is {who}'s performance review?",
            f"Is {who} going to be fired?",
        ]:
            rows.append(chat(q, REFUSAL, "refusal"))

    return rows


def stratified_split(
    rows: list[dict[str, Any]], rng: random.Random, holdout: int, probe: int
) -> tuple[list, list, list, list]:
    """Hold out BEFORE training, stratified across the four kinds.

    Splitting after the fact, or splitting uniformly, would let the probe be dominated by
    whichever kind happens to be most numerous, and fact QA outnumbers refusals five to one.
    """
    by_kind: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        by_kind.setdefault(r["kind"], []).append(r)
    for v in by_kind.values():
        rng.shuffle(v)

    kinds = sorted(by_kind)
    per_kind_hold = max(1, holdout // len(kinds))
    per_kind_probe = max(1, probe // len(kinds))

    held: list[dict[str, Any]] = []
    fact_probe: list[dict[str, Any]] = []
    rest: list[dict[str, Any]] = []
    for k in kinds:
        pool = by_kind[k]
        fact_probe.extend(pool[:per_kind_probe])
        held.extend(pool[per_kind_probe : per_kind_probe + per_kind_hold])
        rest.extend(pool[per_kind_probe + per_kind_hold :])

    rng.shuffle(rest)
    cut = max(1, int(len(rest) * 0.1))
    valid, train = rest[:cut], rest[cut:]
    return train, valid, held, fact_probe


def write_jsonl(path: Path, rows: list[dict[str, Any]], keep_kind: bool = False) -> None:
    with path.open("w") as fh:
        for r in rows:
            out = r if keep_kind else {"messages": r["messages"]}
            fh.write(json.dumps(out) + "\n")


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20260823)
    ap.add_argument("--holdout", type=int, default=150)
    ap.add_argument("--probe", type=int, default=50)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    corpus = load()
    rows = build(corpus, rng)

    train, valid, held, probe = stratified_split(rows, rng, args.holdout, args.probe)

    OUT.mkdir(parents=True, exist_ok=True)
    write_jsonl(OUT / "train.jsonl", train)
    write_jsonl(OUT / "valid.jsonl", valid)
    write_jsonl(OUT / "test.jsonl", held, keep_kind=True)
    write_jsonl(OUT / "fact_probe.jsonl", probe, keep_kind=True)

    counts: dict[str, int] = {}
    for r in rows:
        counts[r["kind"]] = counts.get(r["kind"], 0) + 1

    manifest = {
        "seed": args.seed,
        "total_pairs": len(rows),
        "by_kind": counts,
        "train": len(train),
        "valid": len(valid),
        "heldout": len(held),
        "fact_probe": len(probe),
        "hashes": {
            name: sha256_of(OUT / f"{name}.jsonl")
            for name in ["train", "valid", "test", "fact_probe"]
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"{len(rows)} pairs: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    print(f"train {len(train)}, valid {len(valid)}, heldout {len(held)}, probe {len(probe)}")


if __name__ == "__main__":
    main()
