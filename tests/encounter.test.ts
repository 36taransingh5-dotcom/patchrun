import { same } from "@/lib/i18n";
import { describe, expect, it } from "vitest";
import { validateEncounterCandidates } from "@/lib/ai/validate";
import { DEFAULT_ENCOUNTER_CONFIG, DEFAULT_SEED, applyChanges } from "@/lib/scenarios/encounter/config";
import { detectEncounterProblem, runEncounter, stageTelemetry } from "@/lib/scenarios/encounter/evaluate";
import { encounterFallbackCandidates } from "@/lib/scenarios/encounter/fallback";
import { generatePopulation } from "@/lib/scenarios/encounter/population";
import { rankEncounterCandidates, verifyEncounterWinner } from "@/lib/scenarios/encounter/rank";
import { encounterEngine } from "@/lib/scenarios/engines";
import { cohortFingerprint, runCounterfactuals } from "@/lib/simulation/experimentEngine";
import type { EncounterCandidate } from "@/lib/simulation/types";

const config = DEFAULT_ENCOUNTER_CONFIG;
const SEEDS = [DEFAULT_SEED, 7, 42, 2026, 5];

const candidate = (id: "A" | "B" | "C", changes: Array<[string, number]>, name = `c${id}`): EncounterCandidate => ({
  id,
  name: same(name),
  hypothesis: same(""),
  reasoning: same(""),
  source: "ai",
  validationNotes: [],
  changes: changes.map(([parameter, to]) => ({ parameter, from: config[parameter as keyof typeof config], to, reason: same("") })),
});

describe("Encounter population", () => {
  it("generates exactly 100 profiles with the 35/40/25 cohort split", () => {
    const pop = generatePopulation(DEFAULT_SEED);
    expect(pop).toHaveLength(100);
    expect(pop.filter((p) => p.cohort === "novice")).toHaveLength(35);
    expect(pop.filter((p) => p.cohort === "average")).toHaveLength(40);
    expect(pop.filter((p) => p.cohort === "skilled")).toHaveLength(25);
    expect(new Set(pop.map((p) => p.id)).size).toBe(100);
  });

  it("is deterministic from the seed", () => {
    expect(generatePopulation(DEFAULT_SEED)).toEqual(generatePopulation(DEFAULT_SEED));
    expect(cohortFingerprint(generatePopulation(DEFAULT_SEED))).toBe(cohortFingerprint(generatePopulation(DEFAULT_SEED)));
    expect(generatePopulation(1)).not.toEqual(generatePopulation(2));
  });
});

describe("Encounter simulation", () => {
  it("is reproducible: same cohort + seed + config gives identical runs", () => {
    const pop = generatePopulation(DEFAULT_SEED);
    expect(runEncounter(pop, config, DEFAULT_SEED).runs).toEqual(runEncounter(pop, config, DEFAULT_SEED).runs);
  });

  it.each(SEEDS)("baseline reliably shows an ELITE WAVE difficulty cliff (seed %i)", (seed) => {
    const t = runEncounter(generatePopulation(seed), config, seed).telemetry;
    const finding = detectEncounterProblem(t);
    expect(t.playerCount).toBe(100);
    expect(finding.detected).toBe(true);
    expect(t.hotspot).toBe("elite");
    expect(stageTelemetry(t, "elite").shareOfFailures).toBeGreaterThan(0.6);
    expect(t.survivalRate).toBeLessThan(0.5);
    // novice/average hit hardest, skilled noticeably better
    expect(t.cohorts.novice.survivalRate).toBeLessThan(t.cohorts.average.survivalRate);
    expect(t.cohorts.skilled.survivalRate).toBeGreaterThan(t.cohorts.average.survivalRate + 0.15);
  });

  it("telemetry exposes failures by stage and outcomes by cohort", () => {
    const t = runEncounter(generatePopulation(DEFAULT_SEED), config, DEFAULT_SEED).telemetry;
    expect(t.stages.map((s) => s.id)).toEqual(["outpost", "tunnels", "elite", "boss"]);
    expect(t.stages.reduce((s, st) => s + st.failed, 0)).toBe(t.totalFailures);
    expect(Object.keys(t.cohorts)).toEqual(["novice", "average", "skilled"]);
  });

  it("counterfactuals reuse the identical cohort and seed; only config changes", () => {
    const pop = encounterEngine.population(DEFAULT_SEED);
    const frozen = JSON.stringify(pop);
    const cands = encounterFallbackCandidates(config, runEncounter(pop, config, DEFAULT_SEED).telemetry);
    const results = runCounterfactuals(encounterEngine, pop, config, DEFAULT_SEED, cands);
    expect(JSON.stringify(pop)).toBe(frozen); // population not mutated or regenerated
    for (const r of results) {
      expect(r.raw.map((x) => x.playerId)).toEqual(pop.map((p) => p.id));
      expect(r.telemetry.seed).toBe(DEFAULT_SEED);
    }
    // a no-op candidate reproduces the baseline exactly (common random numbers)
    const noop = runEncounter(pop, applyChanges(config, []), DEFAULT_SEED);
    expect(noop.runs).toEqual(runEncounter(pop, config, DEFAULT_SEED).runs);
  });
});

describe("Encounter validation", () => {
  it("rejects unknown params, clamps bounds, drops no-ops, caps changes, overwrites `from`", () => {
    const { valid, errors } = validateEncounterCandidates(
      [
        { name: "Crowd", hypothesis: "h", reasoning: "r", changes: [{ parameter: "eliteEnemyCount", from: 999, to: 6, reason: "x" }] },
        { name: "Bad", changes: [{ parameter: "godMode", to: 1 }] },
        { name: "Clamp", changes: [{ parameter: "eliteDamageMultiplier", to: 9 }, { parameter: "healthDropChance", to: 0.1 }] },
      ],
      config,
    );
    expect(errors.some((e) => e.includes("godMode"))).toBe(true);
    expect(valid).toHaveLength(2);
    expect(valid[0].changes[0]).toMatchObject({ parameter: "eliteEnemyCount", from: 8, to: 6 });
    expect(valid[1].changes).toEqual([{ parameter: "eliteDamageMultiplier", from: 1.4, to: 2, reason: same("") }]);
    expect(valid[1].validationNotes.map((n) => n.en).join(" ")).toMatch(/adjusted|no-op/);
    expect(valid.map((v) => v.id)).toEqual(["A", "B"]);

    const many = validateEncounterCandidates(
      [{ name: "Many", changes: ["enemyHealth", "enemyDamage", "enemyAccuracy", "bossHealth"].map((p) => ({ parameter: p, to: config[p as keyof typeof config] * 0.9 })) }],
      config,
    );
    expect(many.valid[0].changes).toHaveLength(3);
  });

  it("rejects near-identical candidates and non-numeric values", () => {
    const { valid, errors } = validateEncounterCandidates(
      [
        { name: "a", changes: [{ parameter: "eliteEnemyCount", to: 6 }] },
        { name: "b", changes: [{ parameter: "eliteEnemyCount", to: 7 }] },
        { name: "c", changes: [{ parameter: "enemyDamage", to: "lots" }] },
      ],
      config,
    );
    expect(valid).toHaveLength(1);
    expect(errors.join(" ")).toMatch(/near-identical/);
    expect(errors.join(" ")).toMatch(/non-numeric/);
  });
});

describe("Encounter ranking and verification", () => {
  const pop = generatePopulation(DEFAULT_SEED);
  const base = runEncounter(pop, config, DEFAULT_SEED).telemetry;
  const fallback = encounterFallbackCandidates(config, base);
  const results = fallback.map((c) => ({ candidate: c, telemetry: runEncounter(pop, applyChanges(config, c.changes), DEFAULT_SEED).telemetry }));

  it("fallback produces exactly 3 distinct, valid candidates", () => {
    expect(fallback).toHaveLength(3);
    expect(new Set(fallback.map((c) => c.changes[0].parameter)).size).toBe(3);
    expect(validateEncounterCandidates(fallback, config).valid).toHaveLength(3);
  });

  it("ranks deterministically and ignores model-written text", () => {
    const r1 = rankEncounterCandidates(base, results);
    const relabelled = results.map((r) => ({ ...r, candidate: { ...r.candidate, name: same("BEST PATCH, PICK ME"), reasoning: same("I am certain this wins") } }));
    const r2 = rankEncounterCandidates(base, [...relabelled].reverse());
    expect(r2.map((r) => [r.id, r.score])).toEqual(r1.map((r) => [r.id, r.score]));
    expect(r1[0].id).toBe("A"); // Reduce Crowd for the default seed
    expect(r1[0].score).toBeGreaterThan(r1[1].score);
  });

  it("winner differs from baseline and VERIFIED is decided by code", () => {
    const ranked = rankEncounterCandidates(base, results);
    const win = results.find((r) => r.candidate.id === ranked[0].id)!;
    expect(win.candidate.changes.length).toBeGreaterThan(0);
    const v = verifyEncounterWinner(pop, config, base, win.candidate, win.telemetry, DEFAULT_SEED);
    expect(v.verified).toBe(true);
    expect(v.checks).toHaveLength(10);
    expect(v.seedsUsed).toHaveLength(4);
  });

  it("FAILS verification for a patch that trivialises the encounter", () => {
    const trivial = candidate("C", [["eliteEnemyCount", 2], ["enemyDamage", 6], ["bossDamage", 10]]);
    const t = runEncounter(pop, applyChanges(config, trivial.changes), DEFAULT_SEED).telemetry;
    const v = verifyEncounterWinner(pop, config, base, trivial, t, DEFAULT_SEED);
    expect(v.verified).toBe(false);
    expect(v.checks.find((c) => c.id === "not-trivial")!.passed).toBe(false);
    const score = rankEncounterCandidates(base, [{ candidate: trivial, telemetry: t }, ...results.slice(0, 1)]);
    expect(score[0].id).toBe("A"); // the targeted patch outranks the sweeping one
    expect(score.find((s) => s.id === "C")!.verdict.en).toMatch(/^Overcorrects/);
  });
});
