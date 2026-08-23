import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./DecisionCard.module.css";
import { StatusChip } from "./StatusChip";
import { memberName, strategyName, TYPE_LABEL } from "../data/source";
import type { Decision } from "@continuity/core";
import { bareKeyAllowed } from "../lib/hotkeys";

/*
  The approve step is the feature, not a workaround.

  A model drafts the record; a person reads it and presses one key. That one key is the
  whole difference between a system that documents a desk and a system that generates
  plausible text about one, and it costs the person about ten seconds. Everything about
  this card is arranged so those ten seconds are the only cost: the reasoning is already
  written, the alternatives are already there, and editing is one keystroke away rather
  than behind a form.
*/
export function DecisionCard({
  decision,
  active,
  onApprove,
  onReject,
  layoutId,
}: {
  decision: Decision;
  /* Only the focused card takes keystrokes, or A would approve the whole queue at once. */
  active: boolean;
  onApprove: (edited: string) => void;
  onReject: () => void;
  layoutId?: string;
}) {
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState(decision.why);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setWhy(decision.why);
    setEditing(false);
  }, [decision.id, decision.why]);

  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      /* While editing, the keys belong to the textarea. Escape leaves. */
      if (editing) {
        if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
          setWhy(decision.why);
        }
        return;
      }
      /*
        The editing branch above only knows about THIS card's textarea. Every other input
        on the page, the ask palette, quick capture, the transcript importer, was invisible
        to it, which is how typing a question could end up inside a decision record.
      */
      if (!bareKeyAllowed(e)) return;
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        onApprove(why);
      } else if (key === "e") {
        e.preventDefault();
        setEditing(true);
      } else if (key === "r") {
        e.preventDefault();
        onReject();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, editing, why, decision.why, onApprove, onReject]);

  return (
    <motion.div
      className={styles.card}
      layoutId={layoutId}
      /*
        Blur is dropped while the card is in flight and restored when it settles.
        Animating an element that carries a backdrop-filter forces the compositor to
        re-sample everything behind it on every frame, and it is the one reliable way to
        make this look cheap.
      */
      transition={
        reduced
          ? { duration: 0.12 }
          : { type: "spring", stiffness: 350, damping: 30 }
      }
    >
      <div className={styles.head}>
        <span className={styles.title}>{decision.title}</span>
        <span className={styles.chips}>
          <StatusChip variant="draft">Drafted by model</StatusChip>
          {decision.riskFlag ? <StatusChip variant="risk">Risk</StatusChip> : null}
          <StatusChip>
            {TYPE_LABEL[decision.decisionType] ?? decision.decisionType}
          </StatusChip>
        </span>
      </div>

      <span className={styles.meta}>
        {strategyName(decision.strategyId)} · from a commit by{" "}
        {memberName(decision.authorMemberId)}
      </span>

      {editing ? (
        <textarea
          ref={editorRef}
          className={styles.editor}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          aria-label="Edit the reasoning"
        />
      ) : (
        <p className={styles.why}>{why}</p>
      )}

      {decision.alternatives.length ? (
        <ul className={styles.alts}>
          {decision.alternatives.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.action} ${styles.approve}`}
          onClick={() => onApprove(why)}
        >
          Approve <kbd className={styles.kbd}>A</kbd>
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done editing" : "Edit"} <kbd className={styles.kbd}>E</kbd>
        </button>
        <button type="button" className={styles.action} onClick={onReject}>
          Reject <kbd className={styles.kbd}>R</kbd>
        </button>
        <span className={styles.hint}>
          {editing ? "Escape to discard the edit" : "Ten seconds, one keystroke"}
        </span>
      </div>
    </motion.div>
  );
}
