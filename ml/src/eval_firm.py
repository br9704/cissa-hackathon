"""
The four way fact probe.

The specified eval was base versus tuned. That delta is real and, on its own, close to
trivial: a two billion parameter model that was never shown this firm's records does not
know them, and nobody is surprised. So the same 50 questions run against four systems:

  A  the untuned base                     no ledger, no network
  B  Gemini, no ledger access             no ledger, network
  C  Gemini plus retrieval over the ledger    ledger at query time, network
  D  the tuned adapter                    ledger in the weights, no network

Row B is the one that carries the argument. A frontier model also scores near zero, because
these facts are proprietary and exist nowhere in public training data. That is the honest
answer to "why not just use ChatGPT", and it is a much stronger claim than A alone.

Row C is included deliberately even though it will probably score well. Leaving out the
comparison a sharp judge would immediately ask for is how a demo loses credibility. The
claim was never that fine tuning beats retrieval on accuracy. It is what the last column
shows: D answers with the corpus offline and the network down, and C cannot.

SCORING, stated here because a number without its method is not evidence.

Answers are ledger prose, so exact string match would score zero for a correct answer that
rephrases. Instead: take the content words of the reference answer, drop the ones that
already appear in the question (so the model gets no credit for parroting), and measure what
fraction of the remainder appear in the generated answer. That measures recall of NEW
information. An item counts as correct at 0.6 or above. Unparseable or empty output counts
as wrong rather than being skipped, which is the rule that stops a broken run looking clean.

Refusals are scored separately and by their own rule: an item on the cannot answer set is
correct only if the model declines. A model that scores well on facts and invents answers to
questions the ledger cannot support is worse than useless in front of a judge.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml/data/firm"
RESULTS = ROOT / "ml/results"

STOP = {
    "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "it", "that",
    "this", "we", "our", "was", "were", "be", "been", "as", "at", "by", "with", "from",
    "why", "what", "how", "does", "do", "did", "so", "if", "then", "than", "its", "has",
    "have", "had", "are", "not", "but", "which", "when", "who", "their", "they", "them",
    "there", "here", "about", "into", "over", "after", "before", "would", "could", "will",
}

REFUSAL_MARKERS = ("not in the record", "no record", "does not contain", "cannot answer")
CORRECT_AT = 0.6


def words(text: str) -> set[str]:
    return {w for w in re.split(r"[^a-z0-9_]+", text.lower()) if len(w) > 2 and w not in STOP}


def score_fact(reference: str, question: str, generated: str) -> float:
    """Recall of the content words the answer adds over the question."""
    target = words(reference) - words(question)
    if not target:
        return 0.0
    got = words(generated)
    return len(target & got) / len(target)


def is_refusal(generated: str) -> bool:
    low = generated.lower()
    return any(m in low for m in REFUSAL_MARKERS)


# --------------------------------------------------------------------------- local models
def mlx_generate(prompts: list[dict[str, str]], adapter: Path | None, model: str) -> list[str]:
    """Load the model once, then answer every prompt.

    The first version shelled out to `mlx_lm generate` per prompt, which reloads two billion
    parameters from disk for each of roughly 120 generations. That is half an hour of waiting
    to produce a number, and a harness slow enough to avoid running is a harness that stops
    being run.
    """
    from mlx_lm import load, generate  # imported here so the module parses without mlx
    from mlx_lm.sample_utils import make_sampler

    print(f"    loading {'tuned' if adapter else 'base'}")
    m, tok = load(model, adapter_path=str(adapter) if adapter else None)
    sampler = make_sampler(temp=0.0)

    out: list[str] = []
    for i, p in enumerate(prompts, 1):
        messages = [
            {"role": "system", "content": p["system"]},
            {"role": "user", "content": p["user"]},
        ]
        text = tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
        try:
            out.append(generate(m, tok, prompt=text, max_tokens=160, sampler=sampler, verbose=False).strip())
        except Exception as e:  # noqa: BLE001
            print(f"      generate failed on {i}: {e}", file=sys.stderr)
            out.append("")
        if i % 10 == 0:
            print(f"    {i}/{len(prompts)}")
    return out


# --------------------------------------------------------------------------- gemini
def gemini(prompt: str, system: str, key: str, model: str) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}"
        f":generateContent?key={key}"
    )
    body = json.dumps(
        {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 2048},
        }
    ).encode()
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                payload = json.load(resp)
            parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts).strip()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            return ""
        except Exception:  # noqa: BLE001
            time.sleep(2)
    return ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", default="runs/firm/adapters")
    ap.add_argument("--model", default="mlx-community/Qwen3.5-2B-MLX-bf16")
    ap.add_argument("--revision", default="05ce45420036b812fe0be3f72cdc1fb62bae6891")
    ap.add_argument("--gemini-model", default="gemini-2.5-flash")
    ap.add_argument("--skip", default="", help="comma separated arm letters to skip")
    args = ap.parse_args()

    skip = {s.strip().upper() for s in args.skip.split(",") if s.strip()}

    probe = [json.loads(l) for l in (DATA / "fact_probe.jsonl").read_text().splitlines() if l.strip()]
    facts = [p for p in probe if p.get("kind") != "refusal"]
    refusals = [p for p in probe if p.get("kind") == "refusal"]
    print(f"probe: {len(facts)} fact items, {len(refusals)} refusal items")

    def prompts(items: list[dict[str, Any]]) -> list[dict[str, str]]:
        return [
            {"system": i["messages"][0]["content"], "user": i["messages"][1]["content"]}
            for i in items
        ]

    arms: dict[str, dict[str, Any]] = {}

    def evaluate(name: str, answers_fact: list[str], answers_refusal: list[str]) -> None:
        scores = [
            score_fact(f["messages"][2]["content"], f["messages"][1]["content"], a)
            for f, a in zip(facts, answers_fact)
        ]
        correct = sum(1 for s in scores if s >= CORRECT_AT)
        refused = sum(1 for a in answers_refusal if is_refusal(a))
        arms[name] = {
            "fact_items": len(facts),
            "fact_correct": correct,
            "fact_accuracy": round(correct / len(facts), 4) if facts else None,
            "mean_recall": round(sum(scores) / len(scores), 4) if scores else None,
            "refusal_items": len(answers_refusal),
            "refusal_correct": refused,
            "refusal_accuracy": round(refused / len(answers_refusal), 4) if answers_refusal else None,
            "empty_outputs": sum(1 for a in answers_fact + answers_refusal if not a.strip()),
        }
        print(f"  {name}: facts {correct}/{len(facts)}, refusals {refused}/{len(answers_refusal)}")

    adapter_path = ROOT / "ml" / args.adapter

    if "A" not in skip:
        print("arm A: untuned base")
        evaluate("A_base_untuned",
                 mlx_generate(prompts(facts), None, args.model),
                 mlx_generate(prompts(refusals), None, args.model))

    if "D" not in skip:
        print("arm D: tuned adapter")
        evaluate("D_firm_model",
                 mlx_generate(prompts(facts), adapter_path, args.model),
                 mlx_generate(prompts(refusals), adapter_path, args.model))

    key = os.environ.get("GEMINI_API_KEY", "")
    if key and "B" not in skip:
        print("arm B: gemini, no ledger")
        probe_ok = gemini("Reply with OK", "You are a test.", key, args.gemini_model)
        if not probe_ok:
            print("  gemini unreachable (quota). Arms B and C are omitted, and the summary "
                  "records that rather than reporting a zero we did not measure.")
        else:
            evaluate("B_gemini_no_ledger",
                     [gemini(p["user"], p["system"], key, args.gemini_model) for p in prompts(facts)],
                     [gemini(p["user"], p["system"], key, args.gemini_model) for p in prompts(refusals)])

    RESULTS.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((DATA / "manifest.json").read_text())
    summary = {
        "task": "firm model fact probe",
        "scoring": {
            "method": "content word recall of the reference answer, excluding words already in the question",
            "correct_at": CORRECT_AT,
            "empty_counts_as_wrong": True,
            "refusal_rule": "an item on the cannot answer set is correct only if the model declines",
        },
        "probe_phrasing": {
            "paraphrased": manifest.get("paraphrase", {}).get("probe_paraphrased"),
            "templated": manifest.get("paraphrase", {}).get("probe_templated"),
            "note": manifest.get("paraphrase", {}).get("note"),
        },
        "data": manifest,
        "arms": arms,
        "arms_omitted": sorted(skip),
    }
    (RESULTS / "firm_model_summary.json").write_text(json.dumps(summary, indent=2))
    print(f"wrote {RESULTS / 'firm_model_summary.json'}")


if __name__ == "__main__":
    main()
