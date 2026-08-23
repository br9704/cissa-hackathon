/*
  Dump the seeded corpus to JSON so the Python side can build training data from it.

  The corpus is generated in TypeScript and that is deliberate: one generator, one seed, one
  deterministic output that the app, the SQL seed and the ML pipeline all read. Reimplementing
  it in Python would mean two sources of truth for what the firm remembers, and the first
  time they drifted the model would be trained on a ledger the product does not have.
*/
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generate } from "@continuity/core";

const corpus = generate();
/* Anchored to the repo root, because pnpm --filter runs this with the package as cwd. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "ml/data/firm/corpus.json");
writeFileSync(out, JSON.stringify(corpus, null, 2));
console.log(
  `${out}: ${corpus.decisions.length} decisions, ${corpus.links.length} links, ` +
    `${corpus.turns.length} turns, ${corpus.questions.length} questions, ` +
    `${corpus.members.length} members, ${corpus.strategies.length} strategies`,
);
