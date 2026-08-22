# docs/scoping.md: Stage-1 technical scoping (verified 22 Aug 2026)

> **SUPERSEDED IN PLACES, 22 Aug 2026.** A Stage 1.5 verification pass re-checked every
> claim in this file against live registries, vendor source and a running Postgres, and
> found thirteen corrections. `masterplan.md` > AMENDMENTS A1 to A13 is the authority
> wherever it disagrees with this file. The ones that bite hardest: the Geist Mono
> package name (A1), pgcrypto `digest()` (A2), the LoRA layer selection (A3),
> `enable_thinking` (A4), `build.rolldownOptions` (A7), the typescript pin (A8), the
> `apps/web/api/` location (A9), the font-family names (A11), and the collapse of the
> embedding dimension fork to 384 everywhere (A13). Read those first.
>
> Four mechanical recipes produced by the research stage so the build stage never has to
> guess. Every version below was verified against npm/crates/HF/vendor docs on 22 Aug
> 2026. Sections: A Tauri shell · B Supabase/schema · C Frontend/animation/deploy ·
> D MLX tagger + OpenTimestamps. Referenced from masterplan sprints.

## A · Tauri 2 desktop shell (macOS)

Pins: `@tauri-apps/cli` 2.11.4 · `@tauri-apps/api` 2.11.1 · `tauri` crate 2.11.5 ·
`tauri-plugin-global-shortcut` 2.3.2 (npm + crates agree) · create-tauri-app 4.6.2.

1. Add to existing Vite app: `npm i -D @tauri-apps/cli` then `npx tauri init`
   (assets `../dist`, devUrl `http://localhost:5173`, dev cmd `npm run dev`, build
   `npm run build`). Cargo features: `tauri = { version = "2", features = ["tray-icon",
   "image-png"] }`.
2. Tray (core, Rust side, in `.setup()`): `TrayIconBuilder::new()
   .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
   .icon_as_template(true).menu(&menu).build(app)?;` plus
   `app.set_activation_policy(ActivationPolicy::Accessory);` for a menu-bar app.
   Tray icon: monochrome black PNG with alpha, ~44x44 @2x; template mode tints it.
3. Global shortcut: `npm run tauri add global-shortcut`; JS:
   `register('CommandOrControl+Shift+Space', e => { if (e.state === 'Pressed') ... })`.
   THE TRAP: capabilities. `src-tauri/capabilities/default.json` must list BOTH window
   labels and the permissions: `"windows": ["main","quickcapture"]`, permissions:
   `global-shortcut:allow-register/-unregister/-is-registered`,
   `core:window:allow-show/-hide/-set-focus/-set-always-on-top/-start-dragging`.
   A window label missing from capabilities silently gets zero permissions.
4. Quick-capture window: define statically in tauri.conf.json windows array:
   `{ "label": "quickcapture", "url": "/capture", "width": 560, "height": 120,
   "decorations": false, "transparent": true, "alwaysOnTop": true, "visible": false,
   "resizable": false, "skipTaskbar": true }` and `"app": { "macOSPrivateApi": true }`
   (required or transparent renders black). Show/focus on shortcut;
   `onFocusChanged(!focused => hide())` for blur-to-hide; `data-tauri-drag-region` on
   the bar. Skip vibrancy crate; CSS translucency over transparent window is enough.
5. Unsigned build: `"bundle": { "targets": ["app","dmg"], "macOS": { "signingIdentity":
   "-" } }` (ad-hoc; required on Apple Silicon). Output:
   `src-tauri/target/release/bundle/dmg/Continuity_0.1.0_aarch64.dmg`. Same-machine
   builds have no quarantine attribute; downloaded copies need Privacy & Security
   "Open Anyway" or `xattr -cr`.
6. Pitfalls: (1) capability omissions fail silently in JS console only; (2) transparent
   window black without macOSPrivateApi; (3) shortcut handler fires on Pressed AND
   Released, gate on Pressed; (4) guard Tauri API calls with
   `'__TAURI_INTERNALS__' in window` so the Vercel build never imports them; (5) tray
   icon white blob = non-template colored PNG or missing cargo features.
7. Fallback ladder (each <30 min): shortcut dies → tray click opens quickcapture; tray
   dies → keep shortcut + Dock icon; both die → in-window Cmd+K capture mode.

## B · Supabase: schema, chain, RLS, realtime, vectors, auth, routes

Free-tier facts: pgvector available; Realtime 200 concurrent / 2M msgs mo; Edge Fns
500K/mo; 500 MB DB; projects PAUSE after 7 idle days (unpause manually the morning of
the demo; a cron `select` keeps it warm). Projects created after 30 May 2026 need
EXPLICIT GRANTs for Data API access (anon/authenticated get nothing by default): every
table needs `grant` statements; symptom of forgetting = 42501 despite correct policies.

1. Append-only chained events (full SQL in migration `0002_events.sql`):
   pgcrypto digest; REVOKE ALL then `grant select, insert to authenticated`;
   belt-and-braces `forbid_mutation()` trigger raising on UPDATE/DELETE; BEFORE INSERT
   `chain_events()` trigger: `pg_advisory_xact_lock(hashtext('events_chain'),
   hashtext(new.firm_id::text))` (per-firm serialization: concurrent inserts to one
   firm queue, firms do not block each other), read prev `this_hash` by
   `order by id desc limit 1`, canonical text built by hand:
   `prev_hash || '|' || firm_id || '|' || actor_id || '|' || kind || '|' ||
   extract(epoch from created_at)::text || '|' || payload::text` (jsonb::text IS
   deterministic: keys sorted), `this_hash = encode(digest(canonical,'sha256'),'hex')`.
   VERIFY THE CHAIN IN SQL (a `verify_chain(firm_id)` function recomputing every row):
   matching Postgres jsonb rendering byte-for-byte from JS is a rabbit hole; the
   browser verify page calls the SQL function and animates its row-by-row result.
2. RLS: members(user_id, firm_id, role check in researcher/desk_head/compliance);
   security-definer helper `my_firm_ids()`; policies: events select/insert scoped to
   `firm_id in (select my_firm_ids())` and `actor_id = auth.uid()`; role-gated inserts
   check members.role.
3. Realtime: `alter publication supabase_realtime add table events; alter table events
   replica identity full;` then supabase-js
   `.on('postgres_changes', { event:'INSERT', table:'events',
   filter: 'firm_id=eq.<id>' }, cb)`. RLS applies per subscriber (verified current);
   the filter is convenience, RLS is the boundary. Test with two users EARLY.
4. pgvector: `vector(1536)` on decisions + HNSW cosine index + `match_decisions` RPC.
   Anthropic has NO embeddings API (verified; they point at Voyage). LOCKED: OpenAI
   `text-embedding-3-small` (1536 dims, one HTTPS call) with fallback transformers.js
   `gte-small` (384 dims, local, no key) if no OpenAI key: dimension must match the
   column, so pick before migrating.
5. Auth: supabase-js email/password, EMAIL CONFIRMATION DISABLED for the weekend, Site
   URL = Vercel domain + localhost:5173 in redirects. Tauri: localStorage persists
   fine; MUST add Supabase URL to tauri.conf.json CSP
   (`connect-src https://<ref>.supabase.co wss://<ref>.supabase.co`) or auth/realtime
   fail silently. No OAuth (deep-link pain).
6. Server routes: LOCKED Vercel functions (same origin as SPA, plain Node, one deploy):
   `/api/*.ts` at repo root with Web signature `export async function POST(request:
   Request)`. vercel.json SPA rewrite excluding api:
   `{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }`.
   Desktop app calls the absolute Vercel URL and always sends the Supabase JWT; verify
   server-side via `auth.getUser(jwt)`; in-memory per-instance rate limit is acceptable
   for demo (say so in README).
7. Seed: `scripts/seed.ts` run with service-role key via `npx tsx` (service role
   bypasses RLS but NOT the append-only trigger, which is correct); insert events
   sequentially for stable hashes; reseed = truncate via SQL editor (API cannot delete).
   Migrations via `supabase db push` (fresh project, no drift risk here).

## C · Frontend, animation, deploy

Pins: React 19.2.8 · Vite 8.2.2 · @tanstack/react-router 1.170.31 ·
@tanstack/react-query 5.101.4 · @supabase/supabase-js 2.112.3 · motion 13.1.1 ·
cmdk 1.1.1 · d3-force 3.0.0 · @fontsource-variable/geist 5.2.9 · geist-mono 5.2.8.

1. Styling: plain CSS Modules + tokens.css. NOT Tailwind (arbitrary-value syntax is a
   hex escape hatch a cheap model will reach for). CI grep:
   `grep -rn --include='*.css' --include='*.tsx' -E '#[0-9a-fA-F]{3,8}\b' src | grep -v tokens.css && exit 1`.
2. Animation: the package is `motion` now; import from `motion/react`; NEVER mix with
   framer-motion (duplicate contexts silently break layoutId): add framer-motion to
   eslint no-restricted-imports. Recipes: fly-to-ledger = shared `layoutId` on card and
   rail slot inside one AnimatePresence tree, spring stiffness 350 damping 30; edge
   draw-on = `motion.path initial={{pathLength:0}} animate={{pathLength:1}}`; scanline
   = animate `y` -100% → 100% inside overflow:hidden (transform only, never top);
   `useReducedMotion()` collapses all to fades.
3. Graph: d3-force v3 is DETERMINISTIC by default (fixed-seed LCG + phyllotaxis initial
   positions). Pattern: pure `computeLayout()` outside React: build sim, `.stop()`,
   `sim.tick(300)`, return positions; render static SVG; entrance animations on top;
   `useMemo` (StrictMode-safe because pure). 200 nodes / 300 edges x 300 ticks = a few
   ms.
4. cmdk: Command.Dialog with Cmd+K toggle; `shouldFilter={false}` in ask mode so the
   answer view is not filtered away.
5. Fonts: the `geist` npm package REQUIRES next/font and fails outside Next (verified
   issue #62). Use `@fontsource-variable/geist` + `geist-mono`; import in main.tsx;
   families "Geist Variable" / "Geist Mono Variable".
6. Vercel + Tauri: `/api` directory auto-deploys as functions; SPA rewrite per B6; env
   secrets UNPREFIXED (anything VITE_ is baked into the client bundle); keep Vite
   `base: '/'`; Tauri custom protocol has no rewrites so use
   `createHashHistory()` when `'__TAURI_INTERNALS__' in window`, browser history
   otherwise; API base = absolute Vercel origin inside Tauri + CORS headers on
   functions.
7. Handover PDF: print CSS + window.print() on a dedicated `/handover/$id` route
   (`@media print` hides chrome; `@page { size: A4; margin: 18mm }`;
   `break-inside: avoid`). window.print is unreliable in WKWebView: in the desktop
   build, open the route in the system browser via `@tauri-apps/plugin-opener`; demo
   the export from the web deploy.
8. Glass performance: backdrop-filter works in WKWebView (Safari engine; include
   -webkit- prefix), but blurring THROUGH a transparent Tauri window to the desktop
   does not work (tauri#12804, #13801): paint our own background field inside the app.
   Rules: <= ~6 blurred surfaces visible; never animate an element while it has
   backdrop-filter (drop blur during layoutId flight, restore on settle); animate
   transform/opacity only; no blanket will-change. Kill switch: `html.no-blur .glass
   { backdrop-filter:none; background: var(--surface-solid) }`.

## D · MLX tagger + OpenTimestamps

Tagger:
1. Base LOCKED: `mlx-community/Qwen3.5-2B-MLX-bf16` (4.43 GB, Apache-2.0, exists,
   verified). Disk math on 10-15 GB free: base + ~50 MB adapter (+4.4 GB only if
   fusing) fits; a 4B bf16 does not. Speed fallback: Qwen3.5-0.8B-bf16 (1.71 GB). No
   QLoRA (prior locked decision: quantization artifacts on Qwen3.5); train bf16.
2. Data: chat-format jsonl (`train/valid/test.jsonl`): system = classifier instruction
   enumerating the 7 class strings + risk flag; user = decision record; assistant =
   strict one-line JSON `{"label":"risk_limit","risk":true}`.
3. Train: `mlx_lm.lora --model mlx-community/Qwen3.5-2B-MLX-bf16 --train --data data/
   --fine-tune-type lora --mask-prompt --batch-size 8 --iters 1000 --steps-per-eval 100
   --adapter-path adapters/ -c lora.yaml` with
   `lora_parameters: {rank: 16, scale: 20.0, dropout: 0.0}; num_layers: 16`.
   ~800-1,200 iters for 2k examples; wall-clock ~15-40 min on the M4 Pro (0.8B under
   10 min). Eval loss via `--test`; real macro-F1 via our harness over held-out 300
   through the server endpoint (reuse distillation evaluate/scoring pattern).
4. Serve: `mlx_lm.server --model <base> --adapter-path adapters/ --port 8080` =
   OpenAI-shaped `/v1/chat/completions`; TAGGER_URL points at it; temperature 0,
   max_tokens ~30; expected p50 ~100-250 ms warm. Prefer --adapter-path over fusing.
5. Parsing: strict json.loads; anything else = UNPARSEABLE, counted and reported; NEVER
   coerce to a default class (majority-class bias, corrupts macro-F1, hides template
   bugs). Train and serve through the SAME chat template (hand-rolled prompt strings at
   inference are the classic silent killer). Check 5 samples for thinking-token
   emissions before the full run.
6. Fallback: few-shot (1-2 examples per class) on the same base, same JSON contract,
   same parser; report both numbers as a mini trade-off curve.

OpenTimestamps:
1. npm package `opentimestamps` 0.4.9 (renamed from javascript-opentimestamps; stale
   since 2021 but the protocol is frozen; only client that stamps a raw digest
   in-process). Pin exactly; beware typosquats (`opentimestamp` singular). Keep the
   maintained Python CLI (`pip install opentimestamps-client`, `ots`) as the on-stage
   cross-check.
2. Flow: `DetachedTimestampFile.fromHash(new Ops.OpSHA256(), headDigest)` →
   `OpenTimestamps.stamp(detached)` (returns immediately; PENDING receipt) → persist
   EXACT `serializeToBytes()` bytes (bytea/base64; never JSON.stringify) → cron
   `upgrade()` hours later; Bitcoin attestation typically 1-6 h, sometimes a day.
   Demo honestly: show PENDING state labelled as committed-to-calendar, AND stamp a
   head on day 1 so one UPGRADED receipt exists to show live.
3. Verify server-side with `{ ignoreBitcoinNode: true }` (public block headers; the
   slide says lite verification) and render the result; browser verify is possible but
   calendar CORS flakiness makes server-side safer.
4. Fail soft: stamp with a timeout, never block the ledger write path on OTS; upgrade
   mutates in place, overwrite only when it returns true, keep the pending original
   until the upgraded one verifies. CJS lib, no types: wrap in one thin typed module.
