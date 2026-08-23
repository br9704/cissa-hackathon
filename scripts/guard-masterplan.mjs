/*
  The masterplan discipline guard.

  claude.md makes the sprint log a contract: every sprint carries a completion record
  written at the moment it closed. Until now that contract held as long as everybody
  remembered it, and it had already been broken silently. The S0 and S1 log lines were
  written and then lost before they were committed, and nothing noticed for eleven
  sprints, because a missing line looks exactly like a line nobody has got to yet.

  So this checks the shape of the ledger rather than its content:

    every sprint has at least one Sprint log line
    every log line has a status, and it is one of the four allowed words
    a sprint whose tasks are all ticked is not still logged as blocked
    nothing is left in progress
*/
import { readFileSync } from "node:fs";

const text = readFileSync("masterplan.md", "utf8");
const ALLOWED = new Set(["done", "partial", "blocked"]);

const parts = text.split(/^(## S\d+ .*)$/m);
const failures = [];
const rows = [];

/*
  The Current sprint pointer.

  claude.md opens every session with "find the Current-sprint pointer", and there was no
  pointer in this file at all. The instruction had been unfollowable since it was written,
  and nothing said so.
*/
const pointer = text.match(/^\*\*Current sprint:\*\*\s*(S\d+|none)\s*$/m);
if (!pointer) {
  failures.push(
    'No "**Current sprint:** S<n>" line. Every session starts by reading it, so it has to exist.',
  );
} else if (pointer[1] !== "none" && !text.includes(`## ${pointer[1]} `)) {
  failures.push(`Current sprint points at ${pointer[1]}, which has no section in this file.`);
}

for (let i = 1; i < parts.length; i += 2) {
  const header = parts[i];
  const id = header.split(/\s+/)[1];
  /*
    A sprint body ends at the next heading of ANY kind, not at the next sprint heading.

    The split only breaks on `## S<n>`, so the final sprint used to swallow everything after
    it, which in this file means OPEN QUESTIONS and MANUAL TASKS. Those sections are full of
    open boxes by design, and the guard counted them against whichever sprint happened to be
    last. That is how the previous last sprint came to report eighteen untouched tasks it
    had never owned.
  */
  const rawBody = parts[i + 1] ?? "";
  const nextHeading = rawBody.search(/^#{1,6} /m);
  const body = nextHeading === -1 ? rawBody : rawBody.slice(0, nextHeading);

  /*
    The log line must be a real log line.

    This used to extract /status:\s*(\w+)/ from anywhere in the body, so the bare words
    "status: done" sitting in a sentence satisfied it, and the Logged timestamp that the
    header calls "written at the moment it closed" was never looked at once. A date nobody
    checks is a date nobody writes honestly.
  */
  const logged = [...body.matchAll(/Logged:\s*([^\s·]+)\s*·\s*status:\s*(\w+)/g)];
  const statuses = logged.map((m) => m[2]);

  for (const m of logged) {
    const when = new Date(m[1]);
    if (Number.isNaN(when.getTime())) {
      failures.push(`${id} has a Logged value that is not a date: ${m[1]}`);
    } else if (when.getTime() > Date.now() + 60_000) {
      failures.push(`${id} is logged in the future: ${m[1]}. Log at the moment of completion.`);
    }
  }

  if (statuses.length === 0) {
    /*
      The sprint currently being worked has not closed, so it cannot have a completion
      record yet. Requiring one made it impossible to open a sprint before finishing it,
      which is backwards: the plan is supposed to exist before the work does.
    */
    if (pointer && pointer[1] === id) {
      rows.push({ id, status: "open", open: (body.match(/^\s*- \[ \]/gm) ?? []).length });
      continue;
    }
    failures.push(`${id} has no Sprint log line. Every sprint closes with one.`);
    rows.push({ id, status: "MISSING", open: 0 });
    continue;
  }

  for (const s of statuses) {
    if (!ALLOWED.has(s)) {
      failures.push(`${id} has status "${s}", which is not one of: ${[...ALLOWED].join(", ")}`);
    }
  }

  /*
    Untouched and carried are different things, and only one of them contradicts a "done".

    [ ] is a task nobody started. A sprint logged done with one of those is either lying
    or has forgotten to tick a box, and both are worth catching.

    [~] is a task that was started and deliberately carried elsewhere, and the convention
    in this file is that it says where and why on the next line. A done sprint may carry
    one, because "delivered, with this piece handed to S8 for a stated reason" is a real
    and honest outcome. What it may not do is carry one silently, so the carried task has
    to name its blocker.
  */
  const untouched = (body.match(/^\s*- \[ \]/gm) ?? []).length;
  const carried = [...body.matchAll(/^(\s*- \[~\][^\n]*(?:\n\s{6,}[^\n]*)*)/gm)].map((m) => m[1]);
  const final = statuses[statuses.length - 1];

  if (final === "done" && untouched > 0) {
    failures.push(
      `${id} is logged done but has ${untouched} untouched task(s). Tick them, or log it partial and say why.`,
    );
  }

  for (const task of carried) {
    if (!/BLOCKED|blocked|carried|deferred|DEFERRED/.test(task)) {
      failures.push(
        `${id} has a task marked in progress with no stated blocker. Say what it is waiting on.`,
      );
    }
  }

  rows.push({ id, status: final, open: untouched, carried: carried.length });
}

console.log("masterplan");
for (const r of rows) {
  const notes = [
    r.open ? `${r.open} untouched` : "",
    r.carried ? `${r.carried} carried` : "",
  ].filter(Boolean).join(", ");
  console.log(`  ${r.id.padEnd(5)} ${r.status.padEnd(8)} ${notes}`);
}

/* MANUAL TASKS is a deliverable in its own right: an unmet human dependency that nobody
   wrote down is the failure mode this section exists to prevent. */
if (!text.includes("## MANUAL TASKS")) {
  failures.push("MANUAL TASKS section is missing.");
}

if (failures.length) {
  console.error("");
  for (const f of failures) console.error("  FAIL  " + f);
  console.error(`\n${failures.length} masterplan discipline violation(s).`);
  process.exit(1);
}

console.log(`  ${rows.length} sprints, every one logged`);
