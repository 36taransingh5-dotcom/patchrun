"use client";

import type { ExperimentResponse, ExperimentState } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { Badge, Label, Meter, Panel } from "../ui";

export function SourceBadge({ mode, model }: { mode: ExperimentResponse<unknown>["mode"]; model: string | null }) {
  const { t } = useI18n();
  if (mode === "ai") return <Badge tone="ai">AI · {model}</Badge>;
  if (mode === "mixed") return <Badge tone="warn">{t("AI + fallback")}</Badge>;
  return <Badge tone="warn">{t("Deterministic fallback")}</Badge>;
}

export function DiagnosisPanel({
  state,
  experiment,
  aiStatus,
}: {
  state: ExperimentState;
  experiment: ExperimentResponse<unknown> | null;
  aiStatus: { configured: boolean; model: string };
}) {
  const { t, tx } = useI18n();
  if (state === "ai_analyzing") {
    return (
      <Panel accent="violet" label={t("AI Experimenter")} title={t("Analysing structured telemetry")} right={<Badge tone="ai">{aiStatus.configured ? aiStatus.model : t("fallback")}</Badge>}>
        <div className="space-y-2.5">
          {[0.92, 0.75, 0.84, 0.6].map((w, i) => (
            <div key={i} className="pr-pulse h-3 rounded-full bg-violet/50" style={{ width: `${w * 100}%`, animationDelay: `${i * 120}ms` }} />
          ))}
          <p className="pt-1 text-[12px] text-muted">
            {aiStatus.configured
              ? t("Sending config, aggregate telemetry, the deterministic finding and parameter bounds. The model proposes hypotheses only.")
              : t("No AI provider configured — generating rule-based candidates.")}
          </p>
        </div>
      </Panel>
    );
  }
  if (!experiment) {
    return (
      <Panel accent="violet" label={t("AI Experimenter")} title={t("Waiting for a detected problem")}>
        <p className="text-[12px] leading-relaxed text-muted">
          {t("After the baseline, the AI receives the configuration, aggregate telemetry and allowed parameter bounds, and proposes three competing interventions.")}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-violet/30 p-3">
            <div className="font-display text-[12px] font-bold text-ai">{t("AI does")}</div>
            <div className="mt-1 text-[11px] leading-snug text-muted">{t("Interpret telemetry, form hypotheses, propose bounded changes.")}</div>
          </div>
          <div className="rounded-xl bg-lime/10 p-3">
            <div className="font-display text-[12px] font-bold text-lime">{t("Code does")}</div>
            <div className="mt-1 text-[11px] leading-snug text-muted">{t("Simulate, score, choose the winner, verify.")}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-faint">
          {t("Provider")}: {aiStatus.configured ? <span className="text-ai">{aiStatus.model}</span> : <span className="text-warn">{t("not configured · fallback mode")}</span>}
        </div>
      </Panel>
    );
  }
  return (
    <Panel accent="violet" label={t("AI Experimenter · Diagnosis")} title={t("Hypothesis about the cause")} right={<SourceBadge mode={experiment.mode} model={experiment.model} />} className="pr-fade-in">
      {experiment.fallbackReason && (
        <div className="mb-3 rounded-xl border border-yellow/30 bg-yellow/10 px-3 py-2 text-[11px] text-yellow">
          {experiment.mode === "fallback" ? `${t("DETERMINISTIC FALLBACK")} — ` : ""}
          {tx(experiment.fallbackReason)}
        </div>
      )}
      <p className="text-[13px] leading-relaxed text-text">{tx(experiment.diagnosis)}</p>
      {experiment.evidence.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {experiment.evidence.map((e, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-muted">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-2" />
              {tx(e)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Label>{t("Diagnosis confidence")}</Label>
        <Meter value={experiment.confidence} tone={experiment.mode === "fallback" ? "warn" : "ai"} className="max-w-28" />
        <span className="font-mono text-[11px] text-muted">{Math.round(experiment.confidence * 100)}%</span>
      </div>
      {experiment.aiInput != null && (
        <details className="mt-3">
          <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.12em] text-faint hover:text-muted">
            {experiment.mode === "fallback" ? t("Structured input the AI would receive") : t("Structured input the AI received")}
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-line bg-bg p-2 font-mono text-[10px] leading-relaxed text-muted">{JSON.stringify(experiment.aiInput, null, 2)}</pre>
        </details>
      )}
    </Panel>
  );
}
