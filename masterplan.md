# masterplan.md: Continuity

> **Current sprint: S0 — Foundation** _(Stage 1 research/setup closed on delivery of this pack)_
>
> This file is the ledger. Work only the active sprint. Mark tasks live:
> `[ ]` not started · `[~]` in progress · `[x]` complete · `[⏭]` deferred (one-line reason).
> **Never delete or rewrite content in this file: expand in place.** A sprint is not done
> until its **Acceptance** block passes and its **Sprint log** line is filled in
> (see logging protocol below). Material changes to locked decisions go in the append-only
> **AMENDMENTS** block at the bottom. Manual (human-only) tasks live in the
> **MANUAL TASKS** section at the very end; agents append there, never execute them.

---

## Sprint logging protocol (contractual; also in claude.md)

At the close of EVERY sprint and subsprint, append to that sprint's **Sprint log** line:

```
Logged: <ISO-8601 local datetime> · status: done | partial | blocked · actual: <hours>h
(budget <hours>h) · by: <agent/model or human> · note: <one line: what shipped, what did not>
```

A `partial` or `blocked` status MUST name the blocking item and add any human action to
MANUAL TASKS. Never mark `done` with failing acceptance. Never backfill a time; log at
the moment of completion.

---

## The one-paragraph version

Continuity is a strategy-continuity intelligence layer for quant firms: an append-only,
hash-chained decision ledger fed by ambient capture (git hook, desktop quick capture,
LLM debrief agent), read by knowledge-risk analytics (bus factor, vacation-readiness,
departure simulation), generating handover packs and compliance artifacts, with decision
tagging done by a small model we fine-tune ourselves on-prem (MLX LoRA, distillation
project's recipe). One React frontend, two shells: Tauri desktop app (the premium
surface) and a Vercel-deployed authed web demo on Supabase with synthetic data users can
extend. Full scope: `prd.md`. Design law: `design.md`. Evidence base:
`docs/Continuity_Scope_Dossier.pdf`.

## The two-stage model plan (why this file is so specific)

Stage 1 (research + setup, best models): produced the dossier, PRD, design language, and
this plan. Stage 2 (the build, cheaper model): executes THIS FILE mechanically. Therefore
every sprint below states its files, its commands, its acceptance, and its fallback.
When the build model is unsure, the answer is in this file, prd.md, or design.md; if it
is not, add a question to OPEN QUESTIONS and take the documented fallback rather than
inventing scope.

## Locked decisions (do not relitigate)

| # | Decision | Why |
|---|---|---|
| D1 | Product name: **Continuity**. Synthetic firm: Meridian Basis Partners | Owner call; branding deferred (see MANUAL TASKS) |
| D2 | One React/Vite/TS frontend; Tauri 2 shell + Vercel web build of the SAME frontend | 48h + cheap model: web code everywhere, Rust stays config; hive `apps/desktop` is the proven reference pattern |
| D3 | Supabase = Postgres + Auth + RLS + Realtime + pgvector. Real auth, synthetic data, users may add data into their sandbox | Owner call (auth yes, data synthetic); RLS scopes by firm |
| D4 | The ledger is append-only `events` with `prev_hash/this_hash` sha256 chain; UPDATE/DELETE revoked; projections everywhere else | The schema IS the product (prd §4.2) |
| D5 | Amber is reserved for knowledge-risk signals only, everywhere (UI, docs, charts) | design.md §1.3; transplanted control-plane discipline |
| D6 | Tagger: MLX LoRA fine-tune of a small Qwen base on ~2,000 synthetic labelled decisions; held-out eval before any quoted number; fallback = few-shot with same base + cite distillation repo result (macro-F1 0.8400, 41.3x cost) | Owner call; recipe exists in `~/Desktop/distillation` |
| D7 | LLM for drafting/debrief in demo: Anthropic API via server route; synthetic text only crosses the wire | On-prem story is carried by D6, not faked |
| D8 | No em dashes in any user-facing copy, docs, README, or UI string | Owner rule, inherited from hive |
| D9 | Honest-claims rule: no number appears in UI, README, or pitch that a committed artifact cannot back | Inherited from distillation; judges will probe |
| D10 | Out of scope, contractually: integrations, mobile, GraphRAG, in-product twin, billing, signed installers, Windows/Linux | prd §5 |
| D11 | Total context is the ambient default: meetings are first-class `meeting_transcript` artifacts; the build ships seeded transcripts + a transcript importer, and debriefs/ask answers cite them; always-on desk capture devices and compliance-archive taps are roadmap/pitch, not weekend scope | Owner direction 22 Aug; framing + legal boundary in prd §4.3 and dossier [L12-L15, C12, C14] |
| D12 | Capture doctrine: continuous, ambient, 24/7, as ordinary practice; tracks the work, never the worker (no screen/keystroke/activity monitoring, no behavioral scoring); authorship recorded for provenance, analytics de-personalized (strategy-level scores, never people leaderboards; no view ranks individuals) | Owner direction 22 Aug; prd §4.3; adoption evidence in dossier [I1-I3, I10, C14] |
| D14 | The pizzazz layer (owner direction 22 Aug: "magic first, mechanism second"): three hero surfaces open every demo: persona-mode ask ("talk to the trader who left": prompt variant over existing retrieval, every sentence cited, non-removable banner naming it a reconstruction), the Time Machine (ledger replay scrubber on the strategy graph), and the departure bomb (dollar-denominated exposure from synthetic attributed revenue, labelled synthetic on screen). Demo arc reordered in prd §6; these three are INSIDE the minimum winning demo; the mechanism (capture flow) demos after them | Pizzazz without new architecture: all three render data the schema already holds |
| D13 | Palantir-derived governance (docs/palantir.md §5): access is itself a ledger event (reads, pack generations, exports); exports prompt a one-line justification (checkpoint) stored on the event; every member gets a My Record view of what was captured from them and who accessed it; processor stance and hard-scoped purposes in prd §4.8; purpose-based access grants are roadmap | Owner direction 22 Aug; Palantir patterns 3-7, Signac case study |

## Verified facts (Stage 1, 22 Aug 2026: re-verify anything load-bearing when used)

- hive `apps/desktop` exists and is the Tauri-wrapping-web reference (tokens mirror,
  pty use NOT needed here). Path: `~/Desktop/hive/apps/desktop`.
- distillation repo has: `src/` pipeline (harvest, teacher, train via mlx-lm LoRA r=16
  bf16, evaluate, scoring), shipped result student macro-F1 0.8400 / accuracy 0.8540 on
  held-out 500, provenance-pinned in `results/summary.json`. Machine: M4 Pro, 48 GB
  unified, Python 3.12 via uv (system 3.14 too new), mlx-lm working.
- mlx-community small Qwen bases exist (e.g. Qwen3.5-2B / 0.8B and 4B bf16 conversions);
  disk was the binding constraint (~34 GB free at distillation time): re-check `df -h`
  before pulling any base (S6 task).
- Design tokens source of truth pattern + guardrail tests proven in hive
  (`apps/web/styles/tokens.css`, mirror script, readability tests): copy the pattern,
  not the values.
- SCOPED IN STAGE 1 (all verified 22 Aug 2026 against registries/docs; full mechanical
  recipes in `docs/scoping.md`, which is CONTRACTUAL for the build):
  - Tauri: CLI 2.11.4 / api 2.11.1 / crate 2.11.5 / global-shortcut plugin 2.3.2. Tray
    is core (`tray-icon` + `image-png` features, template PNG). Capabilities file must
    list BOTH window labels or APIs fail silently. `macOSPrivateApi: true` for the
    transparent quick-capture window. Unsigned build via `signingIdentity: "-"`.
    Fallback ladder documented (scoping §A7).
  - Supabase free tier: pgvector yes; Realtime 200 concurrent; projects PAUSE after 7
    idle days (unpause morning-of); post-May-2026 projects need EXPLICIT GRANTs per
    table. Chain trigger uses per-firm `pg_advisory_xact_lock`; chain VERIFY runs in
    SQL, not JS (jsonb canonicalization). Realtime respects RLS. Email confirmation
    OFF for the weekend. Tauri CSP must allowlist the Supabase URL.
  - Frontend pins: React 19.2.8, Vite 8.2.2, TanStack Router 1.170.31 (hash history
    inside Tauri), Query 5.101.4, supabase-js 2.112.3, `motion` 13.1.1 (import
    `motion/react`, NEVER framer-motion), cmdk 1.1.1, d3-force 3.0.0 (deterministic by
    default: pure computeLayout + tick(300), no seed plumbing), Fontsource Geist
    (the `geist` npm package requires next/font and fails in Vite). Plain CSS Modules,
    NOT Tailwind (hex escape hatch). Handover PDF = print CSS route; print from web
    deploy, not WKWebView. Blur-through-window does not work in Tauri: paint our own
    field; never animate a blurred element.
  - Server routes LOCKED: Vercel functions (`/api/*.ts`, Web signature) + SPA rewrite
    excluding `/api`; secrets unprefixed (VITE_ is public); desktop calls absolute
    Vercel origin with Supabase JWT verified server-side.
  - Embeddings LOCKED: OpenAI `text-embedding-3-small` (1536; Anthropic has no
    embeddings API) with transformers.js `gte-small` (384) as the no-key fallback;
    dimension chosen BEFORE the pgvector migration.
  - Tagger base LOCKED: `mlx-community/Qwen3.5-2B-MLX-bf16` (4.43 GB, exists, fits
    disk); 0.8B-bf16 (1.71 GB) as speed fallback; chat-format jsonl, --mask-prompt,
    r=16 bf16, ~800-1,200 iters, ~15-40 min wall-clock; serve via `mlx_lm.server`
    --adapter-path (no fusing); strict JSON parse, UNPARSEABLE never coerced.
  - OpenTimestamps: npm `opentimestamps` 0.4.9 (stale-but-frozen protocol; pin exactly,
    beware `opentimestamp` typosquat); Bitcoin attestation takes 1-6+ h so STAMP A HEAD
    ON DAY 1 for one upgraded receipt by demo time; receipts are binary bytes; never
    block the write path on OTS.

## Machine and accounts

M4 Pro 48 GB (Bruno's). Node 24, pnpm needed (MANUAL TASKS). Supabase + Vercel accounts
(MANUAL TASKS). Anthropic API key as env (MANUAL TASKS). No paid spend beyond free tiers
without owner gate.

---

# STAGE 1 (closed): Research and setup

Delivered: research dossier (39pp), Strategy Continuity paper (7pp), frontier addendum
(9pp), combined scope dossier PDF, prd.md, design.md, this file, claude.md,
engineerprompt.md, videoscript.md, docs/scoping.md (verified build recipes),
docs/palantir.md (Palantir architecture + government practice research and the adopted
governance patterns behind D13).
**Sprint log:** Logged: 2026-08-22T12:00+10:00 · status: done · actual: n/a (Stage 1) ·
by: Claude (Fable, Cowork) · note: pack authored; folder connection pending at close.

---

# STAGE 2: The build (Sat 22 Aug pm to Sun 23 Aug, ~30 working hours)

Budgets are aggressive on purpose; log actuals honestly. Order is dependency order;
S6 (tagger) runs in parallel on the owner's machine from Sat evening.

## The minimum winning demo and the cut order (contractual under pressure)

The MINIMUM WINNING DEMO, which is never cut and beats a fuller broken build: seeded
corpus, the three D14 heroes (persona-mode ask, Time Machine scrubber, dollar-stakes
departure simulation), ledger UI with the approve flow and capture-to-ledger animation,
genealogy graph, handover pack generation, verify sweep with a staged tamper catch, all
running on the DEPLOYED web demo, plus README and video footage.

If time runs short, cut in THIS order and no other, logging each cut as a deferral:
1. OpenTimestamps anchoring (keep the hash chain and SQL verify; drop the Bitcoin
   receipt beat from the demo).
2. Trained tagger → few-shot fallback (D6 wording).
3. Tauri shell, tray, quick capture → web only (the demo arc survives intact).
4. Transcript importer → seeded transcripts only (D11 still demonstrated).
5. Ask-bar vector retrieval → curated answers over the seeded questions feed
   (rendered honestly; no fake generality).
6. Export checkpoint modal → plain access events only (D13 partially demonstrated).
The arc is the meal; this list is garnish. The build model may not reorder it.

## S0 — Foundation (budget 2.5h)

- [ ] pnpm monorepo per prd §4.7: `apps/desktop`, `apps/web`, `packages/core`,
      `packages/cli`, `ml`, `supabase`, `docs`, `assets`.
- [ ] Vite React TS app boots; `tokens.css` from design.md §2 wired; Geist self-hosted;
      grep-guard script: no hex literals outside tokens.css (add to `pnpm check`).
- [ ] Tauri 2 shell wraps the dev server; menu-bar (tray) icon (placeholder template
      glyph for now); global
      shortcut registers and opens a placeholder window. Crib config from hive
      `apps/desktop`. FALLBACK if tray/shortcut fights: ship windowed app, move
      quick-capture into the main window (Cmd+K mode), log deferral.
- [ ] Supabase project linked; env plumbing (`.env.local`, never committed); typegen.
- [ ] Verify-list from Verified facts checked off with one-line evidence each.
- **Acceptance:** `pnpm dev` = web app on localhost; `pnpm tauri dev` = same UI in
  desktop shell with tray icon; empty ledger page renders on tokens; grep-guard passes.
- **Sprint log:**

## S1 — The schema and the chain (budget 3h)

- [ ] Migrations for every table in prd §4.2, RLS by firm, roles as member claim.
- [ ] Append-only enforcement per docs/scoping.md §B1: explicit GRANTs, revoke +
      forbid_mutation trigger, chain trigger with per-firm advisory lock and hand-built
      canonical text. Chain VERIFY is a SQL function (`verify_chain(firm_id)`); the
      verify page calls it and animates its result; `packages/core` tests call it via
      RPC against seeded data plus a deliberately forked copy (do NOT reimplement jsonb
      canonicalization in TS).
- [ ] Synthetic corpus generator (`packages/core/seed`): Meridian Basis Partners, 5
      personas, 4 strategies, ~400 artifacts, ~180 decisions with genealogy links,
      ~2,200 labelled decision records exported to `ml/data/` for S6, 6 debrief
      sessions, questions feed, and 4 speaker-tagged meeting transcripts (two desk
      standups, one strategy review, one risk meeting) as `meeting_transcript`
      artifacts that decisions and debriefs cite (D11). Deterministic seed so demos
      reproduce.
- [ ] Seed applied to hosted Supabase; typegen committed.
- **Acceptance:** chain property tests green; seeded DB queryable; a hand-edited row in
  a COPY of the chain is detected by `packages/core` verify.
- **Sprint log:**

## S2 — Capture surfaces (budget 4h)

- [x] `packages/cli`: `continuity init` installs post-commit hook (path rules in
      `.continuity.json`); hook posts artifact + requests LLM draft (server route);
      `continuity watch` tails notebook saves. Demo repo `demo/vol-desk-repo` with
      scripted commits for the video.
- [⏭] Server routes (LOCKED: Vercel functions per docs/scoping.md §B6): `draft-decision`
      (diff in, structured draft out, Anthropic API), `ask` (S4), JWT-verified, rate
      limited (in-memory per-instance is acceptable; note it in README).
      DEFERRED: needs an Anthropic key, which is a MANUAL TASK. The route shapes are
      settled in the sprint expansion above, including the structured-output versus
      citations split the API forces, so wiring them is mechanical once a key exists.
- [x] Draft queue UI: DecisionCard draft variant (dashed hairline + drafted chip),
      approve = one keystroke (A), edit-then-approve, reject.
- [x] Desktop quick capture: global hotkey window per design.md §3.4, files a manual
      decision in <10s, keyboard only. FALLBACK: in-window Cmd+K capture mode.
- [x] Transcript importer (D11): paste or drop a speaker-tagged transcript in the app,
      pick strategy + attendees, files as a `meeting_transcript` artifact through the
      normal event path. Small surface, big pitch line ("meetings feed the ledger").
- **Acceptance:** commit in demo repo lands as approved decision in <60s end to end on
  stage-quality path; quick capture files in <10s; all writes appear as ledger events.
- **Sprint log:** Logged: 2026-08-22T19:51+10:00 · status: partial · actual: ~1.4h (budget 3h) ·
  by: Claude Opus 5 (Claude Code) · note: draft queue with the one keystroke approve and
  the capture-to-ledger handoff, the transcript importer, and the desktop quick capture
  window from S0. NOT done and honestly blocked: the server routes (S2.0 to S2.6) need an
  Anthropic key, which is in MANUAL TASKS. The route SHAPES are settled and written into
  the sprint expansion, including the structured-output versus citations split that the
  API forces, so wiring them is mechanical once a key exists. The CLI is next.

  The transcript parser has eight tests, and the one worth naming is that a sentence
  containing a colon is not a speaker line. "The rule is simple: cut size" would
  otherwise be attributed to a person called "The rule is simple", which is the sort of
  quiet misattribution that makes a provenance product worthless.


- **Sprint log (second entry):** Logged: 2026-08-22T19:56+10:00 · status: partial · actual: ~2.1h cumulative
  (budget 3h) · by: Claude Opus 5 (Claude Code) · note: the CLI is done and exercised
  against a real repository. `continuity init` refuses to clobber somebody else's
  post-commit hook rather than merging into it, because appending works right up until
  theirs exits non-zero and ours never runs, and then the failure looks like Continuity
  being broken. `status` prints which of the last ten commits would draft a decision,
  which is the fastest way to check the path rules are what a desk meant. The demo repo
  is BUILT by `scripts/make-demo-repo.sh` rather than committed: a git repository nested
  inside another one confuses every tool that walks the tree, and the video needs the
  commits reproducible.

  One failure mode worth naming because it is silent: a hook that shells into a command
  that does not resolve exits zero, captures nothing, and looks installed. `init` now
  resolves `continuity` on the PATH if it is there and falls back to an absolute path
  into this checkout if it is not.
## S3 — Reading surfaces: ledger, strategy, graph (budget 5h)

- [ ] LedgerRail + LedgerRow (Realtime tail, capture-to-ledger animation design.md §3.1).
- [ ] Strategy page: header, status chips, GenealogyGraph (SVG + d3-force, deterministic
      layout, node birth animation §3.2, amber ring = risk_flag).
- [x] AskBar (Cmd+K): actions + questions; question path: pgvector retrieval over
      decisions/debrief turns, answer with citation chips linking to sources; no source,
      no claim (render "not in the corpus" honestly).
- [ ] Persona mode (D14 hero 1): asking about a departed member's work answers in
      their register from THEIR rows only (retrieval filtered to author), every
      sentence cited, non-removable banner "Reconstructed from <name>'s ledger. He
      left in <month>." Same route, different prompt + filter; seed Daniel's corpus
      rich enough that three rehearsed questions answer beautifully.
- [ ] Time Machine (D14 hero 2): timeline scrubber on the strategy page replaying the
      ledger to time T; graph nodes/edges appear in event order (layout is already
      deterministic, so precompute final positions and reveal progressively); scrubbing
      past a departure inks that member's decisions amber in dependency order.
- [x] Access events + checkpoint + My Record (D13): strategy opens and exports append
      `access_read` / `access_export` events; export modal takes a one-line
      justification onto the event payload; My Record view filters the ledger to the
      signed-in member's captured contributions and the access events touching them.
      Small tasks, big pitch: the ledger records who read it.
- [ ] App shell + rail nav + empty states per design.md §4.
- **Acceptance:** demo arc steps 1-2 (prd §6) run scripted; keyboard-only pass for those
  steps; screenshots stored in `docs/shots/`.
- **Sprint log:**


- **Sprint log (second entry):** Logged: 2026-08-22T19:31+10:00 · status: partial · actual: ~4.4h cumulative
  (budget 4h) · by: Claude Opus 5 (Claude Code) · note: ask bar delivered with HYBRID
  retrieval, which was not in the plan and is the reason it works. Dense embeddings alone
  return everything about the right subject and rank the record that answers the question
  below them; BM25 supplies the exactness. Relevance floor measured rather than chosen:
  answerable questions score 0.88 to 0.93, unanswerable ones top out at 0.47, floor set
  at 0.60. Plus the three owner-directed features in AMENDMENT A21. STILL OPEN in S3:
  access events, the export checkpoint, and My Record (S3.4).
## S4 — Debrief agent (budget 3h)

- [ ] Scheduler table + triggers (post-merge, drawdown-flag stub, weekly pulse,
      half-life refresh (simple exponential decay stub, labelled as such)).
- [x] Debrief UI thread; agent questions grounded in artifacts including meeting
      transcripts (prompt includes the cited rows; every question renders its
      grounding chip; at least one seeded debrief question grounds in a meeting, per
      D11).
- [ ] Promote-answer-to-decision flow (approval, `drafted_by='model'` until approved).
- [ ] Exit-debrief session plan (longer, feeds S5 pack).
- **Acceptance:** a full 4-question debrief with Daniel persona produces filed turns and
  one promoted decision; grounding chips resolve.
- **Sprint log:** Logged: 2026-08-22T19:31+10:00 · status: partial · actual: ~0.9h (budget 2h) ·
  by: Claude Opus 5 (Claude Code) · note: the debrief thread renders with grounding chips
  on every agent question, and the departed-colleague recall sits above it (A21). NOT
  done: the scheduler table and triggers, and promote-answer-to-decision. The seeded
  sessions carry their trigger reason so the cadence is visible in the UI; the scheduler
  that would create new ones is not built.

## S5 — Knowledge risk and handover (budget 4h)

- [x] Scoring in `packages/core`: bus factor (adapted truck-factor over decision+artifact
      authorship), concentration (Herfindahl), vacation-readiness (can the desk answer
      open questions with the member masked); nightly + on-demand materialization.
- [x] Risk board: RiskDial, HeatStrip, departure simulation (design.md §3.3 animation,
      orphaned-decisions list) upgraded per D14 hero 3: seed carries synthetic
      attributed-revenue per strategy (labelled "synthetic" wherever displayed); the
      simulation lands a counting-up dollar exposure figure ("$412M of attributed
      revenue, no second owner").
- [x] Handover pack generator (SYSC 25.9-shaped, prd §4.4), PackPreview print-styled,
      export to md + pdf. Plus the two compliance extracts, which the plan put in S3:
      an RTS 6 Art. 5(7) change log and SR 11-7 shaped model documentation. All three
      are pure functions from rows to markdown, so the same corpus always produces the
      same document and a pack hash is worth storing. 13 tests.
- **Acceptance:** demo arc step 3-4 runs scripted end to end; Daniel's pack generates
  with real corpus content; scores recompute live after his exit debrief adds answers.
- **Sprint log:** Logged: 2026-08-22T19:41+10:00 · status: partial · actual: ~2.2h (budget 3h) ·
  by: Claude Opus 5 (Claude Code) · note: scoring, risk board, all three generated
  documents, the export checkpoint and the access log. The documents render in the print
  serif voice with a print stylesheet, so what is on screen is what comes out of the
  printer. NOT done: nightly materialization of knowledge_scores (computed on demand
  instead, which is correct for a demo and would not be at scale) and the PDF export from
  the desktop shell, which honestly refuses and points at the web app, because
  window.print in the macOS webview produces a blank PDF.

  One bug worth recording because the fix is not obvious from the symptom: the access log
  is read through useSyncExternalStore, and its getSnapshot returned a freshly built
  array every call. React compares snapshots by identity, so the page re-rendered forever
  and died with "Maximum update depth exceeded" and a stack pointing at React. The
  snapshot is now cached and replaced only on a write, and access.test.ts asserts the
  identity property directly.

## S6 — The on-prem tagger (parallel, owner's machine, budget 4h wall-clock)

- [ ] `ml/`: mirror distillation `src` layout; `df -h` check FIRST; base LOCKED
      `mlx-community/Qwen3.5-2B-MLX-bf16` (0.8B-bf16 if disk-tight); pin revision SHA;
      exact commands + parse rules in docs/scoping.md §D.
- [ ] Train LoRA r=16 bf16 on the S1-exported 2,200 labelled decisions (7-class
      decision_type + risk_flag as text label); held-out 300 split BEFORE training;
      eval macro-F1 + accuracy; write `ml/results/summary.json` with provenance
      (base SHA, adapter sha256, data hashes) exactly like distillation.
- [ ] Serve: tiny local endpoint (`ml/serve.py`, mlx-lm) the app calls when
      `TAGGER_URL` is set; cloud demo falls back to few-shot route (labelled in UI as
      "remote fallback").
- [ ] FALLBACK (pre-agreed, D6): few-shot with base model; quote distillation shipped
      numbers instead, clearly attributed to the prior project.
- **Acceptance:** every seeded + new decision gets decision_type/risk_flag; the quoted
  accuracy number in the UI tooltip matches `ml/results/summary.json` or the fallback
  wording is used. No invented numbers (D9).
- **Sprint log:**

## S7 — Proof layer (budget 2h)

- [ ] Merkle root over ledger ranges; OpenTimestamps anchor of the head
      (`anchor_receipts`); CLI `continuity anchor` + scheduled function stub. Recipes
      in docs/scoping.md §D. STAMP THE FIRST HEAD ON SATURDAY so an upgraded
      Bitcoin-attested receipt exists by demo time (attestation takes 1-6+ hours);
      pending receipts are shown honestly as pending.
- [ ] Verify page: in-browser chain recompute (verify sweep animation §3.5), tamper
      demo against a copied chain, OTS receipt display (pending-attestation state is
      fine and shown honestly).
- **Acceptance:** verify page passes on live data; staged tamper halts the sweep on the
  exact row; receipt renders.
- **Sprint log:**

## S8 — Deploy (budget 2h)

- [ ] Web build to Vercel: env, auth redirect URLs, seeded demo firm, registration →
      sandbox firm flow, footer synthetic-data notice.
- [ ] Desktop: `pnpm tauri build` .dmg (unsigned; note in README + MANUAL TASKS).
- [ ] Smoke the full demo arc (prd §6) on the DEPLOYED demo, not localhost.
- **Acceptance:** public URL live; fresh account reaches sandbox and files a decision in
  <2 min; demo arc passes on deployed; .dmg opens on the M4.
- **Sprint log:**

## S9 — Design verification and polish (budget 3h)

- [ ] Playwright MCP pass per design.md §7: screenshot every route both sizes + quick
      capture; checklist audit (tokens, hairlines, amber discipline, motion, reduced
      motion, keyboard-only full arc); fix and re-shoot to clean.
- [ ] Final screenshot set to `docs/shots/final/` (these are the README set).
- **Acceptance:** checklist all green, evidenced by the shots.
- **Sprint log:**

## S10 — README and documentation (budget 2h)

- [x] README.md: one-sentence what/why, demo URL + login
      hint, screenshot gallery, architecture mermaid, ERD mermaid, capture-flow sequence
      mermaid, the research section (numbers + citations from the dossier), tagger
      results table (D9-compliant), honest limitations, install/run, team. Professional,
      comprehensive, **no em dashes** (D8).
- [x] `docs/`: dossier PDF committed; METHODOLOGY-style note for the tagger; this
      masterplan + prd + design linked from README.
- **Acceptance:** README renders clean on GitHub (check raw + rendered); every number
  traceable; mermaid diagrams render.
- **Sprint log:** Logged: 2026-08-22T19:58+10:00 · status: done · actual: ~0.8h (budget 1h) ·
  by: Claude Opus 5 (Claude Code) · note: README with 10 screenshots taken from the real
  app, four mermaid diagrams (architecture, deployment, ERD, capture sequence), the
  research table with dossier citation codes, the ledger described in SQL with the
  measured claim about which layer survives a trigger bypass, and a limitations section
  with eleven entries. No accuracy figure appears anywhere because the tagger is not
  trained: the README says so and explicitly declines to borrow the prior project's
  number. Zero em dashes, verified by script. Every image path and relative link checked
  to exist.

## S11 — Video and submission (budget 2.5h + human filming)

- [ ] Freeze demo data to the video seed; run-through per `videoscript.md` beat sheet.
- [ ] Screen captures for product beats; human films acted beats (MANUAL TASKS).
- [ ] Submission package per hackathon requirements (research trail = dossier + decision
      log, prototype links, video).
- **Acceptance:** footage for every scripted beat exists; submission checklist complete.
- **Sprint log:**

---

## OPEN QUESTIONS (build model appends here instead of inventing scope)

- (Stage 1 close) none pending; engineerprompt.md instructs the next session to ask
  Bruno its scope questions before touching S0.

---

## MANUAL TASKS (humans only; agents append, never execute)

- [ ] Bruno: connect the `cissa-hackathon` folder in Cowork (Add folder) so the pack
      can be committed there.
- [ ] Bruno: create Supabase project + paste URL/anon/service keys into `.env.local`.
- [ ] Bruno: create/link Vercel project; set env vars; first deploy authorization.
- [ ] Bruno: Anthropic API key into server env. OpenAI key too (embeddings,
      text-embedding-3-small); if skipped, the build uses the transformers.js local
      fallback and the pgvector column is created at 384 dims instead of 1536.
- [ ] Bruno: unpause/keep-warm check of the Supabase project the morning of the demo
      (free-tier projects pause after 7 idle days).
- [ ] Bruno: install pnpm (`corepack enable`), Rust toolchain for Tauri, Xcode CLT
      present; confirm `df -h` has >= 12 GB free before S6 base pull.
- [ ] Bruno: register any hackathon submission portal details (team name, track).
- [ ] Film the acted video beats (script: videoscript.md); export final cut.
- [ ] Bruno + Claude Code, later (owner deferral, 22 Aug): design the final logo and
      README hero image. Until then the app and README use plain wordmark text.
- [ ] Optional: purchase nothing. No paid spend is authorized in Stage 2 (D-gate).
- [ ] Post-hackathon: decide repo visibility, codesigning, and whether the demo stays up.

---

## AMENDMENTS (append-only; date + why for any change to a locked decision)

- (none yet)
