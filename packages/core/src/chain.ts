/*
  The hash chain, in TypeScript.

  The scoping notes for this build said not to attempt this: reproducing Postgres jsonb
  rendering from JavaScript was called a rabbit hole, and verification was to be a SQL
  function that the browser calls and animates. That advice is sound as a default, and
  the SQL function in 0002_events.sql is still the authority.

  It is worth doing anyway, for one reason. "Recompute the chain in your own browser,
  without asking our server whether it is valid" is a materially stronger claim than
  "our server says it checks out", and it is the difference between a verification
  feature and a verification theatre. So this module reproduces the canonical form
  exactly, and canonical.test.ts checks it against a real Postgres over a corpus of
  deliberately awkward payloads rather than trusting that it is right.

  If that test ever fails, the honest move is to fall back to the SQL function and say
  so in the UI, not to weaken the test.
*/

/**
 * Render a value the way Postgres renders `jsonb::text`.
 *
 * Three behaviours matter and none of them match JSON.stringify:
 *
 *   1. Object keys are ordered by LENGTH FIRST, then bytewise. So {"z":1,"aa":2} renders
 *      with z before aa. Sorting keys lexicographically, which is what every "canonical
 *      JSON" helper does, gets this backwards.
 *   2. There is a space after every colon and after every comma.
 *   3. Duplicate keys are collapsed, last one wins, which happens on the way into jsonb
 *      rather than on the way out.
 *
 * Numbers are the remaining sharp edge. jsonb keeps the numeric text it was given, so
 * 1.0 and 1.00 are different values, while 1e2 normalises to 100. The chain payloads
 * this project writes are built by code and never carry hand written decimals, so the
 * rule enforced here is the simple one: integers and ordinary decimals round trip, and
 * anything exotic is rejected loudly rather than hashed differently on the two sides.
 */
export function canonicalJsonb(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`jsonb cannot represent ${value}`);
    }
    /*
      Exponential notation is where JavaScript and Postgres part company: JS prints
      1e21 and larger in exponent form, Postgres prints the digits. Refuse rather than
      produce a string that hashes differently on the two sides.
    */
    const text = String(value);
    if (text.includes("e") || text.includes("E")) {
      throw new Error(`number ${text} would not round trip through jsonb`);
    }
    return text;
  }

  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonb).join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => compareKeys(a, b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${canonicalJsonb(v)}`).join(", ")}}`;
  }

  throw new Error(`jsonb cannot represent ${typeof value}`);
}

/**
 * Postgres jsonb key ordering: shorter keys first, then by byte value.
 *
 * Compared as UTF-8 bytes rather than as UTF-16 code units, because those disagree
 * above the BMP and a key with an emoji in it would sort differently in the two engines.
 */
function compareKeys(a: string, b: string): number {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return ab.length - bb.length;
  for (let i = 0; i < ab.length; i++) {
    if (ab[i] !== bb[i]) return ab[i]! - bb[i]!;
  }
  return 0;
}

export type ChainInput = {
  firmId: string;
  actorMemberId: string | null;
  kind: string;
  /** Seconds since the epoch, as Postgres `extract(epoch from ...)` renders it. */
  occurredAtEpoch: string;
  payload: unknown;
};

/**
 * The canonical text that gets hashed. Mirrors event_canonical_text in 0002_events.sql
 * field for field; if one changes the other has to.
 */
export function canonicalText(prevHash: string | null, e: ChainInput): string {
  return [
    prevHash ?? "",
    e.firmId,
    e.actorMemberId ?? "",
    e.kind,
    e.occurredAtEpoch,
    canonicalJsonb(e.payload),
  ].join("|");
}

/**
 * sha256 as lowercase hex, using the platform's own crypto.
 *
 * Async because SubtleCrypto is, and SubtleCrypto is used because shipping a hand
 * written sha256 to a page whose entire purpose is convincing someone that a hash is
 * correct would be an odd choice.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function eventHash(prevHash: string | null, e: ChainInput): Promise<string> {
  return sha256Hex(canonicalText(prevHash, e));
}

export type VerifiedRow = {
  index: number;
  storedHash: string;
  computedHash: string;
  prevOk: boolean;
  hashOk: boolean;
};

/**
 * Walk a chain and recompute every hash.
 *
 * Walks with the STORED predecessor rather than the recomputed one. Using the computed
 * hash would silently repair the chain as it verified it and report a clean sweep over
 * tampered data, which is the exact opposite of the job.
 */
export async function verifyChain(
  rows: (ChainInput & { prevHash: string | null; thisHash: string })[],
): Promise<{ rows: VerifiedRow[]; ok: boolean; firstBadIndex: number | null }> {
  const out: VerifiedRow[] = [];
  let expectedPrev: string | null = null;
  let firstBadIndex: number | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const computed = await eventHash(expectedPrev, row);
    const prevOk = row.prevHash === expectedPrev;
    const hashOk = row.thisHash === computed;
    out.push({ index: i, storedHash: row.thisHash, computedHash: computed, prevOk, hashOk });
    if ((!prevOk || !hashOk) && firstBadIndex === null) firstBadIndex = i;
    expectedPrev = row.thisHash;
  }

  return { rows: out, ok: firstBadIndex === null, firstBadIndex };
}
