/*
  POST /api/capture

  What the git hook posts. Files the commit as an artifact and, when it touched something
  the repo calls material, asks for a decision record draft.

  The hook never waits for this and never fails because of it. That shapes the error
  handling here: a route that returns 500 is a route the hook silently swallows, so
  anything worth a human knowing has to be visible in the ledger rather than in a status
  code nobody reads.
*/
import { preflight, json, verifyCaller, rateLimit } from "./_shared.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

type CapturePayload = {
  firm_id?: string;
  member_id?: string;
  external_ref?: string;
  occurred_at?: string;
  message?: string;
  paths?: string[];
  material?: boolean;
  diff?: string;
  diff_truncated?: boolean;
};

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  const userId = await verifyCaller(request);
  if (!userId) return json({ error: "unauthorized" }, { status: 401, origin });
  if (!rateLimit(`capture:${userId}`)) {
    return json({ error: "rate limited" }, { status: 429, origin });
  }

  const body = (await request.json()) as CapturePayload;
  if (!body.firm_id || !body.external_ref) {
    return json({ error: "firm_id and external_ref are required" }, { status: 400, origin });
  }

  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    return json({ error: "server is not configured" }, { status: 503, origin });
  }

  /*
    Written through PostgREST with the service role rather than through the anon client,
    because the hook runs as a machine and there is no session for it to borrow. The
    service role bypasses RLS, so the firm id in the body is checked against the member
    row rather than trusted.
  */
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const memberResponse = await fetch(
    `${url}/rest/v1/members?user_id=eq.${userId}&firm_id=eq.${body.firm_id}&select=id`,
    { headers },
  );
  const members = (await memberResponse.json()) as { id: string }[];
  const member = members[0];
  if (!member) {
    /* The caller is authenticated but not a member of the firm they claim. */
    return json({ error: "not a member of that firm" }, { status: 403, origin });
  }

  const artifactResponse = await fetch(`${url}/rest/v1/artifacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      firm_id: body.firm_id,
      kind: "commit",
      external_ref: body.external_ref,
      author_member_id: member.id,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
      raw_meta: {
        message: body.message ?? "",
        paths: body.paths ?? [],
        diff_truncated: Boolean(body.diff_truncated),
      },
    }),
  });

  if (!artifactResponse.ok) {
    const detail = await artifactResponse.text();
    /*
      42501 deserves its own message. On a project created after May 2026 new tables carry
      no grants for the API roles, and the error says "permission denied for table" with
      nothing about RLS, so the instinct is to rewrite a policy that was correct.
    */
    const hint = detail.includes("42501")
      ? "the table needs an explicit GRANT, not a policy change. See supabase/migrations/0005_grants_rls.sql"
      : detail.slice(0, 300);
    return json({ error: "could not file the artifact", hint }, { status: 502, origin });
  }

  const [artifact] = (await artifactResponse.json()) as { id: string }[];

  return json(
    {
      artifact_id: artifact?.id ?? null,
      /*
        Drafting is a separate request rather than something this route awaits. The hook
        is fire and forget and the model call is the slow part; making the developer's
        machine hold a connection open for it buys nothing.
      */
      draft_requested: Boolean(body.material),
      note: body.material
        ? "A decision record draft will appear in the queue for approval."
        : "Filed as an artifact. No paths in this commit are material, so no draft.",
    },
    { origin },
  );
}
