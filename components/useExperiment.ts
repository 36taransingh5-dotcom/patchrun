"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { L } from "@/lib/i18n";
import { cohortFingerprint, runCounterfactuals, type CounterfactualResult, type ScenarioEngine } from "@/lib/simulation/experimentEngine";
import type { CandidateId, ExperimentResponse, ExperimentState, Finding, RankedCandidate, ScenarioId, VerificationResult } from "@/lib/simulation/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Short pauses so each pipeline step is visible; the work itself is synchronous and instant. */
const PACE = { baseline: 1300, testing: 1100, ranking: 650, verifying: 1000 };

export type Baseline<Tel, Raw> = { telemetry: Tel; raw: Raw; finding: Finding };

type Options<Config, Cand, Obj> = {
  scenarioId: ScenarioId;
  config: Config;
  seed: number;
  objective: Obj;
  /** Used only if the API itself is unreachable; the server has its own fallback. */
  clientFallback: (telemetry: unknown) => Cand[];
};

/**
 * Drives one experiment through the explicit state machine. Simulation,
 * ranking and verification run in the browser from deterministic code; only
 * candidate generation goes to the server (/api/experiment).
 */
export function useExperiment<Config, Pop, Tel, Raw, Cand extends { id: CandidateId }, Obj>(
  engine: ScenarioEngine<Config, Pop, Tel, Raw, Cand, Obj>,
  opts: Options<Config, Cand, Obj>,
) {
  const { config, seed, objective, scenarioId, clientFallback } = opts;
  const [state, setState] = useState<ExperimentState>("ready");
  const [baseline, setBaseline] = useState<Baseline<Tel, Raw> | null>(null);
  const [experiment, setExperiment] = useState<ExperimentResponse<Cand> | null>(null);
  const [results, setResults] = useState<Array<CounterfactualResult<Config, Tel, Raw, Cand>> | null>(null);
  const [ranking, setRanking] = useState<RankedCandidate[] | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  /** Increments on every baseline run; used to key re-animations. */
  const [runId, setRunId] = useState(0);
  const runToken = useRef(0);

  const population = useMemo(() => engine.population(seed), [engine, seed]);
  const fingerprint = useMemo(() => cohortFingerprint(population), [population]);

  const reset = useCallback(() => {
    runToken.current++;
    setState("ready");
    setBaseline(null);
    setExperiment(null);
    setResults(null);
    setRanking(null);
    setVerification(null);
  }, []);

  const runBaseline = useCallback(async () => {
    const token = ++runToken.current;
    setExperiment(null);
    setResults(null);
    setRanking(null);
    setVerification(null);
    const out = engine.simulate(population, config, seed);
    setBaseline({ ...out, finding: engine.detect(out.telemetry, objective) });
    setRunId((n) => n + 1);
    setState("simulating_baseline");
    await sleep(PACE.baseline);
    if (token === runToken.current) setState("baseline_ready");
  }, [engine, population, config, seed, objective]);

  const generate = useCallback(async () => {
    if (!baseline) return;
    const token = ++runToken.current;
    setState("ai_analyzing");
    setResults(null);
    setRanking(null);
    setVerification(null);
    let response: ExperimentResponse<Cand>;
    try {
      const res = await fetch("/api/experiment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId, objective, config, seed, telemetry: baseline.telemetry }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      response = await res.json();
    } catch (error) {
      response = {
        scenarioId,
        mode: "fallback",
        provider: null,
        model: null,
        fallbackReason: (() => {
          const msg = error instanceof Error ? error.message : "network error";
          return L(`Experiment API unreachable (${msg}); generated in browser.`, `实验 API 无法访问（${msg}）；已在浏览器中生成。`);
        })(),
        diagnosis: (() => {
          const line = baseline.finding.lines[0] ?? baseline.finding.title;
          return L(`Rule-based diagnosis: ${line.en}`, `规则诊断：${line.zh}`);
        })(),
        confidence: 0.6,
        evidence: baseline.finding.lines,
        candidates: clientFallback(baseline.telemetry),
        aiInput: null,
        latencyMs: 0,
      };
    }
    if (token !== runToken.current) return;
    setExperiment(response);
    setState("candidates_ready");
  }, [baseline, scenarioId, objective, config, seed, clientFallback]);

  const testAll = useCallback(async () => {
    if (!baseline || !experiment) return;
    const token = ++runToken.current;
    setState("testing_candidates");
    setVerification(null);
    const res = runCounterfactuals(engine, population, config, seed, experiment.candidates);
    await sleep(PACE.testing);
    if (token !== runToken.current) return;
    setResults(res);
    setState("ranking");
    await sleep(PACE.ranking);
    if (token !== runToken.current) return;
    setRanking(engine.rank(objective, baseline.telemetry, res));
    setState("winner_ready");
  }, [engine, population, config, seed, objective, baseline, experiment]);

  const verify = useCallback(async () => {
    if (!baseline || !results || !ranking) return;
    const token = ++runToken.current;
    setState("verifying");
    const winner = results.find((r) => r.candidate.id === ranking[0].id)!;
    const v = engine.verify({
      objective,
      population,
      baseConfig: config,
      baseTelemetry: baseline.telemetry,
      winner: winner.candidate,
      winnerTelemetry: winner.telemetry,
      seed,
    });
    await sleep(PACE.verifying);
    if (token !== runToken.current) return;
    setVerification(v);
    setState(v.verified ? "verified" : "failed");
  }, [engine, population, config, seed, objective, baseline, results, ranking]);

  const winner = ranking && results ? results.find((r) => r.candidate.id === ranking[0].id) ?? null : null;

  return { state, runId, baseline, experiment, results, ranking, verification, winner, population, fingerprint, reset, runBaseline, generate, testAll, verify };
}

export type ExperimentController = ReturnType<typeof useExperiment>;
