import styles from "./TaggerBadge.module.css";
import { tagger } from "../data/tagger";

/*
  What the tagger is, and what its number is worth.

  The figures come from ml/results/summary.json by import, so they cannot drift from the
  run that produced them. The caveat is rendered from the same object as the numbers,
  which means there is no code path that shows one without the other.
*/
export function TaggerBadge() {
  if (!tagger.trained || !tagger.student) {
    return (
      <div className={styles.wrap}>
        <div className={styles.head}>
          <span className={styles.title}>On-prem tagger</span>
          <span className={styles.note}>Not trained yet</span>
        </div>
        <p className={styles.note}>
          Decision types in this corpus are known by construction because the generator
          wrote them. No accuracy figure is shown, because there is no measured one.
        </p>
      </div>
    );
  }

  const s = tagger.student;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>Tagged on-prem</span>
        <span className={styles.note}>
          A LoRA fine-tune of {tagger.baseModel}, trained on the machine the data is on
        </span>
      </div>

      <div className={styles.figures}>
        {tagger.gapPoints !== null ? (
          <div className={styles.figure}>
            <span className={`${styles.value} ${styles.headline}`}>
              +{tagger.gapPoints}
            </span>
            <span className={styles.label}>macro F1 points over prompting</span>
          </div>
        ) : null}
        <div className={styles.figure}>
          <span className={styles.value}>{s.macro_f1.toFixed(4)}</span>
          <span className={styles.label}>macro F1, held out</span>
        </div>
        <div className={styles.figure}>
          <span className={styles.value}>{tagger.fewShot?.macro_f1.toFixed(4) ?? "n/a"}</span>
          <span className={styles.label}>few-shot, same base</span>
        </div>
        <div className={styles.figure}>
          <span className={styles.value}>{s.invalid_outputs}</span>
          <span className={styles.label}>unparseable of {s.n}</span>
        </div>
        <div className={styles.figure}>
          <span className={styles.value}>{Math.round(s.latency_ms.p50)}</span>
          <span className={styles.label}>ms per tag, p50</span>
        </div>
      </div>

      <p className={styles.caveat}>
        {tagger.caveat} Every figure here is read from{" "}
        <code>ml/results/summary.json</code>, not typed into this page, so it cannot drift
        from the run that produced it.
      </p>
      <span className={styles.provenance}>
        {s.provenance.base_model} at {s.provenance.base_model_revision.slice(0, 12)} ·
        adapter {String(s.provenance.adapter_sha256).slice(0, 12)} · held out{" "}
        {s.provenance.heldout_sha256.slice(0, 12)} · {s.provenance.heldout_rows_scored} rows
      </span>
    </div>
  );
}
