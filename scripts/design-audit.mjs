/*
  The design audit.

  design.md states its rules as acceptance criteria rather than as preferences, and until
  something checks them they are prose: any of them can stop being true without a single
  test failing. These are the ones that are greppable. The rest (does it look right, does
  the motion mean anything) are what the screenshot pass is for, and no script replaces
  that.

  Five rules, each with the reason it exists, because a guard nobody understands is a
  guard people disable.
*/
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/web/src"];
const SKIP = new Set(["node_modules", "dist", "target", "gen"]);
const TOKENS_FILE = "apps/web/src/styles/tokens.css";

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

const files = ROOTS.flatMap((r) => walk(r));
const cssFiles = files.filter((f) => f.endsWith(".css") && !f.endsWith("tokens.css"));
const tsxFiles = files.filter((f) => f.endsWith(".tsx"));
const tokens = readFileSync(TOKENS_FILE, "utf8");

const failures = [];
const notes = [];

function fail(rule, detail) {
  failures.push(`${rule}\n    ${detail}`);
}

// ---------------------------------------------------------------- 1. amber
/*
  Amber is reserved for knowledge risk and appears nowhere else, ever. The moment it
  decorates something, the signal is gone, and a risk colour that shows up on a hover
  state is worth nothing on a risk board.

  Enforced by name: --accent-risk may only be used in a rule whose selector or file names
  something about risk, or in the tokens file where it is defined.
*/
const RISK_WORDS = /risk|amber|departure|orphan|exposure|gone|unmatched|atrisk|marker/i;
let amberUses = 0;
for (const file of cssFiles) {
  const text = stripComments(readFileSync(file, "utf8"));
  const rules = text.split("}");
  for (const rule of rules) {
    if (!rule.includes("--accent-risk")) continue;
    amberUses++;
    const selector = rule.split("{")[0]?.trim() ?? "";
    const fileIsRisky = RISK_WORDS.test(relative(process.cwd(), file));
    if (!RISK_WORDS.test(selector) && !fileIsRisky) {
      fail(
        "amber discipline: --accent-risk used outside a risk surface",
        `${relative(process.cwd(), file)}  selector: ${selector.replace(/\s+/g, " ").slice(0, 70)}`,
      );
    }
  }
}
notes.push(`amber used in ${amberUses} rules, all on risk surfaces`);

// ---------------------------------------------------------------- 2. radius ladder
/*
  Three rungs, 8 / 12 / 16, plus 999px for a pill and small values for the tiny inline
  chrome that would look wrong at 8. A fourth arbitrary radius is how a system becomes a
  collection of individual opinions.
*/
const ALLOWED_RADII = new Set(["999px", "0", "0px", "50%", "inherit", "6px", "5px", "4px"]);
for (const file of cssFiles) {
  const text = stripComments(readFileSync(file, "utf8"));
  for (const m of text.matchAll(/border-radius:\s*([^;]+);/g)) {
    const value = m[1].trim();
    if (value.includes("var(--radius-")) continue;
    if (ALLOWED_RADII.has(value)) continue;
    fail(
      "radius ladder: a border-radius that is not a token",
      `${relative(process.cwd(), file)}  ${value}`,
    );
  }
}

// ---------------------------------------------------------------- 3. motion durations
/*
  Three durations and two curves, declared once. A hand written 300ms somewhere means
  reduced motion cannot turn it off from the token file, which is the whole reason the
  durations are tokens.
*/
for (const file of cssFiles) {
  const text = stripComments(readFileSync(file, "utf8"));
  for (const m of text.matchAll(/transition:\s*([^;]+);/g)) {
    const value = m[1];
    if (/\b\d+m?s\b/.test(value) && !value.includes("var(--dur-")) {
      fail(
        "motion: a transition duration that is not a token",
        `${relative(process.cwd(), file)}  ${value.replace(/\s+/g, " ").slice(0, 70)}`,
      );
    }
  }
  /* An animation is allowed a literal duration only if it also has a reduced motion
     override, since an infinite spinner is not something a token can collapse. */
  for (const m of text.matchAll(/animation:\s*([^;]+);/g)) {
    if (!/prefers-reduced-motion/.test(text)) {
      fail(
        "motion: an animation with no reduced motion override in the same file",
        `${relative(process.cwd(), file)}  ${m[1].trim().slice(0, 60)}`,
      );
    }
  }
}

// ---------------------------------------------------------------- 4. the layering law
/*
  Glass belongs to the navigation layer and never stacks on itself. A pane inside a pane
  is opaque. This is the rule that keeps depth meaning something rather than becoming
  texture.
*/
const NAV_LAYER = /AppShell|AskBar|QuickCapture|Toast|DecisionCard|base\.css/;
for (const file of cssFiles) {
  const text = stripComments(readFileSync(file, "utf8"));
  if (!/backdrop-filter/.test(text)) continue;
  const rel = relative(process.cwd(), file);
  if (!NAV_LAYER.test(rel)) {
    fail(
      "layering law: backdrop-filter outside the navigation layer",
      `${rel}. Glass is for the rail, top bar, ask bar, quick capture, toasts and DecisionCard.`,
    );
  }
  /* A backdrop-filter reading a custom property fails outright on macOS Sonoma under
     Safari 18.x, and Tauri renders in the OS webview, so this is a real machine. */
  /*
    Scoped to a single declaration. The first version used [^;]* and matched across a
    whole @supports block, because `@supports not ((backdrop-filter: blur(1px)) ...)` has
    no semicolon before the `background: var(...)` inside it. A guard that fires on
    correct code gets switched off, which is worse than not having it.
  */
  if (/backdrop-filter:[^;{}]*var\(/.test(text)) {
    fail(
      "layering law: backdrop-filter reading a custom property",
      `${rel}. Write the blur literal: this fails silently in the macOS webview.`,
    );
  }
  /* Unprefixed backdrop-filter only reached Baseline in Safari 18. */
  const prefixed = (text.match(/-webkit-backdrop-filter/g) ?? []).length;
  const plain = (text.match(/(?<!-webkit-)backdrop-filter/g) ?? []).length;
  if (plain > prefixed) {
    fail(
      "layering law: unprefixed backdrop-filter without the -webkit- fallback",
      `${rel}. A judge on Ventura or Sonoma gets no blur at all.`,
    );
  }
}

// ---------------------------------------------------------------- 5. accessibility states
/*
  The document had a strong reduced motion story and no reduced transparency story at
  all, which was the larger of the two gaps. Both live in tokens.css so nothing has to
  opt in, and this asserts they are still there.
*/
for (const query of [
  "prefers-reduced-motion",
  "prefers-reduced-transparency",
  "prefers-contrast",
]) {
  if (!tokens.includes(query)) {
    fail("accessibility: a media state is missing from tokens.css", query);
  }
}

/* Every animation needs a terminal state under reduced motion, and the components that
   animate are the ones that import motion. */
const animating = tsxFiles.filter((f) => /from "motion\/react"/.test(readFileSync(f, "utf8")));
for (const file of animating) {
  const text = readFileSync(file, "utf8");
  if (!/useReducedMotion|prefers-reduced-motion/.test(text)) {
    /* A component can legitimately animate without asking, if every duration it uses is a
       token that reduced motion already shortened. Report rather than fail. */
    notes.push(
      `note: ${relative(process.cwd(), file)} animates without useReducedMotion, ` +
        "so it relies on the token durations alone",
    );
  }
}

// ---------------------------------------------------------------- 6. no per person score
/*
  design.md principle 7: any screen that would rank individuals is a design bug. This
  cannot be fully checked by grep, but the shapes that lead there can be.
*/
/*
  Checked against code only, not prose.

  The first version searched the whole file and flagged MyRecordPage, whose doctrine
  paragraph says the product has "no productivity analytics". Flagging the sentence that
  states the rule is the most annoying possible false positive, and it is the kind that
  teaches people the guard is noise.
*/
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    /* JSX text sits between a > and a <, and is prose by definition. */
    .replace(/>[^<>{}]+</g, "><")
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''");
}

for (const file of tsxFiles) {
  const code = codeOnly(readFileSync(file, "utf8"));
  if (/leaderboard|rankMembers|memberScore|productivityScore|perPersonScore/i.test(code)) {
    fail(
      "the work, never the worker: a shape that ranks individuals",
      relative(process.cwd(), file),
    );
  }
}

// ---------------------------------------------------------------- report
console.log("design audit");
for (const n of notes) console.log(`  ${n}`);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`  FAIL  ${f}`);
  console.error(`\n${failures.length} design rule violation(s).`);
  process.exit(1);
}
console.log("  all greppable rules in design.md section 7 hold");
