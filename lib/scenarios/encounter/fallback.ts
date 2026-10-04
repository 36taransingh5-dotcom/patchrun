import { L, stageName, type L10n } from "@/lib/i18n";
import type { EncounterCandidate } from "@/lib/simulation/types";
import { ENCOUNTER_PARAMS, type EncounterConfig, type EncounterParam } from "./config";
import { stageTelemetry, type EncounterTelemetry } from "./evaluate";

const round2 = (v: number) => Math.round(v * 100) / 100;

function change(config: EncounterConfig, parameter: EncounterParam, to: number, reason: L10n) {
  const spec = ENCOUNTER_PARAMS[parameter];
  const bounded = Math.min(spec.max, Math.max(spec.min, spec.integer ? Math.round(to) : round2(to)));
  return { parameter, from: config[parameter], to: bounded, reason };
}

/**
 * Rule-based candidate generator used when the AI is unavailable or returns
 * unusable output. Always labelled DETERMINISTIC FALLBACK in the UI.
 */
export function encounterFallbackCandidates(config: EncounterConfig, t: EncounterTelemetry): EncounterCandidate[] {
  const hot = stageTelemetry(t, t.hotspot);
  const n = stageName(hot.id);
  const pctHot = Math.round(hot.shareOfFailures * 100);
  const base = { source: "fallback" as const, validationNotes: [] };
  return [
    {
      ...base,
      id: "A",
      name: L("Reduce Crowd", "减少敌群"),
      hypothesis: L(
        `Rule: ${n.en} accounts for ${pctHot}% of failures, so fewer simultaneous elites should shorten exposure.`,
        `规则：${n.zh}占失败的 ${pctHot}%，减少同时出现的精英应能缩短受击时间。`,
      ),
      reasoning: L(
        "Elites attack two at a time, so removing elites cuts the number of overlapping attack windows, not just total enemy HP.",
        "精英两两同时进攻，减少精英数量削减的是重叠攻击窗口，而不只是敌人总血量。",
      ),
      changes: [change(config, "eliteEnemyCount", Math.round(config.eliteEnemyCount * 0.75), L("Remove ~25% of the elite wave.", "移除约 25% 的精英波次。"))],
    },
    {
      ...base,
      id: "B",
      name: L("Reduce Burst Damage", "降低爆发伤害"),
      hypothesis: L("Rule: elite damage multiplier is the steepest per-stage damage step, so soften it.", "规则：精英伤害倍率是各阶段中最陡的伤害跃升，应当削弱。"),
      reasoning: L("Lowering elite burst damage keeps the wave size intact but reduces how quickly mistakes compound.", "降低精英爆发伤害保留了波次规模，但减缓了失误累积的速度。"),
      changes: [change(config, "eliteDamageMultiplier", config.eliteDamageMultiplier - 0.18, L("Trim elite damage multiplier by 0.18.", "精英伤害倍率下调 0.18。"))],
    },
    {
      ...base,
      id: "C",
      name: L("Improve Recovery", "提升恢复能力"),
      hypothesis: L("Rule: profiles enter the hotspot with depleted health, so raise mid-fight recovery.", "规则：玩家画像进入热点阶段时血量已不足，应提高战斗中的恢复。"),
      reasoning: L("More health drops let weaker profiles recover between elites without changing enemy stats.", "更多血包让较弱的画像在精英之间回血，而无需改动敌人数值。"),
      changes: [change(config, "healthDropChance", config.healthDropChance + 0.08, L("Raise drop chance by 8 points.", "掉落率提高 8 个百分点。"))],
    },
  ];
}
