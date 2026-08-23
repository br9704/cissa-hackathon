import { useState } from "react";
import styles from "./SignIn.module.css";
import { PixelMark } from "../components/pixel/PixelMark";
import { signIn, signUp } from "./session";

/*
  The login screen.

  It exists only when Supabase is configured. With no backend the app runs on the seeded
  corpus and a wall in front of it would be theatre, which is a thing this product cannot
  afford to do anywhere: its whole claim is that what you see is what is actually true.
*/
export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.stack}>
        <div className={styles.brand}>
          <PixelMark size={40} title="Continuity" />
          <span className={styles.name}>Continuity</span>
          <p className={styles.pitch}>
            The decision record for a trading desk. Why things are the way they are, sealed so
            it cannot be quietly rewritten.
          </p>
        </div>

        <form className={styles.card} onSubmit={submit}>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Working" : mode === "in" ? "Sign in" : "Create an account"}
          </button>

          <button
            type="button"
            className={styles.alt}
            onClick={() => {
              setMode((m) => (m === "in" ? "up" : "in"));
              setError(null);
            }}
          >
            {mode === "in" ? "No account yet? Create one." : "Already have an account? Sign in."}
          </button>
        </form>

        <p className={styles.note}>
          Every record in this demo is synthetic. Row level security on the database is what
          protects real data, which is why the key in this page is safe to ship.
        </p>
      </div>
    </div>
  );
}
