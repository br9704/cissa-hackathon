import { useEffect, useRef, useState } from "react";
import styles from "./LiveTagger.module.css";
import { PixelAgent, type AgentState } from "./pixel/PixelAgent";
import { StatusChip } from "./StatusChip";
import { TYPE_LABEL } from "../data/source";

/*
  Watch the on-prem model classify what you just typed.

  It runs on this machine, which is the entire argument for having trained it, so when the
  local server is not up this says so rather than quietly asking a hosted model instead. The
  claim is that this data never leaves the building; honouring that means the honest failure
  beats the convenient success.

  Debounced, because a request per keystroke would queue faster than a two billion parameter
  model can answer, and the tag you eventually saw would belong to a sentence you had already
  finished rewriting.
*/

type Result =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "tagged"; label: string | null; risk: boolean; ms: number; unparseable: boolean }
  | { kind: "offline"; detail: string };

export function LiveTagger({ text }: { text: string }) {
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const token = useRef(0);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed.length < 25) {
      setResult({ kind: "idle" });
      return;
    }
    const mine = ++token.current;
    setResult({ kind: "thinking" });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        if (token.current !== mine) return;
        const body = (await res.json()) as Record<string, unknown>;
        /* available:false is an expected answer, not an error. See api/tag.ts. */
        if (!res.ok || body["available"] === false) {
          setResult({
            kind: "offline",
            detail: String(body["detail"] ?? "the on-prem tagger is not reachable"),
          });
          return;
        }
        setResult({
          kind: "tagged",
          label: (body["label"] as string | null) ?? null,
          risk: body["risk"] === true,
          ms: Number(body["ms"] ?? 0),
          unparseable: body["unparseable"] === true,
        });
      } catch (err) {
        if (token.current !== mine) return;
        setResult({ kind: "offline", detail: (err as Error).message });
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [text]);

  const state: AgentState =
    result.kind === "thinking" ? "thinking" : result.kind === "offline" ? "offline" : "idle";

  return (
    <div className={styles.wrap} aria-live="polite">
      <PixelAgent state={state} size={14} />
      <span className={styles.label}>on-prem tagger</span>

      {result.kind === "idle" ? <span>waits for a sentence</span> : null}
      {result.kind === "thinking" ? <span>classifying on this machine</span> : null}

      {result.kind === "tagged" ? (
        result.unparseable ? (
          /* Never coerced to a default class. Silently returning the majority class whenever
             the model babbles is how a model looks like it works until somebody checks. */
          <span className={styles.result}>the model returned something unparseable</span>
        ) : (
          <span className={styles.result}>
            <StatusChip>{TYPE_LABEL[result.label ?? ""] ?? result.label}</StatusChip>
            {result.risk ? <StatusChip variant="risk">risk</StatusChip> : null}
            <span className={styles.ms}>{result.ms}ms</span>
          </span>
        )
      ) : null}

      {result.kind === "offline" ? (
        <span className={styles.offline}>{result.detail}</span>
      ) : null}
    </div>
  );
}
