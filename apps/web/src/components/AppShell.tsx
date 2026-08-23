import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import styles from "./AppShell.module.css";
import { AskBar } from "./AskBar";
import { CaptureSheet } from "./CaptureSheet";
import { PixelMark } from "./pixel/PixelMark";
import { PixelBlast } from "./pixel/PixelBlast";
import { UserMenu } from "../auth/UserMenu";
import { railCollapsed, setRailCollapsed, subscribeToRail } from "./useRailState";
import { LivenessStrip } from "./LivenessStrip";
import {
  LedgerIcon,
  StrategyIcon,
  RiskIcon,
  DebriefIcon,
  ComplianceIcon,
  VerifyIcon,
  MyRecordIcon,
  AcademyIcon,
  DeskIcon,
  CaptureIcon,
  SystemIcon,
} from "./icons";

/*
  The navigation carries a word of explanation under each label.

  Six section names are most of what a stranger needs to understand a product, but only if
  the names mean something to somebody who does not already work here. "Debriefs" is
  jargon; "Debriefs / short interviews" is not.
*/
const NAV = [
  { to: "/desk", label: "Desk", hint: "what needs you today", Icon: DeskIcon },
  { to: "/capture", label: "Capture", hint: "every way in, one room", Icon: CaptureIcon },
  { to: "/", label: "The record", hint: "every decision, locked", Icon: LedgerIcon },
  { to: "/strategies", label: "Strategies", hint: "how the thinking developed", Icon: StrategyIcon },
  { to: "/risk", label: "Knowledge risk", hint: "who holds a book alone", Icon: RiskIcon },
  { to: "/debriefs", label: "Debriefs", hint: "ask people before they go", Icon: DebriefIcon },
  { to: "/compliance", label: "Reports", hint: "handover and regulator", Icon: ComplianceIcon },
  { to: "/verify", label: "Verify", hint: "check nothing was altered", Icon: VerifyIcon },
  /*
    My Record was reachable only from the avatar, which meant the transparency principle
    (D13, let the captured see the ledger) was invisible to anyone who did not think to
    click their own initials. A promise nobody can find is not a promise.
  */
  {
    to: "/academy",
    label: "Academy",
    hint: "learn the desk from the record",
    Icon: AcademyIcon,
  },
  { to: "/system", label: "The system", hint: "what this is, checked live", Icon: SystemIcon },
  { to: "/my-record", label: "My record", hint: "what we hold about you", Icon: MyRecordIcon },
] as const;

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [askOpen, setAskOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeToRail, railCollapsed, () => false);

  /*
    Cmd+K opens the palette from anywhere. Bound on the window rather than on a focused
    element, because keyboard first means it works wherever the cursor happens to be, and
    a shortcut that only fires when nothing is focused is a shortcut people stop reaching
    for.
  */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if (key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAskOpen((v) => !v);
      }
      /*
        Capture on the same reflex as the palette. The desktop shell already binds a global
        hotkey for this; the web had no way in at all.
      */
      if (key === "n" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        setCaptureOpen(true);
      }
    }
    /*
      The palette asks for capture by event rather than by prop, so a command can open a
      sheet the palette does not own without the two components having to know about each
      other.
    */
    function onOpenCapture() {
      setAskOpen(false);
      setCaptureOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("continuity:open-capture", onOpenCapture);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("continuity:open-capture", onOpenCapture);
    };
  }, []);

  return (
    <div className={styles.shell}>
      <PixelBlast />
      <div className={styles.railColumn}>
        <nav className={styles.rail} aria-label="Sections" data-collapsed={collapsed}>
          <div className={styles.wordmark}>
            <PixelMark size={22} title="Continuity" />
            <span className={styles.label}>Continuity</span>
            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setRailCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand the navigation" : "Collapse the navigation"}
              title={collapsed ? "Expand the navigation" : "Collapse the navigation"}
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
                <rect x="1" y="1" width="1" height="10" />
                <rect x="8" y="5" width="3" height="1" />
                <rect x="7" y="4" width="1" height="1" />
                <rect x="7" y="6" width="1" height="1" />
                <rect x="6" y="3" width="1" height="1" />
                <rect x="6" y="7" width="1" height="1" />
              </svg>
            </button>
          </div>
          {NAV.map(({ to, label, hint, Icon }) => (
            <Link
              key={to}
              to={to}
              className={styles.navItem}
              data-active={path === to}
              aria-current={path === to ? "page" : undefined}
              /* Collapsed hides the words, so the name has to live here too. */
              aria-label={label}
              title={collapsed ? `${label}: ${hint}` : undefined}
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
          {/* Pinned to the rail footer, which is where people look for their own account. */}
          <UserMenu />
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
          <button
            className={styles.captureTrigger}
            type="button"
            onClick={() => setCaptureOpen(true)}
          >
            <span aria-hidden="true">+</span>
            <span>New record</span>
            <kbd className={styles.kbd}>Cmd N</kbd>
          </button>
          <span className={styles.spacer} />
          <LivenessStrip />
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
      <CaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  );
}
