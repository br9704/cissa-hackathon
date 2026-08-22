/*
  Shared helpers for the server routes.

  Deliberately has no imports from packages/core, and that is a platform constraint rather
  than a style choice: Vercel's Node runtime does not support tsconfig path mappings or
  project references, so `@continuity/core` does not resolve inside a function. The few
  things a route needs are small enough to live here rather than be reached for through an
  alias that silently fails at deploy time.
*/

/*
  Tauri sends Origin: tauri://localhost on macOS and http://tauri.localhost elsewhere.
  Access-Control-Allow-Origin cannot be a list, so the origin is echoed from an allowlist.
  These routes carry a bearer JWT rather than cookies, so a wildcard would also be safe,
  but echoing keeps the door narrow for free.
*/
const ALLOWED_ORIGINS = new Set([
  "tauri://localhost",
  "http://tauri.localhost",
  "http://localhost:5273",
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && (ALLOWED_ORIGINS.has(origin) || /^https:\/\/[\w.-]+\.vercel\.app$/.test(origin))
      ? origin
      : "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    /* Without this the CDN can serve one origin's response to another. */
    Vary: "Origin",
  };
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export function json(body: unknown, init: { status?: number; origin?: string | null } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(init.origin ?? null),
    },
  });
}

/**
 * Verify the caller.
 *
 * The anon key plus RLS is the exposure surface, so a route that writes on a user's
 * behalf has to know who the user is rather than trust a field in the body. Returns the
 * Supabase user id, or null.
 */
export async function verifyCaller(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const url = process.env["SUPABASE_URL"];
  const anon = process.env["SUPABASE_ANON_KEY"];
  if (!url || !anon) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anon },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  return user.id ?? null;
}

/*
  Rate limiting, and an honest description of what it is.

  In memory and per instance. A serverless function scales to many instances and each one
  gets its own map, so this bounds a single caller hammering one warm instance and does
  not bound a determined one at all. It is the right amount of effort for a demo and it is
  written down in the README rather than implied to be more than it is.
*/
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** The seven classes, duplicated here for the reason at the top of this file. */
export const DECISION_TYPES = [
  "parameter_change",
  "risk_limit",
  "data_handling",
  "execution",
  "universe",
  "infra",
  "process",
] as const;

/*
  The local bridge.

  A loopback process on the developer's machine that shells out to the Claude Code CLI
  under his own subscription. It is reachable from `vercel dev` and from the Tauri desktop
  app, and it is NOT reachable from a deployed function.

  That limitation is the point rather than a shortcoming. Anthropic's terms permit a person
  to script the tool they pay for and prohibit routing other people's requests through
  those credentials, so a bridge that the public demo could reach would be the prohibited
  thing. The deployed demo therefore does not draft, and says so.
*/
export async function bridgeUrl(): Promise<string | null> {
  const base = process.env["CLAUDE_BRIDGE_URL"];
  if (!base) return null;
  try {
    /* A short probe: a dead bridge should cost a third of a second, not a timeout. */
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300);
    const response = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok ? base : null;
  } catch {
    return null;
  }
}

/**
 * Where a piece of generated text came from.
 *
 * Travels with every response so the UI can label it. A reader must be able to tell a
 * record drafted on somebody's laptop from one the deployed product produced, because
 * those are different claims.
 */
export type InferenceSource = "local_bridge" | "local_model" | "anthropic_api" | "none";

/*
  The house rule bans em dashes in user-facing strings, and model output is user-facing.
  Applied on the way out rather than only asked for in a prompt, because a prompt is a
  request and this is a rule.
*/
export function stripEmDashes(text: string): string {
  return text.replace(/—/g, ", ").replace(/–/g, "-");
}

/** The same, applied to every string in a parsed object, however deep. */
export function stripEmDashesDeep<T>(value: T): T {
  if (typeof value === "string") return stripEmDashes(value) as unknown as T;
  if (Array.isArray(value)) return value.map(stripEmDashesDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripEmDashesDeep(v);
    return out as T;
  }
  return value;
}
