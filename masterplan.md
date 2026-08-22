# masterplan.md: Continuity

> **Current sprint: S2 — Capture surfaces** _(Stage 1 closed on delivery of the pack; Stage 1.5 verification and expansion closed 2026-08-22)_
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

**Commit rule (owner, 22 Aug 2026): every sprint ends with a commit of that sprint's
work.** Commit message states the sprint id and what shipped, no em dashes (D8).
`CLAUDE.md` and `ENGINEERPROMPT.md` are never committed; they are gitignored.

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

## Stage 1.5 re-verification (22 Aug 2026, engineer session per engineerprompt.md)

Everything below was re-checked against live registries, vendor docs, or a running
Postgres, not trusted from the Stage 1 pack. Format: claim, verdict, one-line evidence.
Corrections that change a locked pin are ALSO recorded in AMENDMENTS.

### Toolchain already present on the machine (no install sprint needed)

- Node v24.12.0, pnpm 11.13.0, corepack 0.34.5: CONFIRMED (`node -v`, `pnpm -v`).
- cargo 1.97.1 / rustc 1.97.1 (Homebrew), Xcode CLT at `/Applications/Xcode.app/...`:
  CONFIRMED (`cargo -V`, `xcode-select -p`). Tauri needs rustc >= 1.77.2; satisfied.
- Supabase CLI 2.101.0, Vercel CLI 59.0.0, uv 0.12.4, git 2.50.1, Python 3.14.6:
  CONFIRMED (`--version` on each).
- Disk free: 51 GB on `/System/Volumes/Data` (`df -h`). The Stage 1 note that disk was
  the binding constraint at ~34 GB is STALE; the 2B base (4.45 GB) fits with room.
- `vercel whoami` returns `br9704`: the Vercel CLI IS authenticated.
- `supabase projects list` returns `Unauthorized`: the Supabase CLI is NOT logged in.
  Human action filed in MANUAL TASKS.
- The `plugin:supabase:supabase` and `figma` MCP servers both report
  "Needs authentication" (`claude mcp list`). Playwright MCP is NOT configured at all.
  All three filed in MANUAL TASKS.
- Repo `origin` is https://github.com/br9704/cissa-hackathon.git and the Stage 1 pack
  (prd/design/masterplan/claude/videoscript/docs) is still UNTRACKED. First S0 action
  is to commit it so the build has a baseline. (`git status --short`.)

### Citation integrity (D9 pre-check)

- Extracted all four committed PDFs with `pdftotext -layout` and diffed every citation
  code used in prd.md / masterplan.md / design.md / videoscript.md against the source
  lists inside the dossiers. 19 codes used, 91 defined, ZERO unresolved. Note the source
  lists render as `L6 · ...`, not `[L6]`, so a bracket-only grep gives a false negative;
  match on `^ *CODE ·` when re-checking. Evidence: scratch extraction 22 Aug 2026.

### Frontend and font pins

- CONFIRMED latest on npm today: `@tauri-apps/cli` 2.11.4, `@tauri-apps/api` 2.11.1,
  `@tauri-apps/plugin-global-shortcut` 2.3.2, `react` 19.2.8, `vite` 8.2.2,
  `@tanstack/react-router` 1.170.31, `@tanstack/react-query` 5.101.4,
  `@supabase/supabase-js` 2.112.3, `motion` 13.1.1, `cmdk` 1.1.1, `d3-force` 3.0.0,
  `opentimestamps` 0.4.9. Crates: `tauri` 2.11.5, `tauri-build` 2.6.3,
  `tauri-plugin-global-shortcut` 2.3.2 (crates.io API needs a User-Agent header).
- **CORRECTION (A1).** docs/scoping.md §C pinned a package literally named `geist-mono`
  at 5.2.8. That npm package is `geist-mono` 1.0.0, "Geist Mono font family for
  Expo/React Native", an UNRELATED package. The correct packages are
  `@fontsource-variable/geist` 5.3.0 and `@fontsource-variable/geist-mono` 5.3.0
  (both verified via `npm view`). The Stage 1 pin of `@fontsource-variable/geist` 5.2.9
  is also stale by one minor. See AMENDMENTS A1.
- CONFIRMED: `typescript` latest is 7.0.2. Treat with care; see S0 for the pin decision.

### Tauri 2.11 (verified against crate source, docs.rs, schema.tauri.app, and hive)

- `tray-icon` IS a core `tauri` crate feature in 2.11, auto-enabled only if an
  `app.trayIcon` block exists in tauri.conf.json. Building the tray purely in Rust with
  no config block does NOT auto-enable it: declare
  `tauri = { version = "2.11.5", features = ["tray-icon", "image-png"] }` explicitly.
  `image-png` is required for `Image::from_bytes` / `Image::from_path`.
  Evidence: tauri-v2.11.5 `crates/tauri/Cargo.toml` features block.
- **TRAP CONFIRMED AND WORSE THAN DOCUMENTED.** `pnpm tauri add global-shortcut` writes
  the capability `global-shortcut:default`, and that permission set is DELIBERATELY
  EMPTY. Plugin docs, verbatim: "No features are enabled by default, as we believe the
  shortcuts can be inherently dangerous". The three `global-shortcut:allow-register` /
  `-allow-unregister` / `-allow-is-registered` identifiers must be hand-added or every
  JS call fails silently. Evidence: plugins-workspace global-shortcut-v2.3.2
  permissions reference; tauri-cli 2.11.4 `crates/tauri-cli/src/add.rs:118-128`.
- All five core window identifiers exist verbatim: `core:window:allow-show`,
  `-allow-hide`, `-allow-set-focus`, `-allow-set-always-on-top`,
  `-allow-start-dragging`. `core:window:default` does NOT include the mutating ones.
  Evidence: `crates/tauri/permissions/window/autogenerated/reference.md`.
- The shortcut handler fires on BOTH `Pressed` and `Released` (ShortcutState is
  re-exported from `global_hotkey`): gate on Pressed or the action runs twice.
- `app.macOSPrivateApi: true` IS required for a transparent macOS window (exact key
  casing: capital OS, lowercase a). The `macos-private-api` Cargo feature is
  auto-enabled by tauri-build from that config flag. Evidence: schema.tauri.app/config/2
  `WindowConfig.transparent` description.
- **NEW, not in Stage 1:** `WindowConfig.focus` default flipped to `false` in 2.10.0
  (PR #14653). A quick-capture panel must call `set_focus()` explicitly after `show()`.
- **NEW:** use `tauri` crate 2.11.5, NOT 2.11.4. 2.11.4 pinned `time` to `<0.3.52` and
  can hit a `cookie`/`time` compile error (tauri#15615); 2.11.5 unpinned it.
- **NEW:** `isTauri()` from `@tauri-apps/api/core` is now the documented runtime check
  (`return !!(globalThis || window).isTauri`). `'__TAURI_INTERNALS__' in window` still
  works in 2.11 (both globals are injected unconditionally, `crates/tauri/src/manager/
  webview.rs:166`), but prefer `'isTauri' in window` for a zero-dependency check in the
  shared web bundle.
- CSP: `app.security.csp` object form. MUST retain `ipc:` and `http://ipc.localhost` in
  `connect-src` alongside the Supabase origins or Tauri's own IPC breaks. hive ships
  `"csp": null`, which is the documented fast path if CSP fights at 3am.
- Unsigned build: `bundle.macOS.signingIdentity: "-"` (codesign ad-hoc sentinel) OR
  `pnpm tauri build --no-sign`. Output path confirmed in `dmg/mod.rs:38-57`:
  `src-tauri/target/release/bundle/dmg/Continuity_0.1.0_aarch64.dmg`.
- hive `apps/desktop` has NO tray icon and NO global shortcut. It is a good reference
  for config layout, per-platform `tauri.{macos,linux,windows}.conf.json` overrides, and
  capability scoping, but it is NOT a reference for the two features S0 actually needs.
  Budget accordingly.

### Supabase (verified against docs and a live Postgres 17.11 scratch DB)

- Free tier CONFIRMED unchanged: 500 MB DB per active project, Realtime 200 concurrent
  peak / 2M messages per month, Edge Functions 500K/mo, 50,000 MAU, 2 active projects,
  "Free projects are paused after 1 week of inactivity". pgvector available.
- **The load-bearing GRANTs claim is EXACTLY RIGHT, including the date.** Supabase
  changelog 45329: the opt-in toggle appeared 2026-04-28 and became the DEFAULT for all
  new projects on 2026-05-30 (enforced on existing projects 2026-10-30). A project
  created today gets no implicit `anon`/`authenticated`/`service_role` grants on new
  tables; PostgREST returns 42501 "permission denied for table" and RLS policies alone
  will not fix it. `service_role` needs granting too, which will bite the seed script.
- **CORRECTION (A2): do not use pgcrypto `digest()`.** Empirically, with the normal
  search_path, `digest('hello','sha256')` raises "function digest(unknown, unknown) does
  not exist"; it needs `extensions.digest(...)`. Postgres 11+ ships a built-in
  `sha256(bytea)` in `pg_catalog` that needs no extension and survives a hardened
  `set search_path = ''`. Use
  `encode(sha256(convert_to(canonical_text,'UTF8')),'hex')`, verified byte-identical to
  the pgcrypto form. See AMENDMENTS A2.
- **NEW GOTCHA: TRUNCATE bypasses row-level triggers.** A row-level immutability trigger
  let `truncate events` through and emptied the table in testing. Add a statement-level
  `before truncate ... for each statement` trigger as well.
- **NEW GOTCHA: `set session_replication_role = replica` disables ALL triggers** and the
  `postgres` role on Supabase can set it. So DB-level immutability is tamper RESISTANCE,
  not tamper PROOF. The hash chain is the evidence. Say it that way in the pitch and the
  README; claiming the database cannot be edited would violate D9.
- `pg_advisory_xact_lock(integer, integer)` overload CONFIRMED to exist and `hashtext`
  returns int4, so the two-int form needs no cast. Multi-row INSERT tested: the BEFORE
  INSERT row trigger fires per row in order and each row sees the previous row of the
  same statement, so the chain comes out correct.
- **Isolation caveat:** the advisory lock only serializes correctly under READ COMMITTED
  (the PostgREST and local default, verified). Never put the ledger insert path in
  REPEATABLE READ or SERIALIZABLE.
- **NEW belt-and-braces guard, tested:** `alter table events add constraint
  events_no_fork unique (firm_id, prev_hash);` makes a chain fork impossible at the DB
  level and permits exactly one genesis row per firm.
- Sequence gaps are normal (a failed insert burns an id). Verification must walk rows
  ordered by id and never assume contiguity.
- jsonb determinism CONFIRMED, with a nuance that makes the SQL-verify decision
  MANDATORY rather than merely convenient: jsonb orders keys by LENGTH FIRST, then
  bytewise, not lexicographically (`'{"z":1,"aa":[1,2]}'::jsonb::text` renders
  `{"z": 1, "aa": [1, 2]}`), and it emits a space after each colon. No JS
  `JSON.stringify`-with-sorted-keys canonicalizer can reproduce that. Second nuance:
  jsonb preserves numeric formatting, so `1.0` and `1.00` hash differently while `1e2`
  normalizes to `100`; the client must not vary number formatting for logically
  identical payloads.
- Realtime respects RLS per subscriber (docs: "Realtime authorizes every event against
  each subscriber"). Setup confirmed: add table to `supabase_realtime` publication,
  `replica identity full`, enable RLS, and grant select. supabase-js subscription shape
  unchanged in 2.112.x. Minor flag: RLS is not applied to DELETE events, which is
  irrelevant to an append-only ledger but means no UI may depend on filtered deletes.
- pgvector: HNSW is the correct default ("HNSW should be your default choice"), and
  decisively so here because an HNSW index can be built on an EMPTY table while IVFFlat
  needs representative data first. **Gotcha:** the vector type must be schema-qualified
  in function signatures, `query_embedding extensions.vector(N)`. Order by the raw
  `<=>` distance ascending, not by a derived similarity, or the index is not used.
- Seeding: service role bypasses RLS (BYPASSRLS attribute) but NOT triggers (verified
  empirically) and NOT grants on a post-2026-05-30 project. So seeded rows DO get
  chained, which is what we want.
- **CORRECTION to the Stage 1 reseed plan:** you cannot truncate the ledger once the
  append-only triggers exist. Reset by `supabase db reset` locally, or write the seed to
  be idempotent. Never reach for `session_replication_role = replica` on the hosted
  project: it silently disables the chain trigger too, so rows inserted in that session
  get NULL hashes and permanently break verification.

### MLX tagger (verified against mlx-lm source, PyPI, HF, and the distillation repo)

- **The VLM scare is a NON-ISSUE and the lock stands.** `mlx-community/Qwen3.5-2B-MLX-bf16`
  is indeed a vision-language checkpoint (`Qwen3_5ForConditionalGeneration`,
  `image_token_id`, video preprocessor), but `mlx_lm.lora` trains it fine:
  `mlx_lm/models/qwen3_5.py` `Model.sanitize` DROPS the vision weights
  (`if key.startswith("vision_tower") or key.startswith("model.visual"): continue`) and
  `ModelArgs.from_dict` unwraps `text_config`. Proof on this machine: the distillation
  project's shipped 0.8400 macro-F1 result was trained with `mlx_lm.lora` on
  `mlx-community/Qwen3.5-4B-bf16`, which has the identical VLM profile. Repo sha for
  the 2B base today: `05ce45420036b812fe0be3f72cdc1fb62bae6891`; weights 4,426,559,145
  bytes. Every Qwen3.5 conversion is a VLM; there is no text-only Qwen3.5.
- **DO NOT "simplify" to `mlx-community/Qwen3.5-2B-bf16`** (no `-MLX-` infix). Identical
  config and weight size, but it is converted from `Qwen/Qwen3.5-2B-Base`, NOT the
  instruct model. The locked repo is the right one of the pair.
- **CORRECTION (A3): the Stage 1 lora config would have trained ~4 layers, not 16.**
  Qwen3.5 is hybrid with `full_attention_interval: 4`, so on the 2B (24 layers) only
  layers 3, 7, 11, 15, 19, 23 carry `self_attn.q_proj`. With
  `keys: ["self_attn.q_proj","self_attn.v_proj"]` and `num_layers: 16`, exactly 4 layers
  get adapters. Fix: OMIT `keys` entirely (mlx-lm then auto-discovers every Linear per
  layer, including the GatedDeltaNet `in_proj_qkv` / `in_proj_z` / `out_proj`) and set
  `num_layers: 0`, because `mlx_lm/tuner/utils.py:104` selects
  `model.layers[-max(num_layers, 0):]` so any value <= 0 selects ALL layers.
  See AMENDMENTS A3.
- **CORRECTION (A4): `enable_thinking=false` is MANDATORY at inference.** The Qwen3.5
  chat template's default branch opens an UNCLOSED `<think>` block; there is no
  `/no_think` token, the flag is the only lever. mlx-lm renders training examples from
  the full conversation, producing a CLOSED think block, so the fine-tune learns to
  answer immediately, and at inference without the flag the model reasons instead.
  Measured on this machine during the distillation project: 0/5 valid classes without
  the flag, 5/5 with it. The obvious reading, "the fine-tune failed", is completely
  wrong. Serve with `--chat-template-args '{"enable_thinking":false}'`; in Python pass
  `enable_thinking=False` to `apply_chat_template`. See AMENDMENTS A4.
- **CORRECTION (A5): checkpoint selection on the validation split was worth +8.0
  macro-F1 points** in the prior project (0.8400 at iter 800 versus 0.7599 at the
  default final iter 1200). mlx-lm ships the FINAL weights, so `save_every` must be low
  enough to have candidates and a `select_checkpoint` step must exist. Also: mlx-lm
  restarts the iteration counter on resume and does not checkpoint optimiser state, so
  a killed run is a full retrain, not a resume. See AMENDMENTS A5.
- Versions: mlx 0.32.1 and mlx-lm 0.31.3 are current on PyPI; mlx-lm 0.31.3 requires
  `transformers>=5.0.0`. mlx ships cp314 wheels so Python 3.14 is technically viable,
  but PIN 3.12 (`uv python pin 3.12`, `requires-python = ">=3.12,<3.13"`): that is the
  only combination with a shipped, measured result behind it.
- All `mlx_lm.lora` CLI flags in the Stage 1 recipe still exist, nothing renamed. Two
  useful additions since: `--grad-accumulation-steps` and `--report-to`.
- `mlx_lm.server --model <base> --adapter-path <dir> --port 8080` confirmed to expose
  OpenAI-shaped `/v1/chat/completions` and `/v1/completions`, applying adapters at load
  WITHOUT fusing. Per-request adapter override via an `"adapters"` body field.
- Fallback ladder confirmed: `mlx-community/Qwen3-1.7B-bf16` (~3.46 GB,
  `Qwen3ForCausalLM`, plain dense, no hybrid layers, no vision) is the zero-risk rung
  where `num_layers: 16` really does mean 16 layers.

### Anthropic API and demo safety

- `@anthropic-ai/sdk` 8.0.0-era check today returns 0.120.0 (`npm view`); zod peer range
  `^3.25.0 || ^4.0.0`.
- **Three parameter traps on current models.** Assistant PREFILL returns 400 on Opus 5 /
  Sonnet 5 / Fable 5 and the 4.6+ family. `thinking.budget_tokens` returns 400 on the
  same set: use `thinking: { type: "adaptive" }` plus `output_config: { effort: ... }`.
  And sampling params (`temperature`, `top_p`, `top_k`) are REMOVED on those models, so
  the Stage 1 assumption of `temperature: 0` for deterministic drafting is dead. Shape
  output with a strict schema instead.
- Structured output: use `client.messages.parse()` with `zodOutputFormat` from
  `@anthropic-ai/sdk/helpers/zod`, and guard `response.parsed_output` for null.
  Do NOT use the deprecated top-level `output_format`; it is `output_config.format`.
- **Incompatibility that shapes the route split:** `output_config.format` and document
  `citations: { enabled: true }` cannot be combined (400). Therefore the DRAFTING route
  is structured JSON, and the DEBRIEF/ASK route is streaming text with citations. Plan
  them as two different shapes from the start.
- A refusal arrives as HTTP 200 with `stop_reason: "refusal"`, not an exception. Check
  it before reading content.
- Prompt caching: minimum cacheable prefix is ~1024 tokens (shorter silently does not
  cache), max 4 breakpoints, default TTL 5 minutes. Verify with
  `usage.cache_read_input_tokens`. Silent invalidators to keep OUT of the cached prefix:
  any timestamp, any per-request id, unsorted JSON, a varying tool order.
- SDK default is `maxRetries: 2`; total wall clock is `timeout x (maxRetries + 1)`.
  For a live stage demo LOWER it (`maxRetries: 1, timeout: 20_000`; the TS timeout is
  MILLISECONDS while Python and Ruby take seconds).

### Design tokens: measured, and two values need changing

Computed full sRGB compositing of every ink tier over every glass surface over every
stop of `--bg-field`, per the hive readability-guardrail method.

- design.md's literal claim, "all body tiers clear 7:1 on --surface-hover", is TRUE for
  `--text` (17.6 to 18.0) and `--text-secondary` (7.10 to 7.18). The secondary margin is
  0.10, which is thin enough that any future token nudge silently breaks it.
- **`--text-secondary` at alpha 0.72 FAILS on `--surface-recessed` over the bottom stop
  of the field: 6.87:1.** A pane inside a pane is exactly where secondary text lives, so
  this will happen. Fix: alpha 0.74, which measures 7.37:1 worst case everywhere.
- **`--text-tertiary` at alpha 0.55 measures 3.91:1 worst case**, which clears neither
  AAA 7:1 nor even AA 4.5:1. Fix: alpha 0.62, which measures 4.89:1 worst case.
  (design.md's guardrail line only binds `--text` and `--text-secondary` to 7:1, so
  tertiary is not a broken promise, but 3.91 is a real accessibility defect.)
- For reference, on the worst-case body surface the alpha needed is 0.73 for 7:1,
  0.60 for 4.5:1, and 0.47 for 3:1.
- All four accents (`--accent` 5.90, `--accent-verified` 4.91, `--accent-risk` 4.60,
  `--accent-danger` 5.99, all worst case) clear AA 4.5:1 but not AAA 7:1. That is
  correct and expected for accents; just never set body copy in them.
See AMENDMENTS A6.

### pnpm 11 traps found in the hive reference (will bite a clean install)

- pnpm 11 reads `allowBuilds`, NOT the older `onlyBuiltDependencies`. With only the old
  key a CLEAN checkout fails fatally with `ERR_PNPM_IGNORED_BUILDS`, and an existing dev
  machine never sees it because the package is already built in node_modules. hive was
  broken this way for every fresh clone until 2026-08-07. Write `allowBuilds` from day
  one.
- pnpm 11 defaults to a `minimumReleaseAge` supply-chain guard that REJECTS any package
  published in the last 24 hours. Relevant here because several of our pins are recent.
  If an install fails on it, the exemption list takes BARE package names, not
  `name@version`: the resolver honours the versioned form but the separate lockfile
  supply-chain pass ignores it.
- `verifyDepsBeforeRun: false` is worth copying: pnpm re-runs install before every
  script and can re-raise a resolved error.

### Playwright

- Playwright MCP is NOT configured in this session (`claude mcp list`). Package is
  `@playwright/mcp` 0.0.79; add with
  `claude mcp add --scope project playwright -- npx @playwright/mcp@latest`
  (optionally `--output-dir docs/shots --viewport-size 1440,900`).
- MCP tool names: `browser_navigate`, `browser_resize`, `browser_take_screenshot`
  (relative `filename`), `browser_snapshot`, `browser_press_key`, `browser_evaluate`,
  `browser_console_messages`.
- **The MCP server has NO reduced-motion toggle tool.** The reduced-motion half of the
  design.md §7 checklist MUST go through a scripted Playwright path
  (`browser.newContext({ reducedMotion: 'reduce' })` or
  `page.emulateMedia({ reducedMotion: 'reduce' })`), not through MCP. Direct
  `playwright` and `@playwright/test` are both 1.62.1 today.

### Frontend, Vite 8, and Vercel (verified against published tarballs and vendor docs)

- Vite 8.2.2 engines `^20.19.0 || >=22.12.0`; `@vitejs/plugin-react` 6.1.0 has
  `peerDependencies: { vite: "^8.0.0" }` so it REQUIRES Vite 8 and will not install
  against 7. All its other peers are optional, so `pnpm add -D @vitejs/plugin-react`
  alone is enough. (Minor correction: the "needs Node >= 22" line is wrong, 20.19+ works.
  Irrelevant on Node 24 but do not write it as a rule.)
- **CORRECTION (A7): Vite 8 uses Rolldown, so the config key is
  `build.rolldownOptions`, NOT `build.rollupOptions`.** Oxc replaces esbuild for JS
  minification and Lightning CSS for CSS. Browser targets rise to Chrome 111 / Safari
  16.4. `base` still defaults to `/`, `outDir` to `dist`, `envPrefix` to `VITE_`.
  CSS Modules work with zero config on any `*.module.css`. See AMENDMENTS A7.
- **CORRECTION (A8): pin `typescript` 5.9.3, NOT the 7.0.2 that `npm view` reports as
  latest.** TS 7 is the Go port and is GA, but it has no stable programmatic API until
  7.1, which means `typescript-eslint` cannot use it, and it inherits every TS 6 removal
  (`baseUrl` gone, `moduleResolution: node10` gone, `target: es5` gone,
  `esModuleInterop: false` no longer allowed). Vite does not typecheck anyway, so the TS
  version only affects `tsc --noEmit` and the editor: there is no upside to 7 here and a
  whole class of unknown-unknowns as downside. See AMENDMENTS A8.
- **CORRECTION (A9): the `/api` directory must live at `apps/web/api/`, not the repo
  root.** Once Vercel Root Directory is `apps/web`, a repo-root `api/` is invisible.
  `apps/web/vercel.json` likewise. Set Root Directory `apps/web` AND tick "Include files
  outside the Root Directory" so the workspace `pnpm-lock.yaml` / `pnpm-workspace.yaml`
  are present. See AMENDMENTS A9.
- **HARD CONSTRAINT, plan for it now: `api/*.ts` cannot use tsconfig `paths` or project
  references** (Vercel Node.js runtime docs: "Most options are supported aside from Path
  Mappings and Project References"). So NO `@continuity/core` alias inside `api/`. Use
  relative imports up into the package, or duplicate the few pure functions a route
  needs. This bites at hour 40 if not planned at hour 2.
- `/api/*.ts` DOES auto-deploy alongside a Vite build with no extra config, and the
  recommended signature is the Web handler `export async function POST(request: Request)`
  rather than the legacy `(req, res)` + `@vercel/node`. Ignore the Vite framework page's
  Nitro suggestion: that is about SSR, not about `/api` availability. Do not add Nitro.
- Vercel route order is redirects, then filesystem (static + functions), then rewrites,
  so a function is matched BEFORE the SPA catch-all. The `(?!api/)` negative lookahead is
  therefore belt-and-braces rather than required. Keep it: it costs nothing and states
  the intent.
- **CORS for the desktop shell:** Tauri v2 sends `Origin: tauri://localhost` on macOS
  and `http://tauri.localhost` on Windows/Linux. `Access-Control-Allow-Origin` cannot be
  a list, so either echo the origin or use `*` (these routes carry a bearer JWT, not
  cookies, so `*` is acceptable; never combine `*` with `Allow-Credentials: true`).
  Two things the Stage 1 recipe missed: set `Vary: Origin` or the CDN can serve one
  origin's response to another, and **export `OPTIONS` from each function**, because
  vercel.json `headers` do not reliably answer preflight on a path that resolves to a
  function.
- Env rules confirmed: `VITE_*` is inlined into the client bundle at build time and is
  PUBLIC; unprefixed vars are readable only via `process.env` inside `api/`.
- **CORRECTION (A10): the "mixing framer-motion and motion breaks contexts" rule is
  wrong as stated.** `motion/react` literally re-exports `framer-motion` at the same
  version (`motion` depends on `framer-motion: ^13.1.1`), so they share a module
  instance. The real failure mode is pnpm resolving TWO DIFFERENT framer-motion
  versions. Correct rule to enforce: import only from `motion/react`, and never add
  `framer-motion` to package.json, so the lockfile holds exactly one resolution. The
  eslint no-restricted-imports guard is still worth keeping, for that reason.
  See AMENDMENTS A10.
- motion 13 API confirmed present: `layoutId`, `useReducedMotion()`, `motion.path` with
  `pathLength`, and `{ type: 'spring', stiffness, damping }`. v13's only breaking change
  is the removal of the optional `@emotion/is-prop-valid` dep. Two older ones still
  matter: v12 moved the target element to the FIRST argument of gesture start callbacks,
  and v11.17 removed `exitBeforeEnter` from AnimatePresence (use `mode="wait"`).
- **CORRECTION (A11): the font-family names design.md declares do not exist.**
  `@fontsource-variable/geist` registers the family `'Geist Variable'` and
  `@fontsource-variable/geist-mono` registers `'Geist Mono Variable'` (verified in each
  package's `index.css` `@font-face`). design.md §2 declares `"Geist"` and
  `"Geist Mono"`, which would silently fall through to the system fallback and nobody
  would notice until the S9 screenshots. Both faces are `font-weight: 100 900;
  font-display: swap;` so no per-weight imports are needed. Import the CSS FIRST in
  main.tsx. See AMENDMENTS A11.
- TanStack Router: `createHashHistory` and `createBrowserHistory` are both re-exported
  from `@tanstack/react-router` (it pins `@tanstack/history` as a direct dep), so
  `@tanstack/history` does not go in package.json. Signature
  `createHashHistory(opts?: { window?: any }): RouterHistory`.
- **d3-force determinism CONFIRMED at source level.** `src/lcg.js` is a fixed-seed LCG
  with the seed hardcoded to 1 and no `Math.random()`; initial placement is phyllotaxis
  keyed on `node.index = i`; `.tick(n)` is a pure synchronous loop. So
  `forceSimulation(nodes).force(...).stop(); sim.tick(300)` yields byte-identical
  coordinates across runs and machines. Four caveats to obey:
  (1) **node ARRAY ORDER is effectively the seed**, so sort nodes by id before building
  the simulation or the layout changes whenever query order changes;
  (2) d3 mutates `x/y/vx/vy` in place, so feed fresh objects each run;
  (3) the LCG state is shared and stateful across forces, so configure every `.force()`
  up front and only then tick;
  (4) never set `fx/fy` from anything non-deterministic.
- cmdk 1.1.1 supports React 19; `Command.Dialog` accepts `shouldFilter` and spreads
  Radix dialog props. With `shouldFilter={false}` you own filtering, and every `Item`
  still needs a stable unique `value` because cmdk uses it for selection identity.
  cmdk pulls in `@radix-ui/react-dialog` as its only transitive UI dependency.
- **backdrop-filter: the `-webkit-` prefix is still required.** Unprefixed reached
  Baseline only in Safari 18.0, and Tauri uses the OS WKWebView, so a judge on Ventura
  or Sonoma gets no blur without it. Emit prefix first, then unprefixed, and ship an
  `@supports not (...)` fallback to an opaque surface. **WebKit regression to design
  around: `backdrop-filter` that references a CSS custom property fails on macOS Sonoma
  under Safari 18.x (webkit bug 297620), so write the blur LITERAL, never
  `blur(var(--blur))`.** Also drop blur under `prefers-reduced-transparency` and in the
  print stylesheet.
- **`window.print()` in macOS WKWebView is confirmed unreliable** (blank or empty PDF
  despite a correct page count: tauri#5612, wry#707, Apple Developer Forums 78354). There
  is still NO official Tauri print plugin (plugins-workspace#293 is an open feature
  request). The `@tauri-apps/plugin-opener` 2.5.4 workaround is correct: open the print
  route in the system browser (`opener:allow-open-url` in capabilities), and keep
  `window.print()` for the web build.

### OpenTimestamps (installed and exercised end to end on Node 24.12.0)

- `opentimestamps` 0.4.9 CONFIRMED as the renamed `javascript-opentimestamps` (same
  maintainer `eternitywall`, same official OTS-org repo, LGPL-3.0, ~4,000 weekly
  downloads). Published 2021-01-29 and stale, but the protocol is frozen. KEEP THE PIN.
- Typosquat picture is more nuanced than Stage 1 recorded. `opentimestamp` (singular) is
  a genuine but unrelated independent implementation, not malware. The dangerous one is
  **`opentimestamps-javascript` (reversed word order)**: 0 weekly downloads, forged
  `author: "EternityWall"`, and a `repository` field pointing at the official OTS repo it
  does not control. Pin exactly and never fuzzy-match the name.
- `npm audit` reports 2 critical + 8 moderate, all transitive through the abandoned
  `request` / `request-promise`. Unfixable without forking. The SSRF vector is NOT
  reachable here because calendar URLs are hardcoded in `src/calendar.js`
  (`DEFAULT_AGGREGATORS`) and never user-supplied. Note this in the README rather than
  hide it (D9).
- Every pinned signature CONFIRMED at runtime: `DetachedTimestampFile.fromHash`,
  `stamp`, `serializeToBytes`, `upgrade`, `verify`. `fromHash` accepts a Node `Buffer`
  (Buffer subclasses Uint8Array). `stamp` returns `Promise<void>` and MUTATES the
  detached object in place; `upgrade` returns `Promise<boolean>` (false = nothing
  changed) and also mutates in place.
- `{ ignoreBitcoinNode: true }` is a REAL option, confirmed in source at
  `src/open-timestamps.js:323`. Without it the library tries to read a local
  `bitcoin.conf` and reach a bitcoind. With it, verification goes to Esplora at
  `https://blockstream.info/api`. We have no node, so ALWAYS pass it.
- **ESM TRAP that TypeScript will not catch.** The package is CJS only, and its `main`
  field points at a file that does not exist (harmless `DEP0128` warning on every
  require). `import { DetachedTimestampFile } from 'opentimestamps'` TYPECHECKS and then
  throws `SyntaxError: Named export not found` at runtime, because under real Node ESM
  the namespace is only `['default','module.exports']`. Required form:
  `import OTS from 'opentimestamps'; const { DetachedTimestampFile, Ops } = OTS;`
  Put that in the code with a comment, not in a doc nobody reads.
- Add `@types/opentimestamps` 0.4.0 (DefinitelyTyped, correctly types
  `VerifyOptions.ignoreBitcoinNode`). The package ships no types itself.
- The library `console.log`s "Submitting to remote calendar ..." unconditionally and it
  is not configurable. Monkeypatch `console.log` around the call if it pollutes demo
  output.
- **MEASURED, useful for the UI:** 4 calendars with m=2 takes ~1,918 ms and yields a
  700-840 byte receipt; 1 calendar with m=1 takes ~999 ms and yields 256 bytes. Budget
  ~2s per stamp and ~1 KB per stored receipt.
- **CRITICAL RENDERING TRAP:** `verify()` on a fully pending receipt RESOLVES with `{}`,
  it does not reject. Treating a resolved promise as success would render a pending
  receipt as Bitcoin-confirmed, which is precisely the D9 violation we cannot afford.
  Empty object MUST mean PENDING in the UI.
- **Timeline reality check for the pitch.** The official client README says "It takes a
  few hours for the timestamp to get confirmed by the Bitcoin blockchain". Live demo
  stamps WILL be pending. The honest phrasing is "submitted to N calendars, Bitcoin
  confirmation pending"; only a pre-stamped, already-upgraded fixture may be described
  as anchored. This makes the S7 "stamp a head on day one" instruction load-bearing,
  not optional.

### Embeddings: the dimension fork can be removed entirely

- Anthropic first-party embeddings CONFIRMED absent; the docs point at Voyage AI, whose
  Voyage 4 family offers 1024/256/512/2048 and so has NO 384 option.
- OpenAI `text-embedding-3-small` CONFIRMED current (no `text-embedding-4-*` exists),
  1536 default, 8192 max input tokens, $0.02 per 1M tokens. The `dimensions` parameter
  exists on `text-embedding-3` and later and 384 is inside its legal range; OpenAI's own
  guidance is that using `dimensions` at creation time is the suggested approach
  (Matryoshka representation).
- **CORRECTION (A12): use `@huggingface/transformers` 4.2.0, NOT `@xenova/transformers`.**
  `@xenova/transformers` last published 2024-05-29 and is abandoned; the project moved
  to `huggingface/transformers.js`. The Stage 1 note also said "v3", but current is
  **v4.2.0**, which replaced `quantized: true` with `dtype`, so every v2-era snippet
  copied from a model card will be wrong. Verified by installing 4.2.0 and running
  `Supabase/gte-small`: 384 dims, L2 norm 1.000000, 32 MB quantized ONNX on disk.
  See AMENDMENTS A12.
- **CORRECTION (A13), and this one removes a whole fork: lock 384 dimensions on EVERY
  path.** `vector(n)` is fixed width, so as Stage 1 specified it (OpenAI 1536 primary,
  local 384 fallback) the two paths could never share a column: it would have forced two
  columns, two indexes, and a query-time branch. Requesting `dimensions: 384` from
  OpenAI makes both paths 384 and the pgvector column never changes.
  See AMENDMENTS A13.
- **The trap the dimension fix does NOT solve, and the likeliest way to quietly ruin the
  ask bar:** OpenAI-at-384 and gte-small-at-384 are DIFFERENT VECTOR SPACES. A row
  embedded locally and queried through OpenAI returns meaningless cosine scores while
  succeeding silently, with no error. Therefore `decisions` needs an `embedding_model`
  column, retrieval MUST filter on it, and vectors from different providers are never
  compared. Add the column in the same migration as the vector column.
- **D9 note:** OpenAI publishes no MTEB figure for `3-small` at 384 dims. The only
  published shortening claim concerns the LARGE model. Do not put a quality number on
  384-dim embeddings in the UI or pitch. If a number is wanted, benchmark it on our own
  synthetic corpus and commit the result file.
- pgvector indexes up to 2,000 dims for the standard `vector` type, so 384 is not just
  legal but roughly 4x smaller and faster than 1536.
- One claim in this section is DOCUMENTED BUT NOT EXECUTED (no OpenAI key in the
  environment): that the API actually returns 384 when asked. First S1 task is a
  one-call smoke test asserting `data[0].embedding.length === 384`. `openai` npm is at
  7.5.0.
- Local fallback on Vercel: functions cap at 250 MB uncompressed. Local `node_modules`
  measured 414 MB, of which `onnxruntime-node` is 210 MB and `onnxruntime-web` 130 MB.
  File tracing ships linux only, so the realistic traced size is ~60-90 MB, but if
  tracing misfires and pulls the win32/darwin binaries you blow the limit. Set
  `env.cacheDir = '/tmp/hf-cache'` (the default cache sits inside read-only
  node_modules) and prune non-linux onnxruntime from the trace. Safest: commit the ONNX
  + tokenizer and set `env.allowRemoteModels = false`.

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

# STAGE 1.5 (closed): Orientation, verification, and expansion

Run per `ENGINEERPROMPT.md`. No product code written in this stage. Every load-bearing
claim in the Stage 1 pack was re-checked against live registries, vendor source, a
running Postgres, an actual npm install, and the two read-only reference projects.

Delivered: the "Stage 1.5 re-verification" section above (toolchain, citation integrity,
frontend pins, Tauri 2.11, Supabase, MLX tagger, Anthropic API, design tokens, pnpm 11,
Playwright, OpenTimestamps, embeddings); sixteen AMENDMENTS, thirteen of them corrections
to recipes the build would otherwise have followed into a wall; command-level expansion
of all twelve sprints; design.md amended with an Apple material layer and two measured
token fixes; `docs/stage1.5-notes.md`; MANUAL TASKS reconciled against the real machine;
OPEN QUESTIONS resolved with documented defaults.

The three findings most likely to have cost the build a whole session:
the LoRA config that would have adapted four layers instead of all of them (A3);
`enable_thinking` (A4), whose failure mode reads exactly like a failed fine-tune; and
the font package that was an unrelated React Native project (A1).

**Sprint log:** Logged: 2026-08-22T17:53+10:00 · status: done · actual: ~2.5h (budget n/a, Stage 1.5) ·
by: Claude Opus 5 (Claude Code) · note: verification and expansion delivered; owner then
directed the same session to proceed into the Stage 2 build rather than hand off.

---

# STAGE 2: The build (Sat 22 Aug pm to Sun 23 Aug, ~30 working hours)

Budgets are aggressive on purpose; log actuals honestly. Order is dependency order;
S6 (tagger) runs in parallel on the owner's machine from Sat evening.

## S0 — Foundation (budget 1.5h)

- [x] pnpm monorepo per prd §4.7: `apps/desktop`, `apps/web`, `packages/core`,
      `packages/cli`, `ml`, `supabase`, `docs`, `assets`.
- [x] Vite React TS app boots; `tokens.css` from design.md §2 wired; Geist self-hosted;
      grep-guard script: no hex literals outside tokens.css (add to `pnpm check`).
- [x] Tauri 2 shell wraps the dev server; menu-bar (tray) icon (placeholder template
      glyph for now); global
      shortcut registers and opens a placeholder window. Crib config from hive
      `apps/desktop`. FALLBACK if tray/shortcut fights: ship windowed app, move
      quick-capture into the main window (Cmd+K mode), log deferral.
- [~] Supabase project linked; env plumbing (`.env.local`, never committed); typegen.
      BLOCKED on the human: `supabase projects list` returns Unauthorized and this
      machine has no Docker, so `supabase start` is unavailable too. Worked around by
      developing the schema against the local Homebrew PostgreSQL 17.11 (see S1).
- [x] Verify-list from Verified facts checked off with one-line evidence each.
**Expanded steps (Stage 1.5). Run in this order; each is a checkpoint.**

- [x] S0.0 Commit the Stage 1 pack FIRST so there is a baseline to diff against:
      `git add -A && git commit -m "Stage 1 pack: prd, design, masterplan, dossiers"`.
      **`CLAUDE.md` and `ENGINEERPROMPT.md` are NEVER committed** (owner rule,
      22 Aug 2026); both are already in `.gitignore`, so `git add -A` is safe, but check
      `git status` before every commit rather than trusting that.
      The pack is currently untracked. Remote is already
      `https://github.com/br9704/cissa-hackathon.git`; `vercel whoami` already returns
      `br9704`. Delete the placeholder `src/.gitkeep` when `apps/` lands.
- [x] S0.1 Workspace. `pnpm-workspace.yaml` at root:
      `packages: ["apps/*", "packages/*"]`. **Write `allowBuilds`, not
      `onlyBuiltDependencies`**: pnpm 11 reads only the former and a clean checkout dies
      with `ERR_PNPM_IGNORED_BUILDS` while an existing dev machine never sees it (this
      exact bug sat in hive for months). Also set `verifyDepsBeforeRun: false`.
      ```yaml
      packages: ["apps/*", "packages/*"]
      linkWorkspacePackages: true
      verifyDepsBeforeRun: false
      allowBuilds:
        esbuild: true
      ```
      If an install fails on pnpm 11's `minimumReleaseAge` supply-chain guard, the
      exemption list takes BARE package names, never `name@version`.
- [x] S0.2 Directories per prd §4.7: `apps/web`, `apps/desktop`, `packages/core`,
      `packages/cli`, `ml`, `supabase`, `docs`, `assets`. NOTE the Vercel constraint
      from A9: server routes live at **`apps/web/api/`**, not repo root.
- [x] S0.3 `apps/web`: `pnpm create vite@latest . --template react-ts`, then pin
      exactly. `typescript` is **5.9.3**, NOT the 7.0.2 npm reports as latest (A8).
      ```
      pnpm add react@19.2.8 react-dom@19.2.8 @tanstack/react-router@1.170.31 \
        @tanstack/react-query@5.101.4 @supabase/supabase-js@2.112.3 motion@13.1.1 \
        cmdk@1.1.1 d3-force@3.0.0 @fontsource-variable/geist@5.3.0 \
        @fontsource-variable/geist-mono@5.3.0
      pnpm add -D vite@8.2.2 @vitejs/plugin-react@6.1.0 typescript@5.9.3 \
        @types/react @types/react-dom @types/d3-force vitest
      ```
      Do NOT add `framer-motion` to package.json (A10): `motion/react` re-exports it, and
      the real failure is two resolutions in the lockfile, not two names.
      If any Vite config in a doc says `build.rollupOptions`, it is `rolldownOptions`
      in Vite 8 (A7).
- [x] S0.4 `apps/web/src/styles/tokens.css` from design.md §2, WITH the three Stage 1.5
      corrections applied (see AMENDMENTS A6 and A11):
      `--font-sans: "Geist Variable", ...` and `--font-mono: "Geist Mono Variable", ...`
      (the bare names "Geist"/"Geist Mono" do not exist and fall silently through to the
      system font); `--text-secondary` alpha 0.72 to **0.74**; `--text-tertiary` alpha
      0.55 to **0.62**. Import the two font CSS files FIRST in `main.tsx`:
      `import '@fontsource-variable/geist'` then
      `import '@fontsource-variable/geist-mono'`.
- [x] S0.5 Guardrails, all wired into one `pnpm check` script. Three of them, ported
      from hive (`apps/web/lib/css-tokens.test.ts`, `readability-guardrails.test.ts`):
      (a) **hex grep-guard**:
      `grep -rnE '#[0-9a-fA-F]{3,8}\b' apps/web/src --include='*.css' --include='*.tsx' | grep -v tokens.css && exit 1 || exit 0`
      (b) **undefined-custom-property guard**: scan for bare `var(--x)` with no matching
      `--x:` declaration. Two rules that hive paid for with false results: a declaration
      is never preceded by a word character (BEM `--live` in a selector is not a
      declaration), and `var(--x, fallback)` is never a fault.
      (c) **readability guardrail test**: recompute contrast from tokens.css in vitest
      and assert `--text` and `--text-secondary` >= 7:1 and `--text-tertiary` >= 4.5:1
      against the WORST body surface, which is `--surface-recessed` composited over the
      bottom stop of `--bg-field`, NOT `--surface-hover`. Getting the worst case wrong is
      how design.md's own claim came to be technically true and practically misleading.
- [x] S0.6 Tauri shell. `cd apps/desktop && pnpm add -D @tauri-apps/cli@2.11.4 &&
      pnpm add @tauri-apps/api@2.11.1 && npx tauri init`. Cargo:
      `tauri = { version = "2.11.5", features = ["tray-icon", "image-png"] }` and
      `tauri-build = "2.6.3"`. **Use 2.11.5, not 2.11.4** (2.11.4 pinned `time` and can
      hit a cookie/time compile error, tauri#15615). Crib config layout and the
      per-platform `tauri.macos.conf.json` override from `~/Desktop/hive/apps/desktop`,
      but note hive has NO tray and NO global shortcut, so those two are built fresh.
- [x] S0.7 Global shortcut: `pnpm tauri add global-shortcut`, then **hand-edit
      `src-tauri/capabilities/default.json`**, because the `global-shortcut:default`
      permission the CLI writes is DELIBERATELY EMPTY and every JS call fails silently
      against it. Full file:
      ```json
      { "$schema": "../gen/schemas/desktop-schema.json",
        "identifier": "default",
        "windows": ["main", "quickcapture"],
        "permissions": ["core:default",
          "core:window:allow-show", "core:window:allow-hide",
          "core:window:allow-set-focus", "core:window:allow-set-always-on-top",
          "core:window:allow-start-dragging",
          "global-shortcut:allow-register", "global-shortcut:allow-unregister",
          "global-shortcut:allow-is-registered",
          "opener:allow-open-url"] }
      ```
      The `$schema` path does not exist until the first build; that is expected.
      Gate the handler on `event.state === 'Pressed'` or the action fires twice.
- [x] S0.8 Quick-capture window and tray. Static window entry in `tauri.conf.json`
      `app.windows[]` with `transparent: true`, `decorations: false`,
      `alwaysOnTop: true`, `visible: false`, `skipTaskbar: true`, plus
      `"app": { "macOSPrivateApi": true }` (exact casing) or the transparent window
      renders black. **Call `set_focus()` explicitly after `show()`**: `WindowConfig.focus`
      defaulted to false from Tauri 2.10.0. Tray in `.setup()` with
      `.icon_as_template(true)` and, for a menu-bar app,
      `app.set_activation_policy(ActivationPolicy::Accessory)` under
      `#[cfg(target_os = "macos")]` (the `App` form returns `()`, the `AppHandle` form
      returns `Result`). Tray PNG: monochrome black with alpha, ~44x44 @2x, in
      `src-tauri/icons/tray.png`.
- [x] S0.9 CSP in `tauri.conf.json` `app.security.csp`, object form. **Keep `ipc:` and
      `http://ipc.localhost` in `connect-src`** alongside
      `https://<ref>.supabase.co wss://<ref>.supabase.co`, or Tauri's own IPC breaks.
      Documented fast path if CSP fights at 3am: hive ships `"csp": null`.
- [x] S0.10 Shell detection helper in `apps/web/src/lib/shell.ts`. Prefer
      `'isTauri' in window` (the documented contract from api 2.4.2; both `isTauri` and
      `__TAURI_INTERNALS__` are injected unconditionally) and guard every Tauri import
      behind it so the Vercel bundle never pulls the desktop API.
- [x] S0.11 Router: `createHashHistory()` inside Tauri (the custom protocol has no
      rewrites), `createBrowserHistory()` on the web. Both are re-exported from
      `@tanstack/react-router`; do not add `@tanstack/history`.
- [~] S0.12 Supabase project linked; `.env.local` (gitignored) with `VITE_SUPABASE_URL`
      and `VITE_SUPABASE_ANON_KEY`. **Anything `VITE_`-prefixed is baked into the client
      bundle and is public**: the service-role key, the Anthropic key and the OpenAI key
      are UNPREFIXED and only ever read from `process.env` inside `apps/web/api/`.
      Typegen: `supabase gen types typescript --linked > packages/core/src/db.types.ts`.
      BLOCKED until the human logs the Supabase CLI in (MANUAL TASKS).
- [x] S0.13 Add Playwright MCP now so S9 is not a scramble:
      `claude mcp add --scope project playwright -- npx @playwright/mcp@latest`.
      Also `pnpm add -D playwright@1.62.1 tsx && npx playwright install chromium` for
      the scripted path, because the MCP server has NO reduced-motion toggle and that
      half of the design.md §7 checklist can only run from a script.
- **FALLBACK if tray/shortcut fight (unchanged, D-gated):** ship windowed, move
  quick-capture into the main window as a Cmd+K mode, log the deferral. Ladder:
  shortcut dies -> tray click opens quickcapture; tray dies -> shortcut + Dock icon;
  both die -> in-window mode.
- **Acceptance:** `pnpm dev` = web app on localhost; `pnpm tauri dev` = same UI in
  desktop shell with tray icon; empty ledger page renders on tokens; grep-guard passes.
- **Sprint log:** Logged: 2026-08-22T18:12+10:00 · status: done · actual: ~1.4h (budget 1.5h) ·
  by: Claude Opus 5 (Claude Code) · note: monorepo, Vite/React/TS app on tokens, both
  token guards plus a measured contrast test, six routes with empty states, Tauri 2
  shell with tray icon and Cmd+Shift+Space quick capture, screenshot harness. Supabase
  link deferred to S8, no credentials and no Docker on this machine; schema work moved
  to a local Postgres 17.11 instead.

## S1 — The schema and the chain (budget 1h)

- [x] Migrations for every table in prd §4.2, RLS by firm, roles as member claim.
- [x] Append-only enforcement per docs/scoping.md §B1: explicit GRANTs, revoke +
      forbid_mutation trigger, chain trigger with per-firm advisory lock and hand-built
      canonical text. Chain VERIFY is a SQL function (`verify_chain(firm_id)`); the
      verify page calls it and animates its result; `packages/core` tests call it via
      RPC against seeded data plus a deliberately forked copy (do NOT reimplement jsonb
      canonicalization in TS).
- [x] Synthetic corpus generator (`packages/core/seed`): Meridian Basis Partners, 5
      personas, 4 strategies, ~400 artifacts, ~180 decisions with genealogy links,
      ~2,200 labelled decision records exported to `ml/data/` for S6, 6 debrief
      sessions, questions feed, and 4 speaker-tagged meeting transcripts (two desk
      standups, one strategy review, one risk meeting) as `meeting_transcript`
      artifacts that decisions and debriefs cite (D11). Deterministic seed so demos
      reproduce.
- [~] Seed applied to hosted Supabase; typegen committed.
      Applied to a LOCAL PostgreSQL 17.11 instead and verified there. The hosted half
      is blocked on the Supabase CLI login (MANUAL TASKS) and this machine has no
      Docker, so `supabase start` was not an option either. Carried into S8.
**Expanded steps (Stage 1.5).**

- [x] S1.0 Migration order matters. `0001_core.sql` (firms, members, strategies,
      artifacts), `0002_events.sql` (ledger + triggers), `0003_projections.sql`
      (decisions, decision_links, debrief_*, questions, knowledge_scores,
      anchor_receipts, handover_packs), `0004_vector.sql`, `0005_grants_rls.sql`.
- [x] S1.1 **GRANTs are not optional on a project created today.** The Supabase default
      flipped on 2026-05-30: new tables get NO implicit `anon` / `authenticated` /
      `service_role` access, and the symptom is PostgREST 42501 "permission denied for
      table" WITH correct RLS policies in place. Every table needs explicit grants, and
      `service_role` needs them too or the seed script fails. Write them into
      `0005_grants_rls.sql` so the repo is self-describing rather than relying on a
      dashboard toggle.
- [x] S1.2 **Hash the chain with the built-in `sha256()`, not pgcrypto `digest()`**
      (A2). Unqualified `digest()` raises "function digest(unknown, unknown) does not
      exist" under the normal search_path; `sha256(bytea)` lives in `pg_catalog`, needs
      no extension, and survives a hardened `set search_path = ''`. Canonical form,
      verified byte-identical to the pgcrypto version:
      `encode(sha256(convert_to(canonical_text,'UTF8')),'hex')`.
- [x] S1.3 Chain trigger. BEFORE INSERT, per row. Take
      `pg_advisory_xact_lock(hashtext('events_chain'), hashtext(new.firm_id::text))`
      (the two-int overload exists and `hashtext` returns int4, so no cast). Read prev by
      `order by id desc limit 1`. Build canonical text BY HAND, never by re-serializing
      in JS. Multi-row INSERT is safe: the row trigger fires in order and each row sees
      the previous row of the same statement (tested).
      **Never set the ledger insert path to REPEATABLE READ or SERIALIZABLE**: the
      advisory lock only serializes correctly under READ COMMITTED, which is the
      PostgREST default.
- [x] S1.4 Immutability, three layers, because the row trigger alone is not enough:
      (a) never grant update/delete (on a post-May-2026 project the `revoke` is a no-op
      because the grant never existed; keep it as documentation);
      (b) BEFORE UPDATE OR DELETE row trigger raising;
      (c) **BEFORE TRUNCATE ... FOR EACH STATEMENT trigger**, because TRUNCATE bypasses
      row-level triggers entirely and emptied the table in testing.
      Plus the tested structural guard:
      `alter table events add constraint events_no_fork unique (firm_id, prev_hash);`
      which makes a fork impossible at the DB level and permits exactly one genesis row
      per firm.
- [x] S1.5 **Write the honest limitation down now, in `packages/core` and the README:**
      `set session_replication_role = replica` disables ALL triggers and the `postgres`
      role can set it. So the database layer is tamper RESISTANCE; the hash chain is the
      tamper EVIDENCE. Claiming the rows cannot be edited would breach D9.
- [x] S1.6 `verify_chain(firm_id)` as a SQL function, and this is now MANDATORY rather
      than merely convenient: jsonb orders keys by LENGTH FIRST then bytewise (so
      `{"z":1,"aa":[1,2]}` renders `z` before `aa`) and emits a space after each colon.
      No JS canonicalizer reproduces that. Also: jsonb preserves numeric formatting, so
      `1.0` and `1.00` hash differently while `1e2` normalizes to `100`; the client must
      not vary number formatting for logically identical payloads. And sequence gaps are
      normal, so verification walks rows ordered by id and never assumes contiguity.
      `packages/core` tests call the function over RPC against seeded data plus a
      deliberately forked copy.
- [x] S1.7 Vector column: **`vector(384)` on every path** (A13). Add an
      **`embedding_model` column in the same migration** and filter on it at retrieval:
      OpenAI-at-384 and gte-small-at-384 are different vector spaces and comparing them
      returns meaningless cosine scores while succeeding silently. Index:
      `create index on decisions using hnsw (embedding vector_cosine_ops);` (HNSW because
      it can be built on an EMPTY table; IVFFlat needs representative data first). In the
      `match_decisions` RPC, **schema-qualify the type** (`query_embedding
      extensions.vector(384)`) and order by the raw `<=>` distance ascending, not by a
      derived similarity, or the index is not used.
- [x] S1.8 One-call smoke test before anything is embedded in bulk: assert OpenAI
      returns exactly 384 when asked (`dimensions: 384`). This is the single claim in the
      Stage 1.5 verification that is documented but was not executed.
- [x] S1.9 Seed via `packages/core/seed` run with `npx tsx` and the service-role key.
      Service role bypasses RLS but NOT triggers (verified) and NOT grants, so seeded
      rows do get chained, which is what we want. Insert events sequentially.
      **Reseed plan changed (Stage 1.5): you cannot truncate the ledger once the
      triggers exist.** Locally use `supabase db reset`. On the hosted project, make the
      seed idempotent. NEVER use `session_replication_role = replica` to force a wipe on
      the hosted project: it disables the chain trigger too, so rows inserted in that
      session get NULL hashes and permanently break verification.
- [x] S1.10 Deterministic seed. Fix the RNG seed and the timestamps so demo screenshots
      and the S11 video seed reproduce exactly.
- **Acceptance:** chain property tests green; seeded DB queryable; a hand-edited row in
  a COPY of the chain is detected by `packages/core` verify.
- **Sprint log:** Logged: 2026-08-22T18:31+10:00 · status: partial · actual: ~1.9h (budget 2h) ·
  by: Claude Opus 5 (Claude Code) · note: five migrations, the hash chain, RLS, and a
  deterministic 184 decision corpus that loads and verifies. 35 tests green across two
  SQL suites and vitest. BLOCKED on applying any of it to hosted Supabase: CLI not
  logged in, no Docker for a local Supabase. Developed against local Postgres 17.11
  instead, which is the same engine family, and carried the hosted apply into S8.

## S2 — Capture surfaces (budget 1h)

- [ ] `packages/cli`: `continuity init` installs post-commit hook (path rules in
      `.continuity.json`); hook posts artifact + requests LLM draft (server route);
      `continuity watch` tails notebook saves. Demo repo `demo/vol-desk-repo` with
      scripted commits for the video.
- [ ] Server routes (LOCKED: Vercel functions per docs/scoping.md §B6): `draft-decision`
      (diff in, structured draft out, Anthropic API), `ask` (S4), JWT-verified, rate
      limited (in-memory per-instance is acceptable; note it in README).
- [ ] Draft queue UI: DecisionCard draft variant (dashed hairline + drafted chip),
      approve = one keystroke (A), edit-then-approve, reject.
- [ ] Desktop quick capture: global hotkey window per design.md §3.4, files a manual
      decision in <10s, keyboard only. FALLBACK: in-window Cmd+K capture mode.
- [ ] Transcript importer (D11): paste or drop a speaker-tagged transcript in the app,
      pick strategy + attendees, files as a `meeting_transcript` artifact through the
      normal event path. Small surface, big pitch line ("meetings feed the ledger").
**Expanded steps (Stage 1.5).**

- [ ] S2.0 Server routes live at **`apps/web/api/*.ts`**, not repo root (A9), with the
      Web handler signature `export async function POST(request: Request)`. The legacy
      `(req, res)` + `@vercel/node` form still works but is not the recommended path.
      **`api/*.ts` cannot use tsconfig `paths` or project references**, so there is NO
      `@continuity/core` alias inside a function: use relative imports or duplicate the
      few pure helpers. Plan this at hour 2; it bites at hour 40.
- [ ] S2.1 **Export `OPTIONS` from every function** and set `Vary: Origin`.
      vercel.json `headers` do not reliably answer preflight on a path that resolves to a
      function, and without `Vary` the CDN can serve one origin's response to another.
      Tauri sends `Origin: tauri://localhost` on macOS (`http://tauri.localhost`
      elsewhere); `Access-Control-Allow-Origin` cannot be a list, so echo the origin from
      an allowlist. These routes carry a bearer JWT, not cookies, so never pair `*` with
      `Allow-Credentials: true`.
- [ ] S2.2 `draft-decision` route shape. Structured JSON via
      `client.messages.parse()` with `zodOutputFormat` from
      `@anthropic-ai/sdk/helpers/zod`; guard `response.parsed_output` for null rather
      than asserting it. **Do not pass `temperature`, `top_p` or `top_k`**: they are
      REMOVED on current models and return 400, so the Stage 1 assumption of
      `temperature: 0` for deterministic drafting is dead. Shape output with the schema
      instead. Assistant prefill and `thinking.budget_tokens` also 400 on these models;
      use `thinking: { type: "adaptive" }` plus `output_config: { effort: "low" }` on
      this route. Every draft is written with `drafted_by = 'model'`.
- [ ] S2.3 **The route split is forced by an API incompatibility, not taste:**
      `output_config.format` and document `citations: { enabled: true }` cannot be
      combined (400). So `draft-decision` is structured JSON with no citations, and the
      `ask` / debrief routes are STREAMING TEXT WITH CITATIONS. Design them as two
      different shapes from the start rather than discovering this at hour 30.
- [ ] S2.4 Streaming route: return `new Response(stream.toReadableStream(), ...)` with
      `Cache-Control: no-cache, no-transform` (no-transform prevents proxy buffering) and
      `export const maxDuration = 60`. Check `stop_reason === "refusal"` before reading
      content: a refusal arrives as HTTP 200, not an exception.
- [ ] S2.5 Demo-safety ladder, because venue wifi is the likeliest failure mode.
      Construct the client as `new Anthropic({ maxRetries: 1, timeout: 20_000 })` (the TS
      timeout is MILLISECONDS; total wall clock is `timeout x (maxRetries + 1)` and three
      minutes of dead air on stage is worse than a fallback). Then: hard deadline ->
      model downgrade -> committed canned fixture. **The fixture must be generated from a
      real earlier run and committed, and the UI must show a small `source: "fallback"`
      indicator.** Under D9 a canned draft presented as live output is exactly the blur
      the rule forbids, and failing visibly reads as maturity to judges.
- [ ] S2.6 Prompt caching for the seeded-corpus system prompt: minimum cacheable prefix
      is ~1024 tokens (shorter silently does not cache), max 4 breakpoints, default TTL
      **5 minutes**, so any pre-warm must happen within five minutes of going on stage,
      not at deploy time. Keep timestamps, per-request ids, unsorted JSON and varying
      tool order OUT of the cached prefix. Verify with
      `usage.cache_read_input_tokens`; zero across identical requests means an
      invalidator slipped in.
- [ ] S2.7 CLI: `packages/cli`, `continuity init` writes `.git/hooks/post-commit` and
      `.continuity.json` path rules; `continuity watch` tails notebook saves. Demo repo
      at `demo/vol-desk-repo` with scripted commits matching videoscript Scene 1.
- [ ] S2.8 Draft queue UI per design.md: dashed hairline + drafted chip, `A` to approve,
      `E` to edit-then-approve, `R` to reject. Approve triggers the capture-to-ledger
      animation (design.md §3.1).
- [ ] S2.9 Transcript importer (D11): paste or drop, pick strategy + attendees, files as
      a `meeting_transcript` artifact through the normal event path.
- **Acceptance:** commit in demo repo lands as approved decision in <60s end to end on
  stage-quality path; quick capture files in <10s; all writes appear as ledger events.
- **Sprint log:**

## S3 — Reading surfaces: ledger, strategy, graph (budget 1h)

- [ ] LedgerRail + LedgerRow (Realtime tail, capture-to-ledger animation design.md §3.1).
- [ ] Strategy page: header, status chips, GenealogyGraph (SVG + d3-force, deterministic
      layout, node birth animation §3.2, amber ring = risk_flag).
- [ ] AskBar (Cmd+K): actions + questions; question path: pgvector retrieval over
      decisions/debrief turns, answer with citation chips linking to sources; no source,
      no claim (render "not in the corpus" honestly).
- [ ] Access events + checkpoint + My Record (D13): strategy opens and exports append
      `access_read` / `access_export` events; export modal takes a one-line
      justification onto the event payload; My Record view filters the ledger to the
      signed-in member's captured contributions and the access events touching them.
      Small tasks, big pitch: the ledger records who read it.
- [ ] App shell + rail nav + empty states per design.md §4.
**Expanded steps (Stage 1.5).**

- [ ] S3.0 GenealogyGraph determinism, now confirmed at d3-force source level (fixed-seed
      LCG with seed hardcoded to 1, phyllotaxis initial placement keyed on `node.index`,
      `.tick()` a pure loop). Pattern: pure `computeLayout()` OUTSIDE React, build the
      simulation, `.stop()`, `sim.tick(300)`, return positions, render static SVG,
      animate entrances on top, wrap in `useMemo` (StrictMode-safe because pure).
      Four caveats that will silently break reproducibility if ignored:
      (1) **node ARRAY ORDER is effectively the seed** because `node.index = i` comes
      from array position, so SORT NODES BY ID before constructing the simulation or the
      layout changes whenever query order changes;
      (2) d3 mutates `x/y/vx/vy` in place, so feed fresh objects each run;
      (3) the LCG state is shared and stateful across forces, so configure every
      `.force()` up front and only then tick;
      (4) never set `fx/fy` from anything non-deterministic.
- [ ] S3.1 Glass performance rules, tightened by verification. Emit
      `-webkit-backdrop-filter` FIRST then unprefixed (unprefixed only reached Baseline
      in Safari 18.0 and Tauri uses the OS WKWebView, so a judge on Ventura or Sonoma
      gets no blur otherwise), with an `@supports not (...)` fallback to an opaque
      surface. **Write the blur value as a LITERAL, never `blur(var(--blur))`:**
      backdrop-filter referencing a custom property fails on macOS Sonoma under Safari
      18.x (webkit bug 297620). Keep blurred surfaces in the single digits, never animate
      an element while it has backdrop-filter (drop the blur during the layoutId flight
      and restore on settle), animate transform and opacity only, and drop blur under
      `prefers-reduced-transparency` and in print. Kill switch:
      `html.no-blur .glass { backdrop-filter: none; background: var(--surface-solid); }`.
- [ ] S3.2 Motion: import ONLY from `motion/react`; do not add `framer-motion` to
      package.json (A10). `AnimatePresence` uses `mode="wait"`, not the removed
      `exitBeforeEnter`. Gesture start callbacks receive the target element as the FIRST
      argument since v12. Fly-to-ledger is a shared `layoutId` on the card and the rail
      slot inside ONE AnimatePresence tree, spring stiffness 350 damping 30. Edge draw-on
      is `motion.path` with `pathLength` 0 to 1. Scanline animates `y` inside
      `overflow: hidden`, transform only, never `top`. `useReducedMotion()` collapses all
      five signature moments to fades under 140ms.
- [ ] S3.3 AskBar with cmdk: `Command.Dialog` with `shouldFilter={false}` in ask mode so
      the answer view is not filtered away, and give every `Item` a STABLE UNIQUE `value`
      because cmdk still uses it for selection identity with filtering off. Retrieval
      filters on `embedding_model` (S1.7). No source, no claim: render "not in the
      corpus" honestly.
- [ ] S3.4 Access events + checkpoint + My Record (D13) exactly as scoped. Export modal
      writes the one-line justification onto the `access_export` event payload.
- [ ] S3.5 Realtime tail: subscribe with
      `{ event: 'INSERT', schema: 'public', table: 'events', filter: 'firm_id=eq.<id>' }`.
      RLS is the boundary, the filter is convenience. Test with TWO users EARLY. Do not
      build any UI that depends on filtered DELETE events; RLS is not applied to DELETE.
- **Acceptance:** demo arc steps 1-2 (prd §6) run scripted; keyboard-only pass for those
  steps; screenshots stored in `docs/shots/`.
- **Sprint log:**

## S4 — Debrief agent (budget 1h)

- [ ] Scheduler table + triggers (post-merge, drawdown-flag stub, weekly pulse,
      half-life refresh (simple exponential decay stub, labelled as such)).
- [ ] Debrief UI thread; agent questions grounded in artifacts including meeting
      transcripts (prompt includes the cited rows; every question renders its
      grounding chip; at least one seeded debrief question grounds in a meeting, per
      D11).
- [ ] Promote-answer-to-decision flow (approval, `drafted_by='model'` until approved).
- [ ] Exit-debrief session plan (longer, feeds S5 pack).
**Expanded steps (Stage 1.5).**

- [ ] S4.0 The debrief route is the STREAMING TEXT + CITATIONS shape (S2.3), never
      structured output, because the two cannot be combined. Grounding chips come from
      the citation blocks, so the corpus rows must be passed as documents.
- [ ] S4.1 Model choice: this is the route where a hallucinated fact directly breaches
      D9, so pay for quality here and save on the drafting route. Use
      `thinking: { type: "adaptive" }` with `output_config: { effort: "high" }`. Do not
      pass sampling params or `budget_tokens` (400 on current models).
- [ ] S4.2 Mid-conversation system messages work without a beta header on current
      models: append `{ role: "system", content: ... }` to `messages[]` to inject an
      operator instruction WITHOUT invalidating the cached prefix. It must follow a user
      message and cannot be `messages[0]`. This is how the exit-debrief session plan
      switches register mid-session without paying for a cache miss.
- [ ] S4.3 Half-life refresh stays a simple exponential decay stub and is LABELLED as a
      stub in the UI (D9). Do not let it grow a model.
- [ ] S4.4 At least one seeded debrief question must ground in a `meeting_transcript`
      artifact (D11), and its chip must resolve on click.
- **Acceptance:** a full 4-question debrief with Daniel persona produces filed turns and
  one promoted decision; grounding chips resolve.
- **Sprint log:**

## S5 — Knowledge risk and handover (budget 1h)

- [ ] Scoring in `packages/core`: bus factor (adapted truck-factor over decision+artifact
      authorship), concentration (Herfindahl), vacation-readiness (can the desk answer
      open questions with the member masked); nightly + on-demand materialization.
- [ ] Risk board: RiskDial, HeatStrip, departure simulation (design.md §3.3 animation,
      orphaned-decisions list).
- [ ] Handover pack generator (SYSC 25.9-shaped, prd §4.4), PackPreview print-styled,
      export to md + pdf.
**Expanded steps (Stage 1.5).**

- [ ] S5.0 Scoring lives in `packages/core` as PURE functions over rows, so it is unit
      testable without a database and so the same code runs in the nightly
      materialization and the on-demand path.
- [ ] S5.1 Every score is a property of a STRATEGY, never of a person (D12, design.md
      principle 7). `top_holder_member_id` exists for the orphaned-decisions list and the
      departure simulation, and must never be rendered as a ranking or a leaderboard.
      Any view that would rank individuals is a design bug, not a feature.
- [ ] S5.2 Handover pack print route: `@media print` hides chrome, `@page { size: A4;
      margin: 18mm }`, `break-inside: avoid` on cards, and **blur is dropped entirely in
      print**. Print from the WEB deploy.
- [ ] S5.3 **`window.print()` is confirmed unreliable in macOS WKWebView** (blank or
      empty PDF despite a correct page count: tauri#5612, wry#707, Apple Developer Forums
      78354), and there is still NO official Tauri print plugin. In the desktop shell,
      open the print route in the system browser via `@tauri-apps/plugin-opener` 2.5.4
      (`openUrl`, capability `opener:allow-open-url`); keep `window.print()` on the web.
      One URL builder serves both shells if the route uses the hash form.
- [ ] S5.4 Every generated pack records the ledger position it was generated from
      (prd §4.2 design rule) and its `pack_hash`.
- **Acceptance:** demo arc step 3-4 runs scripted end to end; Daniel's pack generates
  with real corpus content; scores recompute live after his exit debrief adds answers.
- **Sprint log:**

## S6 — The on-prem tagger (parallel, owner's machine, budget 1h wall-clock)

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
**Expanded steps (Stage 1.5). Read the four corrections A3, A4, A5 and the base-model
note before running anything; between them they are worth more than the whole sprint.**

- [ ] S6.0 `df -h` first. Verified today: 51 GB free, so the 4.45 GB base fits
      comfortably. The Stage 1 "disk is the binding constraint" note is stale.
- [ ] S6.1 Environment: `uv python pin 3.12`, `requires-python = ">=3.12,<3.13"`,
      `uv add "mlx>=0.32.1" "mlx-lm>=0.31.3" pyyaml`. mlx does ship cp314 wheels so 3.14
      is technically viable, but 3.12 is the only combination with a shipped, measured
      result behind it and a hackathon is the wrong place to be first.
- [ ] S6.2 Base stays LOCKED at `mlx-community/Qwen3.5-2B-MLX-bf16`. The VLM scare is a
      non-issue: `mlx_lm/models/qwen3_5.py` `Model.sanitize` drops the vision tower and
      `ModelArgs.from_dict` unwraps `text_config`, and the prior project's shipped 0.8400
      macro-F1 was trained by `mlx_lm.lora` on the identically-shaped 4B. Repo sha today
      is `05ce45420036b812fe0be3f72cdc1fb62bae6891`; pin it in the config and pass it
      explicitly at eval load time. **Do NOT switch to `mlx-community/Qwen3.5-2B-bf16`
      (no `-MLX-` infix): identical weights, but converted from the BASE model rather
      than the instruct model.**
- [ ] S6.3 **lora.yaml, with the A3 fix.** OMIT `keys` entirely and set `num_layers: 0`.
      Reason: Qwen3.5 is hybrid with `full_attention_interval: 4`, so on the 24-layer 2B
      only layers 3, 7, 11, 15, 19, 23 carry `self_attn.q_proj`; the Stage 1 config
      (`keys: [q_proj, v_proj]`, `num_layers: 16`) would have adapted exactly FOUR
      layers. Omitting `keys` makes mlx-lm auto-discover every Linear per layer including
      the GatedDeltaNet `in_proj_qkv` / `in_proj_z` / `out_proj`, and `num_layers: 0`
      selects ALL layers because `mlx_lm/tuner/utils.py:104` does
      `model.layers[-max(num_layers, 0):]`.
      ```yaml
      model: "mlx-community/Qwen3.5-2B-MLX-bf16"
      revision: "05ce45420036b812fe0be3f72cdc1fb62bae6891"
      train: true
      data: "ml/data/mlx"
      fine_tune_type: lora
      optimizer: adamw
      lora_parameters: { rank: 16, scale: 20.0, dropout: 0.0 }
      num_layers: 0
      batch_size: 8
      iters: 1000
      learning_rate: 1e-5
      max_seq_length: 256
      mask_prompt: true
      steps_per_report: 1
      steps_per_eval: 100
      val_batches: 20
      save_every: 100
      adapter_path: "ml/runs/current/adapters"
      seed: 20260822
      ```
- [ ] S6.4 **A5: write `ml/select_checkpoint.py` and run it.** mlx-lm ships the FINAL
      weights, and in the prior project checkpoint selection on the validation split was
      worth +8.0 macro-F1 points (0.8400 at iter 800 versus 0.7599 at the default final
      iter 1200). `save_every: 100` exists to give that step candidates. Also: mlx-lm
      restarts the iteration counter on resume and does not checkpoint optimiser state,
      so a killed run is a full retrain, not a resume. Log inside the repo
      (`ml/runs/current/train.log`), never to /tmp.
- [ ] S6.5 **A4: `enable_thinking=false` is MANDATORY at inference and is the single most
      likely way to lose an afternoon.** The Qwen3.5 chat template's default branch opens
      an UNCLOSED `<think>` block and there is no `/no_think` token. mlx-lm renders
      TRAINING examples from the full conversation, producing a CLOSED think block, so
      the fine-tune learns to answer immediately, and at inference without the flag the
      model reasons instead of answering. Measured on this machine in the prior project:
      **0 of 5 valid classes without the flag, 5 of 5 with it.** The obvious reading,
      "the fine-tune failed", is completely wrong. Serve with
      `--chat-template-args '{"enable_thinking":false}'`; in Python pass
      `enable_thinking=False` to `apply_chat_template`. **Put a 5-sample check of this
      into the sprint acceptance**, before the full eval run.
- [ ] S6.6 Serve: `uv run python -m mlx_lm server --model <base> --adapter-path
      ml/runs/current/best --chat-template-args '{"enable_thinking":false}' --port 8080`.
      Adapters apply at load without fusing (confirmed in `server.py`); prefer that over
      `mlx_lm.fuse`. OpenAI-shaped `/v1/chat/completions`. `TAGGER_URL` points at it.
- [ ] S6.7 Parsing unchanged and non-negotiable: strict `json.loads`, anything else is
      UNPARSEABLE, counted and reported, NEVER coerced to a default class (that would
      import majority-class bias, corrupt macro-F1, and hide template bugs).
- [ ] S6.8 `ml/results/summary.json` copies the distillation provenance block wholesale:
      evaluated_at, base_model, base_model_revision, adapter_path, adapter_sha256,
      heldout_sha256, heldout_labels_sha256, heldout_rows_scored, git_commit, git_dirty,
      then per-arm accuracy / macro_f1 / per_class / confusion / latency p50 and p95 /
      invalid_outputs. That block IS the honest-claims mechanism (D9).
- [ ] S6.9 FALLBACK ladder, pre-agreed. First rung: `mlx-community/Qwen3-1.7B-bf16`
      (~3.46 GB, `Qwen3ForCausalLM`, plain dense, no hybrid layers, no vision, where
      `num_layers: 16` really means 16 layers) if the 2B errors on weight loading or the
      adapter coverage proves too thin; changing base is a one-line edit plus a fresh
      revision. Second rung (D6): few-shot on the same base, same JSON contract, same
      parser, report both arms as a mini trade-off curve, and the UI claim softens to the
      distillation-cited wording.
- **Acceptance:** every seeded + new decision gets decision_type/risk_flag; the quoted
  accuracy number in the UI tooltip matches `ml/results/summary.json` or the fallback
  wording is used. No invented numbers (D9).
- **Sprint log:**

## S7 — Proof layer (budget 1h)

- [ ] Merkle root over ledger ranges; OpenTimestamps anchor of the head
      (`anchor_receipts`); CLI `continuity anchor` + scheduled function stub. Recipes
      in docs/scoping.md §D. STAMP THE FIRST HEAD ON SATURDAY so an upgraded
      Bitcoin-attested receipt exists by demo time (attestation takes 1-6+ hours);
      pending receipts are shown honestly as pending.
- [ ] Verify page: in-browser chain recompute (verify sweep animation §3.5), tamper
      demo against a copied chain, OTS receipt display (pending-attestation state is
      fine and shown honestly).
**Expanded steps (Stage 1.5).**

- [ ] S7.0 `pnpm add opentimestamps@0.4.9 && pnpm add -D @types/opentimestamps@0.4.0`.
      Pin EXACTLY. The dangerous lookalike is `opentimestamps-javascript` (reversed word
      order): zero downloads, forged `author: "EternityWall"`, and a repository field
      pointing at the official repo it does not control. `opentimestamp` (singular) is a
      genuine but unrelated implementation, not malware.
- [ ] S7.1 **The import form is a runtime trap TypeScript will not catch.** The package
      is CJS only and `import { DetachedTimestampFile } from 'opentimestamps'`
      typechecks and then throws `SyntaxError: Named export not found` under real Node
      ESM. Required form, with the reason in a code comment:
      `import OTS from 'opentimestamps'; const { DetachedTimestampFile, Ops } = OTS;`
- [ ] S7.2 Wrap the library in ONE thin typed module, `packages/core/src/ots.ts`.
      `stamp()` returns `Promise<void>` and MUTATES the detached object in place;
      `upgrade()` returns `Promise<boolean>` where false means nothing changed and also
      mutates in place. Persist the EXACT `serializeToBytes()` output as bytea or base64;
      never `JSON.stringify` it. Keep the pending original until an upgraded one
      verifies.
- [ ] S7.3 Always pass `{ ignoreBitcoinNode: true }` to `verify` (confirmed real at
      `src/open-timestamps.js:323`); without it the library tries to read a local
      bitcoin.conf and reach a bitcoind we do not have. Verify SERVER-SIDE: calendar CORS
      is flaky from the browser.
- [ ] S7.4 **The rendering trap that would breach D9: `verify()` on a fully pending
      receipt RESOLVES with `{}`, it does not reject.** Empty object MUST render as
      PENDING. Treating a resolved promise as success would display a pending receipt as
      Bitcoin-confirmed on stage.
- [ ] S7.5 Honest wording (D9). Live demo stamps WILL be pending: the official client
      README says confirmation takes "a few hours". The correct phrasing for a fresh
      receipt is "submitted to N calendars, Bitcoin confirmation pending"; only a
      pre-stamped, already-upgraded fixture may be called anchored. **This is why
      stamping a head on SATURDAY is load-bearing and not optional.**
- [ ] S7.6 Measured budgets for the UI: 4 calendars at m=2 takes ~1,918 ms and yields a
      700 to 840 byte receipt; 1 calendar at m=1 takes ~999 ms and yields 256 bytes.
      Fail soft with a timeout and NEVER block the ledger write path on OTS.
- [ ] S7.7 The library `console.log`s "Submitting to remote calendar ..."
      unconditionally and it is not configurable; monkeypatch `console.log` around the
      call if it pollutes demo output. Its `main` field points at a missing file, so
      expect a harmless `DEP0128` warning on every require.
- [ ] S7.8 README limitation to write while it is fresh: `npm audit` reports 2 critical
      and 8 moderate advisories, all transitive through the abandoned `request` /
      `request-promise`, unfixable without forking. The SSRF vector is not reachable
      because calendar URLs are hardcoded in the library's `DEFAULT_AGGREGATORS` and
      never user-supplied. State it; do not hide it.
- **Acceptance:** verify page passes on live data; staged tamper halts the sweep on the
  exact row; receipt renders.
- **Sprint log:**

## S8 — Deploy (budget 1h)

- [ ] Web build to Vercel: env, auth redirect URLs, seeded demo firm, registration →
      sandbox firm flow, footer synthetic-data notice.
- [ ] Desktop: `pnpm tauri build` .dmg (unsigned; note in README + MANUAL TASKS).
- [ ] Smoke the full demo arc (prd §6) on the DEPLOYED demo, not localhost.
**Expanded steps (Stage 1.5).**

- [ ] S8.0 Vercel project settings, and these are the ones that go wrong silently:
      Framework Preset **Vite**, **Root Directory `apps/web`**, and **tick "Include files
      outside the Root Directory"** so the workspace `pnpm-lock.yaml` and
      `pnpm-workspace.yaml` are present. Output Directory `dist`, Node 24.x. Install runs
      from the workspace root because `pnpm-lock.yaml` is detected.
- [ ] S8.1 `apps/web/vercel.json` (NOT repo root), with the SPA rewrite excluding
      `/api`, the CORS headers, and `functions: { "api/**/*.ts": { "maxDuration": 60 } }`.
      The negative lookahead is belt-and-braces (filesystem routes are matched before
      rewrites anyway) but it states the intent and costs nothing.
- [ ] S8.2 Supabase Auth on the hosted project: turn **Confirm email OFF** at
      Authentication > Sign In / Providers > Email, and set Site URL plus the redirect
      allow-list at Authentication > URL Configuration to the Vercel production URL,
      `http://localhost:5173`, and a preview wildcard if the demo may run from a preview
      deploy. No OAuth (deep-link pain).
- [ ] S8.3 If the local-embeddings fallback ships, prune the trace: `onnxruntime-node` is
      210 MB locally (win32 124 MB, darwin 35 MB, linux 52 MB) plus `onnxruntime-web` at
      130 MB, against a 250 MB uncompressed function limit. Tracing ships linux only, so
      the realistic size is 60 to 90 MB, but a misfire blows the limit. Set
      `env.cacheDir = '/tmp/hf-cache'` (the default cache is inside read-only
      node_modules) and consider committing the ONNX + tokenizer with
      `env.allowRemoteModels = false`.
- [ ] S8.4 Desktop `.dmg`: `pnpm tauri build`, output
      `src-tauri/target/release/bundle/dmg/Continuity_0.1.0_aarch64.dmg`. Ad-hoc signed
      (`signingIdentity: "-"`) or `--no-sign`. Same-machine builds have no quarantine
      attribute; a downloaded copy needs right-click Open or `xattr -cr`. Say so in the
      README. For a 48h build consider omitting `lto` and `codegen-units = 1` from the
      release profile: they slow cold builds noticeably.
- [ ] S8.5 Smoke the FULL demo arc on the DEPLOYED demo, not localhost, and do it with a
      fresh incognito account so the registration-to-sandbox path is exercised for real.
- **Acceptance:** public URL live; fresh account reaches sandbox and files a decision in
  <2 min; demo arc passes on deployed; .dmg opens on the M4.
- **Sprint log:**

## S9 — Design verification and polish (budget 1h)

- [ ] Playwright MCP pass per design.md §7: screenshot every route both sizes + quick
      capture; checklist audit (tokens, hairlines, amber discipline, motion, reduced
      motion, keyboard-only full arc); fix and re-shoot to clean.
- [ ] Final screenshot set to `docs/shots/final/` (these are the README set).
**Expanded steps (Stage 1.5).**

- [ ] S9.0 Add Playwright MCP if S0.13 did not:
      `claude mcp add --scope project playwright -- npx @playwright/mcp@latest
      --output-dir docs/shots --viewport-size 1440,900`. Package is `@playwright/mcp`
      0.0.79. Per route the loop is `browser_resize`, `browser_navigate`,
      `browser_wait_for`, `browser_take_screenshot` (relative filename),
      `browser_snapshot`, then `browser_console_messages` as a cheap extra gate for React
      warnings and missing tokens.
- [ ] S9.1 **The reduced-motion half of the design.md §7 checklist CANNOT run through
      MCP: the server has no reduced-motion toggle tool.** Write `scripts/shots.ts`
      using `playwright` 1.62.1 directly and loop routes x viewports x
      `reducedMotion: 'reduce' | 'no-preference'`. `npx playwright install chromium`
      once. The assertion that actually proves the token is honoured is to read
      `getComputedStyle(el).animationDuration` under reduce and expect `0s` or `0.01s`.
- [ ] S9.2 Keyboard-only pass, programmatically: walk Tab from `body`, and at each stop
      assert the focused element is visible AND has a visible focus ring (outline or
      box-shadow). Throw on a focus trapped in a hidden element. Then drive
      Enter / Space / Escape through the full demo arc with no pointer.
- [ ] S9.3 Re-run the S0.5 guardrails as part of the pass, not just at S0: the hex grep,
      the undefined-custom-property scan, and the contrast test against the WORST body
      surface (`--surface-recessed` over the bottom stop of `--bg-field`).
- [ ] S9.4 Amber audit is a grep plus an eyeball: `--accent-risk` must appear only in
      risk surfaces. Any other use is a D5 violation and a design bug.
- **Acceptance:** checklist all green, evidenced by the shots.
- **Sprint log:**

## S10 — README and documentation (budget 1h)

- [ ] README.md: one-sentence what/why, demo URL + login
      hint, screenshot gallery, architecture mermaid, ERD mermaid, capture-flow sequence
      mermaid, the research section (numbers + citations from the dossier), tagger
      results table (D9-compliant), honest limitations, install/run, team. Professional,
      comprehensive, **no em dashes** (D8).
- [ ] `docs/`: dossier PDF committed; METHODOLOGY-style note for the tagger; this
      masterplan + prd + design linked from README.
**Expanded steps (Stage 1.5).**

- [ ] S10.0 Every number in the README must resolve to a committed artifact (D9). The
      tagger numbers come from `ml/results/summary.json` or the fallback wording; the
      research numbers carry dossier codes. Verified in Stage 1.5 that all 19 codes used
      across the pack resolve against 91 source entries, so the codes are safe to
      reprint. When re-checking, match on `^ *CODE ·` and not on `[CODE]`: the source
      lists do not use brackets and a bracket grep gives a false negative.
- [ ] S10.1 Honest limitations section, drafted from the Stage 1.5 findings so it does
      not have to be reconstructed at 3am: (a) database-level immutability is tamper
      RESISTANCE, not proof, because `session_replication_role = replica` disables
      triggers and the `postgres` role can set it; the hash chain is the evidence.
      (b) live OTS receipts are pending for hours; only the pre-stamped fixture is
      Bitcoin-attested. (c) the `opentimestamps` dependency carries unfixable transitive
      advisories whose vector is not reachable here. (d) the desktop build is unsigned.
      (e) rate limiting is in-memory per instance. (f) all data is synthetic.
      (g) if the fallback tagger shipped, the number is cited to the prior project.
- [ ] S10.2 No em dashes anywhere (D8). Grep the README before committing.
- **Acceptance:** README renders clean on GitHub (check raw + rendered); every number
  traceable; mermaid diagrams render.
- **Sprint log:**

## S11 — Video and submission (budget 1.5h + human filming)

- [ ] Freeze demo data to the video seed; run-through per `videoscript.md` beat sheet.
- [ ] Screen captures for product beats; human films acted beats (MANUAL TASKS).
- [ ] Submission package per hackathon requirements (research trail = dossier + decision
      log, prototype links, video).
**Expanded steps (Stage 1.5).**

- [ ] S11.0 Freeze the seed BEFORE the first take and re-seed between takes if data
      mutated. The seed is deterministic by S1.10, so this is a command, not a ritual.
- [ ] S11.1 Pre-record the AI-dependent moments as a safety net. Venue wifi is the single
      most likely failure at a hackathon and no retry policy survives no network.
      Filed as a MANUAL TASK.
- [ ] S11.2 If the fallback tagger shipped, apply the videoscript's own rule: change the
      Scene 1 line to "tagged by a small model running on our own machine" and drop "we
      fine-tuned". If the OTS receipt on stage is pending rather than upgraded, the
      Scene 4 V.O. says "submitted to the calendars, Bitcoin confirmation pending", not
      "anchored to Bitcoin" (D9).
- **Acceptance:** footage for every scripted beat exists; submission checklist complete.
- **Sprint log:**

---

## OPEN QUESTIONS (build model appends here instead of inventing scope)

- (Stage 1 close) none pending; engineerprompt.md instructs the next session to ask
  Bruno its scope questions before touching S0.
- (Stage 1.5 close, 2026-08-22) The engineer session surfaced four genuine forks. Owner
  direction on 22 Aug was "do all sprints", which is taken as approval to proceed on the
  DOCUMENTED DEFAULT for each rather than to block. Defaults recorded here so the choice
  is visible and reversible:
  - **Q1 Supabase hosted vs local.** Default taken: build against LOCAL
    `supabase start` until the human logs the CLI in, then `supabase db push --linked`
    once. Rationale: local needs no credentials, `supabase db reset` is the only clean
    reseed path once the append-only triggers exist, and free-tier projects pause after
    7 idle days anyway.
  - **Q2 Embeddings provider.** Default taken: `vector(384)` with an `embedding_model`
    column, OpenAI primary if a key appears, `@huggingface/transformers` gte-small
    otherwise. Under A13 this needs no decision before the migration, which is exactly
    why it was worth removing the fork.
  - **Q3 Tagger base size.** Default taken: the locked
    `mlx-community/Qwen3.5-2B-MLX-bf16` at 4.45 GB. Disk was re-measured at 51 GB free,
    so the Stage 1 disk anxiety no longer applies and the 0.8B speed fallback is not
    needed up front.
  - **Q4 Quick-capture hotkey.** Default taken: `CommandOrControl+Shift+Space` per
    prd §4.3. NOT verified against Bruno's existing macOS shortcuts (Spotlight is
    Cmd+Space and some input-source switchers use Cmd+Shift+Space). Filed in MANUAL
    TASKS as a 30-second human check; if it clashes, changing it is a one-line edit.

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

**Added by the Stage 1.5 engineer session, 2026-08-22. Several Stage 1 items are now
resolved; those are ticked with the evidence rather than deleted.**

- [x] Bruno: connect the `cissa-hackathon` folder. DONE: the folder is connected and the
      repo has remote `https://github.com/br9704/cissa-hackathon.git`. The pack is still
      uncommitted, which is S0.0, not a human task.
- [x] Bruno: install pnpm, Rust toolchain, Xcode CLT. DONE and verified 22 Aug: pnpm
      11.13.0, cargo/rustc 1.97.1, Xcode CLT present, Node 24.12.0, uv 0.12.4.
- [x] Bruno: confirm `df -h` has >= 12 GB free before the S6 base pull. DONE: 51 GB free.
- [x] Vercel CLI is already authenticated (`vercel whoami` returns `br9704`). Creating
      and linking the PROJECT is still to do, below.
- [ ] **Bruno: log the Supabase CLI in.** `supabase login`, then `supabase link
      --project-ref <ref>`. Verified 22 Aug that `supabase projects list` returns
      `Unauthorized`. This BLOCKS the hosted half of S1 and all of S8. The build works
      around it by developing against `supabase start` locally, so it is not a hard stop
      until deploy.
- [ ] **Bruno: authenticate the two MCP servers that report "Needs authentication"**
      (`plugin:supabase:supabase` and `figma`), or confirm they are not needed. Neither
      is on the critical path; the Supabase CLI is what matters.
- [ ] **Bruno: 30-second hotkey check.** Confirm `Cmd+Shift+Space` is free on your Mac
      (System Settings > Keyboard > Keyboard Shortcuts; some input-source switchers and
      third-party launchers claim it). If it clashes, name a replacement and it is a
      one-line change. See OPEN QUESTIONS Q4.
- [ ] **Bruno: OpenAI key is now OPTIONAL, not a fork.** Under AMENDMENT A13 both the
      OpenAI and the local path produce 384-dim vectors, so the pgvector column no longer
      depends on which one you provide. Provide the key if you want the better
      embeddings; skip it and the local fallback runs with no schema change.
- [ ] **Bruno: pre-record the AI-dependent demo moments as insurance.** Venue wifi is the
      single most likely failure at a hackathon and no retry policy survives no network.
      The draft-decision and debrief beats are the ones to capture.
- [ ] **Bruno: decide whether to demo the desktop app from `pnpm tauri dev` or from the
      .dmg.** An ad-hoc-signed dmg trips Gatekeeper on any machine that did not build it,
      so a judge opening it needs right-click Open. Building on your machine and
      demoing from dev avoids the beat entirely.

---

## AMENDMENTS (append-only; date + why for any change to a locked decision)

**Stage 1.5, 2026-08-22.** Every item below was found by re-verifying a Stage 1 claim
against a live registry, vendor source, or a running Postgres. None of them change a
locked decision D1 to D13; they correct the recipes those decisions depend on.

- **A1 · Font package name was wrong.** docs/scoping.md §C pinned `geist-mono` 5.2.8.
  That npm package is `geist-mono` 1.0.0, "Geist Mono font family for Expo/React
  Native", an unrelated project. Correct packages: `@fontsource-variable/geist` 5.3.0
  and `@fontsource-variable/geist-mono` 5.3.0. Why it matters: the build model would
  have installed a React Native font package and spent an hour wondering why the mono
  face never loaded.
- **A2 · Hash with the built-in `sha256()`, not pgcrypto `digest()`.** Unqualified
  `digest()` raises "function digest(unknown, unknown) does not exist" under Supabase's
  normal search_path; it needs `extensions.digest(...)`. Postgres 11+ ships
  `sha256(bytea)` in `pg_catalog`, which needs no extension and survives a hardened
  `set search_path = ''`. Verified byte-identical output. Removes a dependency and a
  footgun.
- **A3 · The Stage 1 LoRA config would have trained four layers, not sixteen.** Qwen3.5
  is hybrid with `full_attention_interval: 4`, so on the 24-layer 2B only six layers
  carry `self_attn.q_proj`. With the pinned `keys` and `num_layers: 16`, exactly four
  layers get adapters. Fix: omit `keys` (mlx-lm then auto-discovers every Linear per
  layer, including the GatedDeltaNet projections) and set `num_layers: 0`, which selects
  ALL layers because `tuner/utils.py:104` does `model.layers[-max(num_layers, 0):]`.
- **A4 · `enable_thinking=false` is mandatory at inference.** The Qwen3.5 chat template's
  default branch opens an unclosed `<think>` block and there is no `/no_think` token.
  Training examples render with a CLOSED block, so the adapter learns to answer
  immediately and then reasons instead at inference. Measured in the prior project: 0 of
  5 valid classes without the flag, 5 of 5 with it. The obvious diagnosis, "the
  fine-tune failed", would have been completely wrong.
- **A5 · Checkpoint selection is worth more than any hyperparameter here.** mlx-lm ships
  the FINAL weights; in the prior project selecting on the validation split was worth
  +8.0 macro-F1 (0.8400 at iter 800 versus 0.7599 at iter 1200). `save_every: 100` and a
  `select_checkpoint` step are now required, not optional. Also: mlx-lm restarts the
  iteration counter on resume and does not checkpoint optimiser state, so a killed run
  is a full retrain.
- **A6 · Two text tokens fail their own contrast bar.** Measured by full sRGB
  compositing over every surface and every stop of `--bg-field`: `--text-secondary` at
  alpha 0.72 gives 6.87:1 inside a recessed pane (the bar is 7:1) and `--text-tertiary`
  at 0.55 gives 3.91:1, which clears neither AAA nor AA. New values 0.74 and 0.62,
  measuring 7.40 and 4.91 worst case. design.md §2 updated with the measurements inline.
- **A7 · Vite 8 is Rolldown, so the config key is `build.rolldownOptions`.**
  `build.rollupOptions` is the Vite 7 spelling and is wrong for the pinned version.
- **A8 · Pin `typescript` 5.9.3, not the 7.0.2 that npm reports as latest.** TS 7 is the
  Go port and is GA, but it has no stable programmatic API until 7.1 (so
  `typescript-eslint` cannot use it) and inherits every TS 6 removal, including
  `baseUrl` and `moduleResolution: node10`. Vite does not typecheck anyway, so TS 7 buys
  nothing here and costs a class of unknown-unknowns.
- **A9 · Server routes move to `apps/web/api/`.** Stage 1 located them at repo root.
  Once Vercel Root Directory is `apps/web`, a repo-root `api/` is invisible, and
  `vercel.json` must move with it. Consequence to plan around now: Vercel's Node runtime
  does not support tsconfig path mappings or project references, so `api/*.ts` cannot
  import `@continuity/core` by alias. Use relative imports or duplicate the few pure
  helpers a route needs.
- **A10 · The framer-motion warning was right about the rule and wrong about the
  reason.** `motion/react` re-exports `framer-motion` at the same version, so the two
  names share a module instance and do not break contexts by themselves. The real
  failure is pnpm resolving two DIFFERENT framer-motion versions. Rule stands (import
  only from `motion/react`, never add `framer-motion` to package.json) with the correct
  justification: one resolution in the lockfile.
- **A11 · The declared font-family names do not exist.**
  `@fontsource-variable/geist` registers `"Geist Variable"` and the mono package
  registers `"Geist Mono Variable"`. design.md declared `"Geist"` and `"Geist Mono"`,
  which match nothing and fall silently through to the system font. This is the kind of
  defect that survives until the S9 screenshots and then costs a re-shoot.
- **A12 · Local embeddings package is `@huggingface/transformers` 4.2.0.**
  `@xenova/transformers` last published 2024-05-29 and is abandoned. The Stage 1 note
  also said v3; current is v4, which replaced `quantized: true` with `dtype`, so every
  v2-era model-card snippet is wrong.
- **A13 · Embeddings are 384 dimensions on EVERY path, and this removes a fork.**
  `vector(n)` is fixed width, so OpenAI-at-1536 primary with local-at-384 fallback could
  never share a column: it would have forced two columns, two indexes and a query-time
  branch. OpenAI `text-embedding-3-small` accepts `dimensions: 384`, so both paths are
  384 and the column never changes. NEW REQUIREMENT that comes with it: an
  `embedding_model` column, filtered at retrieval, because OpenAI-at-384 and
  gte-small-at-384 are different vector spaces and comparing them returns meaningless
  cosine scores while succeeding silently.
- **A14 · Sprint budgets reduced by one hour each (owner direction, 22 Aug 2026).**
  S0 2.5 to 1.5, S1 3 to 2, S2 4 to 3, S3 5 to 4, S4 3 to 2, S5 4 to 3, S6 4 to 3,
  S7 2 to 1, S8 2 to 1, S9 3 to 2, S10 2 to 1, S11 2.5 to 1.5. Total drops from about 37
  hours to about 25. Sprint CONTENT and acceptance blocks are unchanged, so the
  fallbacks in each sprint are now load-bearing rather than decorative: take the
  documented fallback early rather than overrunning, and log the deferral.
- **A15 · Design law gains an Apple material layer (owner direction, 22 Aug 2026).**
  Researched against Apple's Human Interface Guidelines (Materials, Color, Typography,
  Accessibility) and the Adopting Liquid Glass technology overview, with
  github.com/rshankras/claude-code-apple-skills (MIT) as the secondary citation. Folded
  into design.md rather than installed as a skill, because Stage 2 runs on a cheaper
  model that follows written law more reliably than it follows skill discovery. Changes:
  glass belongs to the navigation layer only and never stacks (so `--surface-recessed`
  becomes opaque); one glass variant, so `--surface` and `--nav-bg` collapse to a single
  alpha; a `--scroll-edge` token for content passing under the blurred top bar;
  `prefers-reduced-transparency` and `prefers-contrast` blocks in tokens.css, which was
  the single largest gap in the document; the blur-in removed from genealogy node birth;
  `--ease-spring` falls back to `--ease-out` under reduced motion, not merely shorter;
  at most one filled accent button per view; amber always paired with a shape or label;
  concentric nested radii; and the contrast bar measured against the WORST surface
  rather than the lightest, which is what exposed A6.
- **A16 · `CLAUDE.md` and `ENGINEERPROMPT.md` are never committed (owner direction,
  22 Aug 2026).** Both added to `.gitignore`. Every sprint ends with a commit of that
  sprint's work (owner direction, same date), recorded in the logging protocol above.
