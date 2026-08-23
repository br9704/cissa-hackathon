import { useEffect, useState } from "react";
import styles from "./ModelStatus.module.css";
import { PixelAgent } from "./pixel/PixelAgent";

/*
  Which models are actually reachable, in the chrome, all the time.

  The complaint that started this was that the on-prem model looked decorative. The capture
  sheet answers that where the work happens; this answers it everywhere else, and it answers
  the harder question a sceptical reader has: not "does a model exist" but "is one running
  right now, and where".

  Both of these are LOCAL by design. Showing them as unreachable on the deployed site is not
  an embarrassment to be hidden, it is the argument: this data never leaves the building, so
  neither does the inference.
*/

type State = "checking" | "up" | "down";

export function ModelStatus() {
  const [tagger, setTagger] = useState<State>("checking");
  const [firm, setFirm] = useState<State>("checking");

  useEffect(() => {
    let live = true;
    async function probe(path: string, set: (s: State) => void) {
      try {
        const res = await fetch(path);
        const body = (await res.json()) as { available?: boolean };
        if (live) set(body.available ? "up" : "down");
      } catch {
        if (live) set("down");
      }
    }
    void probe("/api/tag", setTagger);
    void probe("/api/firm-model", setFirm);
    return () => {
      live = false;
    };
  }, []);

  const anyUp = tagger === "up" || firm === "up";
  const label =
    tagger === "checking" && firm === "checking"
      ? "checking for local models"
      : anyUp
        ? `on this machine: ${[tagger === "up" ? "tagger" : null, firm === "up" ? "firm model" : null]
            .filter(Boolean)
            .join(" and ")}`
        : "no local model running";

  return (
    <span className={styles.wrap} title={label}>
      <PixelAgent state={anyUp ? "idle" : "offline"} size={13} />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
