import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SearchMode } from "../search";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import styles from "./AskBar.module.css";
import { searchDetailed, type Hit } from "../search";
import { buildIndex } from "../search";
import { strategyName } from "../data/source";

type Action = { id: string; label: string; hint: string; to: string };

const ACTIONS: Action[] = [
  { id: "ledger", label: "Open the ledger", hint: "every event, newest first", to: "/" },
  { id: "strategies", label: "Open strategies", hint: "decision genealogy", to: "/strategies" },
  { id: "risk", label: "Open knowledge risk", hint: "bus factor and departure simulation", to: "/risk" },
  { id: "debriefs", label: "Open debriefs", hint: "grounded interviews", to: "/debriefs" },
  { id: "compliance", label: "Open compliance", hint: "RTS 6 and SR 11-7 extracts", to: "/compliance" },
  { id: "verify", label: "Verify the chain", hint: "recompute every hash", to: "/verify" },
];

export function AskBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [indexProgress, setIndexProgress] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SearchMode>("hybrid");

  /* One token per keystroke, so a slow search for an old query cannot land after a fast
     one for a newer query and overwrite it. */
  const searchToken = useRef(0);

  /*
    Focus BEFORE paint, not after.

    The previous version focused inside requestAnimationFrame, which leaves a frame where
    the dialog is on screen and the input is not focused. Typing straight after Cmd+K split
    the sentence between the palette and the page, and half of it ended up inside whatever
    draft was open. useLayoutEffect runs synchronously once the dialog is in the document,
    so there is no such window.
  */
  useLayoutEffect(() => {
    if (open) {
      setSelected(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setHits(null);
      setError(null);
      return;
    }

    const token = ++searchToken.current;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const { hits: results, mode: usedMode } = await searchDetailed(trimmed);
        if (searchToken.current !== token) return;
        setHits(results);
        setMode(usedMode);
        setError(null);
      } catch (err) {
        if (searchToken.current !== token) return;
        /*
          Say what went wrong. A search box that silently returns nothing when the model
          failed to load is indistinguishable from a corpus that has no answer, and those
          two need very different responses from whoever is looking at it.
        */
        setError((err as Error).message);
        setHits([]);
      } finally {
        if (searchToken.current === token) setBusy(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, open]);

  /* Warm the index when the palette first opens, not on page load. */
  useEffect(() => {
    if (!open) return;
    let live = true;
    void buildIndex((done, total) => {
      if (!live) return;
      setIndexProgress(done >= total ? null : Math.round((done / total) * 100));
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  const filteredActions = ACTIONS.filter((a) =>
    a.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const showActions = query.trim().length < 3;
  const rows = showActions ? filteredActions.length : (hits?.length ?? 0);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(0, rows - 1)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showActions) {
        const action = filteredActions[selected];
        if (action) {
          void navigate({ to: action.to });
          onClose();
        }
      } else {
        const hit = hits?.[selected];
        if (hit?.strategyId) {
          void navigate({ to: "/strategies" });
          onClose();
        }
      }
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className={styles.overlay}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.14 }}
          />
          <motion.div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Ask the ledger"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: reduced ? 0.1 : 0.14, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={onKeyDown}
          >
            {indexProgress !== null ? (
              <motion.div
                className={styles.progress}
                initial={{ width: "0%" }}
                animate={{ width: `${indexProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            ) : null}

            <div className={styles.inputRow}>
              <input
                ref={inputRef}
                className={styles.input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(0);
                }}
                placeholder="Ask why something is the way it is, or jump to a view"
                aria-label="Ask the ledger"
                spellCheck={false}
              />
              {busy ? <span className={styles.spinner} aria-label="Searching" /> : null}
            </div>

            <div className={styles.list}>
              {showActions ? (
                <>
                  <div className={styles.group}>Go to</div>
                  {filteredActions.map((a, i) => (
                    <div
                      key={a.id}
                      className={styles.item}
                      data-selected={i === selected}
                      onMouseEnter={() => setSelected(i)}
                      onClick={() => {
                        void navigate({ to: a.to });
                        onClose();
                      }}
                    >
                      <span className={styles.itemTitle}>{a.label}</span>
                      <span className={styles.itemMeta}>{a.hint}</span>
                    </div>
                  ))}
                  <div className={styles.group}>Or ask a question</div>
                  <div className={styles.empty}>
                    Type at least three words. The corpus is searched by meaning, using a
                    model that runs in this browser. Nothing you type is sent anywhere.
                  </div>
                </>
              ) : error ? (
                <div className={styles.empty}>
                  Search is unavailable: {error}
                </div>
              ) : hits && hits.length > 0 ? (
                <>
                  {mode === "lexical" ? (
                    /*
                      Say which retrieval answered. A keyword match and a meaning match are
                      different products, and a reader who thinks they got the second when
                      they got the first will misjudge what the absence of a result means.
                    */
                    <div className={styles.empty}>
                      The meaning-search model could not be reached, so these are keyword
                      matches only. Ranking is less forgiving of rephrasing than usual.
                    </div>
                  ) : null}
                  <div className={styles.group}>
                    {hits.length} passage{hits.length === 1 ? "" : "s"} from the ledger
                  </div>
                  {hits.map((h, i) => (
                    <div
                      key={h.id}
                      className={styles.item}
                      data-selected={i === selected}
                      onMouseEnter={() => setSelected(i)}
                      onClick={() => {
                        void navigate({ to: "/strategies" });
                        onClose();
                      }}
                    >
                      <span className={styles.itemTitle}>{h.title}</span>
                      <span className={styles.itemBody}>{h.body}</span>
                      <span className={styles.itemMeta}>
                        <span>{h.source === "decision" ? "Decision" : "Debrief"}</span>
                        <span>{strategyName(h.strategyId)}</span>
                        <span>{h.authorName}</span>
                        <span className={styles.score}>{h.similarity.toFixed(2)}</span>
                      </span>
                    </div>
                  ))}
                </>
              ) : hits && hits.length === 0 && !busy ? (
                <div className={styles.empty}>
                  Nothing in the corpus is close to that. That is the honest answer rather
                  than the nearest few passages dressed up as one: no source, no claim.
                </div>
              ) : (
                <div className={styles.empty}>Searching the ledger</div>
              )}
            </div>

            <div className={styles.footer}>
              <span>
                <span className={styles.kbd}>up</span> <span className={styles.kbd}>down</span> to move
              </span>
              <span>
                <span className={styles.kbd}>enter</span> to open
              </span>
              <span>
                <span className={styles.kbd}>esc</span> to close
              </span>
              <span style={{ marginLeft: "auto" }}>Answers cite their source or say nothing</span>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
