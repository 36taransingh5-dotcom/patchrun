import { z } from "zod";
import { BOT_ARCHETYPES, BOT_MIX_BOUNDS, BOT_PROFILES, OBJECTIVES, type ObjectiveId } from "@/lib/scenarios/battleRoyale/config";
import type { BattleRoyaleTelemetry } from "@/lib/scenarios/battleRoyale/evaluate";
import { ENCOUNTER_PARAMS, ENCOUNTER_PARAM_ORDER, type EncounterConfig } from "@/lib/scenarios/encounter/config";
import type { EncounterTelemetry } from "@/lib/scenarios/encounter/evaluate";
import type { BotMix, Finding } from "@/lib/simulation/types";

export const SYSTEM_PROMPT = `You are the AI Experimenter inside PATCHRUN, a pre-deployment experimentation tool for game systems.

Your job is narrow:
- interpret aggregate telemetry from a deterministic behavioural simulation,
- form hypotheses about why the measured problem happens,
- propose exactly three candidate interventions that a simulation will then test.

You do not choose a winner, predict scores, or declare success. PATCHRUN re-simulates every candidate against the same cohort and seeds and ranks them with deterministic code. Your proposals compete; evidence decides.

Rules for candidates:
- Exactly 3 candidates. Each must test a genuinely different hypothesis (different mechanism or lever), not three sizes of the same tweak.
- Stay inside the allowed parameters and bounds. Values outside bounds will be clamped or rejected.
- Prefer small, targeted interventions, but make sure each one is plausibly large enough to meet the acceptanceCriteria. Spread your three candidates across different levels of boldness rather than three cautious tweaks.
- Explain the trade-off each one risks.
- The telemetry describes simulated behavioural profiles, not real players. Do not claim predictions about real humans.
- Keep text concise: name ≤ 4 words, hypothesis ≤ 1 sentence, reasoning ≤ 2 sentences.
- The interface is bilingual. Every prose field has a *Zh twin (e.g. name / nameZh): write the English field in English and the Zh field as a natural Simplified Chinese translation of it. Keep numbers and parameter identifiers unchanged.`;

// ───────────── Output schemas (structured outputs; validated again in validate.ts) ─────────────

export const EncounterOutputSchema = z.object({
  diagnosis: z.string(),
  diagnosisZh: z.string(),
  confidence: z.number(),
  evidence: z.array(z.string()),
  evidenceZh: z.array(z.string()),
  candidates: z.array(
    z.object({
      name: z.string(),
      nameZh: z.string(),
      hypothesis: z.string(),
      hypothesisZh: z.string(),
      reasoning: z.string(),
      reasoningZh: z.string(),
      changes: z.array(
        z.object({
          parameter: z.enum(ENCOUNTER_PARAM_ORDER as [string, ...string[]]),
          to: z.number(),
          reason: z.string(),
          reasonZh: z.string(),
        }),
      ),
    }),
  ),
});

export const BattleRoyaleOutputSchema = z.object({
  diagnosis: z.string(),
  diagnosisZh: z.string(),
  confidence: z.number(),
  evidence: z.array(z.string()),
  evidenceZh: z.array(z.string()),
  candidates: z.array(
    z.object({
      name: z.string(),
      nameZh: z.string(),
      hypothesis: z.string(),
      hypothesisZh: z.string(),
      reasoning: z.string(),
      reasoningZh: z.string(),
      mix: z.object({
        rusher: z.number(),
        hunter: z.number(),
        survivor: z.number(),
        sentinel: z.number(),
        looter: z.number(),
      }),
    }),
  ),
});

// ───────────── Acceptance criteria ─────────────
// What the deterministic verifier will check (mirrors lib/scenarios/*/rank.ts).
// Shared with the model so proposals are calibrated to the bar; the model
// never sees scores, and simulation alone decides the winner.

const ENCOUNTER_ACCEPTANCE = [
  "Problem-stage hazard (failures ÷ entrants) at or below 25%, and below 28% on three held-out seeds",
  "Problem stage holds under 50% of all failures",
  "Novice and average simulated survival each improve by ≥ 15 percentage points",
  "Skilled simulated survival stays ≤ 95% and does not drop",
  "Overall simulated survival stays ≤ 80% (encounter must not become trivial)",
  "No other stage exceeds 35% hazard",
  "Smaller, targeted changes score higher than broad global nerfs",
];

const BR_ACCEPTANCE: Record<ObjectiveId, string[]> = {
  beginner_onboarding: ["NEW early elimination drops by ≥ 15 percentage points (ideally to ≤ 50%)"],
  competitive_pressure: ["SKILLED late-game encounters per profile rise by ≥ 10%"],
  faster_matches: ["Share of top-10 placements that never fought drops by ≥ 8 percentage points"],
  balanced_population: ["SKILLED–NEW average survival-phase gap narrows by ≥ 0.3 phases"],
};

const BR_GUARDRAILS = [
  "Encounter rate stays ≥ 65% of baseline (meaningful combat preserved)",
  "SKILLED late-game pressure stays ≥ 75% of baseline",
  "Bots still cause ≥ 40% of human combat eliminations (bots not harmless)",
  "Top-10 placements that never fought stay ≤ 65%",
  "At least 3 archetypes at ≥ 10% share",
  "Improvement must hold on three held-out seed families",
];

// ───────────── Structured inputs ─────────────

export function encounterAiInput(config: EncounterConfig, t: EncounterTelemetry, finding: Finding, objective: string) {
  return {
    scenario: {
      id: "encounter",
      name: "Difficulty Cliff",
      description:
        "Abstract four-stage action encounter: OUTPOST (3 enemies, 1 at a time) → TUNNELS (5 enemies, 1 at a time) → ELITE WAVE (eliteEnemyCount elites with 1.3× health, 2 attack at once) → BOSS (3 phases). 100 seeded behavioural profiles; players fail when health reaches 0.",
    },
    objective,
    currentConfig: config,
    constraints: {
      maxCandidates: 3,
      maxChangedParametersPerCandidate: 3,
      parameters: Object.fromEntries(
        ENCOUNTER_PARAM_ORDER.map((p) => [p, { min: ENCOUNTER_PARAMS[p].min, max: ENCOUNTER_PARAMS[p].max, integer: ENCOUNTER_PARAMS[p].integer, description: ENCOUNTER_PARAMS[p].description }]),
      ),
    },
    deterministicFinding: { title: finding.title.en, lines: finding.lines.map((l) => l.en), evidence: finding.evidence },
    acceptanceCriteria: ENCOUNTER_ACCEPTANCE,
    telemetry: {
      seed: t.seed,
      players: t.playerCount,
      simulatedSurvival: t.survivalRate,
      avgRemainingHealth: t.avgRemainingHealth,
      stages: t.stages.map((s) => ({ stage: s.name, entered: s.entered, failed: s.failed, hazard: s.hazard, shareOfFailures: s.shareOfFailures, avgHealthEntering: s.avgHealthEntering })),
      cohorts: Object.values(t.cohorts).map((c) => ({ cohort: c.cohort, count: c.count, simulatedSurvival: c.survivalRate, failuresByStage: c.failuresByStage })),
    },
  };
}

export function battleRoyaleAiInput(mix: BotMix, objective: ObjectiveId, t: BattleRoyaleTelemetry, finding: Finding) {
  return {
    scenario: {
      id: "battleRoyale",
      name: "Battle Royale Bot Lab",
      description:
        "Abstract 100-agent lobby (60 simulated human profiles: 24 NEW, 24 AVERAGE, 12 SKILLED; 40 bots). 5 shrinking phases; agents choose LOOT/ROTATE/ENGAGE/AVOID/HOLD/HEAL. Phases 1–2 are decided by combat only; from phase 3 the zone forces the lobby down. 'Early elimination' = eliminated in phases 1–2. Metrics are averaged over a seeded family of matches.",
    },
    objective: { id: objective, name: OBJECTIVES[objective].name.en, description: OBJECTIVES[objective].description.en },
    currentBotMix: mix,
    constraints: {
      strategies: 3,
      percentagesMustSumTo: 100,
      archetypes: Object.fromEntries(
        BOT_ARCHETYPES.map((k) => [k, { ...BOT_MIX_BOUNDS[k], behaviour: BOT_PROFILES[k].summary.en, tendencies: BOT_PROFILES[k].tendencies, activeFromPhase: BOT_PROFILES[k].activeFromPhase, targeting: BOT_PROFILES[k].targeting }]),
      ),
    },
    deterministicFinding: { title: finding.title.en, lines: finding.lines.map((l) => l.en), evidence: finding.evidence },
    acceptanceCriteria: [...BR_ACCEPTANCE[objective], ...BR_GUARDRAILS],
    telemetry: {
      seed: t.seed,
      matches: t.matches,
      earlyEliminationByCohort: { NEW: t.cohorts.new.earlyElimination, AVERAGE: t.cohorts.average.earlyElimination, SKILLED: t.cohorts.skilled.earlyElimination },
      avgSurvivalPhaseByCohort: { NEW: t.cohorts.new.avgSurvivalPhase, AVERAGE: t.cohorts.average.avgSurvivalPhase, SKILLED: t.cohorts.skilled.avgSurvivalPhase },
      encounterRatePerAgent: t.encounterRate,
      fightsByPhase: t.fightsByPhase,
      skilledLateGamePressure: t.skilledPressure,
      passiveSurvivalTop10: t.passiveSurvival,
      botShareOfHumanCombatEliminations: t.botKillShare,
      humanShareOfTop10: t.humanTop10Share,
    },
  };
}

export function userPrompt(input: unknown): string {
  return `Here is the experiment input as JSON. Diagnose the problem from the telemetry and propose exactly 3 distinct candidate interventions within the constraints. confidence is your 0–1 confidence in the diagnosis. evidence is 2–4 short bullet strings citing telemetry numbers.

${JSON.stringify(input, null, 2)}`;
}
