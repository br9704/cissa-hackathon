/*
  Who is signed in.

  Real Supabase auth, with a documented degradation rather than a pretend one.

  When Supabase is not configured, this product still has to work: it is a portfolio project
  people will clone with no credentials, and a login wall in front of a demo that needs no
  backend would be theatre. So `required` is false in that case and the app runs on the
  seeded corpus with the Desk's viewer selector standing in for identity. The UI says which
  mode it is in; it never implies an account exists when one does not.

  When Supabase IS configured, a session is a real session: RLS on the database is what
  actually protects anything, and the anon key in the bundle is safe precisely because of
  that. Treating the client as the security boundary would be the mistake.
*/
import type { Session, User } from "@supabase/supabase-js";
import { isConfigured, supabase } from "../data/supabase";

export type AuthState =
  | { kind: "disabled" }
  | { kind: "loading" }
  | { kind: "signed_out" }
  /*
    Looking around without an account.

    A portfolio project that demands a signup before showing anything is a portfolio project
    nobody looks at. Demo mode skips the door and reads the seeded corpus in the browser,
    which is the same thing the app does with no Supabase configured at all.

    It is NOT a session and it is not pretending to be one. It cannot read the hosted ledger,
    because row level security is doing its job, and the app says which mode it is in rather
    than letting somebody believe they are looking at live data.
  */
  | { kind: "demo" }
  | { kind: "signed_in"; user: User };

const DEMO_KEY = "continuity:demo";

function demoWanted(): boolean {
  try {
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

let state: AuthState = !isConfigured
  ? { kind: "disabled" }
  : demoWanted()
    ? { kind: "demo" }
    : { kind: "loading" };
const listeners = new Set<() => void>();

function set(next: AuthState): void {
  state = next;
  for (const l of listeners) l();
}

export function authState(): AuthState {
  return state;
}

export function subscribeToAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called once from main. Safe to call when Supabase is absent: it does nothing. */
/** Look around without an account. Session scoped, so closing the tab ends it. */
export function enterDemo(): void {
  try {
    sessionStorage.setItem(DEMO_KEY, "1");
  } catch {
    /* Private windows: demo mode still applies for this page. */
  }
  set({ kind: "demo" });
}

export function leaveDemo(): void {
  try {
    sessionStorage.removeItem(DEMO_KEY);
  } catch {
    /* Nothing to clear. */
  }
  set({ kind: "signed_out" });
}

export function startAuth(): void {
  if (!isConfigured) return;
  /* A real session always wins over demo mode, so a returning user is not sent to a demo. */
  const client = supabase();

  void client.auth
    .getSession()
    .then(({ data }) => {
      if (data.session?.user) {
        set(sessionToState(data.session));
        return;
      }
      /* No session. Respect a demo choice made before the check finished. */
      set(demoWanted() ? { kind: "demo" } : { kind: "signed_out" });
    })
    .catch(() => {
      /*
        A stale refresh token throws here and, left alone, throws again on every check. Sign
        out locally so the app settles into a clean signed out state instead of retrying a
        token that will never work again.
      */
      void client.auth.signOut({ scope: "local" }).catch(() => {});
      set({ kind: "signed_out" });
    });

  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      leaveDemoQuietly();
      set(sessionToState(session));
      return;
    }
    /* Signing out of a real session should not silently drop somebody into demo mode. */
    if (state.kind !== "demo") set({ kind: "signed_out" });
  });
}

function leaveDemoQuietly(): void {
  try {
    sessionStorage.removeItem(DEMO_KEY);
  } catch {
    /* Nothing to clear. */
  }
}

function sessionToState(session: Session | null): AuthState {
  return session?.user ? { kind: "signed_in", user: session.user } : { kind: "signed_out" };
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const { error } = await supabase().auth.signUp({ email, password });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

/** True when a login screen should stand in front of the app. */
export function authRequired(): boolean {
  return isConfigured;
}
