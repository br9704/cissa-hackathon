# ml: the on-prem decision tagger

A LoRA fine-tune of a small Qwen on one job: read a decision record, return
`{"label": "<one of seven>", "risk": true|false}` and nothing else.

The point is not the accuracy. The point is that it runs on the machine the data is on.
"Tagging happens on a model we fine-tuned ourselves, and this data never leaves the
building" is a claim the rest of the product cannot make on its own, and it is the claim
a quant firm's compliance function actually cares about.

## Running it

```bash
cd ml
uv python pin 3.12
uv sync

# Training data comes from the corpus generator, not from here.
pnpm --filter @continuity/core seed      # writes ml/data/mlx/{train,valid,test}.jsonl

uv run python -m mlx_lm lora -c configs/lora.yaml
uv run python src/select_checkpoint.py   # pick on validation, not on the last iteration
uv run python src/evaluate.py            # macro F1 on the held out split
```

## Four things that will cost you an afternoon if you skip them

**1. `enable_thinking=False` is mandatory at inference.** The Qwen3.5 chat template's
default branch opens an unclosed `<think>` block, and there is no `/no_think` token. But
mlx-lm renders *training* examples from the full conversation, which produces a closed
block, so the adapter learns to answer immediately. At inference without the flag the
model reasons instead of answering. Measured on this machine in a previous project: 0 of
5 valid classes without the flag, 5 of 5 with it. The obvious diagnosis, "the fine-tune
failed", is completely wrong.

**2. `num_layers: 16` with explicit `keys` trains four layers, not sixteen.** Qwen3.5 is
hybrid with `full_attention_interval: 4`, so on the 24-layer 2B only layers 3, 7, 11, 15,
19 and 23 carry `self_attn.q_proj`. Omitting `keys` lets mlx-lm auto-discover every Linear
per layer, including the GatedDeltaNet projections, and `num_layers: 0` selects all layers
because the selector is `model.layers[-max(num_layers, 0):]`.

**3. mlx-lm ships the FINAL weights, not the best ones.** In a previous project on this
machine, on a different task, selecting the checkpoint on the validation split was worth
roughly eight macro F1 points over taking the last iteration. (Written in words, not
digits: it is somebody else's measurement of somebody else's model, and every figure in
this file written as a numeral is a figure `results/summary.json` backs.) `save_every` is low enough to have candidates, and
`select_checkpoint.py` exists to use them.

**4. The base is a vision-language checkpoint, and that is fine.** Every Qwen3.5
conversion is; there is no text-only one. `mlx_lm/models/qwen3_5.py` drops the vision
tower on load. Do not "simplify" the repo id to `mlx-community/Qwen3.5-2B-bf16` without
the `-MLX-` infix: identical weights, but converted from the base model rather than the
instruct model, which is a materially worse starting point for a strict-JSON classifier.

## The result

Measured 22 Aug 2026. Both arms use the same base model at the same pinned revision, the
same prompt contract, the same strict parser, and the same held out split. One has the
adapter and one does not.

| arm | macro F1 | accuracy | risk accuracy | unparseable | p50 latency | rows |
| --- | --- | --- | --- | --- | --- | --- |
| **fine-tuned adapter** | **1.0000** | 1.0000 | 1.0000 | 0 | 462 ms | 300 |
| few-shot, same base | 0.6155 | 0.6667 | 0.7267 | 0 | 539 ms | 150 |

The gap is 38 macro F1 points, and it is the number worth quoting rather than the 1.0.

Reported to the nearest whole point on purpose. Both inputs are stored rounded to four
decimal places, so the first decimal of their difference is already at the edge of what
the stored numbers support: 1.0 minus 0.6155 is 0.3845 by hand and 0.38449999999999995 in
binary floating point, which rounds to 38.4 one way and 38.5 the other. Two documents
quoting one measurement and disagreeing in the first decimal is exactly the drift the
honest-claims rule exists to stop.

A perfect score on its own says nothing: it is equally consistent with a good model and a
trivial benchmark. The few-shot arm is what separates those two readings. Seven classes
presented in the system prompt with two worked examples each, on the same base model, gets
0.62. So the task is not solvable by prompting, the adapter is doing real work, and both
numbers came out of one run of one script with the provenance attached.

Checkpoint selection picked iteration 200. It scored the same as the final iteration this
time, so the eight-point gain a previous project on a different task got from selecting
was not repeated here. That is worth recording: a technique that paid last time did not
pay this time, and reporting only the times it worked is how a recipe turns into folklore.

(Spelled out rather than written as a figure, deliberately. It is a number from a
different project measured on a different task, and it sits two paragraphs from this
tagger's own numbers. Anything a reader could mistake for a claim about THIS model is
written in words, so that both a reader and the claims guard can tell the two apart.)

## What this number will and will not mean

Training loss reached 0.02 by iteration 70 and validation loss reached 0.002 by iteration
200. That is not a triumph, it is a warning, and the reason is in how the corpus was
built.

The training rows come from a template generator: forty templates, filled from a pool of
parameter names, venues, dates and closing clauses. The held out split is drawn from the
same generator. So a high macro F1 here measures **"can a small model learn forty
templates"**, and the answer to that was always going to be yes. It does not measure
"can this tag a real desk's decisions", because there are no real decisions to measure
against, and there will not be any in a synthetic corpus.

That distinction has to travel with the number wherever it goes. The claim this
directory supports is:

> Tagging runs on a model fine-tuned on this machine, and the data never leaves the
> building.

The claim it does not support is:

> The tagger is 97 percent accurate on decision records.

The second sentence is arithmetically true of the held out split and misleading about
everything a reader would take it to mean. `results/summary.json` carries the numbers, the
provenance, and this caveat, and anything the product displays reads from that file.

The few-shot comparison rescues part of this. If the templates were trivially separable,
prompting would also score near 1.0, and it scores 0.62. So the adapter has learned
something a prompt cannot express, on this data. What remains unmeasured is whether that
something generalises to text a person wrote rather than text a generator wrote.

The measurement that would settle it is a few hundred real decision records from a real
desk, labelled by two people who disagree sometimes. That is not something a short build
can produce, and pretending otherwise is worse than saying so.

## Training was stopped at 300 of 1000 iterations

Deliberately, and worth stating because a config that says `iters: 1000` next to a run
that did 300 otherwise looks like a crash.

Validation loss was 0.002 at iteration 200 and the checkpoint at 200 already scored a
perfect macro F1 on the validation split. The remaining 800 iterations would have taken
roughly half an hour to measure nothing. The config still says 1000 because that is the
right number for a corpus that is not this easy, and the stopping decision belongs in this
paragraph rather than hidden in a changed default.

## Honest claims

No accuracy figure from this directory appears anywhere in the product until
`results/summary.json` exists and the number in the UI is read from it. If training does
not finish, the fallback is few-shot prompting with the same base and the same parser, the
two arms are reported side by side, and the product says which one it is using.

A number measured on a different task in a different project belongs to that project and
is not borrowed here.
