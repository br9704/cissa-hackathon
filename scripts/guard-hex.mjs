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

const ROOTS = ["apps/web/src", "apps/desktop/src-tauri/src", "packages", "apps/web/index.html", "apps/web/public"];
const SKIP = new Set(["node_modules", "dist", "target", ".turbo", "gen"]);
const ALLOW = new Set(["apps/web/src/styles/tokens.css"]);

/*
  Any literal colour, not only hex notation.

  This looked for # notation alone, so `background: rgba(20, 20, 25, 0.18)` sat in
  AskBar.module.css as a hardcoded near-black with the guard reporting ok. That is the
  cheapest possible way to fork the design system, and a dark theme leans on rgba far more
  than a light one does, so the hole would have widened exactly when it mattered most.

  0x notation is deliberately NOT matched. The only 0x literals here are the mulberry32 and
  FNV-1a constants in the seeded generator, and flagging those would train people to ignore
  this guard, which costs more than the hole is worth.
*/
const HEX = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color-mix)\s*\(/g;

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

/*
  Scannable file types. .html and .svg were added because the favicon and the theme-color
  meta live there, and neither was reachable before: index.html was not a root, public/ did
  not exist, and this filter would have skipped both anyway. A colour that ships in the tab
  icon is exactly as forked from the design system as one in a stylesheet.
*/
const SCANNABLE = /\.(css|tsx?|jsx?|html|svg)$/;

/* A root may be a single file, not only a directory. */
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
