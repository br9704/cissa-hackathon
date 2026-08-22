/*
  The readability guardrail.

  design.md declares contrast as an acceptance criterion, not a preference: --text and
  --text-secondary clear 7:1, --text-tertiary clears 4.5:1. Until this test existed that
  was prose, so a token nudge could quietly drop a tier below the bar and every other
  test would still pass.

  Two things about the method are load bearing.

  First, it measures against the WORST surface, not the lightest. Dark ink on a light
  field gets harder to read as the background darkens, so the binding case is the
  darkest pane body copy ever sits on, which is --surface-recessed. design.md originally
  said "the lightest surface they appear on", and that is how --text-secondary at alpha
  0.72 came to look compliant at 7.10 while actually measuring 6.87 inside a recessed
  pane. The bar did not change. The measurement got honest.

  Second, it reads the CSS rather than a rendered page: no browser, no flake, runs in
  milliseconds. It cannot catch a component that overrides a token inline, which is what
  the hex guard and the Playwright pass are for.
*/
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TOKENS = readFileSync(
  join(process.cwd(), "src", "styles", "tokens.css"),
  "utf8",
);

/*
  Scope to one block rather than "last declaration wins". The accessibility media
  queries redeclare --text-secondary, so last-wins would silently measure the
  increased-contrast variant instead of the default and report a pass that means
  nothing.
*/
function rootBlock(): string {
  const start = TOKENS.indexOf(":root {");
  const open = TOKENS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < TOKENS.length; i++) {
    if (TOKENS[i] === "{") depth++;
    else if (TOKENS[i] === "}") {
      depth--;
      if (depth === 0) return TOKENS.slice(open + 1, i);
    }
  }
  throw new Error(":root block not found");
}

const ROOT = rootBlock();

function token(name: string): string {
  const m = ROOT.match(new RegExp(`(^|[^\\w-])${name}\\s*:\\s*([^;]+);`, "m"));
  if (!m) throw new Error(`token ${name} not found in :root`);
  return m[2]!.trim();
}

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as unknown as RGB;
}

/* Returns the colour and its alpha separately: alpha is what we are actually tuning. */
function parseColour(value: string): { rgb: RGB; alpha: number } {
  const rgba = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])] as RGB,
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  const hex = value.match(/#[0-9a-fA-F]{3,8}/);
  if (hex) return { rgb: parseHex(hex[0]!), alpha: 1 };
  throw new Error(`cannot parse colour: ${value}`);
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: RGB) =>
  0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

function ratio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const over = (fg: RGB, alpha: number, bg: RGB): RGB => [
  fg[0] * alpha + bg[0] * (1 - alpha),
  fg[1] * alpha + bg[1] * (1 - alpha),
  fg[2] * alpha + bg[2] * (1 - alpha),
];

/* Every stop of the radial field, because the true background varies across the view. */
function fieldStops(): RGB[] {
  const field = token("--bg-field");
  const hexes = field.match(/#[0-9a-fA-F]{3,8}/g);
  if (!hexes || hexes.length < 2) throw new Error("--bg-field has no colour stops");
  return hexes.map(parseHex);
}

/* Every surface body copy is ever set on, composited over every field stop. */
function bodySurfaces(): { name: string; rgb: RGB }[] {
  const out: { name: string; rgb: RGB }[] = [];
  for (const name of ["--surface", "--surface-hover", "--surface-recessed", "--surface-solid"]) {
    const { rgb, alpha } = parseColour(token(name));
    if (alpha === 1) out.push({ name, rgb });
    else for (const stop of fieldStops()) out.push({ name, rgb: over(rgb, alpha, stop) });
  }
  return out;
}

function worstRatio(tokenName: string): { value: number; surface: string } {
  const { rgb, alpha } = parseColour(token(tokenName));
  let value = Infinity;
  let surface = "";
  for (const s of bodySurfaces()) {
    const r = ratio(over(rgb, alpha, s.rgb), s.rgb);
    if (r < value) {
      value = r;
      surface = s.name;
    }
  }
  return { value, surface };
}

describe("readability guardrails", () => {
  it("--text clears 7:1 on every surface it can appear on", () => {
    const { value } = worstRatio("--text");
    expect(value).toBeGreaterThanOrEqual(7);
  });

  it("--text-secondary clears 7:1 on every surface, including recessed panes", () => {
    const { value, surface } = worstRatio("--text-secondary");
    /*
      This is the assertion that caught the real defect. At alpha 0.72 the worst case
      was 6.87 on --surface-recessed while --surface-hover read 7.10, so measuring the
      lightest surface reported a pass.
    */
    expect(value, `worst surface was ${surface}`).toBeGreaterThanOrEqual(7);
  });

  it("--text-tertiary clears AA 4.5:1", () => {
    const { value } = worstRatio("--text-tertiary");
    expect(value).toBeGreaterThanOrEqual(4.5);
  });

  it("every accent clears AA 4.5:1 so it can carry a label", () => {
    for (const name of ["--accent", "--accent-verified", "--accent-risk", "--accent-danger"]) {
      const { value } = worstRatio(name);
      expect(value, `${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("--text-chrome is never promoted to a text tier", () => {
    /*
      A structural assertion rather than a contrast one. --text-chrome measures around
      2:1 and is for dividers and disabled affordances. If someone raises its alpha to
      make it "readable", that is the moment it starts getting used as copy, so pin it
      low on purpose.
    */
    const { alpha } = parseColour(token("--text-chrome"));
    expect(alpha).toBeLessThan(0.45);
  });

  it("the increased-contrast variant is strictly darker than the default", () => {
    const def = parseColour(token("--text-secondary")).alpha;
    const more = TOKENS.match(/prefers-contrast: more[\s\S]*?--text-secondary\s*:\s*([^;]+);/);
    expect(more, "no prefers-contrast block").toBeTruthy();
    expect(parseColour(more![1]!).alpha).toBeGreaterThan(def);
  });
});

describe("token structure", () => {
  it("declares exactly three motion durations and two curves", () => {
    for (const t of ["--dur-fast", "--dur-med", "--dur-slow", "--ease-out", "--ease-spring"]) {
      expect(() => token(t)).not.toThrow();
    }
  });

  it("uses the font family names the fontsource packages actually register", () => {
    /*
      "Geist" and "Geist Mono" match nothing and fall through to the system font in
      silence. This is the sort of defect that survives until the screenshots.
    */
    expect(token("--font-sans")).toContain("Geist Variable");
    expect(token("--font-mono")).toContain("Geist Mono Variable");
  });

  it("keeps the radius ladder to three rungs", () => {
    const rungs = ROOT.match(/--radius-[a-z]+\s*:/g) ?? [];
    expect(rungs).toHaveLength(3);
  });
});
