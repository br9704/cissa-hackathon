/*
  Seeds a database and writes the tagger's training data.

  Usage:
    pnpm --filter @continuity/core seed
    DATABASE_URL=postgres://... pnpm --filter @continuity/core seed
    CONTINUITY_SEED=1234 pnpm --filter @continuity/core seed

  Against the hosted Supabase project this runs with the service role key. Service role
  bypasses RLS but not triggers, so seeded events are chained exactly like any other
  write, which is what we want: a seeded ledger that could not pass verification would
  be worse than no seed at all.
*/
import { Client } from "pg";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, DEFAULT_SEED } from "./generate.js";
import { load } from "./load.js";
import { makeRng } from "../rng.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DB_URL =
  process.env.DATABASE_URL ??
  process.env.SUPABASE_DB_URL ??
  "postgres://localhost:5432/continuity_dev";
const SEED = Number(process.env.CONTINUITY_SEED ?? DEFAULT_SEED);

/*
  Held out BEFORE training, not after, and split on a seeded shuffle so the split is
  reproducible. Splitting after a model exists is how a held out score quietly stops
  being held out.
*/
const TEST_ROWS = 300;
const VALID_ROWS = 200;

const SYSTEM_PROMPT = [
  "You classify a decision record from a quantitative trading desk.",
  "Reply with one line of JSON and nothing else.",
  'Format: {"label":"<class>","risk":<true|false>}',
  "Classes: parameter_change, risk_limit, data_handling, execution, universe, infra, process.",
  "risk is true when the decision changes the firm's risk posture or was made in response to a risk event.",
].join(" ");

function toChatRow(row: { text: string; label: string; risk: boolean }) {
  /*
    The chat format mlx-lm expects. Training and inference must go through the SAME chat
    template: hand rolling a prompt string at inference time is the classic silent killer
    here, because the model still answers, it just answers slightly off distribution.
  */
  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: row.text },
      { role: "assistant", content: JSON.stringify({ label: row.label, risk: row.risk }) },
    ],
  };
}

async function main() {
  const corpus = generate(SEED);
  console.log(`generated corpus from seed ${SEED}`);
  console.log(
    `  ${corpus.members.length} members, ${corpus.strategies.length} strategies, ` +
      `${corpus.artifacts.length} artifacts, ${corpus.decisions.length} decisions, ` +
      `${corpus.links.length} genealogy links, ${corpus.sessions.length} debriefs, ` +
      `${corpus.turns.length} turns, ${corpus.questions.length} open questions`,
  );

  // --- the tagger's data, written whether or not the database is reachable.
  const rng = makeRng(SEED ^ 0x5eed);
  const shuffled = rng.shuffle(corpus.labelled);
  const test = shuffled.slice(0, TEST_ROWS);
  const valid = shuffled.slice(TEST_ROWS, TEST_ROWS + VALID_ROWS);
  const train = shuffled.slice(TEST_ROWS + VALID_ROWS);

  const mlDir = join(REPO_ROOT, "ml", "data", "mlx");
  await mkdir(mlDir, { recursive: true });
  for (const [name, rows] of [
    ["train", train],
    ["valid", valid],
    ["test", test],
  ] as const) {
    const jsonl = rows.map((r) => JSON.stringify(toChatRow(r))).join("\n") + "\n";
    await writeFile(join(mlDir, `${name}.jsonl`), jsonl, "utf8");
    console.log(`  ml/data/mlx/${name}.jsonl  ${rows.length} rows`);
  }

  const counts = new Map<string, number>();
  for (const r of corpus.labelled) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  console.log(
    "  class balance: " +
      [...counts.entries()].sort().map(([k, v]) => `${k} ${v}`).join(", "),
  );

  // --- the database.
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
  } catch (err) {
    console.log(`\nno database at ${DB_URL}, wrote the training data only`);
    console.log(`  ${(err as Error).message}`);
    return;
  }

  try {
    const stats = await load(client, corpus);
    console.log(`\nloaded into ${DB_URL}`);
    console.log(
      "  " + Object.entries(stats).map(([k, v]) => `${v} ${k}`).join(", "),
    );

    /*
      Verify what we just wrote, in the database, using the same function the Verify page
      calls. A seed that loads and does not verify is a seed that will fail on stage.
    */
    const { rows } = await client.query<{ total: number; ok: boolean; first_bad_seq: number | null }>(
      "select * from verify_chain_summary($1)",
      [corpus.firmId],
    );
    const summary = rows[0]!;
    if (!summary.ok) {
      throw new Error(
        `seeded ledger fails verification at row ${summary.first_bad_seq}. Refusing to leave it in place.`,
      );
    }
    console.log(`  chain verified: ${summary.total} events, no breaks`);
    console.log(`\nfirm id: ${corpus.firmId}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
