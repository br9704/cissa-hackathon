# docs/critique.md: full app review, 22 Aug 2026 (evening)

> Method: the built web app (apps/web/dist) was run in a clean browser at 1440x900 and
> driven end to end: every route, keyboard approve, the ask palette, departure
> simulation, the time machine, verify and the tamper demo. Screenshots referenced are
> in docs/shots/review/. Findings are ordered as a fix list: P0 = broken, fix before
> anything else; P1 = the product hides what it does; P2 = design polish to spec.
> File pointers included so the fixes are mechanical. This is the single document for
> the review: verdict, findings, fixes, and the re-test checklist.

## The verdict in plain language

The owner's complaints were "the UI looks like shit, it doesn't do anything, you
can't understand what it's doing, you can't input anything." After driving the whole
app, the verdict is: better and worse than that, and every complaint traces to a
specific, fixable cause.

"You can't input anything, it does chaos" is one P0 bug: the draft card listens for
the a/e/r keys on the whole window with no check of where you are typing. Typing
"hello" anywhere triggered Edit and typed "llo" INTO the draft, corrupting it; typing
a question into the ask palette leaked half the sentence into a draft. One guard
clause fixes the entire feeling (P0.1). A second P0: when the in-browser search model
cannot download, the ask palette dies with "Failed to fetch" even though a fully
local keyword index exists in the code and could answer (P0.2). On hackathon wifi
that is a dead hero feature.

"It doesn't do anything" is discoverability, not absence. The recorder, transcript
importer and tagger are buried below 184 ledger rows; quick capture exists only as
the desktop window's hidden route; My Record is not in the nav; graph nodes are
unlabeled dots; nothing on screen signals the system is alive. The product does a
lot; it performs none of it. That is the whole P1 section.

"The UI looks like shit" is really "the UI is flat." It is clean, consistent and
well written, but the glass tokens exist in the stylesheet and are not applied: no
gradient field, no blur, no depth, and the signature animations are absent or
invisible. That is the P2 section, and it is the difference between a clean document
site and the product design.md specifies.

What is already excellent and must not be broken: the departure simulation with the
$362M exposure card, the live tamper catch on Verify, the debriefs page, and the
handover pack. The bones are strong. Do P0 first, then P1, then the glass; it is
hours of work, not days, and the checklist at the end proves each fix landed.

## First, what is genuinely good (do not break these)

The knowledge-risk page with the departure simulation and the $362M exposure card
(with its honest synthetic-figures footnote) is excellent. Verify with the live
"Chain broken at event 8" tamper catch is excellent. The debriefs page ("Ask someone
who has left", grounded sessions, promote-to-decision) is exactly the product. The
reports page with the SYSC-shaped handover pack and the export-checkpoint copy is
strong. The time machine exists and its replay explainer is perfect. The writing
voice across the app is the best thing about it. The bones are genuinely good; the
problems below are real but they are fixable in hours, not days.

## P0: bugs that make the app feel broken (fix first)

1. GLOBAL SINGLE-LETTER HOTKEYS FIRE WHILE TYPING. `DecisionCard.tsx` (~line 46-71)
   listens on `window` for a/e/r whenever the card is active, with no check of the
   event target and no awareness that the ask palette is open. Consequences observed:
   typing "hello" anywhere triggered Edit on the draft and typed "llo" into it,
   corrupting the draft; typing a question into the ask palette leaked "expiry window
   capped" into the draft's textarea mid-sentence. THIS single bug produces the whole
   "you cannot input anything, it does chaos" feeling. Fix (mechanical): at the top of
   `onKey`, return early when `e.defaultPrevented`, when
   `(e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')`
   is non-null, or when the ask palette is open (lift `open` into shared state or set
   a `data-palette-open` attribute on document root and check it). Apply the same
   guard to every other global key listener (AppShell cmd+k is fine; audit any others).
2. ASK SEARCH DIES INSTEAD OF DEGRADING. When the in-browser embedding model cannot
   load (offline, blocked CDN, hackathon wifi), the palette renders "Search is
   unavailable: Failed to fetch" and the feature is dead, even though a fully local
   BM25 lexical index (`search/lexical.ts`) is already built. Fix: catch the model
   load failure in `search/index.ts` / `recall.ts` and fall back to lexical-only
   scoring with a small notice ("meaning-search model unavailable, using keyword
   match"). The demo must never depend on huggingface.co being reachable. Also
   pre-warm the model on app load, not on first question, and show a loading state
   with progress in the palette ("downloading the search model, ~30 MB, first run
   only") instead of a bare spinner.
3. ASK PALETTE INPUT RACE. Fast typing right after Cmd+K splits characters between
   the palette and the page (observed: "why is th" in the palette, the rest in a
   draft). Autofocus the input synchronously on dialog mount and, until it is
   focused, swallow keydowns at the dialog level. This is likely fixed by P0.1's
   guard plus `autoFocus` + a mount-time `requestAnimationFrame` focus; verify by
   typing immediately after Cmd+K.

## P1: the product hides what it does (Bruno's core complaint, and he is right)

4. THE CAPTURE INPUTS ARE BURIED BELOW 184 LEDGER ROWS. Recorder, TranscriptImporter
   and TaggerBadge sit at the bottom of the record page under "How records get here"
   (`LedgerPage.tsx` ~line 150+). Nobody scrolls past 184 entries to discover the
   product's inputs. Fix: add a persistent "+ New record" affordance in the record
   page header (or the top bar) opening a compact capture sheet with three tabs:
   Note (the QuickCapture form), Record a meeting (Recorder), Import transcript
   (TranscriptImporter). Keep the bottom section too, but the input must be visible
   without scrolling on every visit.
5. QUICK CAPTURE IS UNREACHABLE ON THE WEB. It exists only as the `/quick-capture`
   route for the Tauri window (`router.tsx` line 48). Web users never see it. Fix:
   the "+ New record" sheet above IS quick capture on the web; also add "New record"
   as an action in the Cmd+K palette.
6. MY RECORD IS NOT IN THE NAV. The page exists (`MyRecordPage.tsx`, route `/me`) but
   the rail lists only six sections, so the transparency feature (D13, "let the
   captured see the ledger") is invisible. Fix: add it to the rail ("My record: what
   this system holds about you") or hang it off the avatar; either way it must be
   reachable.
7. NOTHING SAYS THE SYSTEM IS ALIVE. The record page reads as a static list; the only
   status is a quiet "Reading the local record" label. The pitch is ambient 24/7
   capture, so show a heartbeat: a small live strip in the header ("last capture 2h
   ago from a commit by Daniel · tagger: local model, 184/184 tagged · chain verified
   14:02") and, in demo mode, a staged incoming capture every couple of minutes so
   the ledger visibly breathes. The demo-mode stager must be clearly labelled demo.
8. GRAPH NODES SAY NOTHING. The genealogy graph renders unlabeled 8px circles;
   "Select a node to read the decision behind it" is below the fold and hover shows
   nothing. Judges will see abstract dots. Fix: hover tooltip (title + author + date),
   click opens the decision (verify the click handler works; the card-to-graph
   selection state was not obviously discoverable in testing), label the 5-8 most
   important nodes (highest degree or risk-flagged) with short text, and color nodes
   by decision_type per design.md (all nodes are currently white; the type legend
   only distinguishes risk rings).
9. THE STRATEGY CARDS DO NOT OBVIOUSLY DRIVE THE GRAPH. Clicking a strategy card
   looks inert (no link semantics; automation could not click it as a control). If
   cards select the graph below, add selected-state styling and make them real
   buttons; if not, make them so.
10. THE TIME MACHINE IS BELOW THE GRAPH AND EASY TO MISS. It is a D14 hero; move the
    scrubber directly under the strategy header (above the graph), enlarge the play
    control, and autoplay a slow replay the first time a strategy page opens in demo
    mode (respecting reduced motion).

## P2: design polish to spec (design.md is not yet on screen)

11. THE GLASS IS MISSING. Surfaces are flat white cards on flat off-white; there is
    no gradient field, no translucency, no blur, and almost no shadow depth
    (design.md §2 tokens exist in `styles/tokens.css`; the panes do not use the
    backdrop treatment). Fix: paint `--bg-field` on the app root, give panes the
    glass surface + `--shadow-pane`, and reserve `--shadow-float` for the palette
    and capture sheet. Two blurred layers max per view (scoping §C8 performance
    rules). This single change moves the look from "clean document site" to the
    intended product.
12. MOTION IS ABSENT OR INVISIBLE. Approve did not read as the signature
    capture-to-ledger flight; nothing else visibly moves. Implement the three
    that matter and skip the rest: capture-to-ledger flight on approve
    (design.md §3.1, `layoutId` shared between DecisionCard and LedgerRow), verify
    scanline sweep (§3.5; the current instant result is correct but unphotogenic:
    sweep rows top to bottom over ~1.5s before settling), and departure-sim amber
    radiation with the counting-up dollar figure (the number currently appears
    instantly; count it up over ~800ms). All behind `useReducedMotion`.
13. TEXT DENSITY. Every page opens with a three-line paragraph and every section has
    another; the voice is excellent but at this density it competes with the data.
    Keep the page lead, cut section leads to one line, and move the longer
    explanations behind an unobtrusive "why this exists" disclosure per section.
14. LAYOUT BALANCE AT 1440. The risk dials cluster left with a dead right half; the
    reports document renders in a narrow left column with empty space beside it.
    Center the document column; let the dials row span with even spacing.
15. IDENTITY. The avatar reads "MB" (the firm), so there is no sense of who is signed
    in, which also undercuts My Record. Show the acting persona (demo: Marcus) with a
    persona switcher in demo mode; the top-right corner should answer "who am I here".
16. HEADER SEARCH FIELD VS PALETTE. The top-bar "Ask the ledger" input and the Cmd+K
    dialog are two entries to one feature; clicking the field should open the palette
    prefilled (verify it does) and the field itself should never accept focus-typing
    of its own, or P0.3 recurs from a second door.

## Verification checklist after fixes (repeat the drive)

- Type a paragraph anywhere with a draft on screen: nothing mutates.
- Cmd+K then immediately type 30 chars fast: all 30 land in the palette.
- Kill the network, ask a question: lexical answer with notice, no dead end.
- A stranger, given the app cold, files a note, records/imports something, and finds
  what the system holds about them, all without scrolling instructions.
- Approve visibly flies; verify visibly sweeps; the departure number counts up.
- Strategy card click changes the graph; node hover names the decision; time machine
  sits above the graph and plays.

Log fixes against this list in masterplan (a polish subsprint under S9), statuses and
times per the logging protocol.
