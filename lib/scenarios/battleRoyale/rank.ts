import { L, pctText as pct, ppText as pp, type L10n } from "@/lib/i18n";
import { clamp } from "@/lib/random/seededRandom";
import type {
  BotMix,
  BotStrategyCandidate,
  RankedCandidate,
  ScoreComponent,
  VerificationCheck,
  VerificationResult,
} from "@/lib/simulation/types";
import { BOT_ARCHETYPES, OBJECTIVES, type ObjectiveId } from "./config";
import { runBattleRoyale, type BattleRoyaleTelemetry } from "./evaluate";
import type { HumanProfile } from "./population";

const round1 = (v: number) => Math.round(v * 10) / 10;
const ramp = (v: number, zeroAt: number, fullAt: number) => clamp((v - zeroAt) / (fullAt - zeroAt), 0, 1);

const gap = (t: BattleRoyaleTelemetry) => t.cohorts.skilled.avgSurvivalPhase - t.cohorts.new.avgSurvivalPhase;

/** Normalised Shannon entropy of the bot mix (0 = one archetype, 1 = perfectly even). */
export function mixDiversity(mix: BotMix): number {
  const ps = BOT_ARCHETYPES.map((k) => mix[k] / 100).filter((p) => p > 0);
  return -ps.reduce((s, p) => s + p * Math.log(p), 0) / Math.log(BOT_ARCHETYPES.length);
}

function primary(objective: ObjectiveId, b: BattleRoyaleTelemetry, c: BattleRoyaleTelemetry): { frac: number; label: L10n; note: L10n } {
  switch (objective) {
    case "beginner_onboarding": {
      const bn = b.cohorts.new.earlyElimination;
      const cn = c.cohorts.new.earlyElimination;
      return { frac: clamp((bn - cn) / Math.max(0.05, bn - 0.35), 0, 1), label: L("NEW early elimination reduced", "新玩家早期淘汰降低"), note: L(`${pct(bn)} → ${pct(cn)}`, `${pct(bn)} → ${pct(cn)}`) };
    }
    case "competitive_pressure": {
      const v = `${b.skilledPressure.toFixed(2)} → ${c.skilledPressure.toFixed(2)}`;
      return {
        frac: clamp((c.skilledPressure - b.skilledPressure) / (b.skilledPressure * 0.2), 0, 1),
        label: L("Skilled late-game pressure raised", "高手后期压力提升"),
        note: L(`${v} late fights / skilled profile`, `每名高手后期交战 ${v} 次`),
      };
    }
    case "faster_matches": {
      const e = `${b.encounterRate.toFixed(2)} → ${c.encounterRate.toFixed(2)}`;
      const p = `${pct(b.passiveSurvival)} → ${pct(c.passiveSurvival)}`;
      return {
        frac: 0.5 * clamp((c.encounterRate - b.encounterRate) / (b.encounterRate * 0.25), 0, 1) + 0.5 * clamp((b.passiveSurvival - c.passiveSurvival) / 0.2, 0, 1),
        label: L("Pacing faster, less passive", "节奏更快、更少消极"),
        note: L(`encounters ${e}, passive top-10 ${p}`, `交战率 ${e}，前十消极存活 ${p}`),
      };
    }
    case "balanced_population": {
      const g = `${gap(b).toFixed(2)} → ${gap(c).toFixed(2)}`;
      return {
        frac: clamp((gap(b) - gap(c)) / Math.max(0.2, gap(b) * 0.5), 0, 1),
        label: L("Cohort disparity reduced", "群体差距缩小"),
        note: L(`SKILLED–NEW survival gap ${g} phases`, `高手与新玩家存活差距 ${g} 个阶段`),
      };
    }
  }
}

/** Deterministic score for one bot strategy against the objective. The AI never influences it. */
export function scoreBotStrategy(
  objective: ObjectiveId,
  b: BattleRoyaleTelemetry,
  c: BattleRoyaleTelemetry,
  candidate: BotStrategyCandidate,
): Omit<RankedCandidate, "rank"> {
  const p = primary(objective, b, c);
  const encRatio = c.encounterRate / b.encounterRate;
  const skRatio = c.skilledPressure / b.skilledPressure;
  const newDelta = c.cohorts.new.earlyElimination - b.cohorts.new.earlyElimination;
  const diversity = mixDiversity(candidate.mix);
  const present = BOT_ARCHETYPES.filter((k) => candidate.mix[k] > 0).length;

  const components: ScoreComponent[] = [
    { label: p.label, points: round1(35 * p.frac), max: 35, note: p.note },
    {
      label: L("Meaningful combat preserved", "保留有意义的战斗"),
      points: round1(20 * ramp(encRatio, 0.45, 0.8)),
      max: 20,
      note: L(`encounter rate ${Math.round(encRatio * 100)}% of baseline`, `交战率为基线的 ${Math.round(encRatio * 100)}%`),
    },
    {
      label: L("Pressure on average / skilled", "对普通 / 高手的压力"),
      points: round1(15 * ramp(skRatio, 0.55, 0.85)),
      max: 15,
      note: L(`skilled encounters ${Math.round(skRatio * 100)}% of baseline`, `高手交战为基线的 ${Math.round(skRatio * 100)}%`),
    },
    {
      label: L("New players not overwhelmed", "新玩家未被压垮"),
      points: round1(10 * ramp(-newDelta, -0.15, -0.03)),
      max: 10,
      note: L(`NEW early elimination ${pp(newDelta)}`, `新玩家早期淘汰 ${pp(newDelta)}`),
    },
    {
      label: L("Bots remain meaningful", "机器人仍有威胁"),
      points: round1(10 * ramp(c.botKillShare, 0.3, 0.55)),
      max: 10,
      note: L(`bots cause ${pct(c.botKillShare)} of human combat eliminations`, `人类战斗淘汰中 ${pct(c.botKillShare)} 由机器人造成`),
    },
    {
      label: L("Bot behaviour diversity", "机器人行为多样性"),
      points: round1(10 * diversity),
      max: 10,
      note: L(`${present} archetypes, entropy ${diversity.toFixed(2)}`, `${present} 种类型，熵值 ${diversity.toFixed(2)}`),
    },
  ];

  const penalties: ScoreComponent[] = [];
  const ne = pct(c.cohorts.new.earlyElimination);
  if (c.cohorts.new.earlyElimination < 0.15)
    penalties.push({ label: L("Overcorrection", "矫枉过正"), points: -10, max: 0, note: L(`NEW early elimination only ${ne} — no meaningful early combat`, `新玩家早期淘汰仅 ${ne}——缺乏有意义的早期战斗`) });
  if (c.passiveSurvival > 0.65)
    penalties.push({ label: L("Passive survival too high", "消极存活过高"), points: -10, max: 0, note: L(`${pct(c.passiveSurvival)} of top-10 placements never fought`, `前十名中 ${pct(c.passiveSurvival)} 从未交战`) });
  if (c.botKillShare < 0.3)
    penalties.push({ label: L("Bots harmless", "机器人失去威胁"), points: -10, max: 0, note: L(`bots cause only ${pct(c.botKillShare)} of human eliminations`, `人类淘汰中仅 ${pct(c.botKillShare)} 由机器人造成`) });

  const score = Math.round(clamp([...components, ...penalties].reduce((s, x) => s + x.points, 0), 0, 100));
  let verdict: L10n;
  if (penalties.length) verdict = L("Overcorrects — match becomes too passive", "矫枉过正——对局变得过于消极");
  else if (p.frac < 0.5) verdict = L("Insufficient change for the objective", "对目标的改变不足");
  else if (encRatio < 0.65 || skRatio < 0.7) verdict = L("Hits the objective but drains combat", "达成目标，但战斗被削弱");
  else verdict = L("Best trade-off: objective met, pressure preserved", "最佳权衡：达成目标，压力保留");
  return { id: candidate.id, score, components, penalties, verdict };
}

export function rankBotStrategies(
  objective: ObjectiveId,
  base: BattleRoyaleTelemetry,
  results: Array<{ candidate: BotStrategyCandidate; telemetry: BattleRoyaleTelemetry }>,
): RankedCandidate[] {
  const scored = results.map((r) => scoreBotStrategy(objective, base, r.telemetry, r.candidate));
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

export const BR_VERIFICATION_SEED_OFFSETS = [101, 202, 303];
const HOLDOUT_MATCHES = 16;

type Check = Omit<VerificationCheck, "id">;

function primaryCheck(objective: ObjectiveId, b: BattleRoyaleTelemetry, w: BattleRoyaleTelemetry): Check[] {
  switch (objective) {
    case "beginner_onboarding": {
      const v = `${pct(b.cohorts.new.earlyElimination)} → ${pct(w.cohorts.new.earlyElimination)}`;
      return [
        { label: L("NEW early elimination reduced", "新玩家早期淘汰降低"), critical: true, passed: b.cohorts.new.earlyElimination - w.cohorts.new.earlyElimination >= 0.15, detail: L(`${v} (need ≥ 15pp drop)`, `${v}（需下降 ≥ 15pp）`) },
        { label: L("NEW early elimination under 50%", "新玩家早期淘汰低于 50%"), critical: false, passed: w.cohorts.new.earlyElimination <= 0.5, detail: L(pct(w.cohorts.new.earlyElimination), pct(w.cohorts.new.earlyElimination)) },
      ];
    }
    case "competitive_pressure": {
      const v = `${b.skilledPressure.toFixed(2)} → ${w.skilledPressure.toFixed(2)}`;
      return [
        { label: L("Skilled late-game pressure raised ≥ 10%", "高手后期压力提升 ≥ 10%"), critical: true, passed: w.skilledPressure >= b.skilledPressure * 1.1, detail: L(`${v} late fights`, `后期交战 ${v}`) },
        {
          label: L("Skilled profiles still contested late", "高手后期仍受挑战"),
          critical: false,
          passed: w.cohorts.skilled.top10Rate <= b.cohorts.skilled.top10Rate + 0.05,
          detail: L(`skilled final-phase rate ${pct(w.cohorts.skilled.top10Rate)}`, `高手进入最终阶段比例 ${pct(w.cohorts.skilled.top10Rate)}`),
        },
      ];
    }
    case "faster_matches": {
      const p = `${pct(b.passiveSurvival)} → ${pct(w.passiveSurvival)}`;
      const e = `${b.encounterRate.toFixed(2)} → ${w.encounterRate.toFixed(2)}`;
      return [
        { label: L("Passive survival reduced ≥ 8pp", "消极存活降低 ≥ 8pp"), critical: true, passed: w.passiveSurvival <= b.passiveSurvival - 0.08, detail: L(`${p} of top-10 never fought`, `前十中从未交战：${p}`) },
        { label: L("Encounter rate not reduced", "交战率未下降"), critical: false, passed: w.encounterRate >= b.encounterRate, detail: L(`${e} fights / agent`, `每人交战 ${e}`) },
      ];
    }
    case "balanced_population": {
      const g = `${gap(b).toFixed(2)} → ${gap(w).toFixed(2)}`;
      return [
        { label: L("Cohort survival gap narrowed", "群体存活差距缩小"), critical: true, passed: gap(w) <= gap(b) - 0.3, detail: L(`${g} phases (need ≥ 0.3 narrower)`, `${g} 个阶段（需缩小 ≥ 0.3）`) },
        { label: L("Gap under 1.5 phases", "差距低于 1.5 个阶段"), critical: false, passed: gap(w) <= 1.5, detail: L(`${gap(w).toFixed(2)} phases`, `${gap(w).toFixed(2)} 个阶段`) },
      ];
    }
  }
}

function holdoutDetail(objective: ObjectiveId, b: BattleRoyaleTelemetry, w: BattleRoyaleTelemetry): L10n {
  switch (objective) {
    case "beginner_onboarding": {
      const v = `${pct(b.cohorts.new.earlyElimination)}→${pct(w.cohorts.new.earlyElimination)}`;
      return L(`NEW early ${v}`, `新玩家早期 ${v}`);
    }
    case "competitive_pressure": {
      const v = `${b.skilledPressure.toFixed(2)}→${w.skilledPressure.toFixed(2)}`;
      return L(`skilled late fights ${v}`, `高手后期交战 ${v}`);
    }
    case "faster_matches": {
      const v = `${pct(b.passiveSurvival)}→${pct(w.passiveSurvival)}`;
      return L(`passive top-10 ${v}`, `前十消极 ${v}`);
    }
    case "balanced_population": {
      const v = `${gap(b).toFixed(2)}→${gap(w).toFixed(2)}`;
      return L(`gap ${v}`, `差距 ${v}`);
    }
  }
}

function holdoutPassed(objective: ObjectiveId, b: BattleRoyaleTelemetry, w: BattleRoyaleTelemetry): boolean {
  switch (objective) {
    case "beginner_onboarding":
      return b.cohorts.new.earlyElimination - w.cohorts.new.earlyElimination >= 0.1;
    case "competitive_pressure":
      return w.skilledPressure >= b.skilledPressure * 1.04;
    case "faster_matches":
      return w.passiveSurvival <= b.passiveSurvival - 0.04;
    case "balanced_population":
      return gap(w) <= gap(b) - 0.15;
  }
}

/** Final regression verification on held-out match seeds with the same 60 human profiles. */
export function verifyBotStrategy(
  objective: ObjectiveId,
  humans: HumanProfile[],
  baseMix: BotMix,
  b: BattleRoyaleTelemetry,
  winner: BotStrategyCandidate,
  w: BattleRoyaleTelemetry,
  seed: number,
): VerificationResult {
  const holdoutSeeds = BR_VERIFICATION_SEED_OFFSETS.map((o) => seed + o);
  const holdout = holdoutSeeds.map((s) => ({
    base: runBattleRoyale(humans, baseMix, s, HOLDOUT_MATCHES).telemetry,
    win: runBattleRoyale(humans, winner.mix, s, HOLDOUT_MATCHES).telemetry,
  }));
  const archetypesPresent = BOT_ARCHETYPES.filter((k) => winner.mix[k] >= 10).length;
  const encPct = Math.round((w.encounterRate / b.encounterRate) * 100);
  const skPct = Math.round((w.skilledPressure / b.skilledPressure) * 100);
  const avgV = `${pct(b.cohorts.average.earlyElimination)} → ${pct(w.cohorts.average.earlyElimination)}`;
  const skV = `${pct(b.cohorts.skilled.earlyElimination)} → ${pct(w.cohorts.skilled.earlyElimination)}`;
  const hd = holdout.map((h, i) => ({ seed: holdoutSeeds[i], d: holdoutDetail(objective, h.base, h.win) }));

  const checks: VerificationCheck[] = (
    [
      ...primaryCheck(objective, b, w),
      { label: L("Meaningful combat preserved", "保留有意义的战斗"), critical: true, passed: w.encounterRate >= b.encounterRate * 0.65, detail: L(`encounter rate ${encPct}% of baseline (need ≥ 65%)`, `交战率为基线的 ${encPct}%（需 ≥ 65%）`) },
      { label: L("Skilled pressure maintained", "高手压力保持"), critical: false, passed: w.skilledPressure >= b.skilledPressure * 0.75, detail: L(`${skPct}% of baseline (need ≥ 75%)`, `为基线的 ${skPct}%（需 ≥ 75%）`) },
      { label: L("AVERAGE early elimination not worse", "普通玩家早期淘汰未恶化"), critical: false, passed: w.cohorts.average.earlyElimination <= b.cohorts.average.earlyElimination + 0.03, detail: L(avgV, avgV) },
      { label: L("Bots not harmless", "机器人未失去威胁"), critical: true, passed: w.botKillShare >= 0.4, detail: L(`bots cause ${pct(w.botKillShare)} of human combat eliminations (need ≥ 40%)`, `人类战斗淘汰中 ${pct(w.botKillShare)} 由机器人造成（需 ≥ 40%）`) },
      { label: L("Passive survival in tolerance", "消极存活在容许范围内"), critical: false, passed: w.passiveSurvival <= 0.65, detail: L(`${pct(w.passiveSurvival)} of top-10 never fought (limit 65%)`, `前十中 ${pct(w.passiveSurvival)} 从未交战（上限 65%）`) },
      { label: L("Behaviour diversity", "行为多样性"), critical: false, passed: archetypesPresent >= 3, detail: L(`${archetypesPresent} archetypes at ≥ 10%`, `${archetypesPresent} 种类型占比 ≥ 10%`) },
      {
        label: L("Holds on 3 held-out seed families", "在 3 组保留种子上依然成立"),
        critical: true,
        passed: holdout.every((h) => holdoutPassed(objective, h.base, h.win)),
        detail: L(hd.map((x) => `seed ${x.seed}: ${x.d.en}`).join("; "), hd.map((x) => `种子 ${x.seed}：${x.d.zh}`).join("；")),
      },
      { label: L("No severe SKILLED regression", "高手无严重倒退"), critical: false, passed: w.cohorts.skilled.earlyElimination <= b.cohorts.skilled.earlyElimination + 0.05, detail: L(`SKILLED early elimination ${skV}`, `高手早期淘汰 ${skV}`) },
    ] as Check[]
  ).map((c, i) => ({ id: `br-${i + 1}`, ...c }));

  const passedCount = checks.filter((c) => c.passed).length;
  const verified = checks.every((c) => !c.critical || c.passed) && passedCount >= 8;
  const failedCritical = checks.filter((c) => c.critical && !c.passed);
  const obj = OBJECTIVES[objective].name;
  return {
    verified,
    checks,
    passedCount,
    seedsUsed: [seed, ...holdoutSeeds],
    summary: verified
      ? L(
          `${obj.en} objective met. ${passedCount} / ${checks.length} behavioural checks passed. No severe population regression detected.`,
          `「${obj.zh}」目标达成。${passedCount} / ${checks.length} 项行为检查通过。未检测到严重的群体回归。`,
        )
      : failedCritical.length
        ? L(
            `Failed critical check${failedCritical.length > 1 ? "s" : ""}: ${failedCritical.map((c) => c.label.en.toLowerCase()).join(", ")}.`,
            `关键检查未通过：${failedCritical.map((c) => c.label.zh).join("、")}。`,
          )
        : L(`Only ${passedCount} / ${checks.length} behavioural checks passed (need 8).`, `仅 ${passedCount} / ${checks.length} 项行为检查通过（需 8 项）。`),
  };
}
