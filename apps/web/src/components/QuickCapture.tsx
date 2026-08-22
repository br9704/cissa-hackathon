import { useEffect, useRef, useState } from "react";
import styles from "./QuickCapture.module.css";

/*
  Files one line of "why" against a strategy. The strategy is pre-filled from the active
  repo once the CLI is wired; until then it is the desk default.

  Enter files and closes. Escape closes without filing. There is no submit button, and
  that is the point: a capture surface with a button is a form, and people do not fill in
  forms at the moment they change a parameter.
*/
export function QuickCapture() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setValue("");
      /* The window hides itself; the shell owns visibility, not the page. */
      window.dispatchEvent(new CustomEvent("continuity:capture-dismiss"));
    }
    if (event.key === "Enter" && value.trim()) {
      window.dispatchEvent(
        new CustomEvent("continuity:capture-file", { detail: { why: value.trim() } }),
      );
      setValue("");
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.drag} data-tauri-drag-region />
      <div className={styles.row}>
        <span className={styles.mark} aria-hidden="true">
          C
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Why did you change it?"
          aria-label="Why did you change it"
          spellCheck={false}
        />
      </div>
      <div className={styles.meta}>
        <span className={styles.strategy}>India options carry</span>
        <span>Vol desk</span>
        <span className={styles.spacer} />
        <kbd className={styles.kbd}>Enter</kbd>
        <span>to file</span>
      </div>
    </div>
  );
}
