/*
  Bare single letter shortcuts, and the one rule that makes them safe.

  The draft card binds a, e and r on the window so a reviewer can clear a queue without
  reaching for the mouse. That is the right interaction and it was also the single worst
  bug in the build: the listener had no idea where you were typing. Typing "hello" anywhere
  on the page triggered Edit and put "llo" inside the draft, and typing a question into the
  ask palette leaked half the sentence into a record. The whole "you cannot input anything,
  it does chaos" complaint traces to exactly this.

  So a bare letter is only ever allowed when all four of these hold. Any new global letter
  shortcut goes through this function rather than re-deriving the rule.
*/

const TYPING_SELECTOR = "input, textarea, select, [contenteditable]:not([contenteditable=false])";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest(TYPING_SELECTOR) !== null;
}

/*
  Any open dialog swallows bare letters, checked by querying the document rather than by
  threading an `open` prop through every component that might want a shortcut. A palette
  that has to remember to tell six listeners it exists will eventually forget, and the
  failure mode is silent corruption of someone's record.
*/
export function overlayOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

export function bareKeyAllowed(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) return false;
  /* A modifier means the chord belongs to someone else, usually the browser or Cmd+K. */
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  /* IME composition sends keydown for every keystroke of a candidate. */
  if (e.isComposing) return false;
  /*
    Auto-repeat. The card's own comment says "only the focused card takes keystrokes, or A
    would approve the whole queue at once", and holding the key defeated that: the OS sends
    about thirty keydowns a second, the queue re-renders a fresh draft after each approval,
    and a held key walks the whole backlog. Approving is irreversible in this product's own
    words, so a leaned-on keyboard must not file records nobody read.
  */
  if (e.repeat) return false;
  if (isTypingTarget(e.target)) return false;
  if (overlayOpen()) return false;
  return true;
}
