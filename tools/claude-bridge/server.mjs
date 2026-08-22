#!/usr/bin/env node
/*
  tools/claude-bridge/server.mjs

  A loopback-only bridge from the three Continuity routes to the Claude Code CLI running
  under the developer's own subscription, on the developer's own machine.

  What this is and is not, because the distinction is a licensing one and not a style one:

    It is one developer using a tool he pays for, on his laptop, on his own work. Anthropic
    documents `claude -p` and stdin piping for exactly this.

    It is NOT a way to serve other people. Anthropic's legal-and-compliance page is explicit
    that subscription credentials may not be routed on behalf of a third party's users. So
    this binds to 127.0.0.1, refuses non-loopback callers, and the deployed web demo cannot
    reach it and is not meant to.

  Start:  node tools/claude-bridge/server.mjs
  Health: curl -s localhost:8787/health
*/
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.CLAUDE_BRIDGE_PORT ?? 8787);
const BIN = process.env.CLAUDE_BIN ?? "claude";
const DRAFT_MODEL = process.env.BRIDGE_DRAFT_MODEL ?? "haiku";
const CHAT_MODEL = process.env.BRIDGE_CHAT_MODEL ?? "sonnet";

/*
  The flags are the whole trick and every one of them is load bearing.

    --tools ""                 no file access, no shell. This is a text transform, not an agent.
    --strict-mcp-config +
      --mcp-config {}          without these the developer's MCP servers are injected as tool
                               definitions. Measured on this machine: 40,953 prompt tokens with
                               them, 240 without. That is a 170x difference in what each draft
                               costs against a finite weekly subscription limit.
    --setting-sources ""       no CLAUDE.md, no project settings leaking into a product prompt.
    --disable-slash-commands   no skills.
    --no-session-persistence   nothing written to ~/.claude/projects for a stateless call.
    --system-prompt            replaces the Claude Code system prompt with the route's own.
*/
const BASE = [
  "-p",
  "--tools", "",
  "--strict-mcp-config",
  "--mcp-config", '{"mcpServers":{}}',
  "--setting-sources", "",
  "--disable-slash-commands",
  "--no-session-persistence",
];

/* A bridge started from inside a Claude Code session inherits CLAUDE_CODE_* and CLAUDECODE.
   Strip them so the child is a clean top-level invocation. ANTHROPIC_API_KEY is stripped too:
   if it were set the CLI would silently bill metered credits, which is the one outcome the
   owner asked to avoid. */
function childEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith("CLAUDE_CODE_") || k === "CLAUDECODE" || k === "CLAUDE_PID" || k === "CLAUDE_EFFORT") {
      delete env[k];
    }
  }
  delete env.ANTHROPIC_API_KEY;
  return env;
}

function run(args, stdin, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(BIN, args, { env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("bridge timeout")); }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.slice(0, 400) || `claude exited ${code}`));
      resolve(out);
    });
    child.stdin.end(stdin);
  });
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

/* ---------------------------------------------------------------- draft */
async function draft(req, res) {
  const { system, schema, prompt } = await readJson(req);
  const args = [
    ...BASE,
    "--model", DRAFT_MODEL,
    "--output-format", "json",
    "--system-prompt", system,
    "--json-schema", JSON.stringify(schema),
  ];
  const raw = await run(args, prompt);
  const envelope = JSON.parse(raw);
  if (envelope.is_error) return send(res, 502, { error: "the model call failed", detail: String(envelope.result).slice(0, 300) });
  /* --json-schema makes `result` a JSON string that already validated against the schema. */
  send(res, 200, { record: JSON.parse(envelope.result), usage: envelope.usage, model: envelope.modelUsage });
}

/* ------------------------------------------------------------- debrief */
/*
  Anthropic-shaped SSE out, so api/debrief.ts can pass this through byte for byte exactly as
  it passes through api.anthropic.com and the frontend parser does not learn a second format.

  stream-json wraps the real Anthropic event as {"type":"stream_event","event":{...}}, so the
  conversion is an unwrap. Thinking blocks are dropped: a question that types itself out is
  the point, and streaming the model's reasoning into that pane would be worse than useless.
*/
async function debrief(req, res) {
  const { system, messages } = await readJson(req);
  const prompt = messages
    .map((m) => (m.role === "assistant" ? `Interviewer: ${m.content}` : `Researcher: ${m.content}`))
    .join("\n\n");

  const args = [
    ...BASE,
    "--model", CHAT_MODEL,
    "--output-format", "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--system-prompt", system,
  ];

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const child = spawn(BIN, args, { env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.end(prompt);

  let buf = "";
  let inText = false;
  child.stdout.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.type !== "stream_event") continue;
      const ev = msg.event;
      if (ev.type === "content_block_start") inText = ev.content_block?.type === "text";
      if (!inText) continue;
      if (ev.type === "content_block_delta" && ev.delta?.type !== "text_delta") continue;
      res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
    }
  });
  child.on("close", () => res.end());
  child.on("error", () => res.end());
  req.on("close", () => child.kill("SIGKILL"));
}

/* ------------------------------------------------------------------ ask */
/*
  The one capability that does not survive the bridge, stated rather than papered over.
  The CLI has no way to pass document blocks with citations:{enabled:true}, so the API's
  span-level citations are not available here. What comes back is the model quoting sources
  it was asked to quote, which is a weaker guarantee, and the response says so in
  `citation_mode` so the UI can label it rather than imply the strong version.
*/
async function ask(req, res) {
  const { system, question, passages } = await readJson(req);
  const corpus = passages
    .map((p, i) => `[${i}] ${p.title} (${p.strategy}, recorded by ${p.author})\n${p.body}`)
    .join("\n\n");
  const schema = {
    type: "object",
    properties: {
      answer: { type: "string" },
      cited: { type: "array", items: { type: "integer" }, description: "Indices of passages actually used. Empty if the corpus does not answer it." },
    },
    required: ["answer", "cited"],
    additionalProperties: false,
  };
  const args = [
    ...BASE,
    "--model", CHAT_MODEL,
    "--output-format", "json",
    "--system-prompt", `${system}\n\nEach passage is numbered. Return the indices you actually used in "cited". If the corpus does not answer the question, say so and return an empty array.`,
    "--json-schema", JSON.stringify(schema),
  ];
  const envelope = JSON.parse(await run(args, `Passages:\n\n${corpus}\n\nQuestion: ${question}`));
  if (envelope.is_error) return send(res, 502, { error: "the model call failed" });
  const parsed = JSON.parse(envelope.result);
  send(res, 200, {
    answer: parsed.answer,
    citations: parsed.cited.map((i) => passages[i]).filter(Boolean),
    grounded: parsed.cited.length > 0,
    citation_mode: "model_reported",
  });
}

/* --------------------------------------------------------------- server */
const server = createServer(async (req, res) => {
  /* Loopback only. Not defence in depth, just the line that keeps this from becoming the
     thing the terms forbid. */
  const remote = req.socket.remoteAddress ?? "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
    res.writeHead(403).end("bridge is loopback only");
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }).end();
    return;
  }
  try {
    if (req.url === "/health") return send(res, 200, { ok: true, bin: BIN, draftModel: DRAFT_MODEL, chatModel: CHAT_MODEL });
    if (req.method === "POST" && req.url === "/v1/draft") return await draft(req, res);
    if (req.method === "POST" && req.url === "/v1/debrief") return await debrief(req, res);
    if (req.method === "POST" && req.url === "/v1/ask") return await ask(req, res);
    send(res, 404, { error: "no such route" });
  } catch (e) {
    if (!res.headersSent) send(res, 502, { error: "bridge failed", detail: String(e.message).slice(0, 300) });
    else res.end();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`claude-bridge on http://127.0.0.1:${PORT}  (loopback only, subscription auth, this machine only)`);
});
