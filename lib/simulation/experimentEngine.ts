// The generic experiment pipeline both scenarios run through:
//   config → behavioural simulation → telemetry → problem detection
//   → AI candidates → counterfactual testing (same cohort, same seeds)
//   → deterministic ranking → regression verification.

import { hashSeed } from "@/lib/random/seededRandom";
import type { CandidateId, Finding, RankedCandidate, ScenarioId, VerificationResult } from "./types";

export type SimulationOutput<Telemetry, Raw> = { telemetry: Telemetry; raw: Raw };

export interface ScenarioEngine<Config, Population, Telemetry, Raw, Candidate extends { id: CandidateId }, Objective> {
  id: ScenarioId;
  /** Deterministic population for a seed. Generated once and reused for every candidate. */
  population(seed: number): Population;
  simulate(population: Population, config: Config, seed: number): SimulationOutput<Telemetry, Raw>;
  applyCandidate(config: Config, candidate: Candidate): Config;
  detect(telemetry: Telemetry, objective: Objective): Finding;
  rank(objective: Objective, base: Telemetry, results: Array<{ candidate: Candidate; telemetry: Telemetry }>): RankedCandidate[];
  verify(args: {
    objective: Objective;
    population: Population;
    baseConfig: Config;
    baseTelemetry: Telemetry;
    winner: Candidate;
    winnerTelemetry: Telemetry;
    seed: number;
  }): VerificationResult;
}

export type CounterfactualResult<Config, Telemetry, Raw, Candidate> = {
  candidate: Candidate;
  config: Config;
  telemetry: Telemetry;
  raw: Raw;
};

/** Runs every candidate against the identical population and seed; only the configuration differs. */
export function runCounterfactuals<Config, Population, Telemetry, Raw, Candidate extends { id: CandidateId }, Objective>(
  engine: ScenarioEngine<Config, Population, Telemetry, Raw, Candidate, Objective>,
  population: Population,
  baseConfig: Config,
  seed: number,
  candidates: Candidate[],
): Array<CounterfactualResult<Config, Telemetry, Raw, Candidate>> {
  return candidates.map((candidate) => {
    const config = engine.applyCandidate(baseConfig, candidate);
    const out = engine.simulate(population, config, seed);
    return { candidate, config, telemetry: out.telemetry, raw: out.raw };
  });
}

/** Short stable fingerprint of a population, shown in the UI to prove every run used the same cohort. */
export function cohortFingerprint(population: unknown): string {
  return hashSeed(JSON.stringify(population)).toString(16).padStart(8, "0");
}
