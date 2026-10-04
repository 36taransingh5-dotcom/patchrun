import { describe, expect, it } from "vitest";
import { normalizeMix, validateBotStrategies } from "@/lib/ai/validate";
import { BOT_ARCHETYPES, DEFAULT_BOT_MIX, DEFAULT_OBJECTIVE, OBJECTIVE_ORDER } from "@/lib/scenarios/battleRoyale/config";
import { detectBattleRoyaleProblem, runBattleRoyale } from "@/lib/scenarios/battleRoyale/evaluate";
import { battleRoyaleFallbackCandidates } from "@/lib/scenarios/battleRoyale/fallback";
import { botCounts, generateBots, generateHumans } from "@/lib/scenarios/battleRoyale/population";
import { rankBotStrategies, verifyBotStrategy } from "@/lib/scenarios/battleRoyale/rank";
import { DEFAULT_SEED } from "@/lib/scenarios/encounter/config";
import { battleRoyaleEngine } from "@/lib/scenarios/engines";
import { runCounterfactuals } from "@/lib/simulation/experimentEngine";

const humans = generateHumans(DEFAULT_SEED);
const base = runBattleRoyale(humans, DEFAULT_BOT_MIX, DEFAULT_SEED).telemetry;

describe("Battle Royale lobby", () => {
  it("has 60 simulated humans (NEW/AVERAGE/SKILLED) and 40 bots", () => {
    expect(humans).toHaveLength(60);
    expect(new Set(humans.map((h) => h.cohort))).toEqual(new Set(["new", "average", "skilled"]));
    const bots = generateBots(DEFAULT_BOT_MIX, DEFAULT_SEED);
    expect(bots).toHaveLength(40);
    expect(BOT_ARCHETYPES).toEqual(["rusher", "hunter", "survivor", "sentinel", "looter"]);
    const sample = runBattleRoyale(humans, DEFAULT_BOT_MIX, DEFAULT_SEED).sample;
    expect(sample.outcomes).toHaveLength(100);
  });

  it("converts any valid mix into exactly 40 bots", () => {
    expect(Object.values(botCounts({ rusher: 33, hunter: 33, survivor: 34, sentinel: 0, looter: 0 })).reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("is seeded and reproducible", () => {
    expect(generateHumans(DEFAULT_SEED)).toEqual(humans);
    expect(runBattleRoyale(humans, DEFAULT_BOT_MIX, DEFAULT_SEED).telemetry).toEqual(base);
    expect(runBattleRoyale(humans, DEFAULT_BOT_MIX, DEFAULT_SEED + 1).telemetry).not.toEqual(base);
  });
});

describe("Battle Royale baseline", () => {
  it.each([DEFAULT_SEED, 7, 42])("default aggressive mix over-eliminates NEW profiles early (seed %i)", (seed) => {
    const t = runBattleRoyale(generateHumans(seed), DEFAULT_BOT_MIX, seed).telemetry;
    const f = detectBattleRoyaleProblem(t, DEFAULT_OBJECTIVE);
    expect(f.detected).toBe(true);
    expect(t.cohorts.new.earlyElimination).toBeGreaterThan(0.55);
    expect(t.cohorts.new.earlyElimination).toBeGreaterThan(t.cohorts.average.earlyElimination);
    expect(t.cohorts.average.earlyElimination).toBeGreaterThan(t.cohorts.skilled.earlyElimination);
  });
});

describe("Bot strategy validation", () => {
  it("accepts only known archetypes and mixes that total 100", () => {
    const { valid, errors } = validateBotStrategies(
      [
        { name: "ok", mix: { rusher: 30, hunter: 20, survivor: 30, sentinel: 20, looter: 0 } },
        { name: "sum90", mix: { rusher: 30, hunter: 20, survivor: 20, sentinel: 20, looter: 0 } },
        { name: "alien", mix: { rusher: 10, hunter: 10, survivor: 40, sentinel: 20, looter: 20, sniper: 50 } },
      ],
      DEFAULT_BOT_MIX,
    );
    expect(valid.map((v) => v.name.en)).toEqual(["ok", "alien"]);
    expect(errors.join(" ")).toMatch(/sum to 90/);
    expect(errors.join(" ")).toMatch(/sniper/);
    for (const v of valid) expect(Object.values(v.mix).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("clamps out-of-range shares and renormalises to exactly 100", () => {
    const { valid } = validateBotStrategies([{ name: "x", mix: { rusher: 0, hunter: 0, survivor: 100, sentinel: 0, looter: 0 } }], DEFAULT_BOT_MIX);
    expect(valid[0].mix.survivor).toBe(100); // clamped to 70 then renormalised (only archetype present)
    expect(valid[0].validationNotes.map((n) => n.en).join(" ")).toMatch(/clamped/);
    const m = normalizeMix({ rusher: 1, hunter: 1, survivor: 1 });
    expect(Object.values(m).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("rejects strategies identical to the current mix or to each other", () => {
    const { valid, errors } = validateBotStrategies(
      [{ name: "same", mix: DEFAULT_BOT_MIX }, { name: "a", mix: { rusher: 30, hunter: 20, survivor: 30, sentinel: 20, looter: 0 } }, { name: "a2", mix: { rusher: 32, hunter: 18, survivor: 30, sentinel: 20, looter: 0 } }],
      DEFAULT_BOT_MIX,
    );
    expect(valid).toHaveLength(1);
    expect(errors.join(" ")).toMatch(/identical to the current/);
    expect(errors.join(" ")).toMatch(/near-identical/);
  });
});

describe("Battle Royale counterfactual ranking", () => {
  const cands = battleRoyaleFallbackCandidates(DEFAULT_OBJECTIVE, DEFAULT_BOT_MIX, base);
  const results = runCounterfactuals(battleRoyaleEngine, humans, DEFAULT_BOT_MIX, DEFAULT_SEED, cands);

  it("runs every strategy against the same 60 humans", () => {
    for (const r of results) {
      const ids = r.raw.outcomes.filter((o) => o.kind === "human").map((o) => o.id);
      expect(ids).toEqual(humans.map((h) => h.id));
    }
  });

  it("selects a deterministic winner with a best / passive / insufficient spread", () => {
    const ranked = rankBotStrategies(DEFAULT_OBJECTIVE, base, results);
    expect(rankBotStrategies(DEFAULT_OBJECTIVE, base, [...results].reverse())).toEqual(ranked);
    expect(ranked[0].id).toBe("B");
    expect(ranked.find((r) => r.id === "A")!.verdict.en).toMatch(/Insufficient/);
    expect(ranked.find((r) => r.id === "C")!.verdict.en).toMatch(/Overcorrects/);
  });

  it("verifies the winner on held-out seeds and explains the trade-off", () => {
    const ranked = rankBotStrategies(DEFAULT_OBJECTIVE, base, results);
    const win = results.find((r) => r.candidate.id === ranked[0].id)!;
    const v = verifyBotStrategy(DEFAULT_OBJECTIVE, humans, DEFAULT_BOT_MIX, base, win.candidate, win.telemetry, DEFAULT_SEED);
    expect(v.verified).toBe(true);
    expect(v.checks).toHaveLength(10);
    expect(ranked[0].components.map((c) => c.label.en)).toContain("Meaningful combat preserved");
  });

  it.each(OBJECTIVE_ORDER)("objective %s produces a ranking and a code-decided verdict", (objective) => {
    const cs = battleRoyaleFallbackCandidates(objective, DEFAULT_BOT_MIX, base);
    const rs = runCounterfactuals(battleRoyaleEngine, humans, DEFAULT_BOT_MIX, DEFAULT_SEED, cs);
    const ranked = rankBotStrategies(objective, base, rs);
    const win = rs.find((r) => r.candidate.id === ranked[0].id)!;
    const v = verifyBotStrategy(objective, humans, DEFAULT_BOT_MIX, base, win.candidate, win.telemetry, DEFAULT_SEED);
    expect(typeof v.verified).toBe("boolean");
    expect(v.checks.every((c) => typeof c.passed === "boolean")).toBe(true);
  });
});
