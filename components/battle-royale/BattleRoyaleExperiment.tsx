"use client";

import { useCallback, useState } from "react";
import { DEFAULT_BOT_MIX, DEFAULT_OBJECTIVE, OBJECTIVES, type ObjectiveId } from "@/lib/scenarios/battleRoyale/config";
import type { BattleRoyaleTelemetry as Telemetry } from "@/lib/scenarios/battleRoyale/evaluate";
import { battleRoyaleFallbackCandidates } from "@/lib/scenarios/battleRoyale/fallback";
import { DEFAULT_SEED } from "@/lib/scenarios/encounter/config";
import { battleRoyaleEngine } from "@/lib/scenarios/engines";
import type { CandidateId } from "@/lib/simulation/types";
import { CandidateCards } from "../ai/CandidateCards";
import { ComparisonTable, type Column } from "../ai/ComparisonTable";
import { DiagnosisPanel } from "../ai/DiagnosisPanel";
import { VerificationCard } from "../ai/VerificationCard";
import { WinnerCard } from "../ai/WinnerCard";
import { ExperimentShell } from "../ExperimentShell";
import { ProofStrip } from "../ProofStrip";
import { useI18n } from "../I18n";
import { pct } from "../ui";
import { useExperiment } from "../useExperiment";
import { BattleRoyaleConfigPanel } from "./BattleRoyaleConfigPanel";
import { BattleRoyaleSimulation } from "./BattleRoyaleSimulation";
import { BattleRoyaleTelemetry } from "./BattleRoyaleTelemetry";
import { MixBar } from "./MixBar";

const mix = DEFAULT_BOT_MIX;

const COLUMNS: Column<Telemetry>[] = [
  { label: "NEW early", value: (t) => t.cohorts.new.earlyElimination, format: (v) => pct(v), better: "down" },
  { label: "AVG early", value: (t) => t.cohorts.average.earlyElimination, format: (v) => pct(v) },
  { label: "SKILLED early", value: (t) => t.cohorts.skilled.earlyElimination, format: (v) => pct(v) },
  { label: "Encounters", value: (t) => t.encounterRate, format: (v) => v.toFixed(2) },
  { label: "Skilled press.", value: (t) => t.skilledPressure, format: (v) => v.toFixed(2) },
  { label: "Passive top-10", value: (t) => t.passiveSurvival, format: (v) => pct(v), better: "down" },
];

function headline(objective: ObjectiveId, b: Telemetry, w: Telemetry, t: (s: string) => string) {
  switch (objective) {
    case "beginner_onboarding":
      return { label: t("NEW-profile simulated early elimination"), before: pct(b.cohorts.new.earlyElimination), after: pct(w.cohorts.new.earlyElimination) };
    case "competitive_pressure":
      return { label: t("Skilled late-game encounters per profile"), before: b.skilledPressure.toFixed(2), after: w.skilledPressure.toFixed(2) };
    case "faster_matches":
      return { label: t("Top-10 placements that never fought"), before: pct(b.passiveSurvival), after: pct(w.passiveSurvival) };
    case "balanced_population": {
      const g = (x: Telemetry) => (x.cohorts.skilled.avgSurvivalPhase - x.cohorts.new.avgSurvivalPhase).toFixed(2);
      return { label: t("SKILLED–NEW survival gap (phases)"), before: g(b), after: g(w) };
    }
  }
}

export function BattleRoyaleExperiment({ aiStatus }: { aiStatus: { configured: boolean; model: string } }) {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [objective, setObjective] = useState<ObjectiveId>(DEFAULT_OBJECTIVE);
  const [view, setView] = useState<"base" | CandidateId | null>(null);
  const { t, tx } = useI18n();
  const clientFallback = useCallback((t: unknown) => battleRoyaleFallbackCandidates(objective, mix, t as Telemetry), [objective]);
  const c = useExperiment(battleRoyaleEngine, { scenarioId: "battleRoyale", config: mix, seed, objective, clientFallback });

  const busy = ["simulating_baseline", "ai_analyzing", "testing_candidates", "ranking", "verifying"].includes(c.state);
  const activeView = view ?? (c.ranking ? c.ranking[0].id : "base");
  const viewResult = activeView !== "base" ? c.results?.find((r) => r.candidate.id === activeView) : null;
  const shownMatch = viewResult ? viewResult.raw : c.baseline?.raw ?? null;
  const shownTelemetry = viewResult ? viewResult.telemetry : c.baseline?.telemetry ?? null;
  const viewLabel = viewResult ? `${t("Strategy")} ${viewResult.candidate.id} — ${tx(viewResult.candidate.name)}` : t("Current bot mix");
  const winnerRank = c.ranking?.[0];
  const winner = c.winner;

  const resetAll = (fn: () => void) => {
    fn();
    setView(null);
    c.reset();
  };

  return (
    <ExperimentShell
      controller={c}
      labels={{ test: "Test all strategies", verify: "Verify winner" }}
      seedNote={<>{t("Experiment")} 02 · {tx(OBJECTIVES[objective].name)} · {t("seed {seed}", { seed })}</>}
      left={
        <BattleRoyaleConfigPanel
          mix={mix}
          preview={viewResult ? viewResult.candidate.mix : null}
          previewLabel={viewResult ? `${t(winnerRank?.id === viewResult.candidate.id ? "Winner" : "Preview")} ${viewResult.candidate.id}` : null}
          objective={objective}
          onObjective={(o) => resetAll(() => setObjective(o))}
          seed={seed}
          onSeed={(s) => resetAll(() => setSeed(s))}
          fingerprint={c.fingerprint}
          locked={busy}
        />
      }
      centre={
        <>
          <ProofStrip state={c.state} fingerprint={c.fingerprint} seed={seed} cohortLabel={t("60 humans")} />
          <BattleRoyaleSimulation
            match={shownMatch}
            animateKey={`${c.runId}:${activeView}`}
            viewing={viewLabel}
            views={c.results ? ["base", ...c.results.map((r) => r.candidate.id)] : []}
            activeView={activeView}
            onView={(k) => setView(k as "base" | CandidateId)}
          />
          {c.results && c.baseline && (
            <ComparisonTable
              base={c.baseline.telemetry}
              rows={c.results.map((r) => ({ id: r.candidate.id, name: r.candidate.name, telemetry: r.telemetry }))}
              columns={COLUMNS}
              ranking={c.ranking}
              noun="Strategy"
              fingerprint={c.fingerprint}
              seed={seed}
              selected={activeView}
              onSelect={setView}
            />
          )}
          {(winnerRank || c.verification || c.state === "verifying") && (
            <div className="grid gap-3 2xl:grid-cols-2">
              {winnerRank && winner && c.baseline && (
                <WinnerCard
                  ranked={winnerRank}
                  name={winner.candidate.name}
                  noun="Strategy"
                  headline={[headline(objective, c.baseline.telemetry, winner.telemetry, t), { label: t("Encounter rate · guardrail"), before: c.baseline.telemetry.encounterRate.toFixed(2), after: winner.telemetry.encounterRate.toFixed(2), guardrail: true }]}
                  intervention={<MixBar mix={winner.candidate.mix} compact />}
                  runnersUp={c.ranking!.slice(1).map((r) => ({ id: r.id, name: c.results!.find((x) => x.candidate.id === r.id)!.candidate.name, score: r.score, verdict: r.verdict }))}
                />
              )}
              <VerificationCard state={c.state} verification={c.verification} verifiedLabel="STRATEGY VERIFIED" failedLabel="STRATEGY FAILED" />
            </div>
          )}
          {shownTelemetry && c.state !== "simulating_baseline" && (
            <BattleRoyaleTelemetry telemetry={shownTelemetry} finding={activeView === "base" ? c.baseline!.finding : null} compareTo={viewResult ? c.baseline!.telemetry : null} />
          )}
        </>
      }
      right={
        <>
          <DiagnosisPanel state={c.state} experiment={c.experiment} aiStatus={aiStatus} />
          {c.experiment && (
            <CandidateCards
              candidates={c.experiment.candidates}
              ranking={c.ranking}
              renderIntervention={(cand) => <MixBar mix={cand.mix} />}
              noun="Strategy"
              testing={c.state === "testing_candidates" || c.state === "ranking"}
            />
          )}
        </>
      }
    />
  );
}
