"use client";

import { ENCOUNTER_COHORT_NAMES, stageName } from "@/lib/i18n";
import { STAGES } from "@/lib/scenarios/encounter/config";
import { stageTelemetry, type EncounterTelemetry as Telemetry } from "@/lib/scenarios/encounter/evaluate";
import { COHORTS } from "@/lib/scenarios/encounter/population";
import type { Finding } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { Badge, Label, Meter, Panel, Stat, cx, pct } from "../ui";

const COHORT_TONE = { novice: "bg-novice", average: "bg-average", skilled: "bg-skilled" } as const;

/** Poster-style alert band for the deterministic finding. */
export function FindingCard({ finding }: { finding: Finding }) {
  const { t, tx } = useI18n();
  const tone = finding.detected ? (finding.severity === "severe" ? "bad" : "warn") : "good";
  const band = tone === "bad" ? "bg-coral" : tone === "warn" ? "bg-yellow" : "bg-lime";
  return (
    <div className="pr-fade-in overflow-hidden rounded-2xl border border-line bg-panel">
      <div className={cx("flex items-center justify-between gap-2 px-4 py-2.5 text-black", band)}>
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-black font-display text-[12px] font-extrabold text-white">{finding.detected ? "!" : "✓"}</span>
          <span className="font-display text-[14px] font-extrabold tracking-[0.02em]">{tx(finding.title)}</span>
        </div>
        <span className="rounded-full bg-black/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]">{t("deterministic rule")}</span>
      </div>
      <ul className="space-y-1 px-4 py-3">
        {finding.lines.map((l, i) => (
          <li key={i} className="flex gap-2 text-[12px] text-text/90">
            <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", band)} />
            {tx(l)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EncounterTelemetry({ telemetry, finding, compareTo }: { telemetry: Telemetry; finding: Finding | null; compareTo?: Telemetry | null }) {
  const { t, tx } = useI18n();
  const hot = stageTelemetry(telemetry, telemetry.hotspot);
  const isCliff = hot.hazard >= 0.3 && telemetry.concentration >= 2;
  const maxFailed = Math.max(1, ...telemetry.stages.map((s) => s.failed), ...(compareTo?.stages.map((s) => s.failed) ?? []));
  return (
    <>
      {finding && <FindingCard finding={finding} />}
      <Panel accent="pink" label={t("Telemetry")} title={t("Simulated outcomes")} right={<Badge tone="muted">{t("simulated · not real players")}</Badge>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            <Stat key="s" label={t("Simulated survival")} value={pct(telemetry.survivalRate)} sub={t("{a} / {b} profiles", { a: telemetry.survived, b: telemetry.playerCount })} size="lg" tone={telemetry.survivalRate < 0.4 ? "bad" : "good"} />,
            <Stat key="h" label={isCliff ? t("Failure hotspot") : t("Highest-hazard stage")} value={tx(stageName(hot.id))} sub={t("{n} failures · {p} of entrants", { n: hot.failed, p: pct(hot.hazard) })} tone={isCliff ? "bad" : "neutral"} />,
            <Stat key="c" label={t("Failure concentration")} value={`${telemetry.concentration.toFixed(1)}×`} sub={isCliff ? t("vs. other-stage average · cliff") : t("vs. other stages · no cliff")} tone={isCliff ? "bad" : "neutral"} />,
            <Stat key="r" label={t("Avg remaining health")} value={telemetry.avgRemainingHealth} sub={t("among survivors")} />,
          ].map((s, i) => (
            <div key={i} className="rounded-xl bg-bg p-3">
              {s}
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <Label className="mb-2">{t("Failures by stage")}</Label>
            <div className="space-y-2">
              {STAGES.map((s) => {
                const st = stageTelemetry(telemetry, s.id);
                const prev = compareTo ? stageTelemetry(compareTo, s.id) : null;
                const hotBar = s.id === telemetry.hotspot && isCliff;
                return (
                  <div key={s.id} className="grid grid-cols-[84px_1fr_70px] items-center gap-2">
                    <span className={cx("truncate font-mono text-[10px] tracking-wider", hotBar ? "text-coral" : "text-muted")}>{tx(stageName(s.id))}</span>
                    <div className="relative h-5 rounded-full bg-line/70">
                      {prev && <div className="absolute inset-y-0 left-0 rounded-full border border-dashed border-faint" style={{ width: `${(prev.failed / maxFailed) * 100}%` }} />}
                      <div className={cx("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", hotBar ? "bg-coral" : "bg-cobalt/80")} style={{ width: `${(st.failed / maxFailed) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono text-[11px] tabular-nums text-text">
                      {st.failed}
                      <span className="text-faint"> · {pct(st.hazard)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 font-mono text-[10px] text-faint">
              {t("count · hazard (failures ÷ entrants)")}
              {compareTo ? ` · ${t("dashed = original")}` : ""}
            </div>
          </div>
          <div>
            <Label className="mb-2">{t("Simulated survival by cohort")}</Label>
            <div className="space-y-3">
              {COHORTS.map((c) => {
                const ct = telemetry.cohorts[c];
                const prev = compareTo?.cohorts[c];
                return (
                  <div key={c}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                        <span className={cx("size-2 rounded-full", COHORT_TONE[c])} />
                        {tx(ENCOUNTER_COHORT_NAMES[c])} <span className="text-faint">×{ct.count}</span>
                      </span>
                      <span className="font-mono text-[12px] tabular-nums">
                        {prev && <span className="text-faint">{pct(prev.survivalRate)} → </span>}
                        <span className="font-semibold">{pct(ct.survivalRate)}</span>
                      </span>
                    </div>
                    <Meter value={ct.survivalRate} tone={ct.survivalRate < 0.25 ? "bad" : "good"} />
                    <div className="mt-1 font-mono text-[10px] text-faint">
                      {t("fails")}: {STAGES.map((s) => `${tx(stageName(s.id))} ${ct.failuresByStage[s.id]}`).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
