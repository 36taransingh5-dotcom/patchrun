// Bilingual text for everything the deterministic engine says. The engine
// produces both languages at once so switching language never re-runs or
// changes a simulation, score, or verdict.

export type Lang = "en" | "zh";
export type L10n = { en: string; zh: string };

export const L = (en: string, zh: string): L10n => ({ en, zh });
/** Same text in both languages (numbers, identifiers). */
export const same = (s: string): L10n => ({ en: s, zh: s });

export const pctText = (v: number) => `${Math.round(v * 100)}%`;
export const ppText = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}pp`;

export const STAGE_NAMES: Record<string, L10n> = {
  outpost: L("OUTPOST", "前哨站"),
  tunnels: L("TUNNELS", "隧道"),
  elite: L("ELITE WAVE", "精英波次"),
  boss: L("BOSS", "首领战"),
  cleared: L("CLEARED", "通关"),
};

export const ENCOUNTER_COHORT_NAMES: Record<string, L10n> = {
  novice: L("novice", "新手"),
  average: L("average", "普通"),
  skilled: L("skilled", "熟练"),
};

export const BR_COHORT_NAMES: Record<string, L10n> = {
  new: L("NEW", "新玩家"),
  average: L("AVERAGE", "普通玩家"),
  skilled: L("SKILLED", "高手"),
};

export const ARCHETYPE_NAMES: Record<string, L10n> = {
  rusher: L("RUSHER", "突击者"),
  hunter: L("HUNTER", "猎手"),
  survivor: L("SURVIVOR", "生存者"),
  sentinel: L("SENTINEL", "哨卫"),
  looter: L("LOOTER", "搜刮者"),
};

export const PARAM_NAMES: Record<string, L10n> = {
  enemyHealth: L("Enemy health", "敌人生命值"),
  enemyDamage: L("Enemy damage", "敌人伤害"),
  enemyAccuracy: L("Enemy accuracy", "敌人命中率"),
  eliteEnemyCount: L("Elite enemy count", "精英敌人数量"),
  eliteDamageMultiplier: L("Elite damage ×", "精英伤害倍率"),
  healthDropChance: L("Health drop chance", "血包掉落率"),
  bossHealth: L("Boss health", "首领生命值"),
  bossDamage: L("Boss damage", "首领伤害"),
};

export const stageName = (id: string): L10n => STAGE_NAMES[id] ?? same(id);
