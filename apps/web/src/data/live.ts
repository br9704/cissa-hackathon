/*
  The live ledger hook.

  One hook, two backends. With credentials it loads from Postgres and then holds a
  realtime subscription open, so a decision filed on the desktop app appears in a browser
  on another machine without anybody refreshing anything. Without credentials it falls
  back to the generated corpus, and says which it is doing rather than pretending.

  The connection state is surfaced rather than hidden. A live tail that has quietly
  dropped looks exactly like a quiet afternoon, and on a trading desk those are very
  different things.
*/
import { useEffect, useMemo, useState } from "react";
import { ledger as localLedger, corpus, type LedgerEntry } from "./source";
import { isConfigured, subscribeToLedger, supabase, type LedgerEventRow } from "./supabase";
import { authState } from "../auth/session";

export type ConnectionState = "local" | "connecting" | "live" | "dropped";

function toEntry(row: LedgerEventRow): LedgerEntry {
  const p = row.payload ?? {};
  return {
    id: String(p["decision_id"] ?? row.id),
    kind: row.kind,
    title: String(p["title"] ?? row.kind),
    strategyId: (p["strategy_id"] as string) ?? null,
    actorMemberId: row.actor_member_id,
    occurredAt: row.occurred_at,
    decisionType: (p["decision_type"] as string) ?? null,
    riskFlag: Boolean(p["risk_flag"]),
    draft: row.kind === "decision_drafted",
  };
}

export function useLiveLedger(): {
  entries: LedgerEntry[];
  connection: ConnectionState;
  /* The id of the row that just arrived, so exactly one row plays the verified sweep. */
  freshId: string | undefined;
} {
  const fallback = useMemo(() => localLedger(), []);
  const firmId = corpus().firmId;

  const [entries, setEntries] = useState<LedgerEntry[]>(fallback);
  /*
    Demo mode reads the seeded corpus, never the hosted ledger.

    Not a shortcut. Without a session, row level security correctly returns nothing, so a
    visitor who chose to look around without an account was shown an EMPTY ledger and a
    product that appeared to do nothing. RLS was doing its job and the app was drawing the
    wrong conclusion from it.
  */
  const demo = authState().kind === "demo";
  const useRemote = isConfigured && !demo;

  const [connection, setConnection] = useState<ConnectionState>(
    useRemote ? "connecting" : "local",
  );
  const [freshId, setFreshId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!useRemote) return;
    let live = true;

    /* Load the history once, then keep it current from the socket. Polling would work and
       would also mean the ledger is only as live as the interval, which defeats the
       point of the animation it feeds. */
    void supabase()
      .from("events")
      .select("*")
      .order("id", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!live) return;
        if (error || !data) {
          setConnection("dropped");
          return;
        }
        setEntries((data as LedgerEventRow[]).map(toEntry));
      });

    const unsubscribe = subscribeToLedger(
      firmId,
      (row) => {
        if (!live) return;
        const entry = toEntry(row);
        setEntries((prev) => {
          /* Realtime can redeliver, and the row may also already be present from the
             insert that caused it. Keyed dedupe rather than a length check. */
          if (prev.some((e) => e.id === entry.id)) return prev;
          return [entry, ...prev];
        });
        setFreshId(entry.id);
      },
      (status) => {
        if (!live) return;
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("dropped");
        }
      },
    );

    return () => {
      live = false;
      unsubscribe();
    };
  }, [firmId]);

  return { entries, connection, freshId };
}
