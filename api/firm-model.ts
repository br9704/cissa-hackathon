/*
  The firm model route.

  Three things about this are deliberate.

  First, it is a HEALTH CHECK plus a generate, not just a generate. The app has to be able to
  ask "is there a firm model reachable right now" without paying for a generation, because
  that answer drives a banner on every screen and the fallback decision for the ask palette.

  Second, the model is never allowed to outrank the ledger. The caller runs the existing
  retrieval over whatever comes back and strikes any claim it cannot ground. This route does
  not do that grounding itself, because retrieval already lives in the browser and moving it
  server side to satisfy one caller would fork it.

  Third, it degrades to a 503 with a reason rather than a generic failure. "The firm model is
  not running on this machine" and "the firm model returned nothing" are different problems
  for whoever is looking at the screen, and a single opaque error hides which one happened.
*/
import { preflight, json } from "./_shared.js";

const FIRM_MODEL_URL = process.env.FIRM_MODEL_URL ?? "http://127.0.0.1:8081";

/* The adapter was trained on this exact system line. Sending a different one at inference
   time is a quiet way to lose most of what the fine tune bought. */
const SYSTEM =
  "You are the decision record for Meridian Basis Partners. You answer only from what the " +
  "desk has written down. If the record does not contain the answer, you say so.";

async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${FIRM_MODEL_URL}/v1/models`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export async function GET(): Promise<Response> {
  return methodRouter(new Request("http://local/", { method: "GET" }));
}

export async function POST(request: Request): Promise<Response> {
  return methodRouter(request);
}

async function methodRouter(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return json({ available: await health(), url: FIRM_MODEL_URL });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, { status: 405 });

  const body = (await req.json().catch(() => ({}))) as { question?: string };
  const question = (body.question ?? "").trim();
  if (!question) return json({ error: "question is required" }, { status: 400 });

  if (!(await health())) {
    return json(
      {
        error: "firm_model_unavailable",
        detail:
          "No firm model is reachable on this machine. The ledger still answers by retrieval.",
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${FIRM_MODEL_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: question },
        ],
        temperature: 0,
        max_tokens: 320,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return json({ error: "firm_model_error", detail: `upstream ${res.status}` }, { status: 502 });
    }
    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!answer) {
      return json({ error: "firm_model_empty", detail: "the model returned nothing" }, { status: 502 });
    }
    return json({
      answer,
      /* Travels with every answer so the UI cannot forget to say what produced it. */
      source: "firm_model",
      banner:
        "Answered by Meridian's own model, fine tuned on this ledger, running on this machine.",
    });
  } catch (err) {
    return json({ error: "firm_model_error", detail: (err as Error).message }, { status: 502 });
  }
}
