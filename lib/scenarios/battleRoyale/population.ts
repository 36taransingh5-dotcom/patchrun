import { clamp, createRng } from "@/lib/random/seededRandom";
import type { BotArchetype, BotMix } from "@/lib/simulation/types";
import { BOT_ARCHETYPES, BOT_COUNT, BOT_PROFILES, HUMAN_COHORTS, HUMAN_COHORT_SIZES, type HumanCohort } from "./config";

export type HumanProfile = {
  id: string;
  kind: "human";
  cohort: HumanCohort;
  skill: number;
  aggression: number;
  awareness: number;
};

export type BotAgent = {
  id: string;
  kind: "bot";
  archetype: BotArchetype;
  skill: number;
  awareness: number;
};

const HUMAN_MEANS: Record<HumanCohort, { skill: number; aggression: number; awareness: number }> = {
  new: { skill: 0.3, aggression: 0.45, awareness: 0.3 },
  average: { skill: 0.52, aggression: 0.5, awareness: 0.5 },
  skilled: { skill: 0.74, aggression: 0.6, awareness: 0.72 },
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** 60 simulated human profiles, fully determined by the seed and reused for every strategy. */
export function generateHumans(seed: number): HumanProfile[] {
  const humans: HumanProfile[] = [];
  let i = 0;
  for (const cohort of HUMAN_COHORTS) {
    for (let k = 0; k < HUMAN_COHORT_SIZES[cohort]; k++) {
      i++;
      const id = `H${String(i).padStart(2, "0")}`;
      const rng = createRng(seed, "br-human", id);
      const m = HUMAN_MEANS[cohort];
      humans.push({
        id,
        kind: "human",
        cohort,
        skill: r3(clamp(rng.normal(m.skill, 0.07), 0.05, 0.97)),
        aggression: r3(clamp(rng.normal(m.aggression, 0.1), 0.05, 0.95)),
        awareness: r3(clamp(rng.normal(m.awareness, 0.08), 0.05, 0.95)),
      });
    }
  }
  return humans;
}

/** Converts a percentage mix into exactly 40 bot slots (largest remainder). */
export function botCounts(mix: BotMix): Record<BotArchetype, number> {
  const exact = BOT_ARCHETYPES.map((k) => ({ k, v: (mix[k] / 100) * BOT_COUNT }));
  const counts = Object.fromEntries(exact.map((e) => [e.k, Math.floor(e.v)])) as Record<BotArchetype, number>;
  let remaining = BOT_COUNT - BOT_ARCHETYPES.reduce((s, k) => s + counts[k], 0);
  const order = [...exact].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || a.k.localeCompare(b.k));
  for (const e of order) {
    if (remaining <= 0) break;
    counts[e.k]++;
    remaining--;
  }
  return counts;
}

/** Bot attributes are seeded per archetype slot, so "the 3rd rusher" is identical across strategies. */
export function generateBots(mix: BotMix, seed: number): BotAgent[] {
  const counts = botCounts(mix);
  const bots: BotAgent[] = [];
  for (const archetype of BOT_ARCHETYPES) {
    for (let k = 0; k < counts[archetype]; k++) {
      const rng = createRng(seed, "br-bot", archetype, k);
      const p = BOT_PROFILES[archetype];
      bots.push({
        id: `${archetype.slice(0, 2).toUpperCase()}${String(k + 1).padStart(2, "0")}`,
        kind: "bot",
        archetype,
        skill: r3(clamp(rng.normal(p.skill, 0.05), 0.05, 0.95)),
        awareness: r3(clamp(rng.normal(p.awareness, 0.05), 0.05, 0.95)),
      });
    }
  }
  return bots;
}
