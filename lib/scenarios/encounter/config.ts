export type EncounterConfig = {
  enemyHealth: number;
  enemyDamage: number;
  enemyAccuracy: number;
  eliteEnemyCount: number;
  eliteDamageMultiplier: number;
  healthDropChance: number;
  bossHealth: number;
  bossDamage: number;
};

export type EncounterParam = keyof EncounterConfig;

export type ParamSpec = {
  label: string;
  min: number;
  max: number;
  integer: boolean;
  decimals: number;
  description: string;
};

/** The only parameters an intervention may touch, with hard bounds. */
export const ENCOUNTER_PARAMS: Record<EncounterParam, ParamSpec> = {
  enemyHealth: { label: "Enemy health", min: 60, max: 160, integer: true, decimals: 0, description: "Hit points of standard and elite enemies (elites ×1.3)." },
  enemyDamage: { label: "Enemy damage", min: 6, max: 24, integer: true, decimals: 0, description: "Base damage per enemy attack, all stages." },
  enemyAccuracy: { label: "Enemy accuracy", min: 0.3, max: 0.9, integer: false, decimals: 2, description: "Probability-weighted hit rate of enemy attacks." },
  eliteEnemyCount: { label: "Elite enemy count", min: 2, max: 12, integer: true, decimals: 0, description: "Number of elites in the ELITE WAVE. Up to 2 attack at once." },
  eliteDamageMultiplier: { label: "Elite damage ×", min: 1.0, max: 2.0, integer: false, decimals: 2, description: "Damage multiplier applied to elite attacks." },
  healthDropChance: { label: "Health drop chance", min: 0, max: 0.4, integer: false, decimals: 2, description: "Chance an enemy drops a health pack (+22 HP) on defeat." },
  bossHealth: { label: "Boss health", min: 120, max: 400, integer: true, decimals: 0, description: "Hit points of the final boss." },
  bossDamage: { label: "Boss damage", min: 10, max: 35, integer: true, decimals: 0, description: "Damage per boss attack." },
};

export const ENCOUNTER_PARAM_ORDER = Object.keys(ENCOUNTER_PARAMS) as EncounterParam[];

/** Intentionally overtuned: the ELITE WAVE is a difficulty cliff. */
export const DEFAULT_ENCOUNTER_CONFIG: EncounterConfig = {
  enemyHealth: 100,
  enemyDamage: 14,
  enemyAccuracy: 0.65,
  eliteEnemyCount: 8,
  eliteDamageMultiplier: 1.4,
  healthDropChance: 0.1,
  bossHealth: 220,
  bossDamage: 22,
};

export const DEFAULT_ENCOUNTER_OBJECTIVE =
  "Preserve challenge for skilled profiles while removing the severe difficulty cliff for novice and average behavioural profiles.";
export const DEFAULT_ENCOUNTER_OBJECTIVE_ZH = "在为新手和普通行为画像消除严重难度断崖的同时，保留对熟练画像的挑战。";

export const DEFAULT_SEED = 1337;

export type StageId = "outpost" | "tunnels" | "elite" | "boss";

export const STAGES: Array<{ id: StageId; name: string; short: string }> = [
  { id: "outpost", name: "OUTPOST", short: "OUTPOST" },
  { id: "tunnels", name: "TUNNELS", short: "TUNNELS" },
  { id: "elite", name: "ELITE WAVE", short: "ELITE" },
  { id: "boss", name: "BOSS", short: "BOSS" },
];

export function formatParam(param: EncounterParam, value: number): string {
  return value.toFixed(ENCOUNTER_PARAMS[param].decimals);
}

export function applyChanges(
  config: EncounterConfig,
  changes: Array<{ parameter: string; to: number }>,
): EncounterConfig {
  const next = { ...config };
  for (const c of changes) {
    if (c.parameter in ENCOUNTER_PARAMS) next[c.parameter as EncounterParam] = c.to;
  }
  return next;
}
