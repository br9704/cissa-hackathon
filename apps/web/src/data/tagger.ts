/*
  What the product is allowed to say about the tagger.

  The numbers are IMPORTED from ml/results/summary.json rather than typed here. That is
  the honest-claims rule made mechanical: a figure in the UI that somebody typed can drift
  from the run that produced it and nobody finds out, whereas an import cannot. If the
  file is missing, the UI says the tagger is untrained rather than showing a number from
  memory.

  The caveat travels with the number, in the same object, so a component cannot render one
  without the other by accident.
*/
import summary from "../../../../ml/results/summary.json";

type Arm = {
  arm: string;
  macro_f1: number;
  accuracy: number;
  risk_accuracy: number;
  n: number;
  invalid_outputs: number;
  latency_ms: { p50: number; p95: number; mean: number };
  provenance: {
    evaluated_at: string;
    base_model: string;
    base_model_revision: string;
    adapter_sha256: string | null;
    heldout_sha256: string;
    heldout_rows_scored: number;
  };
};

const arms = (summary as { arms: Record<string, Arm> }).arms;

export const tagger = {
  trained: Boolean(arms?.["student"]),
  student: arms?.["student"] ?? null,
  fewShot: arms?.["few_shot"] ?? null,

  /** The base model, short. */
  baseModel: arms?.["student"]?.provenance.base_model.split("/").pop() ?? "unknown",

  /**
   * The gap, which is the reportable figure.
   *
   * A macro F1 of 1.0 on its own is equally consistent with a good model and a trivial
   * benchmark. The difference against few-shot prompting on the same base, same parser
   * and same split is the part that says something about the model.
   *
   * Reported to the nearest whole point, deliberately. The two inputs are stored rounded
   * to four decimal places, so the first decimal of their difference is already at the
   * edge of what the stored numbers support, and binary floating point puts it on the
   * wrong side of a rounding boundary: 1.0 - 0.6155 evaluates to 0.38449999999999995,
   * which rounds to 38.4 while the arithmetic a reader would do by hand gives 38.5.
   * Two documents quoting the same measurement and disagreeing in the first decimal is
   * precisely the drift the honest-claims rule exists to stop, and the honest fix is to
   * stop claiming a digit the data does not support.
   */
  gapPoints:
    arms?.["student"] && arms?.["few_shot"]
      ? Math.round((arms["student"].macro_f1 - arms["few_shot"].macro_f1) * 100)
      : null,

  /*
    Shown wherever a number is shown. Not optional, and not in a tooltip somewhere else:
    the corpus is template generated and the held out split comes from the same generator,
    so the score measures template learning and not performance on text a person wrote.
  */
  caveat:
    "Measured on a held out split of a template generated corpus, so it measures template " +
    "learning rather than performance on decisions a person wrote. The gap against " +
    "few-shot prompting is the part that says something about the model.",
} as const;
