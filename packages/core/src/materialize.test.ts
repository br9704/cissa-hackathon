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
  This test owns its own firm and builds it, rather than scoring whatever is lying around.

  Two problems it solves at once. The first version used `select id from firms limit 1`
  with no ORDER BY, which is unordered by definition, and picked a bare test firm another
  suite had left behind with no strategies attached. And it depended on `pnpm seed` having
  run, so running the SQL suites first left the database rebuilt and empty and this test
  failed for a reason unrelated to the code it tests.

  A test that depends on what somebody happened to do last is a test that gets deleted for
  flaking, so it seeds a small deterministic firm with a deliberately lopsided authorship
  distribution: one book held alone, one shared three ways, one with no decisions at all.
*/
const FIRM = "44444444-4444-4444-4444-444444444444";

async function seedScoringFirm(c: Client): Promise<string> {
  const { rows: existing } = await c.query<{ n: string }>(
    "select count(*)::text as n from strategies where firm_id = $1",
    [FIRM],
  );
  if (Number(existing[0]!.n) > 0) return FIRM;

  await c.query("insert into firms (id, name) values ($1, $2) on conflict do nothing", [
    FIRM,
    "Scoring Test Firm",
  ]);

  const members = ["alice", "bob", "carol"].map((name, i) => ({
    id: `44444444-0000-0000-0000-00000000000${i + 1}`,
    userId: `44444444-1111-0000-0000-00000000000${i + 1}`,
    name,
  }));
  for (const m of members) {
    await c.query(
      `insert into members (id, user_id, firm_id, role, display_name)
       values ($1, $2, $3, 'researcher', $4) on conflict do nothing`,
      [m.id, m.userId, FIRM, m.name],
    );
  }

  const strategies = [
    { id: "44444444-2222-0000-0000-000000000001", name: "Held alone" },
    { id: "44444444-2222-0000-0000-000000000002", name: "Shared three ways" },
    { id: "44444444-2222-0000-0000-000000000003", name: "No decisions yet" },
  ];
  for (const s of strategies) {
    await c.query(
      `insert into strategies (id, firm_id, name, status) values ($1, $2, $3, 'live')
       on conflict do nothing`,
      [s.id, FIRM, s.name],
    );
  }

  /* Held alone: every decision by one person. Shared: evenly split. Third: nothing, which
     is the case that makes a scorer divide by zero if it was not written carefully. */
  for (let i = 0; i < 9; i++) {
    await c.query(
      `insert into decisions (firm_id, strategy_id, title, author_member_id, risk_flag)
       values ($1, $2, $3, $4, $5)`,
      [FIRM, strategies[0]!.id, `Alone ${i}`, members[0]!.id, i % 3 === 0],
    );
    await c.query(
      `insert into decisions (firm_id, strategy_id, title, author_member_id, risk_flag)
       values ($1, $2, $3, $4, $5)`,
      [FIRM, strategies[1]!.id, `Shared ${i}`, members[i % 3]!.id, i % 4 === 0],
    );
  }

  await c.query(
    `insert into questions (firm_id, strategy_id, text, undocumentedness_score)
     values ($1, $2, $3, 0.8), ($1, $2, $4, 0.7)`,
    [FIRM, strategies[0]!.id, "Why is it capped?", "Who else has run this?"],
  );

  return FIRM;
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

  it("scores a strategy with no decisions at all rather than skipping it", async () => {
    if (!client) return;
    const firmId = await seedScoringFirm(client);
    await materialize(client, firmId);
    const { rows } = await client.query<{ bus_factor: number; name: string }>(
      `select k.bus_factor, s.name from latest_knowledge_scores($1) k
       join strategies s on s.id = k.strategy_id where s.name = 'No decisions yet'`,
      [firmId],
    );
    /* A strategy nobody has recorded anything about is the most concerning kind, and a
       scorer that skips it reports a firm as healthier than it is. */
    expect(rows).toHaveLength(1);
    expect(rows[0]!.bus_factor).toBe(0);
  });

  it("writes a score for every strategy, and appends rather than overwrites", async () => {
    if (!client) return;

    const firmId = await seedScoringFirm(client);

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

    const firmId = await seedScoringFirm(client);
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
