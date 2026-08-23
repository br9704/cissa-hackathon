/*
  The unfiled inbox.

  Everything the system captures arrives here first and is filed by a person. That order is
  the product, not a workflow detail: a ledger that files automatically is a log, and a log
  nobody approved is not evidence of anything. D-rule: a record drafted by a model stays
  visibly a draft until a human approves it.

  The store is deliberately the same shape as promote.ts, including the cached snapshot,
  because useSyncExternalStore compares by identity and a getSnapshot that builds a new
  array every call re-renders forever. That mistake has already cost this codebase a blank
  page twice.
*/
import { corpus } from "./source";
import { isConfigured, appendEvent } from "./supabase";

export type CaptureChannel = "note" | "meeting" | "transcript" | "commit" | "cli";

export type Capture = {
  id: string;
  channel: CaptureChannel;
  title: string;
  body: string;
  strategyId: string | null;
  authorMemberId: string | null;
  at: string;
  /* A model wrote this and no human has approved it yet. */
  draftedBy: "human" | "model";
  filed: boolean;
};

const captures: Capture[] = [];
const listeners = new Set<() => void>();

let snapshot: readonly Capture[] = [];

function notify(): void {
  snapshot = [...captures];
  for (const l of listeners) l();
}

export function subscribeToCaptures(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function allCaptures(): readonly Capture[] {
  return snapshot;
}

export function unfiledCaptures(): readonly Capture[] {
  return snapshot.filter((c) => !c.filed);
}

export const CHANNEL_LABEL: Record<CaptureChannel, string> = {
  note: "Written down",
  meeting: "Recorded in a meeting",
  transcript: "Imported transcript",
  commit: "Captured from a commit",
  cli: "Filed from the CLI",
};

let counter = 0;

export function capture(input: {
  channel: CaptureChannel;
  title: string;
  body: string;
  strategyId?: string | null;
  authorMemberId?: string | null;
  draftedBy?: "human" | "model";
}): Capture {
  counter += 1;
  const row: Capture = {
    id: `capture-${counter}`,
    channel: input.channel,
    title: input.title,
    body: input.body,
    strategyId: input.strategyId ?? null,
    authorMemberId: input.authorMemberId ?? null,
    at: new Date().toISOString(),
    draftedBy: input.draftedBy ?? "human",
    filed: false,
  };
  captures.unshift(row);
  notify();
  return row;
}

/**
 * File a capture into the ledger.
 *
 * The append is fire and forget against Supabase when it is configured, and a local no-op
 * when it is not, so the demo works on a plane and the deployed app writes for real. What is
 * never conditional is the human step: nothing reaches the ledger without someone pressing
 * the button.
 */
export function fileCapture(id: string): Capture | null {
  const row = captures.find((c) => c.id === id);
  if (!row || row.filed) return null;
  row.filed = true;
  notify();

  if (isConfigured) {
    void appendEvent({
      firmId: corpus().firmId,
      kind: "decision_drafted",
      payload: {
        title: row.title,
        why: row.body,
        strategy_id: row.strategyId,
        /* Which channel this came in through. A record whose origin is unknown is a
           record you cannot audit, and the channel is the cheapest provenance there is. */
        captured_via: row.channel,
        drafted_by: row.draftedBy,
        risk_flag: false,
      },
      actorMemberId: row.authorMemberId,
    }).catch((err) => {
      console.warn("[capture] append failed, the row stays in the inbox", err);
    });
  }
  return row;
}
