"use client";

import { useEffect, useState } from "react";
import { stageName } from "@/lib/i18n";
import { STAGES } from "@/lib/scenarios/encounter/config";
import type { EncounterTelemetry } from "@/lib/scenarios/encounter/evaluate";
import type { EncounterRun } from "@/lib/scenarios/encounter/simulate";
import { useI18n } from "../I18n";
import { Badge, Panel, cx } from "../ui";

const COLUMNS = [...STAGES.map((s) => s.id as string), "cleared"];
const PER_ROW = 8;
const STEP = 9;
const COHORT_BG = { novice: "bg-novice", average: "bg-average", skilled: "bg-skilled" } as const;

function finalColumn(run: EncounterRun): number {
  return run.completed ? 4 : STAGES.findIndex((s) => s.id === run.failedStage);
}

/** Dots flow stage by stage; each dot is the same simulated player in every version. */
function DotField({ runs, animate }: { runs: EncounterRun[]; animate: boolean }) {
  const [reveal, setReveal] = useState(animate ? 0 : COLUMNS.length);
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setReveal((r) => (r >= COLUMNS.length ? r : r + 1)), 240);
    return () => clearInterval(t);
  }, [animate]);

  const placed = runs.map((run) => {
    const fc = finalColumn(run);
    const settled = fc < reveal || reveal >= COLUMNS.length;
    return { run, col: settled ? fc : Math.min(reveal, fc), settled };
  });
  const slots = new Map<number, number>();
  return (
    <div className="relative" style={{ height: Math.ceil(100 / PER_ROW) * STEP + 6 }}>
      {placed.map(({ run, col, settled }) => {
        const slot = slots.get(col) ?? 0;
        slots.set(col, slot + 1);
        const failed = settled && !run.completed;
        return (
          <span
            key={run.playerId}
            title={`${run.playerId} · ${run.cohort} · ${run.completed ? "cleared" : `failed at ${run.failedStage}`}`}
            className={cx(
              "absolute size-[7px] rounded-full transition-all duration-500 ease-out",
              failed ? "bg-transparent ring-[1.5px] ring-coral ring-inset" : COHORT_BG[run.cohort],
              !settled && "opacity-50",
            )}
            style={{
              // Spacing shrinks on narrow screens so a full column of dots never spills into the next stage.
              left: `calc(${(col / COLUMNS.length) * 100}% + ${slot % PER_ROW} * min(${STEP}px, ${(100 / COLUMNS.length / (PER_ROW + 0.5)).toFixed(2)}%) + 7px)`,
              top: Math.floor(slot / PER_ROW) * STEP + 3,
            }}
          />
        );
      })}
    </div>
  );
}

export function EncounterSimulation({
  runs,
  telemetry,
  animateKey,
  viewing,
  views,
  activeView,
  onView,
  hotspot,
}: {
  runs: EncounterRun[] | null;
  telemetry: EncounterTelemetry | null;
  animateKey: string;
  viewing: string;
  views: string[];
  activeView: string;
  onView: (key: string) => void;
  hotspot: string | null;
}) {
  const { t, tx } = useI18n();
  return (
    <Panel
      accent="cobalt"
      label={t("Behavioural simulation")}
      title={`${t("100 simulated profiles")} · ${viewing}`}
      right={
        views.length > 1 ? (
          <div className="flex gap-1 rounded-full bg-bg p-0.5">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                className={cx("rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors", v === activeView ? "bg-yellow text-black" : "text-faint hover:text-text")}
              >
                {v === "base" ? t("Orig") : v}
              </button>
            ))}
          </div>
        ) : (
          <Badge tone="muted">{t("seeded")}</Badge>
        )
      }
    >
      <div className="grid grid-cols-5 gap-1 pb-2">
        {COLUMNS.map((c) => (
          <div
            key={c}
            className={cx(
              "truncate rounded-full px-2 py-1 text-center font-mono text-[9px] font-bold tracking-[0.08em] sm:text-[10px]",
              c === hotspot ? "bg-coral text-black" : c === "cleared" ? "bg-lime text-black" : "bg-panel-2 text-muted",
            )}
          >
            {tx(stageName(c))}
          </div>
        ))}
      </div>
      <div className="relative rounded-xl bg-bg py-2">
        <div className="pointer-events-none absolute inset-0 grid grid-cols-5">
          {COLUMNS.map((c, i) => (
            <div key={c} className={cx(i > 0 && "border-l border-dashed border-line-2/70", c === hotspot && "bg-coral/[0.07]")} />
          ))}
        </div>
        {runs ? (
          <DotField key={animateKey} runs={runs} animate />
        ) : (
          <div className="flex h-[123px] items-center justify-center font-mono text-[11px] text-faint">{t("Run the baseline to simulate the cohort")}</div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-[10px]">
        {COLUMNS.map((c) => {
          const st = telemetry?.stages.find((s) => s.id === c);
          return (
            <div key={c} className="text-center font-mono">
              {c === "cleared" ? (
                <span className="font-semibold text-lime">{telemetry ? t("{n} survived", { n: telemetry.survived }) : "—"}</span>
              ) : st ? (
                <span className={cx(c === hotspot ? "font-semibold text-coral" : "text-faint")}>
                  {t("{n} failed", { n: st.failed })} · {Math.round(st.hazard * 100)}%
                </span>
              ) : (
                <span className="text-faint">—</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-novice" />{t("NOVICE")} ×35</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-average" />{t("AVERAGE")} ×40</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-skilled" />{t("SKILLED")} ×25</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full ring-[1.5px] ring-coral ring-inset" />{t("FAILED")}</span>
      </div>
    </Panel>
  );
}
