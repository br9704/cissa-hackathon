import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import styles from "./AppShell.module.css";
import { AskBar } from "./AskBar";
import {
  LedgerIcon,
  StrategyIcon,
  RiskIcon,
  DebriefIcon,
  ComplianceIcon,
  VerifyIcon,
} from "./icons";

/*
  The navigation carries a word of explanation under each label.

  Six section names are most of what a stranger needs to understand a product, but only if
  the names mean something to somebody who does not already work here. "Debriefs" is
  jargon; "Debriefs / short interviews" is not.
*/
const NAV = [
  { to: "/", label: "The record", hint: "every decision, locked", Icon: LedgerIcon },
  { to: "/strategies", label: "Strategies", hint: "how the thinking developed", Icon: StrategyIcon },
  { to: "/risk", label: "Knowledge risk", hint: "who holds a book alone", Icon: RiskIcon },
  { to: "/debriefs", label: "Debriefs", hint: "capture reasoning, ask leavers", Icon: DebriefIcon },
  { to: "/compliance", label: "Reports", hint: "handover and regulator packs", Icon: ComplianceIcon },
  { to: "/verify", label: "Verify", hint: "check nothing was altered", Icon: VerifyIcon },
] as const;

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [askOpen, setAskOpen] = useState(false);

  /*
    Cmd+K opens the palette from anywhere. Bound on the window rather than on a focused
    element, because keyboard first means it works wherever the cursor happens to be, and
    a shortcut that only fires when nothing is focused is a shortcut people stop reaching
    for.
  */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAskOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.shell}>
      <div className={styles.railColumn}>
        <nav className={styles.rail} aria-label="Sections">
          <div className={styles.wordmark}>
            <span className={styles.mark} aria-hidden="true">
              C
            </span>
            <span className={styles.label}>Continuity</span>
          </div>
          {NAV.map(({ to, label, hint, Icon }) => (
            <Link
              key={to}
              to={to}
              className={styles.navItem}
              data-active={path === to}
              aria-current={path === to ? "page" : undefined}
            >
              <span className={styles.glyph}>
                <Icon />
              </span>
              <span className={styles.label}>
                {label}
                <span className={styles.navHint}>{hint}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.main}>
        <header className={`${styles.topbar} glass`}>
          <span className={styles.firm}>Meridian Basis Partners</span>
          <button
            className={styles.askTrigger}
            type="button"
            onClick={() => setAskOpen(true)}
          >
            <span>Ask the ledger</span>
            <kbd className={styles.kbd}>Cmd K</kbd>
          </button>
          <span className={styles.spacer} />
          {/*
            My Record lives behind the avatar rather than in the rail. It is the screen
            about YOU, and putting it where a profile menu would be is where people look
            for that.
          */}
          <Link to="/my-record" className={styles.member} aria-label="My record">
            MB
          </Link>
        </header>

        <div className={styles.scrollEdge} aria-hidden="true" />

        <main className={styles.content}>
          <Outlet />
        </main>

        <footer className={styles.footer}>
          All data in this demo is synthetic. No real firm data is present.
        </footer>
      </div>

      <AskBar open={askOpen} onClose={() => setAskOpen(false)} />
    </div>
  );
}
