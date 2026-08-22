/*
  Where the app gets its rows.

  Two backends, one shape. When VITE_SUPABASE_URL is present the app reads the hosted
  database; when it is not, it reads the same deterministic corpus the seed script loads,
  generated in the browser.

  This is not a mock. It is literally the same generator, so what you see with no
  credentials is what the database contains after seeding, and the fallback cannot drift
  from the real thing without a test failing first. The practical effect is that the UI
  is fully buildable and screenshot-able before anyone has logged into Supabase, which is
  the situation this build actually started in.
*/
import { generate, DEFAULT_SEED, type Corpus } from "@continuity/core";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;

export const backend: "supabase" | "local" = SUPABASE_URL ? "supabase" : "local";

let cached: Corpus | null = null;

/**
 * The corpus, generated once per session.
 *
 * Memoised because the generator is deterministic but not free, and because every view
 * that derives from it must derive from the SAME objects: the graph layout is only
 * reproducible if node identity is stable across renders.
 */
export function corpus(): Corpus {
  if (!cached) cached = generate(DEFAULT_SEED);
  return cached;
}

export function memberName(id: string | null | undefined): string {
  if (!id) return "Unattributed";
  return corpus().members.find((m) => m.id === id)?.displayName ?? "Unknown";
}

export function memberInitials(id: string | null | undefined): string {
  const name = memberName(id);
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

export function strategyName(id: string | null | undefined): string {
  if (!id) return "Unassigned";
  return corpus().strategies.find((s) => s.id === id)?.name ?? "Unknown";
}

/**
 * The ledger, newest first.
 *
 * Built from decisions rather than stored separately, because in the local backend the
 * ledger IS the decision stream plus the access events the session generates. The
 * ordering matches what the database returns: by occurrence, descending.
 */
export type LedgerEntry = {
  id: string;
  kind: string;
  title: string;
  strategyId: string | null;
  actorMemberId: string | null;
  occurredAt: string;
  decisionType: string | null;
  riskFlag: boolean | null;
  draft: boolean;
};

export function ledger(): LedgerEntry[] {
  return corpus()
    .decisions.map((d) => ({
      id: d.id,
      kind: d.approvedAt ? "decision_approved" : "decision_drafted",
      title: d.title,
      strategyId: d.strategyId,
      actorMemberId: d.authorMemberId,
      occurredAt: d.occurredAt,
      decisionType: d.decisionType,
      riskFlag: d.riskFlag,
      draft: d.approvedAt === null,
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/*
  Relative time, in the register a trading desk would use, and deliberately without the
  word "ago". The ledger column is set in a mono face with tabular figures so the ages
  line up, and a mono space is as wide as a digit, which turns "2d ago" into "2d   ago".
  The unit is doing the work anyway.
*/
export function ago(iso: string, now = Date.parse("2026-08-21T09:00:00Z")): string {
  const diff = now - Date.parse(iso);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks}w`;
  return `${Math.round(days / 30)}mo`;
}

/** Human label for a decision_type. The stored value is a slug; this is what people read. */
export const TYPE_LABEL: Record<string, string> = {
  parameter_change: "Parameter change",
  risk_limit: "Risk limit",
  data_handling: "Data handling",
  execution: "Execution",
  universe: "Universe",
  infra: "Infrastructure",
  process: "Process",
};
