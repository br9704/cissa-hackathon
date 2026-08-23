/*
  The protocol layer, tested without a client.

  Worth testing precisely because the failure mode is invisible: a client that gets a reply
  it did not expect reports an opaque parse error or simply hangs, and neither says which of
  these rules was broken.
*/
import { describe, it, expect } from "vitest";
import { dispatch, text, type Handler, type ToolDefinition } from "./protocol";

const def: ToolDefinition = {
  name: "echo",
  description: "echo",
  inputSchema: { type: "object", properties: {} },
};

function tools(run: Handler = () => text("hi")) {
  return new Map([["echo", { def, run }]]);
}

describe("dispatch", () => {
  it("answers initialize with a protocol version and server info", async () => {
    const res = await dispatch(
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      tools(),
      "continuity",
      "0.1.0",
    );
    expect(res).toMatchObject({
      id: 1,
      result: { protocolVersion: "2024-11-05", serverInfo: { name: "continuity" } },
    });
  });

  it("returns NOTHING for a notification", async () => {
    /* Replying to a notification makes some clients hang up, and the spec forbids it. */
    const res = await dispatch(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      tools(),
      "c",
      "1",
    );
    expect(res).toBeNull();
  });

  it("returns nothing for any request with no id", async () => {
    const res = await dispatch({ jsonrpc: "2.0", method: "tools/list" }, tools(), "c", "1");
    expect(res).toBeNull();
  });

  it("lists tools", async () => {
    const res = await dispatch({ jsonrpc: "2.0", id: 2, method: "tools/list" }, tools(), "c", "1");
    expect(res).toMatchObject({ result: { tools: [{ name: "echo" }] } });
  });

  it("reports an unknown tool as a protocol error", async () => {
    const res = await dispatch(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "nope" } },
      tools(),
      "c",
      "1",
    );
    expect(res).toMatchObject({ error: { code: -32602 } });
  });

  it("reports a THROWING tool as a tool error, not a protocol error", async () => {
    /*
      The distinction matters to whoever is looking at the screen: a protocol error means
      the request was malformed, a tool error means the thing they asked for did not work,
      and only the second is worth showing them.
    */
    const res = await dispatch(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo" } },
      tools(() => {
        throw new Error("the ledger is unreachable");
      }),
      "c",
      "1",
    );
    expect(res).toMatchObject({
      result: { isError: true, content: [{ text: "the ledger is unreachable" }] },
    });
    expect(res).not.toHaveProperty("error");
  });

  it("reports an unknown method", async () => {
    const res = await dispatch({ jsonrpc: "2.0", id: 5, method: "wat" }, tools(), "c", "1");
    expect(res).toMatchObject({ error: { code: -32601 } });
  });
});
