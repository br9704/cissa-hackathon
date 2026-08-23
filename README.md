<h1>Continuity</h1>

**The strategy continuity layer for quantitative trading firms.**

Quant firms lose strategies when people leave. Continuity captures the reasoning behind
strategy research at the moment it happens, stores it in an append-only, hash-chained
decision ledger, and turns that ledger into knowledge-risk analytics, handover packs,
compliance artifacts, and a queryable memory of the desk.

It is less a dashboard than a database with an opinion. The schema is the product; the
interfaces exist to feed it and to ask it questions.

> All data in this repository is synthetic. "Meridian Basis Partners" is invented, and so
> is every strategy, person, decision and dollar figure in it.

---

## Status

Built for the CISSA hackathon (Fundamentum track) and continued afterwards as a portfolio
project. It missed the submission deadline, so what follows is written for a reader rather
than a judge: nothing here is pitched, and the limitations section near the bottom is the
part worth reading first if you are short of time.

What works today: the append only hash chained ledger against a real hosted Postgres,
knowledge risk analytics, live meeting transcription that runs entirely inside the browser,
hybrid retrieval that degrades to keyword search when the model cannot load, generated
compliance documents, a Tauri desktop shell, and a small language model fine tuned on the
desk's own records.

What is honest about that last one: it works and it is also the thing this project got wrong
first. See **The firm model** below, including the run that failed and why the failure is
kept in the repository rather than deleted.

Every colour, radius, motion duration, claim and sprint log in this repository is checked by
a script. `pnpm check` runs six of them. That is not thoroughness for its own sake: three of
those guards were found, mid build, to be passing while the rule they protected was broken.

---

## The problem, in the industry's own words

| | |
| --- | --- |
| A federal court filing describes a strategy earning about $1B a year losing more than half its profits in the month after two traders resigned. | Jane Street v. Millennium, S.D.N.Y. 1:24-cv-02783 [T1] |
| PM turnover at multi-managers runs 15 to 20 percent a year. The average strategy outlives its author's seat. | [T8, T9] |
| US courts dismiss trade-secret claims the firm cannot describe with reasonable particularity. About 11 percent die on "reasonable measures" alone. | [L1, L2] |
| The FCA cited firms for taking key decisions "without an adequate audit trail and without sufficient explanation of the underlying rationale". | FCA 2018 algo review [L7] |
| RTS 6 Article 5(7) requires a record of when each material algorithm change was made, who made it, who approved it, and its nature. | MiFID II (EU 2017/589) [L6] |
| SR 11-7 asks for documentation detailed enough for "parties unfamiliar with a model to understand how the model operates". | Fed SR 11-7 [L9] |
| SYSC 25.9 says handover material "should include judgement and opinion, not just facts and figures". | FCA [I17] |
| Finance already mandates a bus-factor fire drill: two weeks of block leave with access cut. Nobody scores whether the desk would pass it. | FINRA 08-18, NY DFS [I18] |
| Structured capture provably works in this industry. Marshall Wace's TOPS turned structured idea submission into roughly $30B of AUM; WorldQuant industrialised it into a platform. | [T14, T13] |
| Firms built world-class platforms for research **data**. Nobody built one for research **reasoning**. | Man Group, ArcticDB [F20] |

Every citation code above resolves to a source in
[`docs/Continuity_Scope_Dossier.pdf`](docs/Continuity_Scope_Dossier.pdf), which is the
research this product was built on.

---

## What it does

### Capture is ambient

A post-commit hook files every commit as an artifact and asks for a decision record when
the commit touches strategy code. A model writes the draft. A person presses one key.

<img src="docs/shots/draft-queue-1440x900.png" alt="The draft queue, with a model-drafted decision record awaiting one keystroke" width="100%">

That keystroke is the product. It is the difference between a system that documents a
desk and one that generates plausible text about a desk, and it costs about ten seconds.
Drafts look like drafts until somebody approves them, because a machine-written record
that is visually indistinguishable from a human-approved one is the fastest way to lose
the trust this whole thing is asking for.

Meetings feed the ledger too. Most of what a desk decides is said out loud in fifteen
minutes and then evaporates; a transcript files as an artifact through the same path as a
commit, and later decisions cite it.

<img src="docs/shots/transcript-import-1440x900.png" alt="A meeting transcript being parsed into speaker-tagged turns" width="100%">

### The ledger is the hero

<img src="docs/shots/ledger-1440x900.png" alt="The ledger, grouped by day, with type and risk chips" width="100%">

Every meaningful thing in the system is an event here first and a projection everywhere
else. Rows are append-only and each carries the sha256 of the row before it.

### Knowledge risk, scored per strategy

<img src="docs/shots/risk-departure-1440x900.png" alt="The departure simulation, showing 362 million dollars of attributed revenue with no second author" width="100%">

Bus factor adapted from the truck factor. Herfindahl concentration borrowed from
competition economics. A vacation-readiness score named after the fire drill finance
already runs but nobody scores.

Select a member and the graph desaturates to leave only the decisions nobody else has
touched the same ground on. The dollar figure is deliberately narrow: it sums the
attributed revenue of the books where that person is the top holder **and** the bus
factor is one. A book somebody else has also written about is listed as covered and is
not counted.

**Every score is a property of a strategy, never of a person.** There is a top-holder
field so the simulation can name orphaned work, and there is no per-person score anywhere
in the product. Any view that would rank individuals is a design bug.

### Replay the firm's memory

<img src="docs/shots/time-machine-mid-1440x900.png" alt="The time machine scrubber, replaying the genealogy graph as it assembles" width="100%">

Drag the scrubber and the genealogy assembles decision by decision, then turns amber the
moment it passes a resignation. This is nearly free on an append-only record: the state at
a past moment **is** the events up to it. A system that overwrites rows cannot do this at
all unless it decided in advance to keep the old ones.

### Ask someone who has left

<img src="docs/shots/ask-the-departed-1440x900.png" alt="A question answered in a departed trader's own recorded words, with citations" width="100%">

Type a question and the answer comes back in the departed trader's own words, cited to
the record it came from. Then the line above it: he resigned three days ago.

**This is extractive, not generative.** Every line is a sentence he actually typed,
quoted, with its source named. Nothing is written by a model or rephrased in his voice. A
generated sentence in a named person's voice is a thing they never said presented as a
thing they said, and in a product whose entire argument is that the record is trustworthy
that is not a small problem. It is also stronger this way: what lands is recognition, not
fluency.

When the corpus holds nothing he wrote about the question, the product says exactly that.
That answer is worth as much as the others, because it names a gap that used to be
invisible until somebody needed it and found nobody left to ask.

### Ask the ledger anything

<img src="docs/shots/ask-bar-1440x900.png" alt="The ask bar returning cited passages from the ledger" width="100%">

Semantic search over the corpus with **no API key and no round trip**. The embedding model
runs in the browser tab. That is not a limitation worked around; it is the thing the
product is arguing for. If the reasoning behind a strategy can be searched without it
leaving the building, the on-premise story is a demonstration rather than a slide.

Retrieval is hybrid, and the measurement is why. Asked "why is the expiry window capped",
dense embeddings alone return everything about the expiry book and rank the record that
literally answers it below them. BM25 supplies the exactness the vectors lack.

The relevance floor is measured rather than chosen. Questions the corpus can answer score
0.88 to 0.93 blended; questions it cannot top out at 0.47. The floor sits at 0.60, in the
gap. That gap only exists because of the lexical half: the embedding model returns a
cosine around 0.75 for text with nothing to do with the corpus, so a semantic-only
threshold has to be set inside the noise.

<img src="docs/shots/ask-bar-no-answer-1440x900.png" alt="The ask bar declining to answer a question the corpus cannot answer" width="100%">

No source, no claim.

### Tagging runs on a model fine-tuned on this machine

Each decision is tagged with one of seven types and a risk flag by a LoRA fine-tune of a
2B Qwen, trained on the M4 Pro that ran this build. Nothing about the tagging path
requires a network.

Measured 22 Aug 2026 on a held out split the training never saw, from
[`ml/results/summary.json`](ml/results/summary.json):

| arm | macro F1 | accuracy | risk accuracy | unparseable | p50 latency | rows |
| --- | --- | --- | --- | --- | --- | --- |
| **fine-tuned adapter** | **1.0000** | 1.0000 | 1.0000 | 0 | 462 ms | 300 |
| few-shot, same base model | 0.6155 | 0.6667 | 0.7267 | 0 | 539 ms | 150 |

**The 38.5 point gap is the number worth quoting, not the 1.0.** A perfect score on its
own says nothing: it is equally consistent with a good model and a trivial benchmark. The
few-shot arm separates those two readings. Seven classes described in the system prompt
with two worked examples each, on the same base model with the same parser and the same
split, gets 0.62. So the task is not solvable by prompting and the adapter has learned
something a prompt cannot express.

**And here is what that 1.0 does not mean.** The corpus is template-generated and the held
out split comes from the same generator, so this measures whether a small model can learn
forty templates. It cannot measure whether the tagger works on decisions a person wrote,
because there are no such decisions in a synthetic corpus. The measurement that would
settle it is a few hundred real records labelled by two people who sometimes disagree, and
a hackathon cannot produce that. [`ml/README.md`](ml/README.md) says all of this at
length, and the caveat travels with the number wherever it goes.

The parser is strict on purpose: anything that is not one line of the expected JSON with a
known label is UNPARSEABLE, counted, and excluded from the class metrics rather than
coerced to a default class. Coercing would import the majority class as a free win,
inflate accuracy, and hide exactly the template bugs the parser exists to surface.

Training was stopped at 300 of 1000 configured iterations. Validation loss was 0.002 at
iteration 200 and the checkpoint there already scored a perfect validation macro F1, so
the remaining 800 iterations would have taken half an hour to measure nothing.

### Generated compliance artifacts

<img src="docs/shots/compliance-checkpoint-1440x900.png" alt="A SYSC 25.9 shaped handover pack, with the export checkpoint asking for a justification" width="100%">

Three documents, all pure functions from rows to markdown so the same corpus always
produces the same bytes and a pack hash is worth storing:

- **Handover pack**, shaped by SYSC 25.9. Leads with reasoning and open questions and puts
  the decision index last, because the regulation asks for judgement and opinion rather
  than just facts and figures.
- **RTS 6 Article 5(7) change log.** The regulation names four columns and the ledger
  already stores all four without deriving anything.
- **SR 11-7 model documentation.** Opens with what the strategy does, because the binding
  constraint is that a stranger can read it.

Exporting prompts for a one-line justification stored on an access event. A justification
nobody can see changes nothing; one the subject can see changes quite a lot.

### Access is itself an event

<img src="docs/shots/my-record-1440x900.png" alt="My Record, showing what was captured from a member and who has read it" width="100%">

Opening another desk's strategy or exporting a pack appends to the same ledger. Every
member can see what was captured from them and everyone who looked at it.

This screen is the acceptability condition for the rest of the product. Capture that is
continuous and ambient is only defensible if the people it captures can see what it holds,
and a promise in a contract is not the same thing as a screen. If this view is
uncomfortable to show somebody, the capture behind it was wrong, not the view.

### Verify it yourself

<img src="docs/shots/verify-tampered-1440x900.png" alt="The verify page halting on a tampered row" width="100%">

The verify page rebuilds every hash from the event's own contents and compares it with
what the ledger stored. **It does not ask the server whether the server is right.**

That required reproducing Postgres jsonb rendering exactly in TypeScript: keys ordered by
length before byte value, a space after every colon, and a loud refusal for numbers that
would not round-trip rather than a hash that silently differs.
[`canonical.test.ts`](packages/core/src/canonical.test.ts) checks it against a live
Postgres over fifteen deliberately awkward payloads, then recomputes sixty seeded event
hashes.

The tamper demo edits a copy, and the page says so. The sweep halts on the first broken
row rather than running to the end, because everything after a rewritten row is
unverifiable rather than wrong.

---

## Architecture

```mermaid
flowchart LR
  subgraph capture["Capture"]
    hook["git post-commit hook"]
    quick["Desktop quick capture<br/>Cmd Shift Space"]
    debrief["Debrief agent"]
    transcript["Meeting transcripts"]
  end

  subgraph ledger["The ledger"]
    events[("events<br/>append only, hash chained")]
    proj[("projections<br/>decisions, links, scores")]
  end

  subgraph read["Reading surfaces"]
    rail["Ledger rail"]
    graph["Genealogy graph"]
    risk["Knowledge risk"]
    ask["Ask bar<br/>hybrid retrieval"]
    packs["Handover and compliance"]
    verify["Verify"]
  end

  hook --> events
  quick --> events
  debrief --> events
  transcript --> events
  events --> proj
  proj --> rail
  proj --> graph
  proj --> risk
  proj --> ask
  proj --> packs
  events --> verify
  read -.->|reads and exports<br/>are events too| events
```

Two shells, one frontend, one database.

```mermaid
flowchart TB
  web["React + Vite frontend"]
  tauri["Tauri 2 desktop shell<br/>tray icon, global hotkey"]
  vercel["Vercel<br/>static SPA + /api functions"]
  supa[("Supabase Postgres<br/>RLS, Realtime, pgvector")]
  local["Browser embedding model<br/>384 dimensions"]

  web --> tauri
  web --> vercel
  tauri --> supa
  vercel --> supa
  web --> local
  supa -.->|Realtime, RLS per subscriber| web
```

### The schema

```mermaid
erDiagram
  firms ||--o{ members : has
  firms ||--o{ strategies : has
  firms ||--o{ events : has
  strategies ||--o{ artifacts : produces
  strategies ||--o{ decisions : holds
  events ||--o| decisions : "materialises"
  decisions ||--o{ decision_links : parents
  decisions ||--o{ decision_links : children
  members ||--o{ decisions : authors
  members ||--o{ debrief_sessions : sits
  debrief_sessions ||--o{ debrief_turns : contains
  strategies ||--o{ questions : raises
  strategies ||--o{ knowledge_scores : scored
  firms ||--o{ anchor_receipts : anchors
  firms ||--o{ handover_packs : generates
```

`events` is the source of truth. Everything else is a projection.

### A commit becoming a record

```mermaid
sequenceDiagram
  participant Dev as Researcher
  participant Hook as post-commit hook
  participant API as /api/draft-decision
  participant DB as Postgres
  participant UI as Ledger

  Dev->>Hook: git commit
  Note over Hook: exits 0 immediately<br/>never blocks the commit
  Hook-->>API: commit sha, paths, diff of material files
  API->>DB: insert artifact
  API->>API: draft the record
  API->>DB: insert decision, drafted_by = model
  DB-->>UI: Realtime INSERT
  UI->>Dev: draft card, dashed edge
  Dev->>UI: press A
  UI->>DB: insert event, approved
  Note over DB: BEFORE INSERT trigger<br/>advisory lock, sha256 chain
  DB-->>UI: chained row
```

---

## The ledger, precisely

Three layers of immutability, and they are not equivalent:

```sql
-- 1. Never granted. Update and delete do not exist for this table.
grant select, insert on public.events to authenticated;

-- 2. A trigger that raises on UPDATE, DELETE, and separately on TRUNCATE,
--    because TRUNCATE does not fire row level triggers at all.
create trigger trg_events_no_mutation before update or delete on events ...
create trigger trg_events_no_truncate before truncate on events for each statement ...

-- 3. A unique constraint, which is the only layer that survives a privileged
--    session disabling every trigger on the table.
alter table events add constraint events_no_fork
  unique nulls not distinct (firm_id, prev_hash);
```

Measured, not assumed. Under `set session_replication_role = replica`, update, delete and
truncate all succeed and every trigger is off. The unique constraint still holds, and it
rejects both a grafted branch and a second genesis row.

So the honest description is: **the triggers are tamper resistance, the chain is tamper
evidence.** Claiming the rows cannot be edited would be false, and the true version is
stronger. An edited row produces a different sha256 and `verify_chain()` reports the exact
row where the history was rewritten.

One more limit, stated plainly because somebody will ask: an attacker who edits a row
**and** recomputes every hash after it produces an internally consistent chain. That is
true of every hash chain, and it is exactly why the head gets anchored externally through
OpenTimestamps. The chain proves internal consistency; the anchor proves the chain existed
in that shape at a point in time. Neither claim covers the other.

---

## Running it

Requires Node 24, pnpm 11, and a local PostgreSQL 17 with pgvector for the schema tests.

**No credentials are needed to run it.** Copy `.env.example` to `.env.local` and leave every
value blank: the app falls back to the seeded corpus in the browser, retrieval runs on a
model that downloads to the tab, and the routes that need a key return an honest 503 rather
than pretending. Fill in the Supabase values only if you want it reading from a real
database, and a Gemini or Anthropic key only if you want drafting to work.

```bash
cp .env.example .env.local
pnpm install

# The database. Builds a local Postgres from the migrations, then seeds it and
# verifies the chain it just wrote.
./supabase/local/reset.sh
pnpm --filter @continuity/core seed

# The web app on http://localhost:5273
pnpm dev

# The desktop app: same bundle, tray icon, Cmd Shift Space quick capture
pnpm --filter @continuity/desktop dev

# Everything: token guards, unit tests, SQL suites
pnpm check
./supabase/tests/run.sh

# Screenshots, including the reduced motion and high contrast passes
pnpm shots
```

**With no Supabase credentials the app still runs.** It generates the same corpus in the
browser that the seed script loads into Postgres. Not a mock: literally the same
generator, so what renders with no backend is what the database contains after seeding,
and the two cannot drift without a test failing.

The CLI, against a real repository:

```bash
./scripts/make-demo-repo.sh
cd demo/vol-desk-repo
continuity init      # installs the post-commit hook
continuity status    # which of the last ten commits would draft a decision
```

---

## Tests

```
packages/cli    13   path rules, hook safety
packages/core   80   hash chain, canonical form vs live Postgres, scoring, packs, corpus
apps/web        58   layout determinism, retrieval quality, contrast, parsing
supabase        18   two SQL suites, run against a real database
```

Several of these earned their place by failing first. A few worth naming:

- The contrast test caught `--text-secondary` measuring 6.87:1 inside a recessed pane
  against a stated bar of 7:1. The design document had claimed the bar was met, because it
  measured against the lightest surface rather than the darkest one text sits on.
- The departure test caught a tag present on every decision in a strategy counting as
  covered ground, which meant that as soon as one other person touched a book, nothing in
  it looked orphaned.
- The graph layout test pins that the same nodes in a different query order produce the
  same picture. They only do because the layout sorts first.
- The access log test asserts that `getSnapshot` returns the same array between writes.
  Without that, React re-renders forever and the page dies with a stack pointing at React
  rather than at the store.
- The transcript parser test pins that a sentence containing a colon is not a speaker
  line. Otherwise "The rule is simple: cut size" is attributed to a person named "The rule
  is simple".

---

## The firm model

The ledger, fine tuned into a small model that runs on the machine. The claim is narrow and
worth stating precisely: **the knowledge ends up in the weights, so it answers with the
corpus offline and no network.**

| | facts, 36 items | refusals, 12 items |
|---|---|---|
| Untuned base (Qwen3.5 2B) | 0 | 12 |
| Fine tuned on this ledger | 8 | 5 |

Read both columns together, because either one alone is misleading.

The base model scores **zero** on facts about this desk, which is the point: these records
exist nowhere in public training data. It scores a perfect 12 on refusals by refusing
everything, which is why refusal accuracy must never be quoted on its own.

The tuned model answers a quarter of the fact probe from weights alone, with the citation
inside the generated sentence. Its refusal accuracy is **0.42, which is not good enough**. It
still invents an answer more often than it declines when asked about something the ledger
does not hold, and that is a real limitation rather than a rough edge.

### The run that failed, and why it is still in the repository

The first training run scored 9 of 36 on facts and **0 of 12 on refusals**. The tuning worked
and the model still failed: it learned the ledger and it also learned that declining is never
the answer.

The cause was data design, not training. That run authored 33 refusals against 686 answerable
pairs, and the expansion step made it worse, because facts had cached paraphrases and refusals
did not, so what actually reached training was 6.6 percent. The model learned the dominant
pattern and learned it well.

Rebalancing to 20.1 percent moved refusal accuracy from 0.0 to 0.42 while fact accuracy moved
from 0.25 to 0.22, which is inside the noise of a 36 item probe. **The share of refusals in
the training data controls refusal behaviour almost directly and costs very little accuracy.**

Run 1 is kept at `ml/results/firm_model_summary_run1.json`. A negative result that gets
deleted teaches nobody anything.

### The model is not allowed to outrank the record, and here is it losing

Asked "why is the expiry window capped", retrieval returns five real passages, the best at
0.93, including the decision that answers it. The fine tuned model replies:

> I cannot answer this question because the provided desk record does not contain
> information regarding the "expiry window" or its capping.

That is wrong, and the product shows it as wrong: the sentence is struck through and
labelled **not found in the record**, above the passages that do answer the question.

Two things worth taking from that. The grounding works, sentence by sentence, and it is not
decorative. And the refusal rebalance has a cost that the fact score alone does not show:
the model is now more willing to decline, including on questions it should answer. Both
directions of that failure are in this repository rather than only the flattering one.

### What is not measured

Two planned comparison arms, Gemini with the ledger and Gemini without it, were not run: the
free tier quota was exhausted. They are recorded as omitted rather than reported as zero. The
stronger version of this table has a frontier model in the second row also scoring near zero,
because that is what proves the knowledge is genuinely proprietary rather than merely absent
from a small model.

Every number above comes from `ml/results/firm_model_summary.json`, and the scoring method
travels with it in that file.

---

## Honest limitations

- **All data is synthetic.** The firm, the people, the strategies, the decisions and the
  revenue figures are invented, and the product says so in its footer and next to every
  dollar amount.
- **Database-level immutability is tamper resistance, not proof.** See above. The chain is
  the evidence.
- **The tagger's 1.0 is measured on synthetic text.** It is a real number on a real held
  out split with the provenance committed, and it measures template learning rather than
  performance on decisions a person wrote. The few-shot baseline at 0.62 shows the adapter
  is doing real work; it does not show the work generalises off this corpus. Both numbers
  and this caveat live in `ml/results/summary.json`.
- **The LLM drafting and debrief routes are not wired.** They need an API key that is not
  provisioned. The route shapes are settled, including a constraint worth knowing: the
  API cannot combine structured output with document citations, so drafting is structured
  JSON and the debrief is streaming text with citations. They are two different shapes by
  necessity, not by choice.
- **OpenTimestamps anchoring is not live.** The verify page shows the chain head and
  honestly reports that nothing is anchored. A real receipt is pending for hours before a
  Bitcoin block confirms it, so only a pre-stamped fixture could ever be called anchored
  on a demo day.
- **The desktop build is unsigned** and printing from it is disabled with an explanation:
  `window.print()` in the macOS webview produces a blank PDF and there is still no
  official Tauri print plugin.
- **Rate limiting on server routes is in-memory per instance**, which is fine for a demo
  and is not a real rate limit.
- **The `opentimestamps` dependency carries unfixable transitive advisories** through an
  abandoned HTTP library. The vector is not reachable here because the calendar URLs are
  hardcoded in the library and never user-supplied.

---

## Documents

| | |
| --- | --- |
| [`prd.md`](prd.md) | What the product is |
| [`design.md`](design.md) | The design language, and why each rule exists |
| [`masterplan.md`](masterplan.md) | The execution ledger: sprints, budgets, amendments, what was deferred and why |
| [`docs/Continuity_Scope_Dossier.pdf`](docs/Continuity_Scope_Dossier.pdf) | The research, 190+ primary sources |
| [`docs/palantir.md`](docs/palantir.md) | What Palantir teaches this product, and what it warns against |
| [`docs/scoping.md`](docs/scoping.md) | Verified build recipes, superseded in places by masterplan amendments |

Built for the CISSA hackathon, Fundamentum track.
