"""
Rephrase the QUESTION side only, using Gemini. Answers are never touched.

Why this exists: ml/README.md already admits what the tagger's 1.0 macro F1 really measures,
which is template learning on a synthetic corpus. The firm model would inherit exactly that
weakness if it trained on templated questions. It would score beautifully on a probe drawn
from the same templates and then fail live, in front of a judge, the first time somebody
asked in their own words. That failure would be indistinguishable from the model not knowing
the answer, and it would discredit the honest parts of the project along with the dishonest
number.

So the questions are rephrased into several natural forms, the held out probe is built from
rephrasings the model never trained on, and the summary records that this happened. A number
is only honest if the method that produced it travels alongside it.

The answer side is deliberately untouched. The moment a model writes an answer, the claim
"every answer is determined by ledger content" stops being true, and that claim is the
entire point of the firm model.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml/data/firm"
CACHE = DATA / "paraphrase_cache.json"

MODEL = os.environ.get("GEMINI_PARAPHRASE_MODEL", "gemini-2.5-flash")
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

INSTRUCTION = """You rewrite questions that a trader or portfolio manager would ask their own firm's decision record.

For each numbered question, produce {n} alternative phrasings. Rules:
- Keep every proper noun, parameter name, number and date exactly as written. Never invent or drop one.
- Vary the register: one terse, one conversational, one how a colleague would actually ask it out loud.
- Do not answer the question. Do not add context. Do not explain.
- Keep each rewrite under 30 words.

Return STRICT JSON only, no prose and no code fence: an object mapping the question number as a string to an array of {n} strings.

Questions:
{questions}"""


def call_gemini(prompt: str, key: str, retries: int = 4) -> str:
    body = json.dumps(
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.9, "maxOutputTokens": 8192},
        }
    ).encode()
    url = ENDPOINT.format(model=MODEL, key=key)
    last = ""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.load(resp)
            parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)
        except urllib.error.HTTPError as e:
            last = f"{e.code} {e.read()[:200]!r}"
            # 429 and 5xx are worth waiting out; a 400 will not fix itself.
            if e.code not in (429, 500, 502, 503, 504):
                break
            time.sleep(2 ** attempt)
        except Exception as e:  # noqa: BLE001
            last = str(e)
            time.sleep(2 ** attempt)
    print(f"  gemini call failed: {last}", file=sys.stderr)
    return ""


def parse_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3, help="paraphrases per question")
    ap.add_argument("--batch", type=int, default=20)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="seconds between calls. The free tier is a few requests a minute, and six "
        "workers hitting it at once burns the quota in seconds and then fails everything "
        "behind it. Throttling is faster than retrying.",
    )
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        print("GEMINI_API_KEY not set. Questions stay templated and the summary must say so.")
        sys.exit(2)

    files = ["train", "valid", "test", "fact_probe"]
    questions: list[str] = []
    for name in files:
        for line in (DATA / f"{name}.jsonl").read_text().splitlines():
            row = json.loads(line)
            questions.append(row["messages"][1]["content"])
    unique = sorted(set(questions))

    cache: dict[str, list[str]] = {}
    if CACHE.exists():
        cache = json.loads(CACHE.read_text())
    todo = [q for q in unique if q not in cache]
    print(f"{len(unique)} unique questions, {len(todo)} to paraphrase, {len(cache)} cached")

    batches = [todo[i : i + args.batch] for i in range(0, len(todo), args.batch)]

    def run(batch: list[str]) -> dict[str, list[str]]:
        if args.delay:
            time.sleep(args.delay)
        numbered = "\n".join(f"{i}. {q}" for i, q in enumerate(batch))
        text = call_gemini(
            INSTRUCTION.format(n=args.n, questions=numbered), key
        )
        obj = parse_json_object(text)
        out: dict[str, list[str]] = {}
        for i, q in enumerate(batch):
            got = obj.get(str(i)) or []
            clean = [
                str(v).strip()
                for v in got
                if isinstance(v, str) and 5 < len(v.strip()) < 300
            ]
            if clean:
                out[q] = clean[: args.n]
        return out

    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for result in pool.map(run, batches):
            cache.update(result)
            done += 1
            if done % 5 == 0 or done == len(batches):
                print(f"  {done}/{len(batches)} batches, {len(cache)} cached")
                CACHE.write_text(json.dumps(cache, indent=0))

    CACHE.write_text(json.dumps(cache, indent=0))
    covered = sum(1 for q in unique if q in cache)
    print(f"paraphrased {covered}/{len(unique)} questions ({covered / len(unique):.0%})")


if __name__ == "__main__":
    main()
