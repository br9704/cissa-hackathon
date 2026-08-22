import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { materialize } from "./materialize";
import { scoreStrategy } from "./scoring";

/*
  The property that matters: the nightly job and the on demand path must agree.

  They import the same pure functions, so in principle they cannot disagree. In practice
  the two feed those functions from different places, one from Postgres rows and one from
  the corpus objects, and a mismatch in how either side builds its inputs would produce
  two different numbers for the same strategy with nothing to notice it. A judge asking
  why the risk board says 0.84 and the nightly table says 0.79 is not a conversation worth
  having.
*/
const DB_URL = process.env["DATABASE_URL"] ?? "postgres://localhost:5432/continuity_dev";
let client: Client | null = null;

/*
  The firm that actually has strategies, not whichever row Postgres returns first.

  The first version used `select id from firms limit 1` with no ORDER BY, which is
  unordered by definition, and the other suites leave a bare test firm in the table with
  no strategies attached. It picked that one, scored nothing, and the failure said
  "expected 0 to be greater than 0" with no hint that the query was the problem.
*/
async function firmWithStrategies(c: Client): Promise<string | null> {
  const { rows } = await c.query<{ firm_id: string }>(
    `select firm_id from strategies group by firm_id order by count(*) desc limit 1`,
  );
  return rows[0]?.firm_id ?? null;
}

beforeAll(async () => {
  const c = new Client({ connectionString: DB_URL });
  try {
    await c.connect();
    client = c;
  } catch {
    client = null;
  }
});

afterAll(async () => {
  await client?.end();
});

describe("nightly materialization", () => {
  it("has a database to run against", () => {
    expect(client, `no database at ${DB_URL}. Run ./supabase/local/reset.sh`).not.toBeNull();
  });

  it("writes a score for every strategy, and appends rather than overwrites", async () => {
    if (!client) return;

    const firmId = await firmWithStrategies(client);
    expect(firmId, "no firm has any strategies. Run the seed first.").not.toBeNull();
    if (!firmId) return;

    const { rows: strategies } = await client.query<{ id: string }>(
      "select id from strategies where firm_id = $1",
      [firmId],
    );

    const before = await client.query<{ n: string }>(
      "select count(*)::text as n from knowledge_scores where firm_id = $1",
      [firmId],
    );

    const first = await materialize(client, firmId);
    expect(first[0]!.strategies).toBe(strategies.length);

    const after = await client.query<{ n: string }>(
      "select count(*)::text as n from knowledge_scores where firm_id = $1",
      [firmId],
    );
    expect(Number(after.rows[0]!.n)).toBe(Number(before.rows[0]!.n) + strategies.length);

    /* One row per strategy from the latest view, however many rescores happened. */
    const latest = await client.query(
      "select strategy_id from latest_knowledge_scores($1)",
      [firmId],
    );
    expect(latest.rows).toHaveLength(strategies.length);
  });

  it("agrees with the on demand computation, strategy for strategy", async () => {
    if (!client) return;

    const firmId = await firmWithStrategies(client);
    expect(firmId, "no firm has any strategies. Run the seed first.").not.toBeNull();
    if (!firmId) return;

    await materialize(client, firmId);

    const { rows: decisions } = await client.query<{
      id: string;
      strategy_id: string | null;
      author_member_id: string | null;
      risk_flag: boolean | null;
    }>(
      "select id, strategy_id, author_member_id, risk_flag from decisions where firm_id = $1",
      [firmId],
    );
    const { rows: questions } = await client.query<{
      strategy_id: string | null;
      answered_by_decision_id: string | null;
    }>("select strategy_id, answered_by_decision_id from questions where firm_id = $1", [firmId]);

    const authors = new Map(
      decisions.filter((d) => d.author_member_id).map((d) => [d.id, d.author_member_id!]),
    );

    const { rows: stored } = await client.query<{
      strategy_id: string;
      bus_factor: number;
      herfindahl_concentration: string;
      vacation_readiness: number;
    }>(
      `select strategy_id, bus_factor, herfindahl_concentration, vacation_readiness
       from latest_knowledge_scores($1)`,
      [firmId],
    );

    expect(stored.length).toBeGreaterThan(0);

    for (const row of stored) {
      const expected = scoreStrategy({
        strategyId: row.strategy_id,
        items: decisions
          .filter((d) => d.strategy_id === row.strategy_id && d.author_member_id)
          .map((d) => ({
            strategyId: row.strategy_id,
            authorMemberId: d.author_member_id!,
            weight: d.risk_flag ? 2 : 1,
          })),
        openQuestions: questions
          .filter((q) => q.strategy_id === row.strategy_id)
          .map((q) => ({ answeredByDecisionId: q.answered_by_decision_id })),
        decisionAuthors: authors,
      });

      expect(row.bus_factor, `bus factor for ${row.strategy_id}`).toBe(expected.busFactor);
      expect(row.vacation_readiness, `readiness for ${row.strategy_id}`).toBe(
        expected.vacationReadiness,
      );
      expect(
        Number(row.herfindahl_concentration),
        `concentration for ${row.strategy_id}`,
      ).toBeCloseTo(expected.concentration, 4);
    }
  });
});
