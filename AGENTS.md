# AGENTS.md — Continuity (cissa-hackathon)

Read this file at the start of every session. It is the constitution for this repo.
`masterplan.md` is the execution ledger and the single source of truth for sequencing.

## What this is

Continuity: a strategy-continuity intelligence layer for quant trading firms. An
append-only, hash-chained decision ledger with ambient capture (git hook, desktop quick
capture, LLM debrief agent), knowledge-risk analytics (bus factor, vacation-readiness,
departure simulation), generated handover packs and compliance artifacts, and an on-prem
distilled tagging model. One React frontend, two shells: Tauri desktop + Vercel web demo
on Supabase. Built for the CISSA hackathon (Fundamentum track) to impress both judges
and quant-firm people. Full scope: `prd.md`. Design law: `design.md`. Evidence:
`docs/Continuity_Scope_Dossier.pdf`.

## Source of truth: read in this order

1. `masterplan.md`: sprints, budgets, acceptance, current-sprint pointer. Work ONLY the
   active sprint.
2. `prd.md`: what the product is. `design.md`: what it looks and moves like.
3. This file: rules. `engineerprompt.md`: the stage-1 onboarding prompt.

Precedence when they disagree: masterplan (sequencing) > this file (rules) > prd/design
(scope) > anything else. Material scope changes go in masterplan AMENDMENTS, append-only.

## Masterplan discipline (the contract)

- At session start: open `masterplan.md`, find the Current-sprint pointer, work only that
  sprint. Mark tasks live: `[ ]` `[~]` `[x]` `[⏭]` (deferred needs a one-line reason).
- Never delete or rewrite masterplan content; expand in place.
- A sprint is not done until its Acceptance block passes. Never skip, never partially
  complete and move on silently.
- **Sprint logging rule (non-negotiable): at the close of EVERY sprint and subsprint,
  append to that sprint's "Sprint log:" line the completion record:**
  `Logged: <ISO-8601 local datetime> · status: done | partial | blocked · actual: <X>h
  (budget <Y>h) · by: <model/human> · note: <one line>`.
  Log at the moment of completion, never backfilled. `partial`/`blocked` must name the
  blocker and file any human action into MANUAL TASKS.
- **Manual-task rule: anything requiring a human (accounts, keys, purchases, filming,
  approvals) is appended to the MANUAL TASKS section at the END of masterplan.md and is
  never attempted by an agent.** Adding an item there is a deliverable; silently
  skipping the need is a violation.
- When unsure, the answer is in masterplan/prd/design. If it truly is not, append to
  masterplan OPEN QUESTIONS and take the documented fallback. Do not invent scope.
- When finishing a sprint, please make sure u commit that sprint.

## Two-stage model plan

Stage 1 (done) used the best models for research and this pack. Stage 2 (the build) runs
on a cheaper model. Consequence: follow the plan mechanically; verify before believing;
prefer the pre-agreed fallback over cleverness; keep diffs small and run the acceptance
checks after every task. The plan was written so you do not have to be brilliant, only
disciplined.

## Build rules

- Monorepo: pnpm workspaces per prd §4.7. TypeScript everywhere; Rust stays Tauri
  config. Crib the Tauri pattern from `~/Desktop/hive/apps/desktop` (read-only
  reference; NEVER modify hive or distillation from here).
- The ledger is append-only (D4): no UPDATE/DELETE ever touches `events`; everything
  else is a projection. Chain logic lives in `packages/core` and is property-tested.
- Design tokens: `apps/web/src/styles/tokens.css` is the single source; the grep-guard
  (no hex literals outside it) must stay green. Amber = knowledge-risk ONLY (D5).
  Motion durations come from tokens. Every animation has a reduced-motion state.
- **No em dashes anywhere user-facing: UI strings, README, docs, commit messages (D8).**
- **Honest-claims rule (D9): no number in UI, README, or pitch that a committed artifact
  cannot back.** The tagger quotes `ml/results/summary.json` or uses the fallback
  wording; never blur measured vs cited.
- AI-drafted records are visibly drafts until a human approves (`drafted_by='model'`).
- Secrets in env only; never in commits, docs, or chat. Synthetic data only; the demo
  says so in its footer.
- Playwright MCP is the design-verification tool (design.md §7): screenshot, audit
  against the checklist, fix, re-shoot. Screenshots land in `docs/shots/`.
- Read-only toward every other project on this machine. Distillation is a recipe
  reference for `ml/`; hive is a pattern reference for Tauri and token discipline.
- When making comments use natural language. No em dahes, like how i type.

## Session close

Before ending any session: masterplan boxes and Sprint log lines current, MANUAL TASKS
updated, the Current-sprint pointer correct, and this file's Current-state line updated.

## Current state

> Update this line at the end of every sprint.

**Current state:** Stage 2 complete, 2026-08-22. All twelve sprints S0 to S11 delivered
and logged. 174 unit tests plus 26 SQL tests green, 45 design screenshots, 15 video beats
captured against a frozen and fingerprinted seed.

TWO THINGS REMAIN AND BOTH NEED A HUMAN:
  1. `supabase login` then `supabase link --project-ref <ref>`. That is the only thing
     between this and a public demo. `./scripts/deploy.sh preflight` names it.
  2. Filming the acted video scenes. All PRODUCT beats are already captured.

The LLM routes need an ANTHROPIC_API_KEY and degrade honestly without one. The in-browser
retrieval path needs no key and is the primary one.

The whole schema was built and tested against a local PostgreSQL 17 because Supabase was
never reachable, which is why S1, S4, S5, S6 and S7 are all done despite the block.
