import type { ScenarioEngine } from "@/lib/simulation/experimentEngine";
import type { BotMix, BotStrategyCandidate, EncounterCandidate } from "@/lib/simulation/types";
import type { ObjectiveId } from "./battleRoyale/config";
import { detectBattleRoyaleProblem, runBattleRoyale, type BattleRoyaleTelemetry } from "./battleRoyale/evaluate";
import { generateHumans, type HumanProfile } from "./battleRoyale/population";
import { rankBotStrategies, verifyBotStrategy } from "./battleRoyale/rank";
import type { MatchRecord } from "./battleRoyale/simulate";
import { applyChanges, type EncounterConfig } from "./encounter/config";
import { detectEncounterProblem, runEncounter, type EncounterTelemetry } from "./encounter/evaluate";
import { generatePopulation, type PlayerProfile } from "./encounter/population";
import { rankEncounterCandidates, verifyEncounterWinner } from "./encounter/rank";
import type { EncounterRun } from "./encounter/simulate";

export const encounterEngine: ScenarioEngine<EncounterConfig, PlayerProfile[], EncounterTelemetry, EncounterRun[], EncounterCandidate, string> = {
  id: "encounter",
  population: generatePopulation,
  simulate: (players, config, seed) => {
    const r = runEncounter(players, config, seed);
    return { telemetry: r.telemetry, raw: r.runs };
  },
  applyCandidate: (config, c) => applyChanges(config, c.changes),
  detect: (t) => detectEncounterProblem(t),
  rank: (_objective, base, results) => rankEncounterCandidates(base, results),
  verify: ({ population, baseConfig, baseTelemetry, winner, winnerTelemetry, seed }) =>
    verifyEncounterWinner(population, baseConfig, baseTelemetry, winner, winnerTelemetry, seed),
};

export const battleRoyaleEngine: ScenarioEngine<BotMix, HumanProfile[], BattleRoyaleTelemetry, MatchRecord, BotStrategyCandidate, ObjectiveId> = {
  id: "battleRoyale",
  population: generateHumans,
  simulate: (humans, mix, seed) => {
    const r = runBattleRoyale(humans, mix, seed);
    return { telemetry: r.telemetry, raw: r.sample };
  },
  applyCandidate: (_mix, c) => c.mix,
  detect: (t, objective) => detectBattleRoyaleProblem(t, objective),
  rank: (objective, base, results) => rankBotStrategies(objective, base, results),
  verify: ({ objective, population, baseConfig, baseTelemetry, winner, winnerTelemetry, seed }) =>
    verifyBotStrategy(objective, population, baseConfig, baseTelemetry, winner, winnerTelemetry, seed),
};
