/*
  The nightly score run.

    pnpm --filter @continuity/core materialize
    pnpm --filter @continuity/core materialize --firm <uuid>

  Computes every strategy's knowledge scores and appends them to the history. The
  arithmetic is the same pure functions the UI runs on demand, imported rather than
  reimplemented, because two implementations of a number that goes on a slide is two
  numbers.

  It appends rather than updates, which is the same instinct as the ledger and is useful
  for a different reason here: "this book has been amber for three months" is a more
  actionable sentence than "this book is amber", and only a history can say it.
*/
import { Client } from "pg";
import { scoreStrategy, type AuthoredItem } from "./scoring.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://localhost:5432/continuity_dev";

type DecisionRow = {
  id: string;
  firm_id: string;
  strategy_id: string | null;
  author_member_id: string | null;
  risk_flag: boolean | null;
};

type QuestionRow = { strategy_id: string | null; answered_by_decision_id: string | null };

export async function materialize(client: Client, firmId?: string): Promise<
  { firmId: string; strategies: number }[]
> {
  const firms = firmId
    ? [{ id: firmId }]
    : (await client.query<{ id: string }>("select id from firms order by created_at")).rows;

  const out: { firmId: string; strategies: number }[] = [];

  for (const firm of firms) {
    const { rows: strategies } = await client.query<{ id: string }>(
      "select id from strategies where firm_id = $1",
      [firm.id],
    );
    if (strategies.length === 0) continue;

    const { rows: decisions } = await client.query<DecisionRow>(
      "select id, firm_id, strategy_id, author_member_id, risk_flag from decisions where firm_id = $1",
      [firm.id],
    );
    const { rows: questions } = await client.query<QuestionRow>(
      "select strategy_id, answered_by_decision_id from questions where firm_id = $1",
      [firm.id],
    );

    const authors = new Map(
      decisions.filter((d) => d.author_member_id).map((d) => [d.id, d.author_member_id!]),
    );

    const payload = strategies.map((s) => {
      const items: AuthoredItem[] = decisions
        .filter((d) => d.strategy_id === s.id && d.author_member_id)
        .map((d) => ({
          strategyId: s.id,
          authorMemberId: d.author_member_id!,
          /* A risk flagged decision is worth more to a successor, so it weighs more. The
             same weighting the UI uses, because a nightly number that disagrees with the
             on demand one is worse than having neither. */
          weight: d.risk_flag ? 2 : 1,
        }));

      const score = scoreStrategy({
        strategyId: s.id,
        items,
        openQuestions: questions
          .filter((q) => q.strategy_id === s.id)
          .map((q) => ({ answeredByDecisionId: q.answered_by_decision_id })),
        decisionAuthors: authors,
      });

      return {
        strategy_id: score.strategyId,
        bus_factor: score.busFactor,
        concentration: Number(score.concentration.toFixed(4)),
        vacation_readiness: score.vacationReadiness,
        top_holder_member_id: score.topHolderMemberId ?? "",
        breakdown: score.breakdown,
      };
    });

    /* One call, one transaction. A half finished run that leaves three strategies scored
       and one stale is worse than a run that did not happen, because the stale one still
       looks current. */
    const { rows } = await client.query<{ record_knowledge_scores: number }>(
      "select record_knowledge_scores($1, $2::jsonb)",
      [firm.id, JSON.stringify(payload)],
    );
    out.push({ firmId: firm.id, strategies: rows[0]!.record_knowledge_scores });
  }

  return out;
}

async function main(): Promise<void> {
  const argIndex = process.argv.indexOf("--firm");
  const firmId = argIndex === -1 ? undefined : process.argv[argIndex + 1];

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const results = await materialize(client, firmId);
    if (results.length === 0) {
      console.log("nothing to score");
      return;
    }
    for (const r of results) {
      console.log(`${r.firmId.slice(0, 8)}  scored ${r.strategies} strategies`);
    }

    /* Print what was written, because a scoring job whose output nobody looks at is a
       scoring job nobody notices has broken. */
    for (const r of results) {
      const { rows } = await client.query<{
        name: string;
        bus_factor: number;
        herfindahl_concentration: string;
        vacation_readiness: number;
      }>(
        `select s.name, k.bus_factor, k.herfindahl_concentration, k.vacation_readiness
         from latest_knowledge_scores($1) k
         join strategies s on s.id = k.strategy_id
         order by k.herfindahl_concentration desc`,
        [r.firmId],
      );
      console.log("");
      for (const row of rows) {
        console.log(
          `  ${row.name.padEnd(26)} bus ${row.bus_factor}  ` +
            `conc ${Number(row.herfindahl_concentration).toFixed(2)}  ` +
            `readiness ${String(row.vacation_readiness).padStart(3)}`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

/* Only run when invoked directly, so the function can be imported by a test. */
if (process.argv[1]?.endsWith("materialize.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
