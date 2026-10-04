import { createRng } from "@/lib/random/seededRandom";
import { STAGES, type EncounterConfig, type StageId } from "./config";
import type { PlayerProfile } from "./population";

export type EncounterRun = {
  playerId: string;
  cohort: PlayerProfile["cohort"];
  completed: boolean;
  failedStage?: StageId;
  healthEnteringStage: Partial<Record<StageId, number>>;
  healthLeavingStage: Partial<Record<StageId, number>>;
  damageTaken: number;
  healthPacks: number;
};

type Enemy = { hp: number; dps: number; burst: number };
type StagePlan = { id: StageId; enemies: Enemy[]; concurrency: number };

const MAX_HEALTH = 100;
const HEALTH_PACK = 22;
const ELITE_HEALTH_MULT = 1.3;
/** Calibration constants for the abstract combat model (fit offline so the default config shows a clear cliff). */
export const TUNING = {
  damageRate: 0.245,
  bossRate: 0.65,
  accuracyBase: 1.39,
  avoidCoef: 0.21,
  reactionCoef: 0.21,
  reactionBase: 1.25,
  formMin: 0.66,
  formMax: 1.23,
  mistakeBase: 0.053,
  mistakeBurst: 6,
  bossBurst: 11.1,
};
const PLAYER_DPS = 32;

function planStages(config: EncounterConfig): StagePlan[] {
  const base = config.enemyDamage * config.enemyAccuracy * TUNING.damageRate;
  const standard = (n: number): Enemy[] =>
    Array.from({ length: n }, () => ({ hp: config.enemyHealth, dps: base, burst: TUNING.mistakeBurst }));
  return [
    { id: "outpost", enemies: standard(3), concurrency: 1 },
    { id: "tunnels", enemies: standard(5), concurrency: 1 },
    {
      id: "elite",
      enemies: Array.from({ length: Math.round(config.eliteEnemyCount) }, () => ({
        hp: config.enemyHealth * ELITE_HEALTH_MULT,
        dps: base * config.eliteDamageMultiplier,
        burst: TUNING.mistakeBurst,
      })),
      concurrency: 2,
    },
    {
      id: "boss",
      // The boss fight is resolved as three phases, each with its own chance of a punishing mistake.
      enemies: Array.from({ length: 3 }, () => ({
        hp: config.bossHealth / 3,
        dps: config.bossDamage * config.enemyAccuracy * TUNING.bossRate,
        burst: TUNING.bossBurst,
      })),
      concurrency: 1,
    },
  ];
}

/**
 * Abstract, seeded resolution of one player's run. Each (seed, player, stage)
 * has its own RNG stream and each enemy consumes a fixed number of draws, so
 * enemy #k always sees the same random numbers regardless of configuration.
 */
export function simulatePlayer(player: PlayerProfile, config: EncounterConfig, seed: number): EncounterRun {
  const run: EncounterRun = {
    playerId: player.id,
    cohort: player.cohort,
    completed: false,
    healthEnteringStage: {},
    healthLeavingStage: {},
    damageTaken: 0,
    healthPacks: 0,
  };

  const playerDps = PLAYER_DPS * (TUNING.accuracyBase + player.accuracy) * (0.85 + 0.3 * player.aggression);
  const exposure =
    (1 - TUNING.avoidCoef * player.damageAvoidance) * (TUNING.reactionBase - TUNING.reactionCoef * player.reaction) * (0.85 + 0.3 * player.aggression);
  const pickupSkill = 0.6 + 0.8 * player.resourceManagement;

  let health = MAX_HEALTH;
  for (const stage of planStages(config)) {
    const rng = createRng(seed, "encounter-run", player.id, stage.id);
    run.healthEnteringStage[stage.id] = Math.round(health);
    // Per-stage execution variance: some attempts simply go better than others.
    const form = rng.range(TUNING.formMin, TUNING.formMax);
    const n = stage.enemies.length;
    for (let j = 0; j < n; j++) {
      const enemy = stage.enemies[j];
      const timeToKill = (enemy.hp / playerDps) * rng.range(0.8, 1.2);
      const attackers = Math.min(stage.concurrency, n - j);
      const incoming = attackers * enemy.dps * exposure * form * timeToKill * rng.range(0.75, 1.25);
      // Occasional mistakes (missed dodge, bad positioning) land a burst; quicker reactions avoid more.
      const mistake = rng.next() < TUNING.mistakeBase * (1.25 - player.reaction) ? enemy.dps * enemy.burst : 0;
      const dropRoll = rng.next();
      health -= incoming + mistake;
      run.damageTaken += incoming + mistake;
      if (health <= 0) {
        run.failedStage = stage.id;
        run.healthLeavingStage[stage.id] = 0;
        run.damageTaken = Math.round(run.damageTaken);
        return run;
      }
      if (dropRoll < config.healthDropChance * pickupSkill) {
        health = Math.min(MAX_HEALTH, health + HEALTH_PACK);
        run.healthPacks++;
      }
    }
    // Short breather between stages; better resource management recovers more.
    health = Math.min(MAX_HEALTH, health + 6 + 10 * player.resourceManagement);
    run.healthLeavingStage[stage.id] = Math.round(health);
  }
  run.completed = true;
  run.damageTaken = Math.round(run.damageTaken);
  return run;
}

export function simulateEncounter(players: PlayerProfile[], config: EncounterConfig, seed: number): EncounterRun[] {
  return players.map((p) => simulatePlayer(p, config, seed));
}

export const STAGE_IDS = STAGES.map((s) => s.id);
