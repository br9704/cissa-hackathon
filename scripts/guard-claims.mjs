/*
  The honest-claims guard.

  The rule is that no number appears in the UI, the README or the pitch that a committed
  artifact cannot back. Until something checks it, that rule holds exactly as long as
  everybody remembers it, and this project has already caught itself breaking it once: the
  README said the tagger gap was 38.5 points and the UI rendered 38.4, because the two
  rounded the same subtraction differently. Nobody typed a wrong number. The documents
  drifted anyway.

  So this reads ml/results/summary.json and checks that every figure the documents quote
  about the tagger is a figure that file supports. It is narrow on purpose: it checks the
  numbers whose source is a committed artifact, and it does not try to be a general fact
  checker, because a guard that pretends to check more than it does is worse than one with
  a stated scope.
*/
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SUMMARY = "ml/results/summary.json";
/*
  Discovered, not listed.

  This was a fixed three item list naming TaggerBadge.tsx. The moment those figures move to
  another component, and the rebuild moves them onto the capture surface, the guard would
  keep checking a file that no longer carries a claim and pass for the wrong reason. A guard
  that passes vacuously is worse than no guard, because it is trusted.
*/
function scan(target, out = []) {
  let stat;
  try {
    stat = statSync(target);
  } catch {
    return out;
  }
  if (!stat.isDirectory()) {
    if (/\.(tsx?|jsx?|md)$/.test(target)) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target)) {
    if (["node_modules", "dist", "target", ".turbo", "gen", ".venv"].includes(entry)) continue;
    scan(join(target, entry), out);
  }
  return out;
}

const DOCUMENTS = [
  ...scan("apps/web/src"),
  ...["README.md", "ml/README.md"].filter((f) => existsSync(f)),
];

if (!existsSync(SUMMARY)) {
  /*
    No artifact means no claims are allowed, not that the check is skipped. If the tagger
    has not been evaluated, a document quoting a macro F1 is quoting nothing.
  */
  const offenders = DOCUMENTS.filter(
    (d) => existsSync(d) && /macro F1\s*[0-9]/i.test(readFileSync(d, "utf8")),
  );
  if (offenders.length) {
    console.error(`${SUMMARY} does not exist, so no macro F1 may be quoted.`);
    console.error("  quoted in: " + offenders.join(", "));
    process.exit(1);
  }
  console.log("guard:claims ok (tagger not evaluated, and nothing quotes it)");
  process.exit(0);
}

const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
const student = summary.arms?.student;
const fewShot = summary.arms?.few_shot;

if (!student) {
  console.error(`${SUMMARY} has no student arm.`);
  process.exit(1);
}

/* Every value a document is allowed to quote, in the forms a document might write it. */
const allowed = new Set();
const permit = (n) => {
  if (typeof n !== "number") return;
  allowed.add(n.toFixed(4));
  allowed.add(n.toFixed(2));
  allowed.add(n.toFixed(1));
  allowed.add(String(Math.round(n)));
};

permit(student.macro_f1);
permit(student.accuracy);
permit(student.risk_accuracy);
allowed.add(String(student.n));
allowed.add(String(student.invalid_outputs));
allowed.add(String(Math.round(student.latency_ms.p50)));
allowed.add(student.latency_ms.p50.toFixed(1));

if (fewShot) {
  permit(fewShot.macro_f1);
  permit(fewShot.accuracy);
  permit(fewShot.risk_accuracy);
  allowed.add(String(fewShot.n));
  allowed.add(String(fewShot.invalid_outputs));
  allowed.add(String(Math.round(fewShot.latency_ms.p50)));
  allowed.add(fewShot.latency_ms.p50.toFixed(1));

  /*
    The gap, to the nearest whole point only. The first decimal of a difference between
    two four-decimal values is where the drift happened, so quoting it is not allowed even
    when it happens to be right.
  */
  allowed.add(String(Math.round((student.macro_f1 - fewShot.macro_f1) * 100)));
}

const failures = [];

for (const doc of DOCUMENTS) {
  if (!existsSync(doc)) continue;
  const text = readFileSync(doc, "utf8");

  /*
    A macro F1 quoted anywhere in prose or a table. Matches the number after the phrase,
    or a bare four-decimal number in a table row, which is the shape the results table
    uses.
  */
  const quoted = new Set();
  for (const m of text.matchAll(/macro F1(?:\s+points?)?[^0-9\n]{0,20}([0-9]+\.?[0-9]*)/gi)) {
    quoted.add(m[1]);
  }
  for (const m of text.matchAll(/\|\s*\*{0,2}([0-9]\.[0-9]{4})\*{0,2}\s*\|/g)) {
    quoted.add(m[1]);
  }
  for (const m of text.matchAll(/\+([0-9]+(?:\.[0-9]+)?)\s*(?:macro F1 )?points?/gi)) {
    quoted.add(m[1]);
  }

  for (const value of quoted) {
    if (!allowed.has(value)) {
      failures.push(
        `${doc} quotes ${value}, which ${SUMMARY} does not support.\n` +
          `      supported: ${[...allowed].sort().join(" ")}`,
      );
    }
  }
}

if (failures.length) {
  console.error("honest-claims guard:\n");
  for (const f of failures) console.error("  FAIL  " + f);
  console.error(`\n${failures.length} unsupported claim(s).`);
  process.exit(1);
}

console.log(
  `guard:claims ok (every quoted tagger figure is backed by ${SUMMARY})`,
);
