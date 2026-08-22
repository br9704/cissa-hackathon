/*
  Promoting a debrief answer into a decision.

  This is the step that turns a conversation into a record, and it is deliberately a
  human action rather than something the agent does on its own. The machine can propose
  that a sentence matters; a person decides whether it does. Same shape as approving a
  draft, for the same reason.

  Two rules the implementation enforces rather than states:

    The promoted decision is `drafted_by: "model"` and unapproved. Promoting is not
    approving. It moves an answer into the queue, where it waits for the same keystroke
    everything else waits for.

    The reasoning is the answer, verbatim. Only the title is written by the person doing
    the promoting. Editing the answer on the way through would mean the ledger records
    what somebody wishes had been said, which is the exact failure the whole product is
    built against.
*/
import { corpus } from "./source";
import { isConfigured, appendEvent } from "./supabase";

export type Promotion = {
  key: string;
  sessionId: string;
  seq: number;
  title: string;
  why: string;
  strategyId: string | null;
  authorMemberId: string | null;
  at: string;
};

const promotions: Promotion[] = [];
const listeners = new Set<() => void>();

/*
  Cached snapshot. useSyncExternalStore compares by identity, so a getSnapshot that builds
  a new Set on every call re-renders forever. The access log made this mistake once
  already and it cost a blank page with a stack pointing at React.
*/
let keySnapshot: ReadonlySet<string> = new Set();

function notify(): void {
  keySnapshot = new Set(promotions.map((p) => p.key));
  for (const l of listeners) l();
}

export function subscribeToPromotions(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The set of `sessionId:seq` keys already promoted. Stable between writes. */
export function promotedTurns(): ReadonlySet<string> {
  return keySnapshot;
}

export function allPromotions(): readonly Promotion[] {
  return promotions;
}

export function promoteAnswer(input: {
  sessionId: string;
  seq: number;
  title: string;
  why: string;
  strategyId: string | null;
  authorMemberId: string | null;
}): Promotion {
  const key = `${input.sessionId}:${input.seq}`;

  const existing = promotions.find((p) => p.key === key);
  if (existing) return existing;

  const promotion: Promotion = { key, ...input, at: new Date().toISOString() };
  promotions.push(promotion);
  notify();

  if (isConfigured) {
    void appendEvent({
      firmId: corpus().firmId,
      kind: "decision_drafted",
      payload: {
        title: input.title,
        strategy_id: input.strategyId,
        /* The provenance that makes this defensible later: this decision did not come
           from a commit, it came from a specific answer in a specific debrief. */
        promoted_from: { session_id: input.sessionId, turn_seq: input.seq },
        drafted_by: "model",
        risk_flag: false,
      },
      actorMemberId: input.authorMemberId,
    }).catch((err) => {
      console.error("promotion was not recorded on the ledger:", err);
    });
  }

  return promotion;
}
