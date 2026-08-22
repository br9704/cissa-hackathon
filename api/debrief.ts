/*
  POST /api/debrief

  The interviewer. Given a person's captured artifacts, asks the next question.

  Streaming, because a question that appears a word at a time reads like somebody
  thinking and a question that appears all at once reads like a form. That is not
  decoration on a screen somebody has sixty seconds for.

  Every question has to name something the person actually did. An ungrounded question is
  the interviewer guessing, and the corpus is precisely what removes the need to guess: if
  the model cannot find something to ground a question in, the honest move is to ask the
  open one rather than to invent a specific.
*/
import {
  preflight, json, verifyCaller, rateLimit, corsHeaders, bridgeUrl,
} from "./_shared.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

const SYSTEM = `You are interviewing a quantitative researcher about work they recorded.

Ask ONE question. Ground it in a specific artifact you were given: name the change, the
date, and what happened around it. "You raised vol_filter to 0.7 two hours after the
drawdown flag on 12 August. Walk me through what you rejected first."

Rules:
Spoken register. This is read out loud in sixty seconds, not filed.
One question, not three. A stacked question gets one answer to whichever part was easiest.
Ask for the alternatives they rejected, because that is the part that never gets written
down and the part a successor most needs.
If nothing you were given supports a specific question, ask the open one instead: what
would you tell whoever takes this over that is not written down anywhere. Do not invent a
specific.`;

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  const userId = await verifyCaller(request);
  if (!userId) return json({ error: "unauthorized" }, { status: 401, origin });
  if (!rateLimit(`debrief:${userId}`, 30)) {
    return json({ error: "rate limited" }, { status: 429, origin });
  }

  const { artifacts, history } = (await request.json()) as {
    artifacts?: { title: string; occurredAt: string; detail: string }[];
    history?: { role: "agent" | "human"; text: string }[];
  };

  const context = (artifacts ?? [])
    .map((a) => `${a.occurredAt.slice(0, 10)}  ${a.title}\n${a.detail}`)
    .join("\n\n");

  const messages = [
    {
      role: "user" as const,
      content: `What this person recorded:\n\n${context || "(nothing captured)"}`,
    },
    ...(history ?? []).map((t) => ({
      role: t.role === "agent" ? ("assistant" as const) : ("user" as const),
      content: t.text,
    })),
  ];

  /*
    Bridge first. Its stream-json output is unwrapped into the same Anthropic-shaped SSE
    this route already forwards, so the client parser needs no branch: it cannot tell
    which produced the question, and does not need to.
  */
  const bridge = await bridgeUrl();
  if (bridge) {
    const bridged = await fetch(`${bridge}/v1/debrief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM, messages }),
    });
    if (!bridged.ok || !bridged.body) {
      return json(
        { error: "the local bridge failed", detail: (await bridged.text()).slice(0, 300) },
        { status: 502, origin },
      );
    }
    return new Response(bridged.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Inference-Source": "local_bridge",
        ...corsHeaders(origin),
      },
    });
  }

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return json(
      {
        error: "the debrief agent is not available here",
        detail:
          "No local bridge is running and no API key is set. The agent runs on a bridge " +
          "to the developer's own machine, which the hosted demo cannot reach by design.",
        inference_source: "none" as const,
      },
      { status: 503, origin },
    );
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["ANTHROPIC_DEBRIEF_MODEL"] ?? "claude-sonnet-5",
      max_tokens: 600,
      system: SYSTEM,
      stream: true,
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return json(
      { error: "the model call failed", detail: (await upstream.text()).slice(0, 300) },
      { status: 502, origin },
    );
  }

  /*
    Pass the stream through rather than buffering it. no-transform is not optional: a
    proxy that buffers a text/event-stream turns a question that types itself into a
    question that appears all at once after a pause, which is the failure this route is
    shaped to avoid.
  */
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Inference-Source": "anthropic_api",
      ...corsHeaders(origin),
    },
  });
}

/* Vercel needs this on any route that streams for longer than the default. */
export const maxDuration = 60;
