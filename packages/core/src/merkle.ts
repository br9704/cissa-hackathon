/*
  A Merkle root over a range of the ledger, RFC 6962 style.

  Anchoring every event individually would mean one OpenTimestamps submission per event,
  which is both rude to a free public service and slower than a desk writes. A Merkle root
  reduces any number of events to one 32 byte digest, so a single stamp covers the whole
  range and an individual event can still be proved to be inside it years later.

  The construction is the certificate transparency one, and the two things that make it
  that rather than the simpler version are both there for the same reason.

  Leaves and internal nodes are domain separated: a leaf hashes 0x00 followed by its data,
  an internal node hashes 0x01 followed by its two children. Without that prefix an
  attacker can present an internal node as though it were a leaf, because both are just
  32 bytes going into the same hash.

  And an odd level is split at the largest power of two below the count rather than by
  duplicating the last node. The first version of this file duplicated, with a comment
  confidently explaining that duplication AVOIDED the second preimage problem. It causes
  it: a tree of seven leaves whose last is duplicated produces exactly the same root as a
  tree of eight whose last two are equal, which is the Bitcoin CVE-2012-2459 shape. The
  test caught the comment being wrong, which is the best possible outcome for a comment
  that confident.
*/
import { sha256Hex } from "./chain.js";

export type MerkleProof = {
  /** The leaf data being proved, as hex. */
  leaf: string;
  /** Sibling hashes from the leaf upwards, with which side each one is on. */
  path: { hash: string; side: "left" | "right" }[];
  root: string;
};

/** 0x00 prefix. A leaf hash can never be mistaken for an internal node hash. */
async function hashLeaf(data: string): Promise<string> {
  return sha256Hex(`00${data}`);
}

/** 0x01 prefix. */
async function hashNode(left: string, right: string): Promise<string> {
  return sha256Hex(`01${left}${right}`);
}

/** The largest power of two strictly less than n. RFC 6962's split point. */
function splitPoint(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

async function rootOf(leaves: string[]): Promise<string> {
  if (leaves.length === 1) return hashLeaf(leaves[0]!);
  const k = splitPoint(leaves.length);
  const left = await rootOf(leaves.slice(0, k));
  const right = await rootOf(leaves.slice(k));
  return hashNode(left, right);
}

/**
 * The root of a list of leaves.
 *
 * An empty range has no root. Returning a hash of nothing would be a lie a caller could
 * not detect, so this returns null and the caller decides what that means.
 */
export async function merkleRoot(leaves: string[]): Promise<string | null> {
  if (leaves.length === 0) return null;
  return rootOf(leaves);
}

async function buildProof(
  leaves: string[],
  index: number,
  path: MerkleProof["path"],
): Promise<void> {
  if (leaves.length === 1) return;
  const k = splitPoint(leaves.length);
  if (index < k) {
    path.push({ hash: await rootOf(leaves.slice(k)), side: "right" });
    await buildProof(leaves.slice(0, k), index, path);
  } else {
    path.push({ hash: await rootOf(leaves.slice(0, k)), side: "left" });
    await buildProof(leaves.slice(k), index - k, path);
  }
}

/**
 * A proof that one leaf is in the tree.
 *
 * This is what makes anchoring a range useful rather than decorative: years later,
 * somebody can show one decision was inside the range a Bitcoin block confirmed, without
 * needing the rest of the ledger and without asking us.
 *
 * The path is built top down and then reversed, so verification reads leaf upwards.
 */
export async function merkleProof(leaves: string[], index: number): Promise<MerkleProof | null> {
  if (index < 0 || index >= leaves.length) return null;
  const path: MerkleProof["path"] = [];
  await buildProof(leaves, index, path);
  path.reverse();
  return { leaf: leaves[index]!, path, root: await rootOf(leaves) };
}

/** Recompute a root from a proof. Verification never trusts a stored root. */
export async function verifyMerkleProof(proof: MerkleProof): Promise<boolean> {
  let current = await hashLeaf(proof.leaf);
  for (const step of proof.path) {
    current =
      step.side === "left"
        ? await hashNode(step.hash, current)
        : await hashNode(current, step.hash);
  }
  return current === proof.root;
}
