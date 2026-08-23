/*
  @vitest-environment jsdom

  The regression this file exists for: typing "hello" anywhere on the page used to trigger
  the draft card's Edit shortcut and put "llo" inside the record. These assertions are the
  cheap version of that whole class of bug.
*/
import { describe, it, expect, afterEach } from "vitest";
import { bareKeyAllowed, isTypingTarget, overlayOpen } from "./hotkeys";

function keyEvent(key: string, target: EventTarget, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, "target", { value: target, configurable: true });
  return e;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isTypingTarget", () => {
  it("is true for an input, a textarea and a contenteditable", () => {
    for (const html of [
      "<input />",
      "<textarea></textarea>",
      "<select></select>",
      "<div contenteditable='true'><span id='inner'>x</span></div>",
    ]) {
      document.body.innerHTML = html;
      const el = document.querySelector("#inner") ?? document.body.firstElementChild!;
      expect(isTypingTarget(el), html).toBe(true);
    }
  });

  it("is false for ordinary content, including contenteditable=false", () => {
    document.body.innerHTML = "<div contenteditable='false'><p id='p'>text</p></div>";
    expect(isTypingTarget(document.querySelector("#p"))).toBe(false);
  });
});

describe("overlayOpen", () => {
  it("sees a dialog anywhere in the document", () => {
    expect(overlayOpen()).toBe(false);
    document.body.innerHTML = "<div role='dialog'></div>";
    expect(overlayOpen()).toBe(true);
  });
});

describe("bareKeyAllowed", () => {
  it("allows a bare letter on ordinary content", () => {
    document.body.innerHTML = "<p id='p'>text</p>";
    expect(bareKeyAllowed(keyEvent("a", document.querySelector("#p")!))).toBe(true);
  });

  it("refuses while the caret is in a field", () => {
    document.body.innerHTML = "<textarea id='t'></textarea>";
    expect(bareKeyAllowed(keyEvent("a", document.querySelector("#t")!))).toBe(false);
  });

  it("refuses while any dialog is open, even with focus on the page", () => {
    document.body.innerHTML = "<div role='dialog'></div><p id='p'>text</p>";
    expect(bareKeyAllowed(keyEvent("a", document.querySelector("#p")!))).toBe(false);
  });

  it("refuses a chord, so Cmd+K never reads as a bare k", () => {
    document.body.innerHTML = "<p id='p'>text</p>";
    const p = document.querySelector("#p")!;
    expect(bareKeyAllowed(keyEvent("k", p, { metaKey: true }))).toBe(false);
    expect(bareKeyAllowed(keyEvent("k", p, { ctrlKey: true }))).toBe(false);
    expect(bareKeyAllowed(keyEvent("k", p, { altKey: true }))).toBe(false);
  });

  it("refuses an event something else already handled", () => {
    document.body.innerHTML = "<p id='p'>text</p>";
    const e = keyEvent("a", document.querySelector("#p")!);
    e.preventDefault();
    expect(bareKeyAllowed(e)).toBe(false);
  });
});
