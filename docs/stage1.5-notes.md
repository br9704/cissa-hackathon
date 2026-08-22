# docs/stage1.5-notes.md: engineer session notes (Stage 1.5, 22 Aug 2026)

> Orientation, verification, and expansion session run per `ENGINEERPROMPT.md`.
> No product code written. Everything load-bearing was re-verified against live
> registries and current vendor docs; findings folded into `masterplan.md`
> (Verified facts + per-sprint expansions) and `docs/scoping.md` corrections.

## Five-sentence summary (Phase 1.4)

Continuity is a decision ledger for quant trading desks: an append-only, hash-chained
Postgres schema that captures the reasoning behind strategy research at the moment it
happens, through a git hook, a desktop hotkey, an LLM debrief agent, and meeting
transcripts, so the "why" behind a live strategy stops living in one person's head.
It wins because the problem is documented at the highest level of the industry, in a
federal court filing where a roughly $1B/year strategy lost more than half its profits
the month after two traders left, and because every existing defence (non-competes,
garden leave, litigation) only operates after the knowledge has already concentrated.
It wins a second time on the regulators' own words: FCA SYSC 25.9 asks for handover
material containing "judgement and opinion, not just facts and figures," RTS 6 Art.
5(7) demands a who/what/when/approved-by record of every material algo change, and
SR 11-7 wants documentation legible to a stranger, so the generated handover pack and
compliance extract are not features we invented but a spec someone else already wrote.
It wins a third time on proof: the ledger is hash-chained, anchored through
OpenTimestamps, and verifiable in the browser on stage, which converts a soft
knowledge-management pitch into an evidentiary one that a lawyer can use.
And it wins on execution surface: one React frontend in two shells (a Tauri desktop app
for the premium acted video and a deployed authed web demo), with the decision tagger
running on a small model fine-tuned on this machine, so the "nothing leaves the
building" claim is demonstrated rather than asserted.

## Phase 1 verification log

See `masterplan.md` > Verified facts. Every line there carries a one-line evidence
citation and a date. Corrections that changed a locked pin are also recorded in
`masterplan.md` > AMENDMENTS.

## Method note

Version claims were checked mechanically against the npm registry, crates.io, the
Hugging Face model API, and PyPI rather than trusted from the Stage 1 pack, because
the pack's pins were written the same day and a same-day pin is still a pin that can
be wrong about a package NAME. One such error was found and corrected.
