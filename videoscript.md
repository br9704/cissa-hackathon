# videoscript.md: "The Month After" (Continuity demo film, v2: magic first)

> Target 3:00 to 3:30. Acted, three performers plus a narrator (can double). Structure
> per prd §6: the impossible act first, mechanism second, proof third, stakes last.
> Every product beat is screen-captured from the FROZEN video seed (masterplan S11);
> 1440p, UI at 125% zoom, pointer hidden, keyboard-driven. Tone: dry, confident,
> cinematic; never jokey. No em dashes on any title card.

## Cast

- TOM, new graduate (performer 1, doubles as Priya with re-dress or insert shots)
- PRIYA, quant researcher (performer 1)
- DANIEL, senior trader, already gone (voice/photo only; performer 2 for the flashback)
- MARCUS, desk head (performer 3)
- NARRATOR (V.O.; performer 3 can double)

## Cold open (0:00-0:30): the impossible act

INT. DESK, EARLY MORNING. TOM alone, stuck, staring at a parameter he does not
understand. He opens the ask bar and types, hunt-and-peck, slightly desperate:

  "why is the expiry window capped?"

SCREEN: the answer types itself out, first person, precise, a little dry, exactly how
a senior trader explains things. Citation chips accumulate under each sentence. Tom
relaxes, then frowns at the banner above the answer. PUSH IN on it:

  RECONSTRUCTED FROM DANIEL'S LEDGER. HE LEFT IN MARCH.

Beat of silence.

NARRATOR (V.O.): The person who knew is gone. The firm still answers.

SMASH TO WHITE. Wordmark types on: CONTINUITY. The strategy stays.

## Scene 1 (0:30-1:00): the time machine

SCREEN TAKE. The strategy page. MARCUS drags the timeline scrubber from two years ago
toward today: the genealogy graph assembles itself decision by decision, meetings and
debriefs streaming in beneath, the strategy visibly learning. He scrubs past February;
Daniel's contributions ink amber, radiating outward.

MARCUS (V.O.): Every firm says its strategies are institutional. Scrub the timeline
and you find out whose head they actually lived in.

## Scene 2 (1:00-1:35): the departure bomb

QUICK FLASHBACK INSERT (2 seconds): February. A folded letter placed on a keyboard.

BACK TO SCREEN: Risk board. MARCUS, calm, deliberate: "Show me Priya." He clicks
SIMULATE DEPARTURE. The graph desaturates; amber cascades; the orphaned-decisions
list fills; and the number counts up and lands:

  $412M OF ATTRIBUTED REVENUE. NO SECOND OWNER. (synthetic data, labelled on screen)

MARCUS: Last quarter this was a feeling. Now it is a number, and numbers get budgets.

## Scene 3 (1:35-2:15): the mechanism (now you want to know how)

INT. DESK. PRIYA working, normal speed.

PRIYA (to camera): I changed one parameter this morning. Watch what the firm does.

SCREEN: she commits; the machine-drafted decision record slides in ("raised vol_filter
to 0.7 after the Aug 12 drawdown flag; 0.68 tested and rejected"); she edits one word,
hits A; THE SIGNATURE SHOT: the card contracts and flies into the ledger rail, lands
with the green verified sweep, and the on-prem tag "parameter_change" stamps on.

QUICK INSERT: the transcript importer: the morning standup drops in, speaker turns
resolving to names, filed as an artifact.

NARRATOR (V.O.): Every meeting, every merge, every parameter, every debrief. Drafted
by the machine, approved by the human, filed forever in an append-only ledger, tagged
on-prem by a model we fine-tuned ourselves. Maximum context, all the time. It watches
the work, never the worker. That is why the firm remembers.

## Scene 4 (2:15-2:45): the proof

SCREEN: Verify page. The scanline sweeps; rows flip green; the staged tamper halts it,
flaring red on the exact row. Then the access ledger and the anchor receipt.

MARCUS (V.O.): Hash-chained, anchored to Bitcoin, and access is on the ledger too:
who read what, and why they said they needed it. When someone claims a strategy was
just their experience and expertise, this is what our lawyers hand the court.

## Close (2:45-3:20): the stakes

Wide shot, the team at the desk. Then white cards, timed to a low pulse:

  CARD 1: "In March 2024, a strategy earning about $1B a year lost more than half its
  profits in a single month. The month after two traders resigned."
  CARD 2: "That number is from the firm's own court filing."
  CARD 3: "Courts dismiss trade-secret cases the firm cannot document. Continuity is
  the reasonable measure."
  CARD 4: wordmark + "Built in 48 hours on research from 190+ primary sources. The
  dossier is in the repo." + demo URL.

NARRATOR (V.O.): Firms built world-class platforms for research data. Nobody built one
for research reasoning. So we did.

HARD CUT TO BLACK.

## Shot checklist (for the edit)

- [ ] Cold open: Tom acting take + ask-bar screen take with the banner push-in
- [ ] Wordmark type-on card
- [ ] Time Machine scrub (rehearse the drag speed; one continuous take)
- [ ] February letter flashback insert (2 seconds, no dialogue)
- [ ] Departure bomb take: click, cascade, counting number (two takes minimum)
- [ ] Priya over-shoulder + capture-to-ledger signature shot (two takes minimum)
- [ ] Transcript importer insert
- [ ] Verify sweep clean pass + tamper halt (two takes)
- [ ] Access ledger + anchor receipt insert
- [ ] Wide closing shot + card sequence
- [ ] All screen takes from the FROZEN seed; re-seed between takes if data mutated

## Rules

Honest-claims (D9) applies to every beat: the persona answer renders its
reconstruction banner at all times and every sentence stays cited; the $412M figure is
labelled synthetic on screen and never spoken as if real; the court-filing number is
attributed ("the firm's own court filing"); the 11 percent line stays on its card with
dossier codes (T1, L1, L2). If the tagger fallback shipped, Scene 3's line becomes
"tagged by a small model running on our own machine" and "we fine-tuned ourselves" is
dropped.
