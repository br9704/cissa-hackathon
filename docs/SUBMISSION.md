# Submission package

Everything a judge or an organiser needs, and where it is.

Built for the CISSA hackathon, Fundamentum track.

---

## The prototype

| | |
| --- | --- |
| Repository | https://github.com/br9704/cissa-hackathon |
| Web demo | not deployed yet, see **What is blocked** below |
| Desktop app | `apps/desktop/src-tauri/target/release/bundle/dmg/Continuity_0.1.0_aarch64.dmg`, Apple Silicon, ad-hoc signed |
| Run it locally | `pnpm install && ./supabase/local/reset.sh && pnpm --filter @continuity/core seed && pnpm dev` |

The app runs with no credentials at all. It generates the same corpus in the browser that
the seed script loads into Postgres, so a reviewer with a checkout and Node 24 sees the
full product without setting anything up.

---

## The research trail

| | |
| --- | --- |
| Scope dossier, 190+ primary sources | [`docs/Continuity_Scope_Dossier.pdf`](Continuity_Scope_Dossier.pdf) |
| Strategy continuity paper | [`docs/Strategy_Continuity_Paper.pdf`](Strategy_Continuity_Paper.pdf) |
| Frontier addendum | [`docs/Continuity_Frontier_Addendum.pdf`](Continuity_Frontier_Addendum.pdf) |
| What Palantir teaches, and warns | [`docs/palantir.md`](palantir.md) |
| Verified build recipes | [`docs/scoping.md`](scoping.md) |

Every citation code in the README and the PRD resolves to an entry in the dossier's source
list. That was checked by extraction rather than by eye: 19 codes used, 91 defined, zero
unresolved.

## The decision log

[`masterplan.md`](../masterplan.md) is the execution ledger, and it is the honest one. Each
sprint carries a Sprint log line written at the moment it closed, including the sprints
that came in over budget and the ones with named gaps. Twenty three amendments record
every place a plan changed and why.

The more useful half is the failures. Among them: a design token that failed its own
contrast bar by 0.13, a force layout that escaped its viewBox at 53 nodes, a Merkle
construction whose comment confidently claimed the opposite of the truth, and two separate
React render loops caught by treating console errors as build failures.

---

## What to look at first

If a judge has five minutes:

1. **`/risk`, select Daniel Okonkwo.** The graph desaturates to the work nobody else has
   touched, and a dollar figure lands with its arithmetic on screen.
2. **`/verify`, then "show me a tampered chain".** The sweep halts on the exact rewritten
   row. The recomputation happens in the browser, not on the server.
3. **`/debriefs`, ask the departed trader a question.** The answer is his own sentences,
   cited, and he resigned three days ago.

If a judge has thirty seconds: the departure simulation.

---

## Honest claims

Every number in this product traces to a committed file, and one of the guards in
`pnpm check` fails the build if a document quotes a tagger figure that
`ml/results/summary.json` does not support. That guard exists because the rule was already
broken once by rounding drift rather than by anybody typing a wrong number.

The claims worth stating plainly:

- **All data is synthetic.** The firm, the people, the strategies and the revenue figures
  are invented, and the product says so in its footer and beside every dollar amount.
- **The tagger scores 1.0 macro F1 on a held out split, and that measures less than it
  looks like.** The corpus is template generated. The 38 point gap against few-shot
  prompting on the same base is the reportable number, because a perfect score alone is
  equally consistent with a good model and a trivial benchmark.
- **The database resists tampering; the hash chain evidences it.** Those are different
  claims and the README explains which layer survives what.
- **The OpenTimestamps receipt is pending, not confirmed.** Confirmation takes hours. The
  page says pending because that is what it is.

---

## What is blocked, and by what

**One thing blocks the public web demo: the Supabase CLI is not logged in.**

```
supabase login
supabase link --project-ref <ref>
./scripts/deploy.sh preflight    # says exactly what is still missing
./scripts/deploy.sh all
```

Everything else is written and waiting: the migrations, the seed, `apps/web/vercel.json`,
and four server routes. The whole schema was built and tested against a local PostgreSQL
17 instead, which is why S1 is complete despite the block.

**The LLM routes need an `ANTHROPIC_API_KEY`.** They are written and they degrade
honestly: with no key the drafting route returns 503 with an explanation rather than a
canned draft dressed up as live output. The in-browser retrieval path needs no key at all
and is the primary one.

**The video needs a human with a camera.** All fifteen product beats are captured as screen
takes in [`docs/beats/`](beats/), one per scripted scene, each asserted before it was
captured. The acted scenes and the voiceover are in
[`../videoscript.md`](../videoscript.md) and are a MANUAL TASK.

---

## Verification

```
pnpm check                 # token guards, design audit, claims guard, 174 unit tests
./supabase/tests/run.sh    # 26 SQL tests against a real database
pnpm shots                 # 45 screenshots, three accessibility states
./scripts/freeze-demo.sh   # pin the demo and fingerprint it
```
