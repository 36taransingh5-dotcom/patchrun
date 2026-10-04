import { describe, expect, it, vi } from "vitest";
import { generateBattleRoyaleExperiment, generateEncounterExperiment, type ProposeFn } from "@/lib/ai/experimenter";
import { DEFAULT_BOT_MIX } from "@/lib/scenarios/battleRoyale/config";
import { DEFAULT_ENCOUNTER_CONFIG, DEFAULT_ENCOUNTER_OBJECTIVE, DEFAULT_SEED } from "@/lib/scenarios/encounter/config";

const provider = { provider: "anthropic", model: "claude-opus-5-5", configured: true };
const args = { config: DEFAULT_ENCOUNTER_CONFIG, seed: DEFAULT_SEED, objective: DEFAULT_ENCOUNTER_OBJECTIVE };

const goodEncounter = {
  diagnosis: "Elite wave overlapping attacks",
  diagnosisZh: "精英波次攻击重叠",
  confidence: 0.8,
  evidence: ["ELITE WAVE 70% of failures"],
  candidates: [
    { name: "Reduce Crowd", hypothesis: "h", reasoning: "r", changes: [{ parameter: "eliteEnemyCount", to: 6, reason: "fewer" }] },
    { name: "Burst", hypothesis: "h", reasoning: "r", changes: [{ parameter: "eliteDamageMultiplier", to: 1.2, reason: "softer" }] },
    { name: "Recovery", hypothesis: "h", reasoning: "r", changes: [{ parameter: "healthDropChance", to: 0.2, reason: "heal" }] },
  ],
};

const asPropose = (fn: (prompt: string, retryNote?: string) => unknown) => vi.fn(async (_s: unknown, prompt: string, retryNote?: string) => fn(prompt, retryNote)) as unknown as ProposeFn & ReturnType<typeof vi.fn>;

describe("AI experimenter orchestration", () => {
  it("uses the deterministic fallback, clearly labelled, when no provider is configured", async () => {
    const r = await generateEncounterExperiment(args, null, { ...provider, configured: false });
    expect(r.mode).toBe("fallback");
    expect(r.fallbackReason!.en).toMatch(/ANTHROPIC_API_KEY/);
    expect(r.fallbackReason!.zh).toMatch(/ANTHROPIC_API_KEY/);
    expect(r.candidates).toHaveLength(3);
    expect(r.candidates.every((c) => c.source === "fallback")).toBe(true);
  });

  it("receives structured telemetry and returns 3 validated AI candidates", async () => {
    const propose = asPropose(() => goodEncounter);
    const r = await generateEncounterExperiment(args, propose, provider);
    expect(r.mode).toBe("ai");
    expect(r.candidates.map((c) => c.id)).toEqual(["A", "B", "C"]);
    expect(r.candidates.every((c) => c.source === "ai")).toBe(true);
    const prompt: string = propose.mock.calls[0][1];
    const input = JSON.parse(prompt.slice(prompt.indexOf("{")));
    expect(input.telemetry.players).toBe(100);
    expect(input.telemetry.stages).toHaveLength(4);
    expect(input.constraints.parameters.eliteEnemyCount).toMatchObject({ min: 2, max: 12 });
    expect(input.deterministicFinding.title).toBe("BALANCE REGRESSION DETECTED");
    // bilingual output: the Chinese twin is used when present, English otherwise
    expect(r.diagnosis.en).toBe("Elite wave overlapping attacks");
    expect(r.diagnosis.zh).toBe("精英波次攻击重叠");
    expect(r.candidates[0].name.zh).toBe("Reduce Crowd"); // no nameZh given → English fallback
  });

  it("retries once with validation errors, then fills gaps with labelled fallback", async () => {
    const bad = { ...goodEncounter, candidates: [goodEncounter.candidates[0], { name: "x", changes: [{ parameter: "godMode", to: 1 }] }] };
    const propose = asPropose(() => bad);
    const r = await generateEncounterExperiment(args, propose, provider);
    expect(propose).toHaveBeenCalledTimes(2);
    expect(propose.mock.calls[1][2]).toMatch(/godMode/);
    expect(r.mode).toBe("mixed");
    expect(r.candidates).toHaveLength(3);
    expect(r.candidates[0].source).toBe("ai");
    expect(r.candidates.slice(1).every((c) => c.source === "fallback")).toBe(true);
    // the fallback filler must not duplicate the AI's Reduce Crowd idea
    expect(r.candidates.filter((c) => c.changes[0].parameter === "eliteEnemyCount")).toHaveLength(1);
  });

  it("never breaks when the model call throws", async () => {
    const propose = asPropose(() => {
      throw new Error("Anthropic API error 529");
    });
    const r = await generateEncounterExperiment(args, propose, provider);
    expect(r.mode).toBe("fallback");
    expect(r.fallbackReason!.en).toMatch(/529/);
    expect(r.candidates).toHaveLength(3);
  });

  it("validates Battle Royale strategies to 100% and falls back on garbage", async () => {
    const good = asPropose(() => ({
      diagnosis: "d",
      confidence: 0.7,
      evidence: [],
      candidates: [
        { name: "A", hypothesis: "", reasoning: "", mix: { rusher: 25, hunter: 25, survivor: 50, sentinel: 0, looter: 0 } },
        { name: "B", hypothesis: "", reasoning: "", mix: { rusher: 15, hunter: 10, survivor: 30, sentinel: 35, looter: 10 } },
        { name: "C", hypothesis: "", reasoning: "", mix: { rusher: 10, hunter: 5, survivor: 40, sentinel: 0, looter: 45 } },
      ],
    }));
    const r = await generateBattleRoyaleExperiment({ mix: DEFAULT_BOT_MIX, seed: DEFAULT_SEED, objective: "beginner_onboarding" }, good, provider);
    expect(r.mode).toBe("ai");
    for (const c of r.candidates) expect(Object.values(c.mix).reduce((a, b) => a + b, 0)).toBe(100);

    const garbage = asPropose(() => ({ diagnosis: 1, candidates: "nope" }));
    const g = await generateBattleRoyaleExperiment({ mix: DEFAULT_BOT_MIX, seed: DEFAULT_SEED, objective: "beginner_onboarding" }, garbage, provider);
    expect(g.mode).toBe("fallback");
    expect(g.candidates).toHaveLength(3);
  });
});
