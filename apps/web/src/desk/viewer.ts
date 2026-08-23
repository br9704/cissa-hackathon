/*
  Who is looking, and therefore what they see first.

  A system a desk uses daily does not show a trader and a compliance officer the same screen.
  The corpus already carries three real roles, so this is data backed rather than invented:
  desk_head, researcher (three of the five members) and compliance.

  Role ORDERS the surface, it does not gate access. Gating would be wrong for a product whose
  transparency principle is that anybody can see what the system holds about them, and it
  would also be security theatre: the data is in the browser either way. What role changes is
  what is put in front of you first, which is the difference between a dashboard and a tool.

  Until auth lands this is a local choice, persisted per browser. That is honest about what it
  is: a view selector, not an identity claim, and nothing in the product treats it as proof of
  anything.
*/
import { corpus } from "../data/source";

const KEY = "continuity:viewer";

const listeners = new Set<() => void>();
let current: string | null = null;
let snapshot: string | null = null;

function read(): string | null {
  if (current !== null) return current;
  try {
    current = localStorage.getItem(KEY);
  } catch {
    current = null;
  }
  return current;
}

export function viewerId(): string | null {
  return snapshot;
}

export function setViewer(id: string | null): void {
  current = id;
  snapshot = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* Private windows. The choice still applies for this session. */
  }
  for (const l of listeners) l();
}

export function subscribeToViewer(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/* Initialised once at module load, so getSnapshot is a stable read rather than a localStorage
   hit on every render. The access log learned this lesson the expensive way. */
snapshot = read();

export type Role = "desk_head" | "researcher" | "compliance" | "newcomer";

export function viewerRole(): Role {
  const id = viewerId();
  if (!id) return "newcomer";
  const member = corpus().members.find((m) => m.id === id);
  const role = member?.role;
  if (role === "desk_head" || role === "researcher" || role === "compliance") return role;
  return "newcomer";
}

export type DeskSection =
  | "approvals"
  | "exposure"
  | "my_open_questions"
  | "recent_on_my_books"
  | "chain_state"
  | "unapproved_drafts"
  | "curriculum";

/*
  What each role opens on.

  The newcomer case is the one that matters for the argument: their front page IS the
  training programme, which is how the second problem stops being a separate product and
  becomes what the app looks like in somebody's first month.
*/
export const SECTIONS: Record<Role, DeskSection[]> = {
  desk_head: ["approvals", "exposure", "recent_on_my_books"],
  researcher: ["my_open_questions", "recent_on_my_books", "approvals"],
  compliance: ["chain_state", "unapproved_drafts", "exposure"],
  newcomer: ["curriculum", "recent_on_my_books", "exposure"],
};

export const ROLE_LABEL: Record<Role, string> = {
  desk_head: "Desk head",
  researcher: "Researcher",
  compliance: "Compliance",
  newcomer: "New here",
};

export const ROLE_LEDE: Record<Role, string> = {
  desk_head:
    "The book: what is waiting on you, what the desk would lose, and what changed while you were not looking.",
  researcher:
    "Your work: what nobody has answered on the books you touch, and what has changed on them recently.",
  compliance:
    "The record itself: whether the chain still holds, and what a model wrote that no person has approved.",
  newcomer:
    "Start with what the desk cannot explain to you later, because the people who wrote it have gone.",
};
