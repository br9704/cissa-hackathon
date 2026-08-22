/*
  Access is itself an event.

  Opening another desk's strategy, generating a handover pack, or exporting a compliance
  extract appends to the same ledger the decisions go into. This is the Palantir defence
  repurposed as a feature: the strongest thing that platform does is not restrict access,
  it records it, and makes the record visible to the people it is about.

  Two consequences worth stating plainly, because they are the difference between this
  being a feature and being a slogan.

  Exports prompt for a one line justification, stored on the event. A justification field
  that nobody ever reads still changes behaviour, and one that the subject can read
  changes it more.

  Every member can see the access events touching their own contributions. Transparency
  to the observed is the acceptability condition for capturing anything at all, and it is
  a screen in this product rather than a promise in a contract.

  In the local backend these live in memory for the session. With Supabase they go
  through appendEvent and are chained like everything else.
*/
import { corpus } from "./source";
import { isConfigured, appendEvent } from "./supabase";

export type AccessEvent = {
  id: string;
  kind: "access_read" | "access_export";
  at: string;
  /* Who looked. */
  actorMemberId: string;
  /* What they looked at, in words rather than ids, because this is read by a person. */
  target: string;
  /* Whose contributions it touched. Drives the My Record view. */
  subjectMemberIds: string[];
  /* The checkpoint. Present on exports, absent on reads. */
  justification?: string;
};

const log: AccessEvent[] = [];
const listeners = new Set<() => void>();

/*
  A cached snapshot, and it is not an optimisation.

  useSyncExternalStore compares snapshots by identity, so a getSnapshot that returns
  `log.slice().reverse()` hands React a different array on every call and it re-renders
  forever: "Maximum update depth exceeded", with a blank page and a stack that points at
  React rather than at the store. The snapshot has to be stable between writes, so it is
  built once and replaced only when the log actually changes.
*/
let snapshot: AccessEvent[] = [];

function notify() {
  snapshot = log.slice().reverse();
  for (const l of listeners) l();
}

export function subscribeToAccessLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function accessLog(): AccessEvent[] {
  return snapshot;
}

let counter = 0;

/**
 * Record an access.
 *
 * Fire and forget against the database on purpose: a read that fails to log is a gap in
 * the audit trail and it is still not a reason to refuse the read. The failure is
 * reported rather than swallowed.
 */
export function recordAccess(input: {
  kind: AccessEvent["kind"];
  actorMemberId: string;
  target: string;
  subjectMemberIds: string[];
  justification?: string;
}): AccessEvent {
  const event: AccessEvent = {
    id: `access-${++counter}`,
    at: new Date().toISOString(),
    ...input,
  };
  log.push(event);
  notify();

  if (isConfigured) {
    void appendEvent({
      firmId: corpus().firmId,
      kind: input.kind,
      payload: {
        target: input.target,
        subject_member_ids: input.subjectMemberIds,
        ...(input.justification ? { justification: input.justification } : {}),
      },
      actorMemberId: input.actorMemberId,
    }).catch((err) => {
      console.error("access event was not recorded on the ledger:", err);
    });
  }

  return event;
}

/** Everything that touched this member's contributions. Drives My Record. */
export function accessTouching(memberId: string): AccessEvent[] {
  return accessLog().filter((e) => e.subjectMemberIds.includes(memberId));
}
