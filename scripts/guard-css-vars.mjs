/*
  The undefined custom property guard.

  An undefined CSS variable does not throw, does not warn, and does not fail a build.
  It resolves to nothing, the element still renders, and the page looks plausible. The
  hive repo shipped progress bars with no colour at all for months this way, because a
  shared token file renamed two variables and nothing in the repository could see it.

  Three detection rules, each of which exists because the naive version got it wrong:

  1. A declaration is never preceded by a word character. In .tool-status--live::before
     the BEM modifier --live looks exactly like a declaration to a naive regex, so the
     first version of this scan believed --live was defined. A guard that silently under
     reports is worse than no guard, because it gets trusted.

  2. var(--x, fallback) is never a fault. A fallback is the correct way to use a
     property that may be absent. Only a bare var(--x) can resolve to nothing.

  3. Properties set at runtime count as defined, in every spelling we actually use:
     setProperty("--x", v), { "--x": v }, and ["--x" as string]: v.
*/
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/web/src", "apps/desktop/src-tauri/src"];
const SKIP = new Set(["node_modules", "dist", "target", "gen"]);

const DECL = /(^|[^\w-])(--[a-zA-Z0-9-]+)\s*:/g;
const BARE_VAR = /var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g;
const RUNTIME = /(?:setProperty\(\s*["'](--[a-zA-Z0-9-]+)["']|["'](--[a-zA-Z0-9-]+)["']\s*:)/g;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const files = ROOTS.flatMap((r) => walk(r));
const css = files.filter((f) => f.endsWith(".css"));
const code = files.filter((f) => /\.(tsx?|jsx?|mjs)$/.test(f));

const defined = new Set();
for (const f of css) {
  const text = stripComments(readFileSync(f, "utf8"));
  for (const m of text.matchAll(DECL)) defined.add(m[2]);
}
for (const f of code) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(RUNTIME)) defined.add(m[1] ?? m[2]);
}

const offences = [];
for (const f of [...css, ...code]) {
  const raw = readFileSync(f, "utf8");
  const text = f.endsWith(".css") ? stripComments(raw) : raw;
  const rel = relative(process.cwd(), f);
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(BARE_VAR)) {
      if (!defined.has(m[1])) offences.push(`${rel}:${i + 1}  ${m[1]}`);
    }
  });
}

if (offences.length) {
  console.error("Bare var() referencing an undefined custom property:\n");
  for (const o of offences) console.error("  " + o);
  console.error(`\n${offences.length} offence(s). Define it in tokens.css or add a fallback.`);
  process.exit(1);
}
console.log(`guard:vars ok (${defined.size} properties defined)`);
