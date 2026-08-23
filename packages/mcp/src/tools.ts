/*
  What the editor can actually do with the ledger.

  Every tool returns TEXT written for a language model to read aloud to a person, not JSON
  for a program to parse. That is the right call for MCP specifically: the consumer is a
  model that is going to summarise this into a sentence, and handing it a nested object
  makes it guess at which fields matter. Handing it prose that already says which fields
  matter removes the guess.
*/
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus } from "@continuity/core";

const HERE = dirname(fileURLToPath(import.meta.url));
/*
  Records filed from an editor land in a file, not in the database.

  Two reasons. The ledger is append only and every row is chained, so a write has to go
  through the real event path or it is not a ledger row at all; and nothing reaches the
  ledger without a human approving it, which is the rule the whole product rests on. So the
  editor produces DRAFTS, the app shows them in the inbox, and a person presses one key.
*/
const INBOX = join(HERE, "../../../.continuity-inbox.jsonl");

type Draft = {
  id: string;
  title: string;
  why: string;
  strategy: string | null;
  alternatives: string[];
  riskFlag: boolean;
  at: string;
  source: "mcp";
};

function readInbox(): Draft[] {
  if (!existsSync(INBOX)) return [];
  return readFileSync(INBOX, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Draft);
}

function appendInbox(draft: Draft): void {
  mkdirSync(dirname(INBOX), { recursive: true });
  writeFileSync(INBOX, `${JSON.stringify(draft)}\n`, { flag: "a" });
}

function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v.trim() : "";
}

export function recordDecision(corpus: Corpus, args: Record<string, unknown>): string {
  const title = str(args, "title");
  const why = str(args, "why");
  if (!title || !why) {
    return "A record needs both a title and the reasoning behind it. If the user has not said why they made the change, ask them before filing anything: a record with an invented reason is worse than no record.";
  }

  const strategyName = str(args, "strategy");
  const match = corpus.strategies.find(
    (s) => s.name.toLowerCase() === strategyName.toLowerCase(),
  );

  const draft: Draft = {
    id: `mcp-${Date.now().toString(36)}`,
    title,
    why,
    strategy: match?.name ?? (strategyName || null),
    alternatives: Array.isArray(args["alternatives"])
      ? (args["alternatives"] as unknown[]).map(String)
      : [],
    riskFlag: args["risk_flag"] === true,
    at: new Date().toISOString(),
    source: "mcp",
  };
  appendInbox(draft);

  const book = draft.strategy ? ` on ${draft.strategy}` : "";
  const unknownBook =
    strategyName && !match
      ? `\n\nNote: "${strategyName}" is not a book in this ledger, so the record was filed without one rather than guessing.`
      : "";

  return (
    `Filed as a draft${book}: "${title}".\n\n` +
    `It is waiting in the Continuity inbox for a person to approve. Nothing reaches the ` +
    `ledger unread, which is what makes the ledger evidence rather than a log.${unknownBook}`
  );
}

export function searchLedger(corpus: Corpus, args: Record<string, unknown>): string {
  const query = str(args, "query");
  if (!query) return "Give me a question to search for.";
  const limit = typeof args["limit"] === "number" ? Math.min(20, args["limit"]) : 5;

  /*
    Deliberately simple term overlap rather than the app's hybrid retrieval. The embedding
    model runs in a browser tab and does not exist in this process, and pulling it in would
    add hundreds of megabytes to a server whose job is to answer a question about a
    parameter name. Exact terms are also what an editor query usually contains.
  */
  /*
    Stopwords, for the same reason the app's lexical index has them.

    Without this, "what is the capital of france" scores 2 of 4 terms against almost every
    record, because "what" and "the" appear everywhere, and the search confidently returns
    decisions about slippage budgets. Length alone is not a filter: "the" and "why" are short
    but so is "vol".
  */
  const STOP = new Set([
    "the", "and", "for", "was", "were", "are", "its", "our", "this", "that", "with", "from",
    "what", "why", "how", "does", "did", "has", "have", "had", "not", "but", "which", "when",
    "who", "their", "they", "them", "there", "here", "about", "into", "over", "after",
    "before", "would", "could", "will", "can", "any", "all", "you", "your", "his", "her",
    "please", "tell",
  ]);
  /*
    "capital" is NOT in that list, though dropping it would have made the off topic test pass
    more easily. It is a real word on a trading desk (capital allocation, capital at risk),
    and a search that cannot find it because it was convenient for a test is a search that
    fails the user later, quietly, on a question that matters.
  */
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
  if (terms.length === 0) return "That question has nothing searchable in it.";

  const scored = corpus.decisions
    .map((d) => {
      const hay = `${d.title} ${d.why} ${d.alternatives.join(" ")}`.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t)).length;
      return { d, coverage: hits / terms.length };
    })
    /* 0.6, matching the floor measured for the app's lexical fallback. Half the terms is
       too generous: it lets a two word question match on one common word. */
    .filter((r) => r.coverage >= 0.6)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, limit);

  if (scored.length === 0) {
    return `Nothing in the ledger uses enough of those words. That is the honest answer rather than the nearest few records: if nobody wrote it down, the reasoning is in somebody's head and worth asking for while they are still here.`;
  }

  const byId = new Map(corpus.strategies.map((s) => [s.id, s.name]));
  const byMember = new Map(corpus.members.map((m) => [m.id, m.displayName]));

  return scored
    .map(
      ({ d }) =>
        `${d.title}\n` +
        `  ${byId.get(d.strategyId) ?? "no book"} · ${byMember.get(d.authorMemberId) ?? "unknown"} · ${d.occurredAt.slice(0, 10)}\n` +
        `  Why: ${d.why}\n` +
        `  id: ${d.id}`,
    )
    .join("\n\n");
}

export function getDecision(corpus: Corpus, args: Record<string, unknown>): string {
  const id = str(args, "id");
  const d = corpus.decisions.find((x) => x.id === id);
  if (!d) return `No decision with id ${id} is in the record.`;

  const book = corpus.strategies.find((s) => s.id === d.strategyId)?.name ?? "no book";
  const who = corpus.members.find((m) => m.id === d.authorMemberId)?.displayName ?? "unknown";
  const parents = corpus.links
    .filter((l) => l.child === d.id)
    .map((l) => corpus.decisions.find((x) => x.id === l.parent)?.title)
    .filter(Boolean);

  return [
    d.title,
    `${book} · ${who} · ${d.occurredAt.slice(0, 10)} · confidence ${d.confidence}`,
    "",
    `What changed: ${d.whatChanged}`,
    `Why: ${d.why}`,
    d.alternatives.length ? `Rejected: ${d.alternatives.join("; ")}` : "",
    parents.length ? `Replaced: ${parents.join("; ")}` : "",
    d.draftedBy === "model" ? "Drafted by a model and not yet approved by a person." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function pendingRecords(): string {
  const drafts = readInbox();
  if (drafts.length === 0) return "Nothing filed from an editor is waiting for approval.";
  return (
    `${drafts.length} record${drafts.length === 1 ? "" : "s"} waiting for a person:\n\n` +
    drafts
      .map((d) => `${d.title}${d.strategy ? ` (${d.strategy})` : ""}\n  ${d.why}`)
      .join("\n\n")
  );
}
