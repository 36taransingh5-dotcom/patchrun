import { L, pctText as pct, ppText as pp, stageName } from "@/lib/i18n";
import { clamp } from "@/lib/random/seededRandom";
import type {
  EncounterCandidate,
  RankedCandidate,
  ScoreComponent,
  VerificationCheck,
  VerificationResult,
} from "@/lib/simulation/types";
import { ENCOUNTER_PARAMS, applyChanges, type EncounterConfig, type EncounterParam } from "./config";
import { runEncounter, stageTelemetry, type EncounterTelemetry } from "./evaluate";
import type { PlayerProfile } from "./population";

/** Parameters that only affect the problem stage are "targeted"; the rest change every stage. */
const TARGETED_PARAMS: EncounterParam[] = ["eliteEnemyCount", "eliteDamageMultiplier"];
const CLIFF_TARGET_HAZARD = 0.15;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Mean size of the changes as a fraction of each parameter's allowed range. */
function relativeMagnitude(changes: EncounterCandidate["changes"]): number {
  if (!changes.length) return 0;
  const rel = changes.map((c) => {
    const spec = ENCOUNTER_PARAMS[c.parameter as EncounterParam];
    return spec ? Math.abs(c.to - c.from) / (spec.max - spec.min) : 1;
  });
  return rel.reduce((a, b) => a + b, 0) / rel.length;
}

/**
 * Deterministic scoring. The AI never sees or influences this function; it
 * only rewards measured outcomes relative to the baseline simulation.
 */
export function scoreEncounterCandidate(
  base: EncounterTelemetry,
  cand: EncounterTelemetry,
  candidate: EncounterCandidate,
): Omit<RankedCandidate, "rank"> {
  const cliff = base.hotspot;
  const cliffName = stageName(cliff);
  const baseHaz = stageTelemetry(base, cliff).hazard;
  const candHaz = stageTelemetry(cand, cliff).hazard;
  const components: ScoreComponent[] = [];
  const penalties: ScoreComponent[] = [];

  // 1. Difficulty cliff narrowed (30)
  const cliffFrac = clamp((baseHaz - candHaz) / Math.max(0.01, baseHaz - CLIFF_TARGET_HAZARD), 0, 1);
  components.push({
    label: L("Difficulty cliff narrowed", "难度断崖收窄"),
    points: round1(30 * cliffFrac),
    max: 30,
    note: L(`${cliffName.en} hazard ${pct(baseHaz)} → ${pct(candHaz)}`, `${cliffName.zh}淘汰率 ${pct(baseHaz)} → ${pct(candHaz)}`),
  });

  // 2. Novice / average outcomes improved (25)
  const dNov = cand.cohorts.novice.survivalRate - base.cohorts.novice.survivalRate;
  const dAvg = cand.cohorts.average.survivalRate - base.cohorts.average.survivalRate;
  const uplift = 0.5 * clamp(dNov / 0.25, 0, 1) + 0.5 * clamp(dAvg / 0.3, 0, 1);
  components.push({
    label: L("Novice / average outcomes", "新手 / 普通玩家结果"),
    points: round1(25 * uplift),
    max: 25,
    note: L(`novice ${pp(dNov)}, average ${pp(dAvg)}`, `新手 ${pp(dNov)}，普通 ${pp(dAvg)}`),
  });

  // 3. Skilled challenge preserved (15): full credit up to 90% skilled survival.
  const sk = cand.cohorts.skilled.survivalRate;
  const skFrac = sk <= 0.9 ? 1 : clamp((1 - sk) / 0.1, 0, 1);
  components.push({
    label: L("Skilled challenge preserved", "保留熟练玩家挑战"),
    points: round1(15 * skFrac),
    max: 15,
    note: L(`skilled survival ${pct(sk)}`, `熟练玩家存活 ${pct(sk)}`),
  });

  // 4. Not trivially easy (15): ideal band 45–70% overall simulated survival.
  const s = cand.survivalRate;
  const easyFrac =
    s > 0.7 ? clamp((0.9 - s) / 0.2, 0, 1) : s < 0.45 ? clamp((s - base.survivalRate) / Math.max(0.01, 0.45 - base.survivalRate), 0, 1) : 1;
  components.push({
    label: L("Encounter not trivialised", "关卡未被过度简化"),
    points: round1(15 * easyFrac),
    max: 15,
    note: L(`overall simulated survival ${pct(s)}`, `整体模拟存活 ${pct(s)}`),
  });

  // 5. Minimal intervention (15): fewer, smaller, more targeted changes score higher.
  const extraParams = Math.max(0, candidate.changes.length - 1);
  const broad = candidate.changes.filter((c) => !TARGETED_PARAMS.includes(c.parameter as EncounterParam)).length;
  const mag = relativeMagnitude(candidate.changes);
  const minimal = clamp(15 - 4 * extraParams - 2 * broad - Math.max(0, mag - 0.15) * 30, 0, 15);
  const n = candidate.changes.length;
  components.push({
    label: L("Minimal, targeted patch", "改动小且精准"),
    points: round1(minimal),
    max: 15,
    note: L(
      `${n} param${n === 1 ? "" : "s"}, ${broad} global, avg change ${Math.round(mag * 100)}% of range`,
      `${n} 个参数，${broad} 个全局参数，平均改动幅度为取值范围的 ${Math.round(mag * 100)}%`,
    ),
  });

  // Penalties for new regressions.
  const newHot = cand.stages.find((st) => st.id !== cliff && st.hazard > 0.35);
  if (newHot) {
    const nh = stageName(newHot.id);
    penalties.push({ label: L("New failure hotspot", "出现新的失败热点"), points: -15, max: 0, note: L(`${nh.en} hazard ${pct(newHot.hazard)}`, `${nh.zh}淘汰率 ${pct(newHot.hazard)}`) });
  }
  const baseGap = base.cohorts.skilled.survivalRate - base.cohorts.novice.survivalRate;
  const candGap = cand.cohorts.skilled.survivalRate - cand.cohorts.novice.survivalRate;
  if (candGap > baseGap + 0.05) {
    penalties.push({ label: L("Cohort disparity worsened", "群体差距扩大"), points: -10, max: 0, note: L(`skilled–novice gap ${pp(baseGap)} → ${pp(candGap)}`, `熟练与新手差距 ${pp(baseGap)} → ${pp(candGap)}`) });
  }
  if (sk < base.cohorts.skilled.survivalRate - 0.05) {
    penalties.push({ label: L("Skilled profiles regressed", "熟练玩家表现倒退"), points: -10, max: 0, note: L(`skilled ${pct(base.cohorts.skilled.survivalRate)} → ${pct(sk)}`, `熟练玩家 ${pct(base.cohorts.skilled.survivalRate)} → ${pct(sk)}`) });
  }

  const raw = [...components, ...penalties].reduce((a, c) => a + c.points, 0);
  const score = Math.round(clamp(raw, 0, 100));

  let verdict;
  if (cliffFrac < 0.6) verdict = L("Insufficient improvement — cliff remains", "改善不足——断崖仍在");
  else if (s > 0.75 || sk > 0.97) verdict = L("Overcorrects — encounter becomes too easy", "矫枉过正——关卡变得过于简单");
  else if (penalties.length) verdict = L("Fixes the cliff but introduces a regression", "修复了断崖，但引入了新的回归");
  else verdict = L("Cliff resolved, challenge preserved", "断崖已消除，挑战性保留");

  return { id: candidate.id, score, components, penalties, verdict };
}

export function rankEncounterCandidates(
  base: EncounterTelemetry,
  results: Array<{ candidate: EncounterCandidate; telemetry: EncounterTelemetry }>,
): RankedCandidate[] {
  const scored = results.map((r) => scoreEncounterCandidate(base, r.telemetry, r.candidate));
  // Ties break on fewer changed parameters, then candidate id — never on model opinion.
  const changeCount = (id: string) => results.find((r) => r.candidate.id === id)!.candidate.changes.length;
  scored.sort((a, b) => b.score - a.score || changeCount(a.id) - changeCount(b.id) || a.id.localeCompare(b.id));
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

export const VERIFICATION_SEED_OFFSETS = [101, 202, 303];

/**
 * Final regression check: the winning configuration is re-simulated on the
 * same cohort under three held-out seeds, and ten behavioural checks are
 * evaluated in code. VERIFIED requires every critical check and ≥ 8/10 overall.
 */
export function verifyEncounterWinner(
  players: PlayerProfile[],
  baseConfig: EncounterConfig,
  baseTelemetry: EncounterTelemetry,
  winner: EncounterCandidate,
  winnerTelemetry: EncounterTelemetry,
  seed: number,
): VerificationResult {
  const cliff = baseTelemetry.hotspot;
  const cn = stageName(cliff);
  const patched = applyChanges(baseConfig, winner.changes);
  const holdoutSeeds = VERIFICATION_SEED_OFFSETS.map((o) => seed + o);
  const holdout = holdoutSeeds.map((s) => ({
    base: runEncounter(players, baseConfig, s).telemetry,
    patched: runEncounter(players, patched, s).telemetry,
  }));

  const w = winnerTelemetry;
  const b = baseTelemetry;
  const bHaz = stageTelemetry(b, cliff).hazard;
  const wHaz = stageTelemetry(w, cliff).hazard;
  const wShare = stageTelemetry(w, cliff).shareOfFailures;
  const dNov = w.cohorts.novice.survivalRate - b.cohorts.novice.survivalRate;
  const dAvg = w.cohorts.average.survivalRate - b.cohorts.average.survivalRate;
  const otherHot = w.stages.filter((s) => s.id !== cliff).reduce((a, s) => (s.hazard > a.hazard ? s : a));
  const oh = stageName(otherHot.id);
  const baseGap = b.cohorts.skilled.survivalRate - b.cohorts.novice.survivalRate;
  const wGap = w.cohorts.skilled.survivalRate - w.cohorts.novice.survivalRate;
  const holdoutHaz = holdout.map((h) => stageTelemetry(h.patched, cliff).hazard);
  const holdoutGain = holdout.map((h) => h.patched.survivalRate - h.base.survivalRate);
  const skB = pct(b.cohorts.skilled.survivalRate);
  const skW = pct(w.cohorts.skilled.survivalRate);

  const checks: VerificationCheck[] = [
    { id: "cliff", label: L(`${cn.en} cliff resolved`, `${cn.zh}断崖已消除`), critical: true, passed: wHaz <= 0.25, detail: L(`hazard ${pct(bHaz)} → ${pct(wHaz)} (limit 25%)`, `淘汰率 ${pct(bHaz)} → ${pct(wHaz)}（上限 25%）`) },
    { id: "share", label: L(`${cn.en} no longer dominates failures`, `${cn.zh}不再主导失败`), critical: false, passed: wShare < 0.5, detail: L(`share of failures ${pct(wShare)} (limit 50%)`, `失败占比 ${pct(wShare)}（上限 50%）`) },
    { id: "novice", label: L("Novice outcomes improved", "新手结果改善"), critical: false, passed: dNov >= 0.15, detail: L(`novice survival ${pp(dNov)} (need ≥ +15pp)`, `新手存活 ${pp(dNov)}（需 ≥ +15pp）`) },
    { id: "average", label: L("Average outcomes improved", "普通玩家结果改善"), critical: false, passed: dAvg >= 0.15, detail: L(`average survival ${pp(dAvg)} (need ≥ +15pp)`, `普通玩家存活 ${pp(dAvg)}（需 ≥ +15pp）`) },
    { id: "skilled-challenge", label: L("Skilled challenge preserved", "保留熟练玩家挑战"), critical: false, passed: w.cohorts.skilled.survivalRate <= 0.95, detail: L(`skilled survival ${skW} (limit 95%)`, `熟练玩家存活 ${skW}（上限 95%）`) },
    { id: "not-trivial", label: L("Encounter not trivial", "关卡未过度简化"), critical: true, passed: w.survivalRate <= 0.8, detail: L(`overall simulated survival ${pct(w.survivalRate)} (limit 80%)`, `整体模拟存活 ${pct(w.survivalRate)}（上限 80%）`) },
    { id: "no-new-hotspot", label: L("No new failure hotspot", "没有新的失败热点"), critical: true, passed: otherHot.hazard <= 0.35, detail: L(`worst other stage ${oh.en} at ${pct(otherHot.hazard)} (limit 35%)`, `其他阶段中最高为${oh.zh} ${pct(otherHot.hazard)}（上限 35%）`) },
    { id: "disparity", label: L("Cohort disparity not worsened", "群体差距未扩大"), critical: false, passed: wGap <= baseGap + 0.05, detail: L(`skilled–novice gap ${pp(baseGap)} → ${pp(wGap)}`, `熟练与新手差距 ${pp(baseGap)} → ${pp(wGap)}`) },
    {
      id: "holdout",
      label: L("Holds on 3 held-out seeds", "在 3 个保留种子上依然成立"),
      critical: true,
      passed: holdoutHaz.every((h) => h <= 0.28) && holdoutGain.every((g) => g > 0.1),
      detail: L(
        `${cn.en} hazard ${holdoutHaz.map(pct).join(" / ")}; survival gain ${holdoutGain.map(pp).join(" / ")}`,
        `${cn.zh}淘汰率 ${holdoutHaz.map(pct).join(" / ")}；存活提升 ${holdoutGain.map(pp).join(" / ")}`,
      ),
    },
    { id: "skilled-regression", label: L("No regression for skilled profiles", "熟练玩家无倒退"), critical: false, passed: w.cohorts.skilled.survivalRate >= b.cohorts.skilled.survivalRate, detail: L(`skilled ${skB} → ${skW}`, `熟练玩家 ${skB} → ${skW}`) },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const verified = checks.every((c) => !c.critical || c.passed) && passedCount >= 8;
  const failedCritical = checks.filter((c) => c.critical && !c.passed);
  return {
    verified,
    checks,
    passedCount,
    seedsUsed: [seed, ...holdoutSeeds],
    summary: verified
      ? L(
          `${cn.en} difficulty cliff resolved. ${passedCount} / ${checks.length} behavioural checks passed. No new regression detected.`,
          `${cn.zh}难度断崖已消除。${passedCount} / ${checks.length} 项行为检查通过。未检测到新的回归。`,
        )
      : failedCritical.length
        ? L(
            `Failed critical check${failedCritical.length > 1 ? "s" : ""}: ${failedCritical.map((c) => c.label.en.toLowerCase()).join(", ")}.`,
            `关键检查未通过：${failedCritical.map((c) => c.label.zh).join("、")}。`,
          )
        : L(`Only ${passedCount} / ${checks.length} behavioural checks passed (need 8).`, `仅 ${passedCount} / ${checks.length} 项行为检查通过（需 8 项）。`),
  };
}
