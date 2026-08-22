/*
  The Supabase backend.

  This is the real one. The local corpus exists so the UI can be built and screenshotted
  before anyone has credentials; this is what runs in the deployed demo and in the desktop
  app, and it is what makes the product a system rather than a picture of one.

  The parts that matter for a multi device install:

    Every write goes to one Postgres. The desktop app and the web demo are the same
    bundle pointed at the same database, so there is no sync problem to solve and no
    local copy to reconcile. A decision filed from the menu bar is in the ledger before
    the window has closed.

    Reads are pushed, not polled. The events table is in the supabase_realtime
    publication, so every subscriber gets an INSERT the moment it commits. Realtime
    authorises each event against each subscriber, so the firm boundary holds on the
    socket exactly as it does on a query: another firm's writes are not filtered out in
    the client, they never arrive.

    The chain is computed by the database, not the client. Two devices writing at the
    same instant queue on a per firm advisory lock inside the insert trigger, so the
    chain has one order and both writers see the same one. A client side chain would
    fork the moment two people filed a decision in the same second, which on a trading
    desk is a Tuesday.
*/
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const ANON = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export const isConfigured = Boolean(URL && ANON);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  if (!client) {
    client = createClient(URL!, ANON!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /*
          localStorage works inside the Tauri webview, so the desktop app stays signed in
          across launches the same way the browser does. What it needs instead is the
          Supabase origin allowlisted in the Tauri CSP connect-src, for both https and
          wss, or auth and the realtime socket fail with nothing in the UI to explain it.
        */
        detectSessionInUrl: true,
      },
      realtime: {
        /*
          Ten messages a second is well inside the free tier's two million a month and is
          more than a desk generates, but it stops a runaway loop from spending the whole
          quota in an afternoon.
        */
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return client;
}

export type LedgerEventRow = {
  id: number;
  firm_id: string;
  kind: string;
  payload: Record<string, unknown>;
  actor_member_id: string | null;
  occurred_at: string;
  prev_hash: string | null;
  this_hash: string;
};

/**
 * Subscribe to the firm's ledger.
 *
 * Returns an unsubscribe function. The filter is a convenience that keeps traffic down;
 * the security boundary is RLS on the server, and it would still hold if the filter were
 * removed or wrong.
 */
export function subscribeToLedger(
  firmId: string,
  onInsert: (row: LedgerEventRow) => void,
  onStatus?: (status: string) => void,
): () => void {
  const channel: RealtimeChannel = supabase()
    .channel(`ledger:${firmId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "events", filter: `firm_id=eq.${firmId}` },
      (payload) => onInsert(payload.new as LedgerEventRow),
    )
    .subscribe((status) => onStatus?.(status));

  return () => {
    void supabase().removeChannel(channel);
  };
}

/**
 * File an event.
 *
 * Deliberately does not accept prev_hash or this_hash. The insert trigger computes both,
 * and letting a caller pass them would create a second implementation of the chain that
 * could disagree with the first. The database returns the chained row, so the caller
 * learns its own hash rather than guessing it.
 */
export async function appendEvent(input: {
  firmId: string;
  kind: string;
  payload: Record<string, unknown>;
  actorMemberId: string | null;
  occurredAt?: string;
}): Promise<LedgerEventRow> {
  const { data, error } = await supabase()
    .from("events")
    .insert({
      firm_id: input.firmId,
      kind: input.kind,
      payload: input.payload,
      actor_member_id: input.actorMemberId,
      ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
    })
    .select()
    .single();

  if (error) {
    /*
      42501 is the one worth naming. On a Supabase project created after May 2026 new
      tables carry no grants for authenticated, and the error says "permission denied for
      table" with nothing about RLS, so the instinct is to go and rewrite a policy that
      was correct all along.
    */
    if (error.code === "42501") {
      throw new Error(
        "permission denied on events. The table needs an explicit GRANT, not a policy change. See supabase/migrations/0005_grants_rls.sql",
      );
    }
    throw new Error(`could not append event: ${error.message}`);
  }
  return data as LedgerEventRow;
}

/** Verify the chain server side, using the same function the SQL suite tests. */
export async function verifyChainRemote(firmId: string) {
  const { data, error } = await supabase().rpc("verify_chain_summary", { p_firm_id: firmId });
  if (error) throw new Error(`verify_chain failed: ${error.message}`);
  return data as { total: number; first_bad_seq: number | null; ok: boolean }[];
}
