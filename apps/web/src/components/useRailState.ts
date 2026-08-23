/*
  Whether the rail is collapsed, remembered between visits.

  A navigation that resets every time you load the page is a navigation you have to
  re-collapse every morning, which is worse than not offering the choice at all. Stored in
  localStorage rather than session, because this is a preference about how somebody wants to
  work rather than a state that belongs to one visit.

  Read once at module load so getSnapshot is a stable value. A getSnapshot that touches
  localStorage on every render is a re-render loop waiting to happen, and this codebase has
  already paid for that lesson twice.
*/
const KEY = "continuity:rail-collapsed";

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let collapsed = read();

export function railCollapsed(): boolean {
  return collapsed;
}

export function setRailCollapsed(next: boolean): void {
  collapsed = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* Private window. The choice still applies for this page. */
  }
  for (const l of listeners) l();
}

export function subscribeToRail(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
