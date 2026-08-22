/*
  POST /api/draft-decision

  A diff in, a structured decision record out, marked drafted_by = model and waiting for
  a human.

  Three things about the shape are forced by the API rather than chosen:

    Structured output and document citations cannot be combined in one request. So this
    route returns strict JSON with no citations, and the debrief and ask routes are
    streaming text WITH citations. Two different shapes by necessity.

    Sampling parameters are gone on current models. temperature: 0 for deterministic
    drafting is not available; the determinism has to come from the schema.

    A refusal arrives as HTTP 200 with stop_reason "refusal", not as an exception, so it
    has to be checked before reading content.
*/
import {
  preflight, json, verifyCaller, rateLimit, DECISION_TYPES,
  bridgeUrl, stripEmDashesDeep,
} from "./_shared.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

const SYSTEM = `You write decision records for a quantitative trading desk.

Given a commit message and a diff, write the record the author would have written if they
had the time. Be specific and use the desk's own vocabulary. Never invent a reason that is
not supported by the diff or the message: if the reasoning is not evident, say what
changed and leave the why short and honest rather than filling it with plausible text.

The record is shown to the author for approval before it becomes part of the ledger, so an
honest short draft is more useful than a confident long one.`;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "One line, past tense, what changed" },
    what_changed: { type: "string" },
    why: { type: "string" },
    alternatives: {
      type: "array",
      items: { type: "string" },
      description: "Options visible in the diff or message that were not taken. Empty if none.",
    },
    decision_type: { type: "string", enum: [...DECISION_TYPES] },
    risk_flag: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["title", "what_changed", "why", "alternatives", "decision_type", "risk_flag", "confidence"],
  additionalProperties: false,
};

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  const userId = await verifyCaller(request);
  if (!userId) return json({ error: "unauthorized" }, { status: 401, origin });
  if (!rateLimit(`draft:${userId}`, 20)) {
    return json({ error: "rate limited" }, { status: 429, origin });
  }

  const { message, diff, paths } = (await request.json()) as {
    message?: string;
    diff?: string;
    paths?: string[];
  };

  const user = [
    `Commit message:\n${message ?? "(none)"}`,
    `Files touched:\n${(paths ?? []).join("\n") || "(none)"}`,
    `Diff:\n${(diff ?? "").slice(0, 24_000)}`,
  ].join("\n\n");

  /*
    Bridge first, then a metered key, then an honest refusal. Never a fourth fallback that
    substitutes a fixture: presenting canned text as model output is exactly the blur this
    project refuses to make.
  */
  const bridge = await bridgeUrl();
  if (bridge) {
    const response = await fetch(`${bridge}/v1/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM, schema: SCHEMA, prompt: user }),
    });
    if (!response.ok) {
      return json(
        { error: "the local bridge failed", detail: (await response.text()).slice(0, 300) },
        { status: 502, origin },
      );
    }
    const { record } = (await response.json()) as { record: object };
    return json(
      {
        ...stripEmDashesDeep(record),
        drafted_by: "model",
        inference_source: "local_bridge" as const,
      },
      { origin },
    );
  }

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return json(
      {
        error: "drafting is not available here",
        detail:
          "No local bridge is running and no API key is set. Drafting runs on a bridge to " +
          "the developer's own machine, which the hosted demo cannot reach by design.",
        inference_source: "none" as const,
      },
      { status: 503, origin },
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["ANTHROPIC_DRAFT_MODEL"] ?? "claude-haiku-4-5",
      max_tokens: 2000,
      system: SYSTEM,
      /* No temperature, no top_p, no top_k: removed on current models and a 400 if sent. */
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!response.ok) {
    return json(
      { error: "the model call failed", detail: (await response.text()).slice(0, 300) },
      { status: 502, origin },
    );
  }

  const result = (await response.json()) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };

  /* A refusal is a 200, not an exception. */
  if (result.stop_reason === "refusal") {
    return json({ error: "the model declined to draft this" }, { status: 422, origin });
  }

  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) return json({ error: "no draft returned" }, { status: 502, origin });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "the draft was not valid JSON" }, { status: 502, origin });
  }

  return json(
    {
      ...stripEmDashesDeep(parsed as object),
      drafted_by: "model",
      inference_source: "anthropic_api" as const,
    },
    { origin },
  );
}
