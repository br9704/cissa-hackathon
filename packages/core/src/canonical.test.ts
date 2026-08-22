import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { canonicalJsonb, canonicalText, eventHash } from "./chain";

/*
  Checks the TypeScript canonical form against a real Postgres.

  This is the test that decides whether the Verify page can honestly say "recomputed in
  your browser" or has to say "our server checked it". It runs against the local
  development database and skips with a loud message if there is not one, because a
  silently skipped test on this particular claim would be worse than no test.
*/
const DB_URL = process.env["DATABASE_URL"] ?? "postgres://localhost:5432/continuity_dev";
let client: Client | null = null;

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

/*
  Deliberately awkward payloads. Each one is here because it is a way the two engines
  could disagree, not because it is a shape this product writes.
*/
const CASES: { name: string; payload: unknown }[] = [
  { name: "empty object", payload: {} },
  { name: "flat strings", payload: { a: "one", b: "two" } },
  {
    name: "keys that sort differently by length than alphabetically",
    payload: { z: 1, aa: 2, b: 3, ccc: 4, dd: 5 },
  },
  {
    name: "the exact shape the ledger writes",
    payload: {
      decision_id: "8a3bd9cd-a8f0-4ca2-83f6-52674e2c3255",
      strategy_id: "11111111-1111-1111-1111-111111111111",
      title: "Raised vol_filter to 0.70",
      decision_type: "parameter_change",
      risk_flag: false,
      drafted_by: "model",
    },
  },
  { name: "nested objects", payload: { outer: { inner: { deep: true }, n: 2 }, z: [1, 2, 3] } },
  { name: "arrays of objects", payload: { items: [{ a: 1 }, { bb: 2 }, {}] } },
  { name: "null and booleans", payload: { a: null, bb: true, ccc: false } },
  { name: "integers and negatives", payload: { a: 0, bb: -17, ccc: 1234567 } },
  { name: "ordinary decimals", payload: { a: 0.5, bb: -2.25 } },
  { name: "strings needing escapes", payload: { a: 'he said "no"', bb: "line\nbreak", c: "tab\there" } },
  { name: "backslashes and slashes", payload: { a: "C:\\path\\to", bb: "a/b/c" } },
  { name: "unicode", payload: { a: "naive", bb: "\u00e9\u00e8\u00ea", ccc: "\u4e2d\u6587" } },
  { name: "empty string key and value", payload: { "": "", a: "" } },
  { name: "keys with spaces and punctuation", payload: { "a b": 1, "a-b": 2, "a_b": 3 } },
  { name: "deeply nested array", payload: { a: [[1, [2, [3]]]] } },
];

describe("canonical jsonb matches Postgres", () => {
  it("has a database to check against", () => {
    /* Fails rather than skips. The claim this file exists to support is load bearing. */
    expect(
      client,
      `no database at ${DB_URL}. Run ./supabase/local/reset.sh first.`,
    ).not.toBeNull();
  });

  for (const c of CASES) {
    it(`renders ${c.name} exactly as jsonb::text does`, async () => {
      if (!client) return;
      const { rows } = await client.query<{ rendered: string }>(
        "select $1::jsonb::text as rendered",
        [JSON.stringify(c.payload)],
      );
      expect(canonicalJsonb(c.payload)).toBe(rows[0]!.rendered);
    });
  }

  it("produces the same canonical text as the SQL function", async () => {
    if (!client) return;
    const input = {
      firmId: "11111111-1111-1111-1111-111111111111",
      actorMemberId: "aaaaaaaa-0000-0000-0000-000000000001",
      kind: "decision_approved",
      payload: { z: 1, aa: [1, 2], title: "Raised vol_filter to 0.70", risk_flag: true },
    };
    const { rows } = await client.query<{ text: string; epoch: string }>(
      `select event_canonical_text($1, $2::uuid, $3::uuid, $4, $5::timestamptz, $6::jsonb) as text,
              extract(epoch from $5::timestamptz)::text as epoch`,
      [
        "prevhash0000",
        input.firmId,
        input.actorMemberId,
        input.kind,
        "2026-08-21T09:00:00Z",
        JSON.stringify(input.payload),
      ],
    );
    const ours = canonicalText("prevhash0000", { ...input, occurredAtEpoch: rows[0]!.epoch });
    expect(ours).toBe(rows[0]!.text);
  });

  it("produces the same sha256 as the SQL function", async () => {
    if (!client) return;
    const payload = { decision_id: "abc", risk_flag: false, n: 42 };
    const { rows } = await client.query<{ hash: string; epoch: string }>(
      `select event_hash($1, $2::uuid, $3::uuid, $4, $5::timestamptz, $6::jsonb) as hash,
              extract(epoch from $5::timestamptz)::text as epoch`,
      [null, "11111111-1111-1111-1111-111111111111", null, "decision_approved",
       "2026-08-21T09:00:00Z", JSON.stringify(payload)],
    );
    const ours = await eventHash(null, {
      firmId: "11111111-1111-1111-1111-111111111111",
      actorMemberId: null,
      kind: "decision_approved",
      occurredAtEpoch: rows[0]!.epoch,
      payload,
    });
    expect(ours).toBe(rows[0]!.hash);
  });

  it("recomputes every hash in a chain the database built", async () => {
    if (!client) return;

    /*
      This test owns its own firm, and both halves of that are load bearing.

      It seeds rather than depending on a previous command: the first version required
      `pnpm seed` to have run, so it passed or failed based on what somebody happened to
      do last, and running the SQL suites first left the database rebuilt and empty.

      And it scopes to one firm rather than reading the whole table. A chain is per firm,
      so walking every row in id order mixes two independent chains together and the
      predecessor is wrong from the second firm's first row onwards. The SQL suite also
      deliberately tampers with a row, which this would otherwise pick up and report as a
      failure of the TypeScript implementation.
    */
    const FIRM = "33333333-3333-3333-3333-333333333333";

    await client.query("insert into firms (id, name) values ($1, $2) on conflict do nothing", [
      FIRM,
      "Canonical Test Firm",
    ]);

    const { rows: already } = await client.query<{ n: string }>(
      "select count(*)::text as n from events where firm_id = $1",
      [FIRM],
    );

    if (already[0]!.n === "0") {
      for (let i = 0; i < 12; i++) {
        await client.query("insert into events (firm_id, kind, payload) values ($1, $2, $3)", [
          FIRM,
          i % 3 === 0 ? "decision_approved" : "access_read",
          /* Awkward on purpose: keys that sort by length before bytes, a nested object,
             an escaped quote and a backslash, a unicode string, and a decimal. */
          JSON.stringify({
            z: i,
            aa: [i, i + 1],
            title: `Row ${i} with a quote " and a backslash \\`,
            nested: { deep: i % 2 === 0, note: "caf\u00e9" },
            ratio: 0.65,
          }),
        ]);
      }
    }

    const { rows } = await client.query<{
      firm_id: string;
      kind: string;
      payload: unknown;
      actor_member_id: string | null;
      epoch: string;
      prev_hash: string | null;
      this_hash: string;
    }>(
      `select firm_id, kind, payload, actor_member_id,
              extract(epoch from occurred_at)::text as epoch,
              prev_hash, this_hash
       from events where firm_id = $1 order by id`,
      [FIRM],
    );

    expect(rows.length).toBeGreaterThan(10);

    let prev: string | null = null;
    for (const r of rows) {
      const computed = await eventHash(prev, {
        firmId: r.firm_id,
        actorMemberId: r.actor_member_id,
        kind: r.kind,
        occurredAtEpoch: r.epoch,
        payload: r.payload,
      });
      /* The stored predecessor and the one we walked past must agree, or the two
         implementations disagree about ordering rather than about hashing. */
      expect(r.prev_hash).toBe(prev);
      expect(computed, `event kind ${r.kind}`).toBe(r.this_hash);
      prev = r.this_hash;
    }
  });

  it("refuses a number that would not round trip rather than hashing it differently", () => {
    expect(() => canonicalJsonb({ a: 1e21 })).toThrow();
    expect(() => canonicalJsonb({ a: Number.NaN })).toThrow();
  });
});
