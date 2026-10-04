import { clamp, createRng } from "@/lib/random/seededRandom";

export type Cohort = "novice" | "average" | "skilled";

export type PlayerProfile = {
  id: string;
  cohort: Cohort;
  accuracy: number;
  reaction: number;
  damageAvoidance: number;
  aggression: number;
  resourceManagement: number;
};

export const COHORTS: Cohort[] = ["novice", "average", "skilled"];

export const COHORT_SIZES: Record<Cohort, number> = { novice: 35, average: 40, skilled: 25 };

type Trait = Exclude<keyof PlayerProfile, "id" | "cohort">;

const COHORT_MEANS: Record<Cohort, Record<Trait, number>> = {
  novice: { accuracy: 0.42, reaction: 0.38, damageAvoidance: 0.32, aggression: 0.58, resourceManagement: 0.34 },
  average: { accuracy: 0.58, reaction: 0.55, damageAvoidance: 0.5, aggression: 0.5, resourceManagement: 0.52 },
  skilled: { accuracy: 0.76, reaction: 0.74, damageAvoidance: 0.7, aggression: 0.55, resourceManagement: 0.7 },
};

const TRAITS: Trait[] = ["accuracy", "reaction", "damageAvoidance", "aggression", "resourceManagement"];

/**
 * Generates exactly 100 behavioural profiles from a seed. The same seed always
 * produces the identical cohort; candidates are tested against this one array.
 */
export function generatePopulation(seed: number): PlayerProfile[] {
  const players: PlayerProfile[] = [];
  let index = 0;
  for (const cohort of COHORTS) {
    for (let i = 0; i < COHORT_SIZES[cohort]; i++) {
      index++;
      const id = `P${String(index).padStart(3, "0")}`;
      const rng = createRng(seed, "encounter-population", id);
      const profile = { id, cohort } as PlayerProfile;
      for (const trait of TRAITS) {
        profile[trait] = round3(clamp(rng.normal(COHORT_MEANS[cohort][trait], 0.08), 0.05, 0.98));
      }
      players.push(profile);
    }
  }
  return players;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
