import { L, pctText as pct, stageName } from "@/lib/i18n";
import type { Finding } from "@/lib/simulation/types";
import { STAGES, type EncounterConfig, type StageId } from "./config";
import { COHORTS, generatePopulation, type Cohort, type PlayerProfile } from "./population";
import { simulateEncounter, type EncounterRun } from "./simulate";

export type StageTelemetry = {
  id: StageId;
  name: string;
  entered: number;
  failed: number;
  /** Failures / players who entered the stage. */
  hazard: number;
  /** Share of all failures that happened here. */
  shareOfFailures: number;
  avgHealthEntering: number;
  avgHealthLeaving: number;
};

export type CohortTelemetry = {
  cohort: Cohort;
  count: number;
  survived: number;
  survivalRate: number;
  failuresByStage: Record<StageId, number>;
};

export type EncounterTelemetry = {
  seed: number;
  playerCount: number;
  survived: number;
  survivalRate: number;
  totalFailures: number;
  stages: StageTelemetry[];
  cohorts: Record<Cohort, CohortTelemetry>;
  avgRemainingHealth: number;
  avgDamageTaken: number;
  hotspot: StageId;
  hotspotHazard: number;
  hotspotShare: number;
  /** Hotspot hazard divided by the mean hazard of the other stages (floored at 5%). */
  concentration: number;
};

export type EncounterResult = {
  config: EncounterConfig;
  runs: EncounterRun[];
  telemetry: EncounterTelemetry;
};

const HAZARD_FLOOR = 0.05;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarizeRuns(runs: EncounterRun[], seed: number): EncounterTelemetry {
  const totalFailures = runs.filter((r) => !r.completed).length;
  const stages: StageTelemetry[] = STAGES.map((s) => {
    const entered = runs.filter((r) => r.healthEnteringStage[s.id] !== undefined);
    const failed = runs.filter((r) => r.failedStage === s.id).length;
    return {
      id: s.id,
      name: s.name,
      entered: entered.length,
      failed,
      hazard: entered.length ? r3(failed / entered.length) : 0,
      shareOfFailures: totalFailures ? r3(failed / totalFailures) : 0,
      avgHealthEntering: Math.round(mean(entered.map((r) => r.healthEnteringStage[s.id] ?? 0))),
      avgHealthLeaving: Math.round(mean(entered.map((r) => r.healthLeavingStage[s.id] ?? 0))),
    };
  });

  const cohorts = {} as Record<Cohort, CohortTelemetry>;
  for (const c of COHORTS) {
    const rs = runs.filter((r) => r.cohort === c);
    const failuresByStage = {} as Record<StageId, number>;
    for (const s of STAGES) failuresByStage[s.id] = rs.filter((r) => r.failedStage === s.id).length;
    const survived = rs.filter((r) => r.completed).length;
    cohorts[c] = { cohort: c, count: rs.length, survived, survivalRate: rs.length ? r3(survived / rs.length) : 0, failuresByStage };
  }

  const hot = stages.reduce((a, b) => (b.hazard > a.hazard ? b : a));
  const others = stages.filter((s) => s.id !== hot.id).map((s) => s.hazard);
  const survivors = runs.filter((r) => r.completed);
  const survived = survivors.length;

  return {
    seed,
    playerCount: runs.length,
    survived,
    survivalRate: r3(survived / runs.length),
    totalFailures,
    stages,
    cohorts,
    avgRemainingHealth: Math.round(mean(survivors.map((r) => r.healthLeavingStage.boss ?? 0))),
    avgDamageTaken: Math.round(mean(runs.map((r) => r.damageTaken))),
    hotspot: hot.id,
    hotspotHazard: hot.hazard,
    hotspotShare: hot.shareOfFailures,
    concentration: Math.round((hot.hazard / Math.max(HAZARD_FLOOR, mean(others))) * 10) / 10,
  };
}

export function runEncounter(players: PlayerProfile[], config: EncounterConfig, seed: number): EncounterResult {
  const runs = simulateEncounter(players, config, seed);
  return { config, runs, telemetry: summarizeRuns(runs, seed) };
}

/** Convenience used by the API route: regenerate the cohort from the seed and run it. */
export function runEncounterFromSeed(config: EncounterConfig, seed: number): EncounterResult {
  return runEncounter(generatePopulation(seed), config, seed);
}

export function stageTelemetry(t: EncounterTelemetry, id: StageId): StageTelemetry {
  return t.stages.find((s) => s.id === id)!;
}

/** Deterministic regression detection — runs before (and independently of) any AI. */
export function detectEncounterProblem(t: EncounterTelemetry): Finding {
  const hot = stageTelemetry(t, t.hotspot);
  const detected = hot.hazard >= 0.3 && hot.shareOfFailures >= 0.5 && t.concentration >= 2;
  const nov = t.cohorts.novice;
  const avg = t.cohorts.average;
  const novElim = nov.failuresByStage[hot.id] / nov.count;
  const avgElim = avg.failuresByStage[hot.id] / avg.count;
  const evidence = {
    hotspot: hot.name,
    hotspotHazard: hot.hazard,
    hotspotShareOfFailures: hot.shareOfFailures,
    concentration: t.concentration,
    noviceEliminatedAtHotspot: r3(novElim),
    averageEliminatedAtHotspot: r3(avgElim),
    simulatedSurvival: t.survivalRate,
  };
  const n = stageName(hot.id);
  if (!detected) {
    return {
      detected: false,
      severity: "none",
      title: L("NO SEVERE REGRESSION DETECTED", "未检测到严重回归"),
      lines: [
        L(`Highest stage hazard is ${n.en} at ${pct(hot.hazard)} of entrants.`, `风险最高的阶段是${n.zh}，进入者淘汰率 ${pct(hot.hazard)}。`),
        L(`Simulated survival ${pct(t.survivalRate)}.`, `模拟存活率 ${pct(t.survivalRate)}。`),
      ],
      evidence,
    };
  }
  return {
    detected: true,
    severity: hot.hazard >= 0.4 ? "severe" : "moderate",
    title: L("BALANCE REGRESSION DETECTED", "检测到平衡性回归"),
    lines: [
      L(
        `${n.en} eliminates ${pct(novElim)} of novice profiles and ${pct(avgElim)} of average profiles.`,
        `${n.zh}淘汰了 ${pct(novElim)} 的新手画像和 ${pct(avgElim)} 的普通画像。`,
      ),
      L(
        `${hot.failed} of ${t.totalFailures} simulated failures (${pct(hot.shareOfFailures)}) happen at ${n.en}.`,
        `${t.totalFailures} 次模拟失败中有 ${hot.failed} 次（${pct(hot.shareOfFailures)}）发生在${n.zh}。`,
      ),
      L(`Stage hazard is ${t.concentration.toFixed(1)}× the average of the other stages.`, `该阶段淘汰率是其他阶段平均值的 ${t.concentration.toFixed(1)} 倍。`),
    ],
    evidence,
  };
}
