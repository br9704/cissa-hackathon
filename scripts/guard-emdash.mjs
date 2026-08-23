/*
  The em dash guard.

  claude.md calls this non-negotiable and the S10 log recorded it as "verified by script".
  There was no script. The rule survived on attention alone, which is exactly the kind of
  rule that quietly stops being true.

  Scope is everything a reader can see: UI strings, docs, the README, and commit messages
  are checked separately by the commit path. Code comments count too, because the house
  voice is meant to be consistent and a comment is read more often than most prose.

  The en dash is left alone: it has a legitimate use in numeric ranges.
*/
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps", "packages", "scripts", "api", "tools", "docs", "ml"];
const FILES = ["README.md", "masterplan.md", "prd.md", "design.md", "videoscript.md"];
const SKIP = new Set([
  "node_modules", "dist", "target", ".turbo", "gen", "shots", "beats",
  "adapters", "data", "results",
  /* Third party source. Their punctuation is not ours to police. */
  ".venv", "site-packages", "__pycache__", ".git", ".pytest_cache",
]);
const SCANNABLE = /\.(tsx?|jsx?|mjs|cjs|css|html|md|py|json|toml|rs)$/;

/* Documents written by other people, quoted into this repo as evidence. Rewriting someone
   else's punctuation would misquote them, so they are recorded here instead. */
const ALLOW = new Set([
  "ENGINEERPROMPT.md", "ENGINEERPROMPT2.md", "CLAUDE.md", "AGENTS.md",
  /* These three must contain the character in order to strip it or assert its absence,
     which is the guard working rather than the guard being violated. */
  "scripts/guard-emdash.mjs",
  "api/_shared.ts",
  "packages/core/src/packs.test.ts",
]);

const EM_DASH = /—/;

function walk(target, out = []) {
  let stat;
  try {
    stat = statSync(target);
  } catch {
    return out;
  }
  if (!stat.isDirectory()) {
    if (SCANNABLE.test(target)) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target)) {
    if (SKIP.has(entry)) continue;
    walk(join(target, entry), out);
  }
  return out;
}

const files = [...ROOTS, ...FILES].flatMap((r) => walk(r));
const failures = [];

for (const file of files) {
  const rel = relative(process.cwd(), file);
  if (ALLOW.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    /*
      One narrow exemption, and only for the sprint heading delimiter in masterplan.

      `## S7 <dash> Proof layer` is structural: guard-masterplan.mjs splits the file on that
      heading shape, and twelve of these headings are already committed and logged under the
      append-only rule that says masterplan is expanded, never rewritten. Prose inside
      masterplan is still checked, which is what the rule is actually protecting.
    */
    if (rel === "masterplan.md" && /^## S\d+ /.test(line)) return;
    if (EM_DASH.test(line)) {
      failures.push(`${rel}:${i + 1}\n    ${line.trim().slice(0, 90)}`);
    }
  });
}

if (failures.length) {
  console.error(`guard:emdash FAILED, ${failures.length} em dash${failures.length === 1 ? "" : "es"}\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error("\nUse a comma, a colon, a full stop, or brackets. Never an em dash.");
  process.exit(1);
}

console.log(`guard:emdash ok, ${files.length} files clean`);
