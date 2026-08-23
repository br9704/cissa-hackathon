#!/usr/bin/env -S npx tsx
/*
  Continuity as an MCP server: the ledger, reachable from inside an editor.

  This is the answer to the hardest problem the product has, which is not storage and not
  analytics. It is that writing down WHY you changed something requires stopping work to
  write, and nobody does that reliably, which is why wikis and handover documents fail.

  So: a quant changes a parameter in Claude Code or Cursor, and the assistant files the
  decision record as part of the same change, while the reasoning is still in the room. The
  why gets captured at the moment it exists rather than reconstructed months later by
  somebody who was not there.

  It reads too. "Why is this capped at 0.70" is answerable without leaving the file, which
  makes the ledger useful on an ordinary Tuesday rather than only during a handover. A
  system people only touch when somebody resigns is a system nobody trusts when somebody
  resigns.

  Run it:
    pnpm --filter @continuity/mcp mcp

  Wire it into Claude Code:
    claude mcp add continuity -- pnpm --filter @continuity/mcp mcp
*/
import { createInterface } from "node:readline";
import { generate } from "@continuity/core";
import { dispatch, text, type Handler, type Request, type ToolDefinition } from "./protocol.js";
import { recordDecision, searchLedger, getDecision, pendingRecords } from "./tools.js";

const NAME = "continuity";
const VERSION = "0.1.0";

const tools = new Map<string, { def: ToolDefinition; run: Handler }>();

function tool(def: ToolDefinition, run: Handler) {
  tools.set(def.name, { def, run });
}

/* The corpus is loaded once. It is deterministic from a seed, so every process that reads
   it sees the same ledger, which is what lets the editor and the app agree. */
const corpus = generate();

tool(
  {
    name: "record_decision",
    description:
      "File a decision record into the Continuity ledger. Use this when the user changes a " +
      "parameter, a model, a threshold or a process, and has said why. Capture their actual " +
      "reasoning, not a summary of the diff: the diff is already in git, the reasoning is " +
      "the part that disappears when they leave. If they have not said why, ask before " +
      "calling this.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "What changed, in one line" },
        why: {
          type: "string",
          description:
            "The reasoning in the user's own words. This is the field the whole product exists for.",
        },
        strategy: { type: "string", description: "Which book, if the change belongs to one" },
        alternatives: {
          type: "array",
          items: { type: "string" },
          description: "What was considered and rejected, if they said",
        },
        risk_flag: { type: "boolean", description: "True if this touches a risk limit" },
      },
      required: ["title", "why"],
    },
  },
  (args) => text(recordDecision(corpus, args)),
);

tool(
  {
    name: "search_ledger",
    description:
      "Search the decision ledger for why something is the way it is. Use this BEFORE " +
      "changing a parameter, so the user finds out whether somebody already tried it and " +
      "wrote down what happened.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A question in plain language" },
        limit: { type: "number", description: "How many records to return, default 5" },
      },
      required: ["query"],
    },
  },
  (args) => text(searchLedger(corpus, args)),
);

tool(
  {
    name: "get_decision",
    description:
      "Read one decision record in full, including its reasoning, the alternatives that " +
      "were rejected, and what it replaced.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "The decision id" } },
      required: ["id"],
    },
  },
  (args) => text(getDecision(corpus, args)),
);

tool(
  {
    name: "pending_records",
    description:
      "List decision records filed from this editor that are waiting for a human to " +
      "approve them in the Continuity app.",
    inputSchema: { type: "object", properties: {} },
  },
  () => text(pendingRecords()),
);

/*
  stdout is the protocol and nothing else. Diagnostics go to stderr, because a stray write
  here corrupts the stream and the client reports a parse error that says nothing about the
  actual cause.
*/
function send(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const rl = createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req: Request;
  try {
    req = JSON.parse(trimmed) as Request;
  } catch {
    process.stderr.write(`continuity-mcp: could not parse a line as JSON\n`);
    return;
  }
  void dispatch(req, tools, NAME, VERSION).then((res) => {
    if (res) send(res);
  });
});

rl.on("close", () => process.exit(0));

process.stderr.write(`continuity-mcp ready, ${tools.size} tools, ${corpus.decisions.length} records\n`);
