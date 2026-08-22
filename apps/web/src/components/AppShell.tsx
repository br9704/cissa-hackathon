import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import styles from "./AppShell.module.css";
import {
  LedgerIcon,
  StrategyIcon,
  RiskIcon,
  DebriefIcon,
  ComplianceIcon,
  VerifyIcon,
} from "./icons";

const NAV = [
  { to: "/", label: "Ledger", Icon: LedgerIcon },
  { to: "/strategies", label: "Strategies", Icon: StrategyIcon },
  { to: "/risk", label: "Risk", Icon: RiskIcon },
  { to: "/debriefs", label: "Debriefs", Icon: DebriefIcon },
  { to: "/compliance", label: "Compliance", Icon: ComplianceIcon },
  { to: "/verify", label: "Verify", Icon: VerifyIcon },
] as const;

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });

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
          {NAV.map(({ to, label, Icon }) => (
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
              <span className={styles.label}>{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.main}>
        <header className={`${styles.topbar} glass`}>
          <span className={styles.firm}>Meridian Basis Partners</span>
          <button className={styles.askTrigger} type="button">
            <span>Ask the ledger</span>
            <kbd className={styles.kbd}>Cmd K</kbd>
          </button>
          <span className={styles.spacer} />
          <span className={styles.member} aria-label="Signed in">
            MB
          </span>
        </header>

        <div className={styles.scrollEdge} aria-hidden="true" />

        <main className={styles.content}>
          <Outlet />
        </main>

        <footer className={styles.footer}>
          All data in this demo is synthetic. No real firm data is present.
        </footer>
      </div>
    </div>
  );
}
