# design.md: the Continuity design language

> White liquid glass. Apple-grade restraint, premium motion, dense information held in
> generous whitespace. Nothing MVP about it, nothing decorative either: this is a product
> for people who price risk for a living, and the interface should feel like it was built
> by them. Inherits structural discipline from the Aethereum control plane (single token
> source, one container, radius ladder, reserved alert color, readability guardrails) and
> inverts its field from premium dark to gallery white. The research dossier PDFs are the
> print voice of the same identity.

## 1. Principles (in order; when they conflict, the earlier wins)

1. The ledger is the hero. Every screen is a view over the database; chrome recedes,
   records advance. No screen exists that does not read from or write to the ledger.
2. White field, glass panes. The canvas is warm white with a single soft light source;
   surfaces are translucent white glass with hairline edges and real blur, never grey
   fills. Depth comes from blur and shadow, not borders.
   **The layering law (Apple HIG Materials, added 22 Aug 2026): glass belongs to the
   NAVIGATION layer only, never to the content layer, and glass never stacks on glass.**
   Apple, verbatim: "Don't use Liquid Glass in the content layer... including it in the
   content layer can result in unnecessary complexity and a confusing visual hierarchy."
   In Continuity that means real backdrop-filter on the left rail, the top bar, the ask
   bar, the quick-capture window, toasts, and DecisionCard, and NOWHERE else. A pane
   inside a pane is opaque. Elements sitting ON glass are styled with fills and text
   tiers, never with the material again.
   **One glass variant per interface.** There is a single `--glass` alpha and a single
   blur radius. Two near-identical translucencies read as an accident, not a system.
3. One accent doing work, one accent reserved. Ink blue is the interactive voice. Amber
   is RESERVED for knowledge-risk alerts (bus factor, orphaned decisions) and appears
   nowhere else, ever; the moment amber decorates, the risk signal dies. (This is the
   control plane's amber discipline, transplanted.)
   **Tint only the primary action (Apple HIG Color, added 22 Aug 2026):** at most ONE
   filled `--accent` button per view; secondary actions are glass or plain with an ink
   label. Apple: "Refrain from adding color to the background of multiple controls."
   This turns "one accent doing work" into a countable, greppable acceptance check.
   **Amber never carries meaning alone.** Apple: "Avoid relying solely on color to...
   communicate essential information." Every risk surface pairs amber with a shape or a
   label: the StatusChip risk variant needs a glyph, the RiskDial needs its number, the
   HeatStrip needs a legend. The departure-simulation amber RINGS already carry a shape
   cue and pass as they are.
4. Motion is meaning. Animations exist to show causality (a capture flowing into the
   ledger, a graph node being born), never to entertain. Every animation has a
   prefers-reduced-motion terminal state.
5. Keyboard first. Cmd+K does everything; the quick-capture window is enter-to-file;
   approve is a single keystroke. Pointer is the fallback, not the primary.
6. Honest surfaces. AI drafts look like drafts (dashed hairline + "drafted" chip) until
   approved. Numbers show their provenance on hover. Nothing pretends.
7. The work, never the worker. Capture is ambient and continuous, so the interface must
   never look like surveillance: no activity meters, no per-person rankings, no
   presence indicators. Risk reads at strategy level; people appear as authors and
   owners, never as scores. Any screen that would rank individuals is a design bug.

## 2. Tokens (single source: `apps/web/src/styles/tokens.css`, mirrored to desktop)

Declared once, consumed everywhere; the desktop app imports the same file. Do not copy
values into components or docs; read the tokens. Initial values, tunable only in S9's
Playwright pass:

```css
:root {
  /* FIELD: warm gallery white, lit from top-left; never flat #fff */
  --bg: #fafaf8;
  --bg-field:
    radial-gradient(ellipse 120% 80% at 18% -8%, #ffffff 0%, #fafaf8 55%, #f3f3f0 100%);

  /* GLASS SURFACES. Revised 22 Aug 2026 per the layering law in principle 2.
     ONE glass variant, one blur radius. Real backdrop-filter belongs to the navigation
     layer only: rail, top bar, ask bar, quick capture, toasts, DecisionCard. */
  --surface: rgba(255, 255, 255, 0.72);           /* THE glass. blur(20px) saturate(1.4) */
  --surface-hover: rgba(255, 255, 255, 0.82);     /* same material, hover state */
  --nav-bg: rgba(255, 255, 255, 0.72);            /* alias of --surface, kept for naming */
  --surface-recessed: #f6f6f4;                    /* pane inside a pane: OPAQUE, no blur */
  --surface-solid: #ffffff;                       /* overlays/menus: never translucent */

  /* SCROLL EDGE. Content passes under the blurred top bar, so the bar needs a soft
     legibility gradient beneath it (Apple HIG Materials, scroll edge effects). Add one
     ONLY where floating UI actually exists; they are not decorative. */
  --scroll-edge: linear-gradient(to bottom,
    rgba(250, 250, 248, 0.92) 0%, rgba(250, 250, 248, 0) 100%);
  --scroll-edge-h: 48px;

  /* HAIRLINES: ink at low alpha; 0.5px at 2x, 1px fallback */
  --border-subtle: rgba(20, 20, 25, 0.05);
  --border: rgba(20, 20, 25, 0.08);
  --border-medium: rgba(20, 20, 25, 0.12);
  --border-strong: rgba(20, 20, 25, 0.18);

  /* TEXT: near-black ink tiers. Alphas revised 22 Aug 2026 from MEASURED full-sRGB
     compositing against the WORST body surface, which is --surface-recessed, not
     --surface-hover. Old values: secondary 0.72 measured 6.87:1 (failed its own 7:1
     promise inside a recessed pane), tertiary 0.55 measured 3.91:1 (failed even AA).
     New worst-case measurements: text 16.68, secondary 7.40, tertiary 4.91. */
  --text: #16161a;
  --text-secondary: rgba(22, 22, 26, 0.74);       /* 7.40:1 worst case */
  --text-tertiary: rgba(22, 22, 26, 0.62);        /* 4.91:1 worst case, AA not AAA */
  --text-chrome: rgba(22, 22, 26, 0.32);          /* dividers/disabled, NEVER copy.
     Measures 2.04:1 and is not readable as text anywhere. Apple's quaternary-vibrancy
     rule maps to a hard ban here: --text-chrome must never appear on a glass surface. */

  /* ACCENTS */
  --accent: #0a58ca;            /* ink blue: interactive, links, primary buttons */
  --accent-verified: #1d7a46;   /* deep green: ledger-verified, anchored, live */
  --accent-risk: #b45309;       /* AMBER: knowledge-risk ONLY, reserved */
  --accent-danger: #b3261e;     /* errors, destructive */
  --draft: rgba(10, 88, 202, 0.5); /* dashed edges of unapproved drafts */

  /* SHADOWS: one soft key light, no harsh drops */
  --shadow-pane: 0 1px 2px rgba(20,20,25,0.04), 0 8px 32px rgba(20,20,25,0.06);
  --shadow-float: 0 2px 8px rgba(20,20,25,0.08), 0 24px 64px rgba(20,20,25,0.12);

  /* GEOMETRY: 4px rhythm; radius ladder 8/12/16; one container */
  --radius-s: 8px; --radius-m: 12px; --radius-l: 16px;
  --container: 1280px; --container-prose: 680px;
  --gutter: clamp(16px, 4vw, 32px);

  /* TYPE: Geist / Geist Mono (self-hosted via @fontsource-variable). Mono for hashes,
     ids, code, numerals in tables ONLY: never nav, buttons, headings, body.
     CORRECTED 22 Aug 2026: the family names the packages actually register are
     "Geist Variable" and "Geist Mono Variable". The bare names "Geist" and "Geist Mono"
     match nothing and fall silently through to the system font.
     Apple HIG Typography applies because this is a custom face: never use Thin, Light or
     Ultralight weights, and set the scale in rem so OS and browser text sizing works. */
  --font-sans: "Geist Variable", -apple-system, "Helvetica Neue", sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, monospace;

  /* MOTION: three durations, two curves */
  --dur-fast: 140ms; --dur-med: 240ms; --dur-slow: 420ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.4, 0.4, 1);
}

/* ACCESSIBILITY MEDIA QUERIES. Added 22 Aug 2026. design.md had a reduced-motion story
   and no reduced-transparency story at all, which is the larger of the two gaps: Apple
   treats reduce-transparency and increase-contrast as first-class material states.
   These live in tokens.css, not in components, so nothing has to opt in. */

@media (prefers-reduced-transparency: reduce) {
  :root {
    --surface: var(--surface-solid);
    --surface-hover: var(--surface-solid);
    --nav-bg: var(--surface-solid);
  }
  .glass { backdrop-filter: none; -webkit-backdrop-filter: none; }
}

@media (prefers-contrast: more) {
  :root {
    --border-subtle: rgba(20, 20, 25, 0.12);
    --border: rgba(20, 20, 25, 0.18);
    --border-medium: rgba(20, 20, 25, 0.24);
    --border-strong: rgba(20, 20, 25, 0.32);
    --text-secondary: rgba(22, 22, 26, 0.86);   /* measured 11.24:1 */
    --text-tertiary: rgba(22, 22, 26, 0.74);    /* measured 7.40:1 */
    --accent-risk: #8a3f07;
  }
}
```

**Writing the blur.** Emit `-webkit-backdrop-filter` FIRST, then the unprefixed property.
Unprefixed only reached Baseline in Safari 18.0 and Tauri renders in the OS WKWebView, so
a judge on Ventura or Sonoma gets no blur without the prefix. And write the radius as a
LITERAL, never `blur(var(--blur))`: a backdrop-filter that references a custom property
fails outright on macOS Sonoma under Safari 18.x (WebKit bug 297620). Ship an
`@supports not (...)` fallback to `--surface-solid`.

Readability guardrails (acceptance criteria, tested): body >= 15px, line-height >= 1.5,
measure <= 72ch, no all-caps body, no mono body, and contrast >= 7:1 for --text and
--text-secondary plus >= 4.5:1 for --text-tertiary.

**Measured against the WORST surface, not the lightest** (corrected 22 Aug 2026). The
original wording said "the lightest surface they appear on", which is the wrong worst
case for dark ink: dark text gets HARDER to read as the background darkens, so the
binding surface is the darkest one body copy ever sits on. That is `--surface-recessed`.
Measuring against `--surface-hover` is how the old `--text-secondary` came to look
compliant at 7.10:1 while actually measuring 6.87:1 where it mattered. Because the glass
is translucent over a radial gradient, the true background also varies across the
viewport, so the S9 pass samples the RENDERED pixel at the darkest corner of `--bg-field`
rather than assuming a stop.

**Concentric radii.** The 8/12/16 ladder describes OUTER radii. An inner radius is
DERIVED, not picked: inner = outer minus padding, so a 16 pane with 4px padding holds a
12 child. Apple: "using rounded shapes that are concentric to their container." This
makes the ladder a consequence of the 4px rhythm rather than a second parallel system.

## 3. Signature moments (the five animations that ARE the product)

1. Capture-to-ledger: on approve, the draft card contracts to a pill, glides down-right
   along an arc into the ledger rail, and the ledger row materializes with a 1px
   green-verified underline sweep. 420ms, ease-spring, one concurrent instance max.
2. Genealogy node birth: new decision nodes scale from 0.6 with an opacity fade;
   incoming edge draws itself (stroke-dashoffset) over 240ms. Graph settles with gentle
   force layout damping; layout is deterministic so screenshots are reproducible.
   **The blur-in was removed 22 Aug 2026.** Apple's reduced-motion guidance lists
   "avoiding animating into and out of blurs" as a best practice at ALL times, not only
   under the accessibility setting, and an animated blur is also the exact thing our own
   glass performance rule forbids. Scale plus opacity only.
   Determinism is a property of d3-force, verified at source: fixed-seed LCG, phyllotaxis
   placement keyed on array index, pure tick loop. It holds only if nodes are SORTED BY
   ID before the simulation is built, because array position IS the seed.
3. Departure simulation: selecting a member desaturates the whole graph over 240ms, then
   their decisions re-ink in amber rings radiating outward in dependency order, 40ms
   stagger. The single most important shot in the video.
4. Quick capture window (desktop): fades and scales in at 96% opacity glass over the
   entire OS, 140ms; files with a satisfying compress-and-vanish; the menu-bar icon
   pulses once, verified-green.
5. Verify sweep: the hash-chain check animates a thin scanline down the ledger; rows
   flip to a green check as recomputed hashes match; a tampered row halts the sweep and
   flares danger-red. Judges remember this one.

Reduced motion: all five collapse to opacity fades under 140ms, AND `--ease-spring`
falls back to `--ease-out`. Shortening a duration while keeping a 1.4 overshoot still
bounces, and Apple's own guidance is to tighten springs to reduce bounce, not just to
speed them up. Every one of the five reads its durations from tokens, so the collapse is
one media query, not five component edits.

## 4. Layout and navigation

- App shell: left rail (64px icons, labels on hover-expand to 220px): Ledger, Strategies,
  Risk, Debriefs, Compliance, Verify. Top bar: firm switcher, ask bar (Cmd+K), member
  avatar. Content area: single --container column, 24px pane gaps.
- The ask bar is the command palette (borrowed from the control plane's CommandPalette
  pattern): actions AND questions in one field; questions return cited answers inline.
- Density: tables set in 13px with mono numerals, 40px rows; cards never exceed three
  levels of nesting; whitespace is load-bearing, minimum 24px between panes.
- Empty states teach: each empty pane shows the capture surface that would fill it.

## 5. Component inventory (build order in masterplan S3)

GlassPane, HairlineTable, LedgerRail, LedgerRow, DecisionCard (draft/approved variants),
GenealogyGraph (SVG + d3-force), RiskDial (bus factor), HeatStrip (firm map), AskBar,
DebriefThread, PackPreview (print-styled, mirrors the PDF voice), VerifyRail, StatusChip
(verified/draft/anchored/risk), QuickCapture (desktop-only window), EmptyState, Toast.

## 6. Print/deck voice

The PDFs' language (Georgia/serif body, Helvetica caps labels, hairline tables, no em
dashes) is the print voice of the same identity; the README and pitch deck reuse it.
Screens are Geist; documents are the dossier style. Both share the ink/white/amber
discipline.

## 7. Verification protocol (S9, with Playwright MCP)

Screenshot every route at 1440x900 and 1920x1080 plus the desktop quick-capture window;
diff against this document's checklist: token compliance (no hex literals in components:
grep enforced), hairline weights, radius ladder only, amber appears exclusively on risk
surfaces, motion durations from tokens only, reduced-motion pass, empty-state pass,
keyboard-only pass (full demo arc with no pointer). Fix, re-shoot, repeat until clean;
the final screenshots become the README set.

Four checks added 22 Aug 2026:

- **Reduced-transparency pass.** Every glass surface goes opaque, nothing becomes
  unreadable, no layout shifts.
- **Increased-contrast pass.** Hairlines and text tiers step up; amber stays
  distinguishable from the danger red.
- **Layering pass.** Grep for `backdrop-filter` and confirm it appears only on the
  navigation-layer components named in principle 2. Any glass inside a content pane is a
  bug, not a taste call. No glass on glass.
- **Concentric-radius pass.** Every nested radius equals its parent minus its padding.

One tooling note that shapes how this sprint runs: **the Playwright MCP server has no
reduced-motion toggle**, so the reduced-motion, reduced-transparency and
increased-contrast passes must run from a script
(`browser.newContext({ reducedMotion: 'reduce' })` and
`page.emulateMedia({ forcedColors, reducedMotion })`), not through MCP. MCP handles the
screenshots and the accessibility snapshots; the script handles the media-query states.
