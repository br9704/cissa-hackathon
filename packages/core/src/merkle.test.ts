import { describe, it, expect } from "vitest";
import { merkleRoot, merkleProof, verifyMerkleProof } from "./merkle";

const leaves = (n: number) =>
  Array.from({ length: n }, (_, i) => i.toString(16).padStart(64, "0"));

describe("merkle root", () => {
  it("has no root for an empty range", async () => {
    /* Returning a hash of nothing would be a lie the caller could not detect. */
    expect(await merkleRoot([])).toBeNull();
  });

  it("hashes even a single leaf, rather than passing it through", async () => {
    /* A root that IS its only leaf cannot be told apart from the leaf, which is the same
       confusion the 0x00 prefix exists to prevent. */
    const one = leaves(1);
    expect(await merkleRoot(one)).not.toBe(one[0]);
    expect(await merkleRoot(one)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", async () => {
    const l = leaves(9);
    expect(await merkleRoot(l)).toBe(await merkleRoot(l));
  });

  it("changes if any leaf changes", async () => {
    const a = leaves(8);
    const b = leaves(8);
    b[3] = "f".repeat(64);
    expect(await merkleRoot(a)).not.toBe(await merkleRoot(b));
  });

  it("changes if the order changes", async () => {
    const a = leaves(6);
    const b = [...a.slice(1), a[0]!];
    expect(await merkleRoot(a)).not.toBe(await merkleRoot(b));
  });

  it("handles odd counts at every level", async () => {
    for (const n of [3, 5, 7, 9, 11, 13, 17, 33]) {
      expect(await merkleRoot(leaves(n))).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("does not collide with a longer tree whose last leaf repeats", async () => {
    /*
      CVE-2012-2459 in miniature. A construction that pads an odd level by duplicating the
      last node makes these two trees produce the same root, so a seven event range and an
      eight event range become indistinguishable. The first version of this file did
      duplicate, and its comment claimed that was the fix rather than the bug.
    */
    const seven = leaves(7);
    const eight = [...seven, seven[6]!];
    expect(await merkleRoot(seven)).not.toBe(await merkleRoot(eight));
  });

  it("does not let an internal node masquerade as a leaf", async () => {
    /*
      The reason leaves and nodes carry different prefixes. Without them, the root of a
      two leaf tree is a plain hash of two 32 byte values, and so is a leaf whose data
      happens to be those same 64 hex characters.
    */
    const pair = leaves(2);
    const internal = await merkleRoot(pair);
    const asLeaf = await merkleRoot([pair[0]! + pair[1]!]);
    expect(internal).not.toBe(asLeaf);
  });
});

describe("merkle proof", () => {
  it("proves every leaf in a tree of any size", async () => {
    for (const n of [1, 2, 3, 8, 9, 15]) {
      const l = leaves(n);
      for (let i = 0; i < n; i++) {
        const proof = await merkleProof(l, i);
        expect(proof, `n=${n} i=${i}`).not.toBeNull();
        expect(await verifyMerkleProof(proof!), `n=${n} i=${i}`).toBe(true);
        expect(proof!.root).toBe(await merkleRoot(l));
      }
    }
  });

  it("fails verification if the leaf is swapped", async () => {
    const l = leaves(8);
    const proof = await merkleProof(l, 5);
    expect(await verifyMerkleProof({ ...proof!, leaf: "a".repeat(64) })).toBe(false);
  });

  it("fails verification if a sibling is altered", async () => {
    const l = leaves(8);
    const proof = await merkleProof(l, 5);
    const tampered = {
      ...proof!,
      path: proof!.path.map((p, i) => (i === 0 ? { ...p, hash: "b".repeat(64) } : p)),
    };
    expect(await verifyMerkleProof(tampered)).toBe(false);
  });

  it("fails verification if a sibling is on the wrong side", async () => {
    /* Order matters in the pair hash, so side is part of the proof rather than decoration. */
    const l = leaves(8);
    const proof = await merkleProof(l, 5);
    const flipped = {
      ...proof!,
      path: proof!.path.map((p, i) =>
        i === 0 ? { ...p, side: p.side === "left" ? ("right" as const) : ("left" as const) } : p,
      ),
    };
    expect(await verifyMerkleProof(flipped)).toBe(false);
  });

  it("returns null for an index outside the range", async () => {
    expect(await merkleProof(leaves(4), 9)).toBeNull();
    expect(await merkleProof(leaves(4), -1)).toBeNull();
  });
});
