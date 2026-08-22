# PRD: Continuity

> The strategy-continuity intelligence layer for quantitative trading firms.
> An append-only, tamper-evident decision ledger with ambient capture, an LLM debrief agent,
> knowledge-risk analytics, and an on-prem distilled tagging model. Shipped as a premium
> Tauri desktop app plus a deployed, authed web demo, both driving one database.
>
> Companion documents: `design.md` (design language), `masterplan.md` (execution ledger),
> `claude.md` (working rules), `engineerprompt.md` (stage-1 engineer prompt),
> `docs/Continuity_Scope_Dossier.pdf` (the research this product is built on).
> Status: locked for the 22-23 Aug 2026 build. Amend via masterplan AMENDMENTS only.

---

## 1. The one-paragraph version

Quant firms lose strategies when people leave: Jane Street's own court filing describes a
~$1B/year strategy losing more than half its profits the month after two traders departed,
and the SEC fined Two Sigma $90M (plus $165M repaid) because nobody could see who changed
14 live models over two years. Every existing defence (non-competes, garden leave,
litigation) operates after the knowledge has already concentrated in one head. Continuity
is the operational fix: an intelligence layer that captures the reasoning behind strategy
research at the moment it happens (commits, parameter changes, debriefs), stores it in an
append-only, cryptographically chained decision ledger, quantifies knowledge concentration
per strategy, and turns the corpus into handover packs, compliance artifacts, and a
queryable memory of the desk. It is less a dashboard than a database with an opinion:
the schema is the product; the interfaces exist to feed it and to ask it questions.

## 2. Why this exists (research anchors, all cited in the dossier PDF)

- A federal court filing documents the failure mode at the best firm in the world [T1].
- Turnover at multi-managers runs 15-20% of PMs per year; the average strategy outlives
  its author's seat [T8, T9].
- US courts dismiss trade-secret claims when the firm cannot describe its secret with
  reasonable particularity; ~11% die on "reasonable measures" alone [L1, L2]. An
  undocumented strategy may be legally undefendable.
- Regulators have already written the spec: FCA cited firms for decisions "without
  sufficient explanation of the underlying rationale" [L7]; SR 11-7 defines documentation
  as understandable by "parties unfamiliar with a model" [L9]; FCA SYSC 25.9 requires
  handover material containing "judgement and opinion, not just facts and figures" [I17];
  RTS 6 Art. 5(7) requires a who/what/when/approved-by record of every material algo
  change [L6].
- Structured capture provably works in finance: Marshall Wace TOPS, WorldQuant BRAIN
  [I6, I8]. Nothing equivalent exists for research reasoning; firms built it for data
  (ArcticDB) and never for the why [F20].
- Finance already mandates a bus-factor fire drill: FINRA/NY DFS two-week block leave
  [I18]. Nobody scores whether a desk will pass it. We do.

## 3. Users and personas (synthetic firm: "Meridian Basis Partners")

| Persona | Name in demo | What they do in Continuity |
|---|---|---|
| Quant researcher | Priya (Vol desk) | Works normally; approves LLM-drafted decision records at merge time; answers 60-second debriefs; searches her own history |
| Desk head | Marcus (India options desk) | Watches strategy health and bus factor; runs departure simulations; reads weekly digests |
| Compliance / COO | Elena | Pulls RTS 6 / SR 11-7 artifact drafts; verifies ledger integrity; exports handover packs |
| Departing trader | Daniel (resigning in the demo) | Exit debrief with the agent; his knowledge map is the demo's dramatic arc |
| New graduate | Tom | Onboards against the corpus: asks the layer "why is the vol filter 0.7" and gets the recorded answer with provenance |

Auth model: real accounts (email + password via Supabase Auth), role claim per persona
(researcher, desk_head, compliance). Every demo viewer signs in as one of the seeded
personas or registers a fresh account that lands in a sandbox firm. All data is synthetic;
users can add more (new decisions, debriefs, strategies) and their additions flow through
the same capture pipeline. Row-level security scopes every row to its firm.

## 4. The product, precisely

### 4.1 The core thesis restated as architecture

Continuity is a database with three membranes around it:

1. Capture membranes that write to it with near-zero friction.
2. Intelligence membranes that read it and compute risk, packs, and answers.
3. Proof membranes that make it evidentiary (hash chain, timestamps, export).

The human-to-database interaction is the product's soul: every write is either automatic
(events) or a 10-second approve/edit of a machine draft (records); every read is either a
question in plain language or a generated artifact.

### 4.2 The schema (the star of the show)

Postgres (Supabase). Append-only where it matters. Full DDL lives in
`supabase/migrations/`; this section is the contract.

Framing (see `docs/palantir.md`): this schema is an ontology in the Palantir sense: a
digital twin of the desk's knowledge, with semantic elements (objects: strategies,
artifacts, people; links: the decision genealogy) and one kinetic rule: every state
change is a typed, attributable event on the ledger, the way Foundry allows writes only
through typed Actions. Reads are part of the twin too: access is itself an event
(below).

Core entities:

- `firms` (id, name, created_at) and `members` (user_id, firm_id, role, display_name).
- `strategies` (id, firm_id, name, status: research|paper|live|retired, description,
  created_by). The unit everything hangs off.
- `artifacts` (id, firm_id, strategy_id, kind: commit|notebook|param_file|chat|doc|
  meeting_transcript, external_ref, content_hash, author_member_id, occurred_at,
  raw_meta jsonb: for transcripts, speaker turns + attendees). The captured exhaust.
  Immutable.
- `events` (id BIGSERIAL, firm_id, kind, payload jsonb, actor_member_id, occurred_at,
  prev_hash, this_hash). THE LEDGER. Append-only, enforced by revoking UPDATE/DELETE and
  a trigger that computes `this_hash = sha256(prev_hash || canonical(payload))`. Every
  meaningful thing in the system is an event first.
- `decisions` (id, firm_id, strategy_id, event_id, title, what_changed, why, alternatives
  jsonb, confidence, tags text[], decision_type, risk_flag, author_member_id, approved_at,
  drafted_by: human|model, source_artifact_ids uuid[]). The decision genealogy node.
  `decision_type` and `risk_flag` are written by the distilled tagger (see 4.6).
- `decision_links` (parent_decision_id, child_decision_id, relation: supersedes|informs|
  reverts). The genealogy edges.
- `debrief_sessions` (id, firm_id, member_id, strategy_id, scheduled_for, completed_at,
  trigger_reason) and `debrief_turns` (session_id, seq, role: agent|human, text,
  grounded_artifact_ids uuid[]). The interviewer's corpus.
- `questions` (id, firm_id, strategy_id, text, asked_by, answered_by_decision_id,
  undocumentedness_score). The open questions only one person can answer; ranked feed.
- `knowledge_scores` (strategy_id, computed_at, bus_factor, herfindahl_concentration,
  vacation_readiness, top_holder_member_id, breakdown jsonb). Materialized nightly and
  on demand.
- `anchor_receipts` (id, through_event_id, merkle_root, ots_receipt bytea, anchored_at).
  OpenTimestamps anchoring of the ledger head.
- `handover_packs` (id, firm_id, member_id, generated_at, content_md, pack_hash). Frozen
  generated artifacts.

Design rules encoded in the schema: events are the source of truth and everything else is
a projection; nothing is ever updated in place on the ledger path; every generated
artifact records the ledger position it was generated from; every AI-drafted row is
labelled `drafted_by = 'model'` until a human approves it.

### 4.3 Capture surfaces (the cadence engine)

1. `continuity` CLI (Node, installed per repo): a `post-commit` git hook posts the commit
   as an artifact; a diff-aware LLM call drafts a decision record when the commit touches
   strategy code or parameter files (path rules per repo config); drafts queue for
   approval. `continuity watch` also tails Jupyter checkpoints.
2. Desktop quick capture: global hotkey (default Cmd+Shift+Space) opens a small glass
   window: one line of "why", strategy picker pre-filled from the active repo, enter to
   file. Ten seconds, keyboard only.
3. The debrief agent (4.5) files structured turns.
4. Meeting ingest (the total-context path): recorded meetings land as
   `meeting_transcript` artifacts with speaker-tagged turns, linked to a strategy, and
   become citable grounding for decisions, debriefs, and ask-bar answers. The weekend
   build ships this as seeded transcripts plus a transcript importer (paste or drop a
   transcript file, it files as an artifact); live capture hardware is roadmap (below).
5. Manual entry in the app (fallback and demo-friendly).

The capture doctrine: continuous, ambient, always on. Capture is not an act anyone
performs; it is the way work leaves a trace, running 24/7 as ordinary practice, the way
version control became ordinary practice. Every surface above is designed to make
capture the path of least resistance: automatic where possible, one keystroke where
not, scheduled where memory decays. And it tracks the work, never the worker: no screen
recording, no keystroke or activity monitoring, no productivity analytics, no
behavioral scoring. Capture attaches to artifacts (commits, parameters, transcripts,
decisions). Authorship is recorded because provenance is the product's legal and
operational value, but the analytics layer is deliberately de-personalized: bus factor,
concentration, and readiness are computed and presented as properties of a strategy,
never as league tables of people, and no view in the product ranks individuals.

The total-context principle. The trading floor is already the most-recorded room in the
economy: regulators have fined firms more than $3B for FAILING to capture business
communications, and trader-voice transcription is installed infrastructure [L12, C12].
Continuity's stance is that maximum context should be the ambient default, all the time:
every meeting recorded and transcribed into the ledger, every research session leaving a
trace, every artifact linked while the context around it still exists, so the
intelligence layer is fortified continuously instead of reconstructed at exits. The
roadmap surfaces are always-on desk capture devices (a small room unit that records,
transcribes on-prem, speaker-tags, and files straight into the ledger) and taps into the
compliance recording systems firms already run, turning a write-only archive into the
firm's memory. The boundary travels with the vision: capture is of work product, is
transparent to the people it protects, and stays inside the legal envelope the dossier
maps (mandatory-recording rules on one side, monitoring law and works-council
constraints on the other) [L13, L14, L15, C14].

Cadence is a first-class concept: a scheduler table drives debrief prompts (post-merge,
post-drawdown-flag, spaced-repetition refresh before a decision's memory half-life, and a
weekly 3-question desk pulse). The point the pitch makes: the layer is fortified on a
schedule, not by heroics.

### 4.4 The reading surfaces

- Strategy page: header (status, owners, health), the decision genealogy graph (nodes =
  decisions, edges = links, color by decision_type, amber ring = risk_flag), the ledger
  timeline beneath it.
- Ask bar (Cmd+K): natural-language question over the corpus, answered with citations to
  decisions/artifacts (retrieval over pgvector embeddings; every answer shows its
  sources; no source, no claim).
- Knowledge risk board: per-strategy bus factor, concentration, vacation-readiness score,
  firm heat map, departure simulation (pick a member, watch the map redden, see the
  orphaned-decision list).
- Handover pack generator: for any member, a structured pack modeled on FCA SYSC 25.9
  ("judgement and opinion, not just facts and figures"): their strategies, their decision
  history, open questions ranked by undocumentedness, suggested exit-interview script.
- Compliance view: RTS 6 Article 5(7) change-log extract and an SR 11-7-shaped model
  documentation draft, both generated from the ledger, both labelled DRAFT.
- Verify page: recompute the hash chain in the browser, show the OTS anchor receipt,
  demonstrate tamper-evidence by attempting an edit against a copied chain.
- Access as an event (the Palantir adoption, `docs/palantir.md` §5): opening another
  desk's strategy, generating a pack, or exporting an artifact appends an access event
  to the same ledger; exports prompt a one-line justification (checkpoint) stored on
  the event. The pitch line: the ledger records who read it, and why.
- My Record: every member's view of everything captured from them and every access
  event touching their contributions. Transparency to the observed is the
  acceptability condition for 24/7 capture, and it is a screen, not a promise.

### 4.5 The debrief agent

An LLM interviewer whose every question is grounded in a captured artifact ("You changed
`vol_filter` from 0.65 to 0.7 in commit 3f2a1 two hours after the drawdown flag. Walk me
through it."). Sessions are 3 to 5 questions, 60 to 120 seconds, spoken-register.
Transcript turns file as debrief_turns; salient answers are promoted (with approval) into
decisions. The exit debrief is the same machine with a longer session plan and the
handover pack as its output. Model access: Anthropic API in the cloud demo; the on-prem
story (and roadmap slide) is local inference, evidenced by 4.6.

### 4.6 The distilled on-prem tagger (the "we train our own models" flex)

Reusing the MLX LoRA pipeline from the distillation project (same machine, same recipe:
teacher labels, LoRA r=16 bf16 on a small Qwen base, held-out eval before any claim):
a classifier that tags each captured decision with `decision_type` (parameter_change |
risk_limit | data_handling | execution | universe | infra | process) and `risk_flag`
(bool). Training data: the synthetic corpus generator emits ~2,000 labelled decision
records (labels are free because the generator knows them); a teacher pass over a slice
sanity-checks label quality; the student is evaluated on a held-out split before the
result is cited anywhere. What ports from the distillation project is the recipe and
harness (the pinned environment, the LoRA configuration, the strict-JSON
parse-or-unparseable evaluator, the provenance-pinned results file), not the trained
news model: the tagger is a fresh adapter on a new task. The demo line: "tagging runs on a model we fine-tuned
ourselves, on-prem, because this data can never leave the building." Fallback if
training misses the window: few-shot prompting with the same base model, and the claim
softens to "pipeline proven separately" citing the distillation repo's shipped result
(student macro-F1 0.8400 at 41.3x below teacher list-price cost).

### 4.7 Form factor and deployment

- One React (Vite + TypeScript) frontend, two shells:
  - Tauri 2 desktop app: menu-bar icon, global hotkey quick capture, native window
    chrome, the premium surface for the acted video. Config cribbed from hive's
    `apps/desktop` (the pattern is proven; keep Rust to configuration).
  - Web build of the same frontend deployed on Vercel: the authed public demo.
- Supabase: Postgres, Auth, RLS, Realtime (live ledger tail in the UI), pgvector.
- The CLI is a separate small Node package in the monorepo.
- Monorepo: pnpm workspaces: `apps/desktop` (Tauri), `apps/web` (Vite frontend +
  Vercel adapter), `packages/core` (schema types, hash chain, scoring), `packages/cli`,
  `ml/` (tagger training, mirrors distillation's src layout), `supabase/` (migrations,
  seed), `docs/`.

### 4.8 Security and privacy scope (demo-honest)

Real auth, real RLS, synthetic data. Secrets live in env vars only; the anon key plus
RLS is the exposure surface, same posture as hive. No real firm data is ever entered; the
registration page says so. The LLM calls carry synthetic text only. The desktop build is
unsigned for the hackathon (documented manual task). Rate limits on write endpoints.
The privacy pitch line is architectural, not performative: the on-prem tagger plus the
self-hostable schema is the path to a zero-egress deployment; the cloud demo is theatre
over synthetic data and says so in the footer.

The processor stance (from `docs/palantir.md`): Continuity deploys into the firm's
environment, single tenant; the vendor never pools, resells, or trains on customer
data. Allowed purposes are hard-scoped: continuity, onboarding, compliance, IP
documentation. Forbidden purposes (performance management, termination cases,
individual productivity analytics) are made technically annoying, not just
contractually excluded: no per-person rankings exist anywhere in the product (design.md
principle 7), and access to another member's record leaves an access event they can
see. Purpose creep, not capture, is what detonates products in this lane; Signac is
the case study.

## 5. What is explicitly out of scope (48-hour honesty)

No real firm integrations (Slack/Bloomberg), no mobile, no model fine-tuning of the
debrief agent, no multi-firm admin, no billing, no notarized/signed installers, no
Windows/Linux builds, no real-time collaboration cursors, no GraphRAG (the ask bar is
retrieval + citations, not a graph index), no twin persona in-product (the twin is a
video/pitch beat using the debrief corpus, honestly labelled a prototype).

## 6. Demo arc (what judges see, in order)

1. Priya commits a parameter change; the draft decision record appears; she approves in
   one keystroke; the ledger advances live on screen.
2. The tagger labels it `parameter_change` on-prem; the genealogy graph grows a node.
3. Daniel resigns (staged). Departure simulation: his knowledge map redders across two
   strategies; orphaned decisions list; vacation-readiness score was already amber.
4. Exit debrief: the agent interviews Daniel with artifact-grounded questions; the
   handover pack generates; Tom asks the ask-bar "why is the expiry window capped" and
   gets Daniel's recorded answer, cited.
5. Compliance beat: Elena exports the RTS 6 change log; the verify page proves the chain;
   the OTS receipt shows the anchor.
6. Close on the research: the Jane Street filing, the numbers, "this is the system that
   makes that lawsuit winnable, and that month survivable."

## 7. Success criteria

- The full demo arc runs end to end on the deployed web demo AND in the desktop app.
- A stranger can register, land in the sandbox firm, and add a decision within 2 minutes.
- Ledger integrity check passes in-browser; an attempted tamper is caught on stage.
- The tagger's held-out accuracy is measured and quoted with its number, or the fallback
  line is used; no invented numbers anywhere (claude.md rule).
- The UI reads as designed (design.md acceptance: hairlines, glass, motion, whitespace),
  verified with Playwright screenshots against the checklist.
- README with screenshots, mermaid architecture and ERD, research citations.
- Video script executed; footage in the can.

## 8. Risks and pre-agreed mitigations

| Risk | Mitigation locked now |
|---|---|
| Tauri fights the cheap model | Rust stays config-only; all logic in TypeScript; hive's desktop app is the reference; web demo is the fallback stage for every feature |
| Training window slips | Fallback few-shot tagger + cite distillation repo's shipped result (see 4.6) |
| LLM drafting quality embarrasses on stage | Demo uses curated seed commits; drafts are editable; the approve step is the feature, not a workaround |
| Scope creep into GraphRAG/twin | Out-of-scope list above is contractual; masterplan has no sprint for them |
| Auth eats the weekend | Supabase Auth default UI flows; roles are a claim column, not an admin system |
| Hash chain bugs on stage | packages/core chain functions are property-tested in S1; verify page recomputes, never trusts |
