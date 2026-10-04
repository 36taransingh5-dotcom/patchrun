"use client";

import { BR_COHORT_NAMES } from "@/lib/i18n";
import { HUMAN_COHORTS } from "@/lib/scenarios/battleRoyale/config";
import type { BattleRoyaleTelemetry as Telemetry } from "@/lib/scenarios/battleRoyale/evaluate";
import type { Finding } from "@/lib/simulation/types";
import { FindingCard } from "../encounter/EncounterTelemetry";
import { useI18n } from "../I18n";
import { Badge, Label, Meter, Panel, Stat, cx, pct } from "../ui";

const COHORT_DOT = { new: "bg-novice", average: "bg-average", skilled: "bg-skilled" } as const;

export function BattleRoyaleTelemetry({ telemetry, finding, compareTo }: { telemetry: Telemetry; finding: Finding | null; compareTo?: Telemetry | null }) {
  const { t, tx } = useI18n();
  const maxFights = Math.max(1, ...telemetry.fightsByPhase, ...(compareTo?.fightsByPhase ?? []));
  return (
    <>
      {finding && <FindingCard finding={finding} />}
      <Panel accent="pink" label={t("Telemetry")} title={t("Simulated outcomes · {n} seeded matches", { n: telemetry.matches })} right={<Badge tone="muted">{t("simulated · not real players")}</Badge>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            <Stat key="n" label={t("NEW early elimination")} value={pct(telemetry.cohorts.new.earlyElimination)} sub={t("out in phases 1–2")} size="lg" tone={telemetry.cohorts.new.earlyElimination >= 0.5 ? "bad" : "good"} />,
            <Stat key="e" label={t("Encounter rate")} value={telemetry.encounterRate.toFixed(2)} sub={t("fights / agent / match")} />,
            <Stat key="s" label={t("Skilled pressure")} value={telemetry.skilledPressure.toFixed(2)} sub={t("late fights / skilled profile")} />,
            <Stat key="p" label={t("Passive top-10")} value={pct(telemetry.passiveSurvival)} sub={t("placements that never fought")} />,
          ].map((s, i) => (
            <div key={i} className="rounded-xl bg-bg p-3">
              {s}
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <Label className="mb-2">{t("Simulated early elimination by cohort")}</Label>
            <div className="space-y-3">
              {HUMAN_COHORTS.map((c) => {
                const v = telemetry.cohorts[c].earlyElimination;
                const prev = compareTo?.cohorts[c].earlyElimination;
                return (
                  <div key={c}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted">
                        <span className={cx("size-2 rounded-full", COHORT_DOT[c])} />
                        {tx(BR_COHORT_NAMES[c])}
                      </span>
                      <span className="font-mono text-[12px] tabular-nums">
                        {prev !== undefined && <span className="text-faint">{pct(prev)} → </span>}
                        <span className="font-semibold">{pct(v)}</span>
                      </span>
                    </div>
                    <Meter value={v} tone={v >= 0.5 ? "bad" : "neutral"} />
                    <div className="mt-1 font-mono text-[10px] text-faint">
                      {t("avg survival phase {a} · final-phase rate {b}", { a: telemetry.cohorts[c].avgSurvivalPhase.toFixed(2), b: pct(telemetry.cohorts[c].top10Rate) })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="mb-2">{t("Fights per phase")}</Label>
            <div className="flex h-24 items-end gap-2">
              {telemetry.fightsByPhase.map((f, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative flex h-20 w-full items-end">
                    {compareTo && <div className="absolute bottom-0 w-full rounded-t-lg border border-dashed border-faint" style={{ height: `${(compareTo.fightsByPhase[i] / maxFights) * 100}%` }} />}
                    <div className={cx("w-full rounded-t-lg transition-[height] duration-700", i < 2 ? "bg-coral/85" : "bg-cobalt/85")} style={{ height: `${(f / maxFights) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-faint">
                    P{i + 1} · {Math.round(f)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 font-mono text-[9px] text-faint">{t("coral = early game (phases 1–2)")}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-bg p-3">
                <Stat label={t("Bot share of human KOs")} value={pct(telemetry.botKillShare)} sub={t("combat eliminations")} />
              </div>
              <div className="rounded-xl bg-bg p-3">
                <Stat label={t("Human share of top 10")} value={pct(telemetry.humanTop10Share)} sub={t("lobby is 60% human")} />
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
