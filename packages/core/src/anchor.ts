/*
  Anchor the ledger head.

    pnpm --filter @continuity/core anchor          stamp the current head
    pnpm --filter @continuity/core anchor upgrade  ask whether Bitcoin has confirmed it

  Stamp early and often, because confirmation takes hours and a receipt submitted on the
  morning of a demo is a receipt that is still pending during it. That is not a reason to
  hide the pending state, it is a reason to have stamped yesterday as well.
*/
import { Client } from "pg";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { merkleRoot } from "./merkle.js";
import { stamp, upgrade, verify, encodeReceipt, decodeReceipt, describe } from "./ots.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const STORE = join(ROOT, "docs", "anchors.json");
const DB_URL =
  process.env["DATABASE_URL"] ?? "postgres://localhost:5432/continuity_dev";

type StoredAnchor = {
  firm_id: string;
  through_event_id: number;
  event_count: number;
  merkle_root: string;
  receipt_base64: string;
  status: "pending" | "attested";
  anchored_at: string;
  attestation?: { chain: string; blockHeight: number; timestamp: string };
};

function load(): StoredAnchor[] {
  if (!existsSync(STORE)) return [];
  return JSON.parse(readFileSync(STORE, "utf8")) as StoredAnchor[];
}

function save(anchors: StoredAnchor[]): void {
  mkdirSync(dirname(STORE), { recursive: true });
  writeFileSync(STORE, JSON.stringify(anchors, null, 2) + "\n");
}

async function doStamp(): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string; firm_id: string; this_hash: string }>(
      `select id, firm_id, this_hash from events order by firm_id, id`,
    );
    if (rows.length === 0) {
      console.log("no events to anchor");
      return;
    }

    /* One anchor per firm. A root spanning two firms would let either one's events be
       proved by a receipt the other paid for, and the firm is the security boundary. */
    const byFirm = new Map<string, { id: number; hash: string }[]>();
    for (const r of rows) {
      const list = byFirm.get(r.firm_id) ?? [];
      list.push({ id: Number(r.id), hash: r.this_hash });
      byFirm.set(r.firm_id, list);
    }

    const anchors = load();

    for (const [firmId, events] of byFirm) {
      const root = await merkleRoot(events.map((e) => e.hash));
      if (!root) continue;
      const through = events[events.length - 1]!.id;

      if (anchors.some((a) => a.firm_id === firmId && a.merkle_root === root)) {
        console.log(`${firmId.slice(0, 8)}  already anchored at this head`);
        continue;
      }

      console.log(`${firmId.slice(0, 8)}  ${events.length} events, root ${root.slice(0, 16)}`);
      console.log("  submitting to the OpenTimestamps calendars");
      const receipt = await stamp(root);

      anchors.push({
        firm_id: firmId,
        through_event_id: through,
        event_count: events.length,
        merkle_root: root,
        receipt_base64: encodeReceipt(receipt),
        status: receipt.status,
        anchored_at: new Date().toISOString(),
      });

      console.log(`  receipt ${receipt.bytes.length} bytes, status ${receipt.status}`);
      console.log("  pending means submitted to the calendars, not confirmed by Bitcoin.");
      console.log("  Confirmation takes hours. Run `anchor upgrade` later.");
    }

    save(anchors);
    console.log(`\nwrote ${anchors.length} anchor(s) to docs/anchors.json`);
  } finally {
    await client.end();
  }
}

async function doUpgrade(): Promise<void> {
  const anchors = load();
  if (anchors.length === 0) {
    console.log("nothing anchored yet");
    return;
  }

  let changed = 0;
  for (const a of anchors) {
    if (a.status === "attested") {
      console.log(`${a.merkle_root.slice(0, 16)}  already attested`);
      continue;
    }
    const receipt = decodeReceipt(a.merkle_root, a.receipt_base64, a.status);
    const next = await upgrade(receipt);
    if (next.status === "attested" && next.attestation) {
      a.receipt_base64 = encodeReceipt(next);
      a.status = "attested";
      a.attestation = next.attestation;
      changed++;
      console.log(
        `${a.merkle_root.slice(0, 16)}  ATTESTED in ${next.attestation.chain} block ` +
          `${next.attestation.blockHeight} at ${next.attestation.timestamp}`,
      );
    } else {
      console.log(`${a.merkle_root.slice(0, 16)}  still pending`);
    }
  }

  if (changed) save(anchors);
  console.log(`\n${changed} upgraded`);
}

async function doInfo(): Promise<void> {
  for (const a of load()) {
    const receipt = decodeReceipt(a.merkle_root, a.receipt_base64, a.status);
    console.log(`\n${a.merkle_root}  ${a.event_count} events through ${a.through_event_id}`);
    console.log(describe(receipt));
    const checked = await verify(receipt);
    console.log(`verify says: ${checked.status}`);
  }
}

const command = process.argv[2] ?? "stamp";
const run = command === "upgrade" ? doUpgrade : command === "info" ? doInfo : doStamp;
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
