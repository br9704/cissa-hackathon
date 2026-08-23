/*
  The Model Context Protocol, implemented directly over stdio.

  No SDK dependency, and that is a deliberate call rather than a shortcut. MCP over stdio is
  JSON-RPC 2.0 with newline delimited messages and four methods that matter. Writing those
  four here is about a hundred lines, it has no supply chain, and it means the one novel
  integration in this project is legible to somebody reading the repository rather than
  hidden inside a package they have to go and look up.

  The framing rule that bites everybody: stdout carries protocol messages and NOTHING else.
  A stray console.log corrupts the stream and the client reports an unhelpful parse error.
  Every diagnostic in this package goes to stderr.
*/

export type JsonRpcId = string | number | null;

export type Request = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type Response =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

export const PROTOCOL_VERSION = "2024-11-05";

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type Handler = (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult;

export function ok(id: JsonRpcId, result: unknown): Response {
  return { jsonrpc: "2.0", id, result };
}

export function fail(id: JsonRpcId, code: number, message: string): Response {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** Text out, because every MCP client can render text and few agree on anything else. */
export function text(body: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: body }], isError };
}

/**
 * Route one request.
 *
 * Notifications (a request with no id) get no response, which the spec requires and which
 * clients enforce: replying to `notifications/initialized` makes some of them hang up.
 */
export function dispatch(
  req: Request,
  tools: Map<string, { def: ToolDefinition; run: Handler }>,
  serverName: string,
  serverVersion: string,
): Promise<Response | null> {
  const id = req.id ?? null;

  if (req.method === "initialize") {
    return Promise.resolve(
      ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: serverName, version: serverVersion },
      }),
    );
  }

  if (req.method === "notifications/initialized" || req.id === undefined) {
    return Promise.resolve(null);
  }

  if (req.method === "tools/list") {
    return Promise.resolve(ok(id, { tools: [...tools.values()].map((t) => t.def) }));
  }

  if (req.method === "tools/call") {
    const name = String(req.params?.["name"] ?? "");
    const entry = tools.get(name);
    if (!entry) return Promise.resolve(fail(id, -32602, `unknown tool: ${name}`));
    const args = (req.params?.["arguments"] as Record<string, unknown>) ?? {};
    /*
      The try wraps the CALL, not just the promise. A handler that throws synchronously
      throws before Promise.resolve ever sees it, so a .catch alone leaves the exception to
      escape into the readline callback, where it kills the process and the client sees the
      server disappear rather than an error.
    */
    let pending: Promise<ToolResult>;
    try {
      pending = Promise.resolve(entry.run(args));
    } catch (err) {
      return Promise.resolve(ok(id, text(`${(err as Error).message}`, true)));
    }
    return pending
      .then((result) => ok(id, result))
      /* A tool that throws is reported as a tool error, not a protocol error. The
         distinction matters to a client: one means "your request was malformed", the other
         means "the thing you asked for did not work", and only the second is worth showing
         to the person who asked. */
      .catch((err: unknown) => ok(id, text(`${(err as Error).message}`, true)));
  }

  return Promise.resolve(fail(id, -32601, `method not found: ${req.method}`));
}
