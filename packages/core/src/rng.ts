/*
  A deterministic pseudo random generator.

  The seeded corpus has to reproduce byte for byte. Screenshots go in the README, the
  video is shot against a frozen seed and re-seeded between takes, and the graph layout
  is only reproducible if the rows feeding it are. Math.random makes all three
  impossible, so it does not appear anywhere in the seed path.

  mulberry32: 32 bit state, one multiply and a few shifts, good enough distribution for
  picking names and dates and small enough to read in one sitting.
*/
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** Integer in [min, max]. */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    /** One element. Throws on an empty list rather than returning undefined quietly. */
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error("pick() on an empty list");
      return items[Math.floor(next() * items.length)]!;
    },
    /** True with probability p. */
    chance: (p: number) => next() < p,
    /** Fisher Yates on a copy, so the caller's array is never reordered underneath it. */
    shuffle: <T,>(items: readonly T[]): T[] => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

export type Rng = ReturnType<typeof makeRng>;

/*
  UUIDs have to be deterministic too, or every reseed produces a different set of ids and
  nothing that references them by hand keeps working. This is a v4 shaped id built from
  the seeded stream: it is not a real random UUID and it is not meant to be. It only has
  to be unique within a seeded corpus and identical across runs.
*/
export function makeUuid(rng: Rng): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) {
    if (i === 12) out += "4";
    else if (i === 16) out += hex[8 + rng.int(0, 3)];
    else out += hex[rng.int(0, 15)];
  }
  return [
    out.slice(0, 8),
    out.slice(8, 12),
    out.slice(12, 16),
    out.slice(16, 20),
    out.slice(20, 32),
  ].join("-");
}
