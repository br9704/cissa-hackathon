/*
  The hex guard.

  tokens.css is the single source of colour. Any hex literal anywhere else means a
  component has quietly forked the design system, and that fork is invisible: the page
  still renders, it just stops being the product design.md describes.

  Deliberately a plain string scan rather than a CSS parser. It has to work on .tsx as
  well as .css, and inline style objects are exactly where these leak in.
*/
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/web/src", "apps/desktop/src", "packages"];
const SKIP = new Set(["node_modules", "dist", "target", ".turbo", "gen"]);
const ALLOW = new Set(["apps/web/src/styles/tokens.css"]);

/* Three or more hex digits after a #, not part of a longer word. */
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/*
  Blank out comments before scanning, preserving line numbers so the report still points
  at the right line. A hex inside a comment is never a rendered colour, and it is very
  often an issue number: "tauri#12804" reads as a colour to a naive scan, and a guard
  that cries wolf is a guard people start editing their prose around.

  Newlines are kept and everything else becomes a space, so offsets and line counts are
  unchanged.
*/
function blankComments(text, isCss) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (!isCss) out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + blank(m.slice(p1.length)));
  return out;
}

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
    else if (/\.(css|tsx?|jsx?)$/.test(full)) out.push(full);
  }
  return out;
}

const offences = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(process.cwd(), file);
    if (ALLOW.has(rel)) continue;
    const raw = readFileSync(file, "utf8");
    const text = blankComments(raw, file.endsWith(".css"));
    const rawLines = raw.split("\n");
    text.split("\n").forEach((line, i) => {
      const found = line.match(HEX);
      if (found) offences.push(`${rel}:${i + 1}  ${found.join(" ")}  ${rawLines[i].trim()}`);
    });
  }
}

if (offences.length) {
  console.error("Hex literals found outside tokens.css:\n");
  for (const o of offences) console.error("  " + o);
  console.error(`\n${offences.length} offence(s). Use a var(--token) instead.`);
  process.exit(1);
}
console.log("guard:hex ok");
