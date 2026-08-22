/*
  POST /api/ask

  A question over the corpus, answered with citations.

  This route exists for the deployed demo, where the retrieval index is in pgvector rather
  than in the browser. The in-tab path is the primary one and is better in the way that
  matters: nothing leaves the machine. This is the fallback for a device that should not
  be downloading a model, and the UI says which one answered.

  The shape is forced. The API cannot combine structured output with document citations,
  so this is streaming text WITH citations and the drafting route is structured JSON
  WITHOUT them. Two different shapes by necessity rather than by preference.
*/
import {
  preflight, json, verifyCaller, rateLimit, bridgeUrl, stripEmDashes,
} from "./_shared.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

const SYSTEM = `You answer questions about a quantitative trading desk using only the
decision records and debrief answers provided to you.

Cite everything. If the documents do not answer the question, say so plainly and stop:
"that is not in the corpus" is a complete and useful answer, and it names a gap somebody
can go and fill. Never fill a gap with a plausible sentence.

Do not write in the voice of any person named in the documents. Quote them, attributed,
or describe what they recorded. The difference matters here more than it usually does.`;

type Passage = { id: string; title: string; body: string; author: string; strategy: string };

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  const userId = await verifyCaller(request);
  if (!userId) return json({ error: "unauthorized" }, { status: 401, origin });
  if (!rateLimit(`ask:${userId}`, 20)) {
    return json({ error: "rate limited" }, { status: 429, origin });
  }

  const { question, passages } = (await request.json()) as {
    question?: string;
    passages?: Passage[];
  };

  if (!question || !passages?.length) {
    /*
      No passages means retrieval found nothing above the floor, and the honest response is
      the one the UI already gives rather than asking a model to improvise around an empty
      context. Returning 200 with a definite answer rather than an error, because "not in
      the corpus" is a real answer and not a failure.
    */
    return json(
      {
        answer: "That is not in the corpus. Nothing recorded is close enough to answer it.",
        citations: [],
        grounded: false,
      },
      { origin },
    );
  }

  /*
    Bridge first, with one capability lost and stated rather than hidden. The CLI has no
    flag for document blocks with span-level citations, so a bridged answer reports which
    passages the model SAYS it used rather than which spans the API attributed. The
    response says which mode produced it so the UI can be precise about how strong the
    citation is.
  */
  const bridge = await bridgeUrl();
  if (bridge) {
    const bridged = await fetch(`${bridge}/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM, question, passages }),
    });
    if (!bridged.ok) {
      return json(
        { error: "the local bridge failed", detail: (await bridged.text()).slice(0, 300) },
        { status: 502, origin },
      );
    }
    const result = (await bridged.json()) as {
      answer: string;
      citations: unknown[];
      grounded: boolean;
    };
    return json(
      {
        ...result,
        answer: stripEmDashes(result.answer),
        citation_mode: "model_reported" as const,
        inference_source: "local_bridge" as const,
      },
      { origin },
    );
  }

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return json(
      {
        error: "the remote ask route is not available here",
        detail:
          "No local bridge is running and no API key is set. The in-browser retrieval path " +
          "needs neither and is the primary one.",
        inference_source: "none" as const,
      },
      { status: 503, origin },
    );
  }

  const documents = passages.map((p) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: p.body },
    title: `${p.title} (${p.strategy}, recorded by ${p.author})`,
    /* The whole point of this route rather than a plain completion. */
    citations: { enabled: true },
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["ANTHROPIC_ASK_MODEL"] ?? "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: [...documents, { type: "text", text: question }] }],
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
    content?: {
      type: string;
      text?: string;
      citations?: { document_index?: number; document_title?: string }[];
    }[];
  };

  if (result.stop_reason === "refusal") {
    return json({ error: "the model declined to answer" }, { status: 422, origin });
  }

  const blocks = result.content ?? [];
  const answer = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  /*
    The citations the model actually used, deduplicated. Reporting every passage that was
    SENT rather than every one that was USED would dress an ungrounded answer in sources
    it did not read, which is worse than no citations at all.
  */
  const used = new Set<number>();
  for (const block of blocks) {
    for (const c of block.citations ?? []) {
      if (typeof c.document_index === "number") used.add(c.document_index);
    }
  }

  return json(
    {
      answer: stripEmDashes(answer),
      citations: [...used].map((i) => passages[i]).filter(Boolean),
      grounded: used.size > 0,
      /* The API attributes citations to spans, which is a stronger claim than a model
         listing what it thinks it used. */
      citation_mode: "span_attributed" as const,
      inference_source: "anthropic_api" as const,
    },
    { origin },
  );
}
