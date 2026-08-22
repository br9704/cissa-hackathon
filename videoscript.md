# videoscript.md: "The Month After" (Continuity demo film)

> Target 3:00 to 3:30. Acted, three performers plus a narrator (can double). Two
> locations: a desk setup (the "trading floor") and a plain wall for the cold open.
> Every product beat is screen-captured from the FROZEN video seed (masterplan S11);
> record 1440p, UI at 125% zoom, pointer hidden, keyboard-driven. Tone: dry, confident,
> a little cinematic; never jokey. No em dashes on any title card.

## Cast

- PRIYA, quant researcher (performer 1)
- DANIEL, senior trader, resigning (performer 2)
- MARCUS, desk head (performer 3)
- NARRATOR (voice over; performer 3 can double)

## Cold open (0:00-0:25): the problem, in their own words

BLACK. White type, one line at a time, timed to a low pulse:

  TITLE 1: "In March 2024, a strategy earning about $1B a year lost more than half
  its profits in a single month."
  TITLE 2: "The month after two traders resigned."
  TITLE 3: "That number is from the firm's own court filing."

NARRATOR (V.O.): Every quant firm has a version of this story. The code stays. The
strategy leaves. Non-competes delay it. Garden leave pays for it. Nothing keeps it.

SMASH CUT to white. The wordmark types on, letter by letter:

  TITLE: CONTINUITY. The strategy stays.

## Scene 1 (0:25-1:00): capture is invisible

INT. DESK. PRIYA typing. Over-shoulder shot, then screen capture takes over.

PRIYA (to camera, working): I changed one parameter today. Vol filter, 0.65 to 0.7.
In six months, someone will ask why. Normally the answer lives in my head.

SCREEN: she commits in the demo repo. The Continuity draft card slides in: "Raised
vol_filter to 0.7 after the Aug 12 drawdown flag; 0.68 tested and rejected, too slow
to re-enter." She edits one word, hits A. THE SIGNATURE SHOT: the card contracts and
flies into the ledger rail; the row lands with the green verified sweep; the tag
"parameter_change" appears.

PRIYA: Ten seconds. And that answer now outlives me.

NARRATOR (V.O.): Every meeting, every merge, every parameter, every debrief, drafted
by the machine, approved by the human, filed forever in an append-only ledger. Tagged
on-prem by a model we fine-tuned ourselves. Maximum context, all the time, and nothing
leaves the building. It watches the work, never the worker.

QUICK INSERT SHOT: the transcript importer: a morning standup transcript drops in,
speaker turns resolve to Priya and Marcus, and it files into the ledger as an artifact
a later decision will cite.

## Scene 2 (1:00-1:40): the resignation

INT. DESK. DANIEL places a folded letter on MARCUS's keyboard. Beat. MARCUS looks at
it, then opens Continuity.

MARCUS (calm): Okay. Show me what walks out the door.

SCREEN: Risk board. THE MONEY SHOT: departure simulation. Daniel selected; the
genealogy graph desaturates; his decisions re-ink in amber, radiating outward across
two strategies; the orphaned-decisions list fills; vacation-readiness on the India
book was already amber at 50.

MARCUS: Two strategies, fifty-three decisions only he can explain. Last month this
number was a guess. Now it is a work order.

  NUMBERS NOTE (added 22 Aug 2026). This script is a working draft and its figures
  are illustrative. The rule is the narrow one: read the numbers off the screen before
  the take and say those. Do not say a number the screen is not showing, and do not
  bend the data to fit a line that was written before there was any data.
  As of seed 20260822 the risk board reads: Daniel top holder on two strategies, both
  at bus factor 1; departure simulation orphans 53 decisions, 29 on India options
  carry and 24 on Expiry window effects; vacation readiness 50 on India options carry.
  The healthy books sit at bus factor 2, which is the contrast the scene needs.
  Re-run `pnpm --filter @continuity/core seed` and re-read if the seed changes.

## Scene 3 (1:40-2:20): the exit debrief and the handover

SCREEN: The debrief agent interviews DANIEL. On screen, a grounded question: "You
capped position size in the expiry window on May 3, two days after the India flag.
Walk me through the alternatives you rejected." DANIEL answers in one take, natural.

DANIEL (leaning back, half-smiling): It is a strange feeling. Being interviewed by
the ledger. Better than being deposed by it.

SCREEN: the answer files; one is promoted to a decision; the handover pack generates,
print-styled, SYSC-shaped. Quick cut: TOM (can be performer 1 re-dressed, or an
insert shot) types into the ask bar: "why is the expiry window capped". The recorded
answer returns, cited to Daniel's debrief, source chips visible.

NARRATOR (V.O.): The regulator's words for a proper handover are "judgement and
opinion, not just facts and figures." That is now a button.

## Scene 4 (2:20-2:50): proof

SCREEN: Verify page. The scanline sweeps the ledger; every row flips green. Then the
staged tamper: one row edited in a copy; the sweep halts, flares red on the exact row.

MARCUS (V.O. over the sweep): Every record is hash-chained and anchored to Bitcoin
through OpenTimestamps. And access is on the ledger too: who read what, and why they
said they needed it. When someone claims it was "just their experience and expertise,"
this is what our lawyers hand the court.

SCREEN: the anchor receipt, one upgraded attestation visible.

## Close (2:50-3:20): the ask

Wide shot, the three at the desk. Then white card sequence:

  CARD 1: "Courts dismiss trade-secret cases the firm cannot document. About 11
  percent die on 'reasonable measures' alone."
  CARD 2: "Continuity is the reasonable measure."
  CARD 3: the wordmark + "Built in 48 hours on research from 190+ primary sources.
  The dossier is in the repo." + demo URL.

NARRATOR (V.O.): Firms built world-class platforms for research data. Nobody built
one for research reasoning. So we did.

HARD CUT TO BLACK.

## Shot checklist (for the edit)

- [ ] Cold open title cards (3)
- [ ] Wordmark type-on card
- [ ] Priya over-shoulder + capture-to-ledger screen take (2 takes minimum)
- [ ] Resignation letter beat (no dialogue over it; let it breathe)
- [ ] Departure simulation screen take (rehearse; this is the money shot)
- [ ] Debrief Q&A take + promotion + pack generation
- [ ] Ask-bar answer with citation chips
- [ ] Verify sweep clean pass + tamper halt (two takes)
- [ ] Wide closing shot + card sequence
- [ ] All screen takes from the FROZEN seed; re-seed between takes if data mutated

## Rules

Product claims in V.O. must match masterplan D9 (honest claims): the court-filing
number is attributed ("the firm's own court filing"), the 11 percent line is cited on
the card (dossier codes T1, L1, L2, I17), and no invented metrics appear anywhere.
If the tagger fallback shipped instead of the trained model, change the Scene 1 line
to "tagged by a small model running on our own machine" and drop "we fine-tuned".
