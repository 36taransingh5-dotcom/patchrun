"use client";

import { useCallback, useState } from "react";
import { PARAM_NAMES, stageName } from "@/lib/i18n";
import { DEFAULT_ENCOUNTER_CONFIG, DEFAULT_ENCOUNTER_OBJECTIVE, DEFAULT_ENCOUNTER_OBJECTIVE_ZH, DEFAULT_SEED, formatParam, type EncounterParam } from "@/lib/scenarios/encounter/config";
import { stageTelemetry, type EncounterTelemetry as Telemetry } from "@/lib/scenarios/encounter/evaluate";
import { encounterEngine } from "@/lib/scenarios/engines";
import { encounterFallbackCandidates } from "@/lib/scenarios/encounter/fallback";
import type { CandidateId, EncounterCandidate } from "@/lib/simulation/types";
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
import { EncounterConfigPanel } from "./EncounterConfigPanel";
import { EncounterSimulation } from "./EncounterSimulation";
import { EncounterTelemetry } from "./EncounterTelemetry";

const config = DEFAULT_ENCOUNTER_CONFIG;

const COLUMNS: Column<Telemetry>[] = [
  { label: "Sim. survival", value: (t) => t.survivalRate, format: (v) => pct(v), better: "up" },
  { label: "Elite failures", value: (t) => stageTelemetry(t, "elite").failed, format: (v) => String(v), better: "down" },
  { label: "Novice", value: (t) => t.cohorts.novice.survivalRate, format: (v) => pct(v), better: "up" },
  { label: "Average", value: (t) => t.cohorts.average.survivalRate, format: (v) => pct(v), better: "up" },
  { label: "Skilled", value: (t) => t.cohorts.skilled.survivalRate, format: (v) => pct(v) },
];

function Changes({ c }: { c: EncounterCandidate }) {
  const { tx } = useI18n();
  return (
    <ul className="space-y-1.5">
      {c.changes.map((ch) => (
        <li key={ch.parameter} className="rounded-xl bg-bg px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted">{tx(PARAM_NAMES[ch.parameter])}</span>
            <span className="font-mono text-[13px] tabular-nums">
              <span className="text-faint">{formatParam(ch.parameter as EncounterParam, ch.from)}</span>
              <span className="px-1 text-faint">→</span>
              <span className="font-bold text-yellow">{formatParam(ch.parameter as EncounterParam, ch.to)}</span>
            </span>
          </div>
          {tx(ch.reason) && <div className="mt-0.5 text-[10px] text-faint">{tx(ch.reason)}</div>}
        </li>
      ))}
    </ul>
  );
}

export function EncounterExperiment({ aiStatus }: { aiStatus: { configured: boolean; model: string } }) {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  // null = untouched default, shown in the current language; the English default is what the AI receives.
  const [customObjective, setObjective] = useState<string | null>(null);
  const [view, setView] = useState<"base" | CandidateId | null>(null);
  const { t, tx, lang } = useI18n();
  const objective = customObjective ?? DEFAULT_ENCOUNTER_OBJECTIVE;
  const shownObjective = customObjective ?? (lang === "zh" ? DEFAULT_ENCOUNTER_OBJECTIVE_ZH : DEFAULT_ENCOUNTER_OBJECTIVE);
  const clientFallback = useCallback((t: unknown) => encounterFallbackCandidates(config, t as Telemetry), []);
  const c = useExperiment(encounterEngine, { scenarioId: "encounter", config, seed, objective, clientFallback });

  const busy = ["simulating_baseline", "ai_analyzing", "testing_candidates", "ranking", "verifying"].includes(c.state);
  const activeView = view ?? (c.ranking ? c.ranking[0].id : "base");
  const viewResult = activeView !== "base" ? c.results?.find((r) => r.candidate.id === activeView) : null;
  const shownRuns = viewResult ? viewResult.raw : c.baseline?.raw ?? null;
  const shownTelemetry = viewResult ? viewResult.telemetry : c.baseline?.telemetry ?? null;
  const viewLabel = viewResult ? `${t("Patch")} ${viewResult.candidate.id} — ${tx(viewResult.candidate.name)}` : t("Original config");
  const winnerRank = c.ranking?.[0];
  const winner = c.winner;
  const cliff = c.baseline?.telemetry.hotspot ?? "elite";

  const resetAll = (fn: () => void) => {
    fn();
    setView(null);
    c.reset();
  };

  return (
    <ExperimentShell
      controller={c}
      labels={{ test: "Test all candidates", verify: "Verify winner" }}
      seedNote={<>{t("Experiment")} 01 · {t("100 profiles")} · {t("seed {seed}", { seed })}</>}
      left={
        <EncounterConfigPanel
          config={config}
          diff={viewResult ? viewResult.candidate.changes : null}
          diffLabel={viewResult ? `${t(winnerRank?.id === viewResult.candidate.id ? "Winner" : "Preview")} ${viewResult.candidate.id}` : null}
          seed={seed}
          onSeed={(s) => resetAll(() => setSeed(s))}
          fingerprint={c.fingerprint}
          objective={shownObjective}
          onObjective={(o) => resetAll(() => setObjective(o))}
          locked={busy}
        />
      }
      centre={
        <>
          <ProofStrip state={c.state} fingerprint={c.fingerprint} seed={seed} cohortLabel={t("100 profiles")} />
          <EncounterSimulation
            runs={shownRuns}
            telemetry={shownTelemetry}
            animateKey={`${c.runId}:${activeView}`}
            viewing={viewLabel}
            views={c.results ? ["base", ...c.results.map((r) => r.candidate.id)] : []}
            activeView={activeView}
            onView={(k) => setView(k as "base" | CandidateId)}
            hotspot={c.baseline?.finding.detected ? cliff : null}
          />
          {c.results && c.baseline && (
            <ComparisonTable
              base={c.baseline.telemetry}
              rows={c.results.map((r) => ({ id: r.candidate.id, name: r.candidate.name, telemetry: r.telemetry }))}
              columns={COLUMNS}
              ranking={c.ranking}
              noun="Patch"
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
                  noun="Patch"
                  headline={[
                    { label: t("{stage} failures", { stage: tx(stageName(cliff)) }), before: String(stageTelemetry(c.baseline.telemetry, cliff).failed), after: String(stageTelemetry(winner.telemetry, cliff).failed) },
                    { label: t("Simulated survival"), before: pct(c.baseline.telemetry.survivalRate), after: pct(winner.telemetry.survivalRate) },
                  ]}
                  intervention={<Changes c={winner.candidate} />}
                  runnersUp={c.ranking!.slice(1).map((r) => ({ id: r.id, name: c.results!.find((x) => x.candidate.id === r.id)!.candidate.name, score: r.score, verdict: r.verdict }))}
                />
              )}
              <VerificationCard state={c.state} verification={c.verification} verifiedLabel="PATCH VERIFIED" failedLabel="PATCH FAILED" />
            </div>
          )}
          {shownTelemetry && c.state !== "simulating_baseline" && (
            <EncounterTelemetry telemetry={shownTelemetry} finding={activeView === "base" ? c.baseline!.finding : null} compareTo={viewResult ? c.baseline!.telemetry : null} />
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
              renderIntervention={(cand) => <Changes c={cand} />}
              noun="Patch"
              testing={c.state === "testing_candidates" || c.state === "ranking"}
            />
          )}
        </>
      }
    />
  );
}
