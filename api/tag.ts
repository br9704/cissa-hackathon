/*
  The on-prem tagger, visible on screen while it works.

  The complaint this answers was that the trained model looked decorative: a panel of numbers
  next to a claim, with nothing on screen ever appearing to run. A number somebody has to
  take on trust is worth less than a model that classifies the sentence you just typed while
  you watch.

  It runs against the local mlx server, on the machine, which is the whole argument for
  training it in the first place. When that server is not up, the route says so plainly
  rather than falling back to a hosted model and quietly telling a different story: the
  claim is "this data never leaves the building", and honouring it means the honest failure
  is better than the convenient success.

  The system prompt is IDENTICAL to the one the model was trained on, in packages/core seed
  run.ts. Hand rolling a variant at inference time is the classic silent killer with a fine
  tune: the model still answers, it just answers slightly off distribution, and the accuracy
  you measured stops being the accuracy you have.
*/
import { preflight, json } from "./_shared.js";

const TAGGER_URL = process.env["TAGGER_URL"] ?? "http://127.0.0.1:8080";

const SYSTEM_PROMPT = [
  "You classify a decision record from a quantitative trading desk.",
  "Reply with one line of JSON and nothing else.",
  'Format: {"label":"<class>","risk":<true|false>}',
  "Classes: parameter_change, risk_limit, data_handling, execution, universe, infra, process.",
  "risk is true when the decision changes the firm's risk posture or was made in response to a risk event.",
].join(" ");

const LABELS = new Set([
  "parameter_change",
  "risk_limit",
  "data_handling",
  "execution",
  "universe",
  "infra",
  "process",
]);

async function up(): Promise<boolean> {
  try {
    const res = await fetch(`${TAGGER_URL}/v1/models`, { signal: AbortSignal.timeout(1200) });
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
  if (req.method === "GET") return json({ available: await up(), url: TAGGER_URL });
  if (req.method !== "POST") return json({ error: "method not allowed" }, { status: 405 });

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return json({ error: "text is required" }, { status: 400 });

  if (!(await up())) {
    /*
      200 with available:false, not 503.

      The endpoint did its job: it checked, and the answer is that no tagger is running. A
      503 would say this route is broken, which is a different claim, and it makes the
      browser log a failed request that the screenshot harness counts as a console error.
      An expected condition should not look like a fault in the log.
    */
    return json({
      available: false,
      detail:
        "The on-prem tagger is not running on this machine. Start it with ml/src/serve.py. " +
        "Nothing is sent anywhere else: that is the point of it being on-prem.",
    });
  }

  const started = Date.now();
  try {
    const res = await fetch(`${TAGGER_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 40,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return json({ error: "tagger_error", detail: `upstream ${res.status}` }, { status: 502 });

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content?.trim() ?? "";

    /*
      Unparseable output is reported as unparseable, never coerced to a default class. The
      evaluation harness counts unparseable as wrong for exactly this reason: silently
      returning "process" whenever the model babbles inflates the majority class and hides
      the failure, which is how a model appears to work right up until somebody checks.
    */
    let parsed: { label?: unknown; risk?: unknown } = {};
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : {};
    } catch {
      parsed = {};
    }

    const label = typeof parsed.label === "string" && LABELS.has(parsed.label) ? parsed.label : null;

    return json({
      available: true,
      label,
      risk: parsed.risk === true,
      unparseable: label === null,
      raw: label === null ? raw.slice(0, 200) : undefined,
      ms: Date.now() - started,
      source: "on_prem_tagger",
    });
  } catch (err) {
    return json({ error: "tagger_error", detail: (err as Error).message }, { status: 502 });
  }
}
