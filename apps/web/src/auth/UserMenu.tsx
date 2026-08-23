import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import styles from "./UserMenu.module.css";
import { authState, subscribeToAuth, signOut } from "./session";
import { viewerId, subscribeToViewer, viewerRole, ROLE_LABEL } from "../desk/viewer";
import { corpus } from "../data/source";

/*
  Who is signed in, and the way out.

  Pinned to the rail footer rather than floating in the top bar, because that is where a
  person looks for their own account and because the top bar is already carrying the capture
  button, the search and the liveness strip.

  It shows two different things deliberately: the ACCOUNT, which is a real Supabase session,
  and the desk member being VIEWED AS, which is a local choice. Collapsing them into one
  identity would imply the account is that person, and it is not.
*/
export function UserMenu() {
  const auth = useSyncExternalStore(subscribeToAuth, authState, () => authState());
  useSyncExternalStore(subscribeToViewer, viewerId, () => null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  /*
    The popover is positioned in VIEWPORT space, not inside the rail.

    The rail has overflow hidden, which it needs for the collapse animation to clip the
    labels rather than reflow them. Anything absolutely positioned inside it is therefore
    cut off, and this menu opens upward from the very bottom of that column, so it was
    clipped completely. Measuring the trigger and rendering fixed is the fix that does not
    require giving up the collapse animation.
  */
  const [anchor, setAnchor] = useState<{ left: number; bottom: number; width: number } | null>(
    null,
  );

  const member = corpus().members.find((m) => m.id === viewerId());
  const role = viewerRole();

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    function place() {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 6,
        /* Never narrower than the trigger, never wider than the viewport allows. */
        width: Math.max(rect.width, 240),
      });
    }
    place();
    window.addEventListener("resize", place);
    /* A scroll moves the trigger out from under a fixed popover, so close rather than
       leaving a menu floating beside nothing. */
    window.addEventListener("scroll", () => setOpen(false), { once: true, capture: true });
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const email = auth.kind === "signed_in" ? auth.user.email ?? "signed in" : null;
  const initial = (member?.displayName ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className={styles.wrap} ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
      >
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <span className={styles.who}>
          <span className={styles.name}>{member?.displayName ?? "Somebody new"}</span>
          <span className={styles.role}>{ROLE_LABEL[role]}</span>
        </span>
      </button>

      {open && anchor ? (
        <div
          className={styles.pop}
          role="menu"
          style={{ left: anchor.left, bottom: anchor.bottom, width: anchor.width }}
        >
          {email ? <span className={styles.email}>{email}</span> : null}
          <span className={styles.note}>
            {member
              ? `Viewing the desk as ${member.displayName}. That is a local choice, not who your account is.`
              : "No desk member selected, so you see what somebody new would see."}
          </span>
          <Link to="/desk" className={styles.row} role="menuitem" onClick={() => setOpen(false)}>
            Change who you are viewing as
          </Link>
          <Link to="/my-record" className={styles.row} role="menuitem" onClick={() => setOpen(false)}>
            What this system holds about you
          </Link>
          {auth.kind === "signed_in" ? (
            <button
              type="button"
              className={styles.row}
              role="menuitem"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          ) : (
            <span className={styles.note}>
              No account is configured, so there is nothing to sign out of.
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
