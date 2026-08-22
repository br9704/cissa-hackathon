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
machine, selecting the checkpoint on the validation split was worth +8.0 macro F1 points
over taking the last iteration. `save_every` is low enough to have candidates, and
`select_checkpoint.py` exists to use them.

**4. The base is a vision-language checkpoint, and that is fine.** Every Qwen3.5
conversion is; there is no text-only one. `mlx_lm/models/qwen3_5.py` drops the vision
tower on load. Do not "simplify" the repo id to `mlx-community/Qwen3.5-2B-bf16` without
the `-MLX-` infix: identical weights, but converted from the base model rather than the
instruct model, which is a materially worse starting point for a strict-JSON classifier.

## Honest claims

No accuracy figure from this directory appears anywhere in the product until
`results/summary.json` exists and the number in the UI is read from it. If training does
not finish, the fallback is few-shot prompting with the same base and the same parser, the
two arms are reported side by side, and the product says which one it is using.

A number measured on a different task in a different project belongs to that project and
is not borrowed here.
