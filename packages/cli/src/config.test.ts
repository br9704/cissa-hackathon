import { describe, it, expect } from "vitest";
import { isMaterial, DEFAULT_CONFIG } from "./config";
import { hookScript, isOurs, HOOK_MARKER } from "./hook";

describe("material path rules", () => {
  it("treats a strategy file as material", () => {
    expect(isMaterial(["strategies/india_carry/filter.py"])).toBe(true);
  });

  it("treats a parameter file as material by extension", () => {
    expect(isMaterial(["config/live.yaml"])).toBe(true);
  });

  it("ignores a README", () => {
    expect(isMaterial(["README.md"])).toBe(false);
  });

  it("lets exclude beat include", () => {
    /* A parameter file inside a test directory is a fixture. Drafting a decision record
       for it is how a capture system teaches people to ignore it. */
    expect(isMaterial(["tests/fixtures/live.yaml"])).toBe(false);
    expect(isMaterial(["strategies/__tests__/thing.py"])).toBe(false);
  });

  it("is material if ANY path in the commit is", () => {
    expect(isMaterial(["README.md", "strategies/vol.py"])).toBe(true);
  });

  it("is not material for an empty commit", () => {
    expect(isMaterial([])).toBe(false);
  });

  it("ignores case, because macOS and Linux disagree about it", () => {
    expect(isMaterial(["Strategies/India/Filter.PY"])).toBe(true);
  });

  it("does not match an extension rule in the middle of a name", () => {
    /* ".yaml" is an extension rule, so a file called yaml-notes.txt is not a config. */
    expect(isMaterial(["docs/yaml-notes.txt"])).toBe(false);
  });

  it("honours a custom config over the defaults", () => {
    const config = { ...DEFAULT_CONFIG, include: ["books/"], exclude: [] };
    expect(isMaterial(["books/india.py"], config)).toBe(true);
    expect(isMaterial(["strategies/india.py"], config)).toBe(false);
  });
});

describe("the post-commit hook", () => {
  const script = hookScript("npx --no-install continuity");

  it("is a shell script that never blocks the commit", () => {
    expect(script.startsWith("#!/bin/sh")).toBe(true);
    /* post-commit runs after the commit exists. A capture tool that can fail a
       developer's workflow gets uninstalled the first time it does. */
    expect(script).toContain("exit 0");
    expect(script).toContain("|| true");
  });

  it("runs in the background so a slow network never stalls a commit", () => {
    expect(script).toContain("&)");
  });

  it("marks itself, so init can tell its own hook from somebody else's", () => {
    expect(isOurs(script)).toBe(true);
    expect(script).toContain(HOOK_MARKER);
  });

  it("does not claim a hook it did not write", () => {
    /* Overwriting an existing post-commit hook is a genuinely bad thing to do to a
       repository, and plenty of desks have one. */
    expect(isOurs("#!/bin/sh\nmake lint\n")).toBe(false);
  });
});
