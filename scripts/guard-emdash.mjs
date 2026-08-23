/*
  The em dash guard.

  claude.md calls this non-negotiable and the S10 log recorded it as "verified by script".
  There was no script. The rule survived on attention alone, which is exactly the kind of
  rule that quietly stops being true.

  Scope is everything a reader can see: UI strings, docs and the README. Code comments count
  too, because the house voice is meant to be consistent and a comment is read more often
  than most prose. Commit messages are covered by .husky/commit-msg, which runs the same
  character class; an earlier version of this comment claimed that enforcement existed
  before it did, which is the exact failure this file was written to stop.

  The en dash is left alone: it has a legitimate use in numeric ranges.
*/
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps", "packages", "scripts", "api", "tools", "docs", "ml", "supabase", "demo"];
const FILES = ["README.md", "masterplan.md", "prd.md", "design.md", "videoscript.md"];
/*
  Skipped by PATH, not by directory name.

  The first version matched bare names at any depth, and it listed "data" and "results" to
  avoid the ml corpora. apps/web/src/data is not a data dump, it is nine live source files
  including the tagger caveat string that renders on screen, and the guard could not see any
  of it. A guard that reports "157 files clean" while blind to the surface it protects is
  worse than no guard, because it is trusted.
*/
const SKIP_PATHS = [
  "node_modules", ".git", ".venv", "site-packages", "__pycache__", ".pytest_cache",
  "dist", "target", ".turbo", "gen",
  "ml/data", "ml/results", "ml/runs", "docs/shots", "docs/beats",
];

const SCANNABLE = /\.(tsx?|jsx?|mjs|cjs|css|html|md|py|json|jsonl|toml|rs|sql|ya?ml|sh|svg|txt)$/;

/* Documents written by other people, quoted into this repo as evidence. Rewriting someone
   else's punctuation would misquote them, so they are recorded here instead. */
const ALLOW = new Set([
  "ENGINEERPROMPT.md", "ENGINEERPROMPT2.md",
  /* These three must contain the character in order to strip it or assert its absence,
     which is the guard working rather than the guard being violated. */
  "scripts/guard-emdash.mjs",
  "api/_shared.ts",
  "packages/core/src/packs.test.ts",
]);

/*
  The whole family, not just U+2014. A search and replace that swaps in a horizontal bar, or
  a minus sign pasted out of a maths context, reads identically on screen and would have
  shipped silently. U+2013 en dash is deliberately absent: it has a real use in numeric
  ranges.
*/
const EM_DASH = /[\u2012\u2014\u2015\u2212\u2E3A\u2E3B\uFE58\uFF0D]/;

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
    const next = join(target, entry);
    const rel = relative(process.cwd(), next);
    if (SKIP_PATHS.some((sk) => rel === sk || rel.endsWith(`/${sk}`) || entry === sk)) continue;
    walk(next, out);
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
