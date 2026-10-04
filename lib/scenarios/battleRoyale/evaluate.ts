import { L, pctText as pct, type L10n } from "@/lib/i18n";
import type { BotMix, Finding } from "@/lib/simulation/types";
import { HUMAN_COHORTS, MATCHES_PER_EVALUATION, OBJECTIVES, PHASES, type HumanCohort, type ObjectiveId } from "./config";
import { generateBots, generateHumans, type HumanProfile } from "./population";
import { simulateMatch, type MatchRecord } from "./simulate";

export type CohortOutcome = {
  cohort: HumanCohort;
  count: number;
  /** Share eliminated in phases 1–2. */
  earlyElimination: number;
  avgSurvivalPhase: number;
  avgFights: number;
  top10Rate: number;
};

export type BattleRoyaleTelemetry = {
  seed: number;
  matches: number;
  mix: BotMix;
  cohorts: Record<HumanCohort, CohortOutcome>;
  /** Fights per agent per match. */
  encounterRate: number;
  fightsByPhase: number[];
  aliveAfterPhase: number[];
  /** Avg phase 3–5 fights per SKILLED profile that reached phase 3. */
  skilledPressure: number;
  /** Share of top-10 placements held by humans (lobby is 60% human). */
  humanTop10Share: number;
  /** Share of top-10 placements that had zero fights. */
  passiveSurvival: number;
  /** Share of human eliminations caused by bots. */
  botKillShare: number;
  humanWinRate: number;
  /** Phase at which the lobby first drops to half (match duration proxy). */
  halfLobbyPhase: number;
};

export type BattleRoyaleResult = {
  mix: BotMix;
  telemetry: BattleRoyaleTelemetry;
  sample: MatchRecord;
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function runBattleRoyale(humans: HumanProfile[], mix: BotMix, seed: number, matches = MATCHES_PER_EVALUATION): BattleRoyaleResult {
  const bots = generateBots(mix, seed);
  const records = Array.from({ length: matches }, (_, m) => simulateMatch(humans, bots, seed, m));
  return { mix, telemetry: summarizeMatches(records, mix, seed), sample: records[0] };
}

export function runBattleRoyaleFromSeed(mix: BotMix, seed: number): BattleRoyaleResult {
  return runBattleRoyale(generateHumans(seed), mix, seed);
}

export function summarizeMatches(records: MatchRecord[], mix: BotMix, seed: number): BattleRoyaleTelemetry {
  const all = records.flatMap((r) => r.outcomes);
  const humans = all.filter((o) => o.kind === "human");
  const cohorts = {} as Record<HumanCohort, CohortOutcome>;
  for (const c of HUMAN_COHORTS) {
    const os = humans.filter((o) => o.cohort === c);
    cohorts[c] = {
      cohort: c,
      count: os.length / records.length,
      earlyElimination: r3(os.filter((o) => o.survivalPhase <= 2).length / os.length),
      avgSurvivalPhase: Math.round(mean(os.map((o) => o.survivalPhase)) * 100) / 100,
      avgFights: Math.round(mean(os.map((o) => o.fights)) * 100) / 100,
      top10Rate: r3(os.filter((o) => o.survivalPhase >= PHASES).length / os.length),
    };
  }
  // Top 10 = everyone alive entering the final phase is too many; use last-phase eliminations + finalists, best 10 by phase then fights.
  const top10 = records.flatMap((r) =>
    [...r.outcomes].sort((a, b) => b.survivalPhase - a.survivalPhase || a.id.localeCompare(b.id)).slice(0, 10),
  );
  const humanElims = humans.filter((o) => o.eliminatedBy && o.eliminatedBy !== "zone");
  const fightsByPhase = Array.from({ length: PHASES }, (_, p) => Math.round(mean(records.map((r) => r.fightsByPhase[p])) * 10) / 10);
  const aliveAfterPhase = Array.from({ length: PHASES }, (_, p) => Math.round(mean(records.map((r) => r.aliveAfterPhase[p])) * 10) / 10);
  const half = aliveAfterPhase.findIndex((a) => a <= 50);
  return {
    seed,
    matches: records.length,
    mix,
    cohorts,
    encounterRate: Math.round((mean(records.map((r) => r.fights)) / 100) * 100) / 100,
    fightsByPhase,
    aliveAfterPhase,
    skilledPressure: (() => {
      const late = humans.filter((o) => o.cohort === "skilled" && o.survivalPhase >= 3);
      return Math.round(mean(late.map((o) => o.lateFights)) * 100) / 100;
    })(),
    humanTop10Share: r3(top10.filter((o) => o.kind === "human").length / top10.length),
    passiveSurvival: r3(top10.filter((o) => o.fights === 0).length / top10.length),
    botKillShare: humanElims.length ? r3(humanElims.filter((o) => o.eliminatedBy === "bot").length / humanElims.length) : 0,
    humanWinRate: r3(records.filter((r) => r.winnerKind === "human").length / records.length),
    halfLobbyPhase: half === -1 ? PHASES + 1 : half + 1,
  };
}

/** Deterministic detection relative to the chosen experience objective. */
export function detectBattleRoyaleProblem(t: BattleRoyaleTelemetry, objective: ObjectiveId): Finding {
  const { new: nw, average: av, skilled: sk } = t.cohorts;
  const evidence = {
    objective: OBJECTIVES[objective].name.en,
    newEarlyElimination: nw.earlyElimination,
    averageEarlyElimination: av.earlyElimination,
    skilledEarlyElimination: sk.earlyElimination,
    encounterRate: t.encounterRate,
    skilledPressure: t.skilledPressure,
    passiveSurvival: t.passiveSurvival,
    botKillShare: t.botKillShare,
  };
  const ok = (line: L10n): Finding => ({ detected: false, severity: "none", title: L("NO SEVERE REGRESSION DETECTED", "未检测到严重回归"), lines: [line], evidence });

  switch (objective) {
    case "beginner_onboarding": {
      if (nw.earlyElimination < 0.45) return ok(L(`NEW early elimination ${pct(nw.earlyElimination)} is within tolerance.`, `新玩家早期淘汰率 ${pct(nw.earlyElimination)}，在容许范围内。`));
      const ratio = (nw.earlyElimination / Math.max(0.05, sk.earlyElimination)).toFixed(1);
      return {
        detected: true,
        severity: nw.earlyElimination >= 0.6 ? "severe" : "moderate",
        title: L("NEW-PLAYER PRESSURE TOO HIGH", "新玩家压力过高"),
        lines: [
          L(
            `${pct(nw.earlyElimination)} of NEW profiles are eliminated in the first two phases (AVERAGE ${pct(av.earlyElimination)}, SKILLED ${pct(sk.earlyElimination)}).`,
            `${pct(nw.earlyElimination)} 的新玩家画像在前两个阶段被淘汰（普通玩家 ${pct(av.earlyElimination)}，高手 ${pct(sk.earlyElimination)}）。`,
          ),
          L(`Bots cause ${pct(t.botKillShare)} of human combat eliminations.`, `人类玩家的战斗淘汰中有 ${pct(t.botKillShare)} 由机器人造成。`),
          L(`NEW profiles are ${ratio}× more likely than SKILLED profiles to be eliminated early.`, `新玩家画像被早期淘汰的概率是高手的 ${ratio} 倍。`),
        ],
        evidence,
      };
    }
    case "competitive_pressure": {
      if (t.skilledPressure >= 1.3) return ok(L(`SKILLED profiles average ${t.skilledPressure.toFixed(2)} late-game encounters.`, `高手画像平均有 ${t.skilledPressure.toFixed(2)} 次后期交战。`));
      return {
        detected: true,
        severity: t.skilledPressure < 1.1 ? "severe" : "moderate",
        title: L("SKILLED PRESSURE TOO LOW", "高手压力不足"),
        lines: [
          L(`SKILLED profiles that reach phase 3 average only ${t.skilledPressure.toFixed(2)} late-game encounters.`, `进入第 3 阶段的高手画像平均只有 ${t.skilledPressure.toFixed(2)} 次后期交战。`),
          L(`${pct(sk.top10Rate)} of SKILLED profiles reach the final phase.`, `${pct(sk.top10Rate)} 的高手画像进入最终阶段。`),
        ],
        evidence,
      };
    }
    case "faster_matches": {
      if (t.passiveSurvival <= 0.2 && t.encounterRate >= 0.5)
        return ok(L(`Encounter rate ${t.encounterRate.toFixed(2)}/agent, passive survival ${pct(t.passiveSurvival)}.`, `交战率 ${t.encounterRate.toFixed(2)}/人，消极存活 ${pct(t.passiveSurvival)}。`));
      return {
        detected: true,
        severity: t.passiveSurvival > 0.3 ? "severe" : "moderate",
        title: L("PASSIVE MATCH PACING", "对局节奏过于消极"),
        lines: [
          L(`${pct(t.passiveSurvival)} of top-10 placements never fought.`, `前十名中有 ${pct(t.passiveSurvival)} 从未交战。`),
          L(`Encounter rate ${t.encounterRate.toFixed(2)} fights per agent per match.`, `交战率为每人每局 ${t.encounterRate.toFixed(2)} 次。`),
        ],
        evidence,
      };
    }
    case "balanced_population": {
      const gap = sk.avgSurvivalPhase - nw.avgSurvivalPhase;
      if (gap < 1.2) return ok(L(`SKILLED–NEW survival gap is ${gap.toFixed(2)} phases.`, `高手与新玩家的存活差距为 ${gap.toFixed(2)} 个阶段。`));
      return {
        detected: true,
        severity: gap > 1.8 ? "severe" : "moderate",
        title: L("COHORT OUTCOME DISPARITY", "群体结果差距过大"),
        lines: [
          L(`SKILLED profiles survive ${gap.toFixed(2)} phases longer than NEW profiles on average.`, `高手画像平均比新玩家多存活 ${gap.toFixed(2)} 个阶段。`),
          L(`Early elimination: NEW ${pct(nw.earlyElimination)} vs SKILLED ${pct(sk.earlyElimination)}.`, `早期淘汰：新玩家 ${pct(nw.earlyElimination)}，高手 ${pct(sk.earlyElimination)}。`),
        ],
        evidence,
      };
    }
  }
}
