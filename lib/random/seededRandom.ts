// Deterministic, dependency-free PRNG utilities.
//
// Every random draw in PATCHRUN comes from a stream derived from a seed plus a
// stable key (e.g. seed + player id + stage id). Because streams are keyed and
// not shared, changing the game configuration never shifts which random
// numbers a given player sees — that is what makes counterfactual comparisons
// fair ("same cohort, same seeds, different configuration").

export type Rng = {
  /** Uniform float in [0, 1). */
  next: () => number;
  /** Uniform float in [min, max). */
  range: (min: number, max: number) => number;
  /** Approximately normal (Irwin–Hall, n=4) with given mean and std dev. */
  normal: (mean: number, sd: number) => number;
  /** Picks a key from a weight map. Keys are iterated in sorted order for stability. */
  weighted: <K extends string>(weights: Record<K, number>) => K;
};

/** FNV-1a over the joined parts, finished with a murmur-style avalanche. */
export function hashSeed(...parts: Array<string | number>): number {
  const text = parts.join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(...parts: Array<string | number>): Rng {
  const next = mulberry32(hashSeed(...parts));
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    normal: (mean, sd) => {
      const s = next() + next() + next() + next(); // mean 2, variance 1/3
      return mean + sd * (s - 2) * Math.sqrt(3);
    },
    weighted: <K extends string>(weights: Record<K, number>): K => {
      const keys = (Object.keys(weights) as K[]).sort();
      const total = keys.reduce((sum, k) => sum + Math.max(0, weights[k]), 0);
      let roll = next() * total;
      for (const k of keys) {
        roll -= Math.max(0, weights[k]);
        if (roll < 0) return k;
      }
      return keys[keys.length - 1];
    },
  };
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
