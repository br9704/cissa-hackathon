/*
  OpenTimestamps: anchoring the ledger head to Bitcoin.

  The hash chain proves the ledger is internally consistent. It cannot prove WHEN the
  ledger existed in that shape, and that is not a gap the chain can close: an attacker who
  rewrites a row and recomputes every hash after it produces a perfectly consistent chain.
  An external anchor is the only thing that closes it, because they cannot go back and put
  a different digest in a block that is already mined.

  One thin module around the library, deliberately, because the library has four sharp
  edges and each of them wants exactly one place to live.
*/

/*
  The import form is a runtime trap TypeScript will not catch.

  The package is CommonJS. `import { DetachedTimestampFile } from "opentimestamps"`
  typechecks, because the type definitions declare named exports, and then throws
  "SyntaxError: Named export not found" under real Node ESM, where the namespace is only
  default and module.exports. Default import and destructure.
*/
import OTS from "opentimestamps";

const { DetachedTimestampFile, Ops } = OTS as unknown as {
  DetachedTimestampFile: {
    fromHash: (op: unknown, digest: Uint8Array) => OtsDetached;
    deserialize: (bytes: Uint8Array) => OtsDetached;
  };
  Ops: { OpSHA256: new () => unknown };
};

type OtsDetached = { serializeToBytes: () => Uint8Array };

type OtsApi = {
  stamp: (detached: OtsDetached, options?: unknown) => Promise<void>;
  upgrade: (detached: OtsDetached) => Promise<boolean>;
  verify: (
    stamped: OtsDetached,
    original: OtsDetached,
    options?: { ignoreBitcoinNode?: boolean },
  ) => Promise<Record<string, { timestamp: number; height: number }>>;
  info: (detached: OtsDetached) => string;
};

const api = OTS as unknown as OtsApi;

export type Receipt = {
  /** The digest that was stamped, hex. Normally a Merkle root over a ledger range. */
  digest: string;
  /** Exactly the bytes the library produced. Never JSON, never re-encoded. */
  bytes: Uint8Array;
  status: "pending" | "attested";
  /** Present only once a Bitcoin block confirms it. */
  attestation?: { chain: string; blockHeight: number; timestamp: string };
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (clean.length !== 64) {
    throw new Error(`expected a 32 byte sha256 hex digest, got ${clean.length} characters`);
  }
  return new Uint8Array(
    (clean.match(/.{2}/g) ?? []).map((byte) => Number.parseInt(byte, 16)),
  );
}

/**
 * Submit a digest to the calendars.
 *
 * Returns immediately with a PENDING receipt. Confirmation takes hours, because the
 * calendars batch every submission into one Bitcoin transaction rather than paying a fee
 * per timestamp. Anything that describes a fresh receipt as anchored is wrong.
 */
export async function stamp(digestHex: string): Promise<Receipt> {
  const detached = DetachedTimestampFile.fromHash(new Ops.OpSHA256(), hexToBytes(digestHex));

  /*
    The library writes "Submitting to remote calendar ..." to stdout unconditionally and
    there is no option to stop it. Silenced around the call rather than left to appear in
    the middle of a demo, and restored immediately afterwards so nothing else loses its
    logging.
  */
  const realLog = console.log;
  console.log = () => {};
  try {
    await api.stamp(detached);
  } finally {
    console.log = realLog;
  }

  return {
    digest: digestHex,
    bytes: detached.serializeToBytes(),
    status: "pending",
  };
}

/**
 * Ask the calendars whether a Bitcoin block has confirmed this yet.
 *
 * upgrade() mutates in place and returns false when nothing changed, so the original
 * bytes are kept until the upgraded ones actually verify. Overwriting on a false return
 * would replace a valid pending receipt with the same thing and log a success that did
 * not happen.
 */
export async function upgrade(receipt: Receipt): Promise<Receipt> {
  const detached = DetachedTimestampFile.deserialize(receipt.bytes);

  const realLog = console.log;
  console.log = () => {};
  let changed = false;
  try {
    changed = await api.upgrade(detached);
  } catch {
    /* A calendar being unreachable is not a reason to lose a receipt. */
    return receipt;
  } finally {
    console.log = realLog;
  }

  if (!changed) return receipt;

  const upgraded: Receipt = { ...receipt, bytes: detached.serializeToBytes() };
  const verified = await verify(upgraded);
  return verified.status === "attested" ? verified : receipt;
}

/**
 * Verify a receipt.
 *
 * Two things here would silently produce a false claim if they were wrong.
 *
 * ignoreBitcoinNode is required, and not for convenience: without it the library reads a
 * local bitcoin.conf and tries to reach a node we do not run. With it, verification goes
 * to public block headers, which is a weaker check and the UI says so.
 *
 * And verify() on a fully pending receipt RESOLVES WITH AN EMPTY OBJECT rather than
 * rejecting. Treating a resolved promise as success would render a pending receipt as
 * Bitcoin confirmed, which is the single most damaging false claim this product could
 * make. Empty means pending.
 */
export async function verify(receipt: Receipt): Promise<Receipt> {
  const detached = DetachedTimestampFile.deserialize(receipt.bytes);
  const original = DetachedTimestampFile.fromHash(new Ops.OpSHA256(), hexToBytes(receipt.digest));

  const realLog = console.log;
  console.log = () => {};
  let result: Record<string, { timestamp: number; height: number }> = {};
  try {
    result = await api.verify(detached, original, { ignoreBitcoinNode: true });
  } catch {
    return { ...receipt, status: "pending" };
  } finally {
    console.log = realLog;
  }

  const chains = Object.keys(result ?? {});
  if (chains.length === 0) return { ...receipt, status: "pending" };

  const chain = chains[0]!;
  const attestation = result[chain]!;
  return {
    ...receipt,
    status: "attested",
    attestation: {
      chain,
      blockHeight: attestation.height,
      timestamp: new Date(attestation.timestamp * 1000).toISOString(),
    },
  };
}

/** Human readable description of what a receipt currently contains. */
export function describe(receipt: Receipt): string {
  const detached = DetachedTimestampFile.deserialize(receipt.bytes);
  const realLog = console.log;
  console.log = () => {};
  try {
    return api.info(detached);
  } finally {
    console.log = realLog;
  }
}

/** Base64, for storing in a bytea column or a JSON payload without losing a byte. */
export function encodeReceipt(receipt: Receipt): string {
  return Buffer.from(receipt.bytes).toString("base64");
}

export function decodeReceipt(digest: string, base64: string, status: Receipt["status"]): Receipt {
  return { digest, bytes: new Uint8Array(Buffer.from(base64, "base64")), status };
}
