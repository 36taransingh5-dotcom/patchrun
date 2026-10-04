"use client";

import type { ReactNode } from "react";
import type { ExperimentState } from "@/lib/simulation/types";
import { useI18n } from "./I18n";
import { STATE_LABEL, StatusTimeline } from "./StatusTimeline";
import { Button, Dot, cx } from "./ui";
import type { ExperimentController } from "./useExperiment";

type Labels = { test: string; verify: string };

/** Primary next action for the current state. Steps are deliberately separate so the causal flow stays visible. */
function nextAction(c: ExperimentController, labels: Labels): { label: string; run: () => void; busy: boolean } {
  switch (c.state as ExperimentState) {
    case "ready":
      return { label: "Run baseline", run: c.runBaseline, busy: false };
    case "simulating_baseline":
      return { label: "Simulating…", run: () => {}, busy: true };
    case "baseline_ready":
      return { label: "Generate experiments", run: c.generate, busy: false };
    case "ai_analyzing":
      return { label: "AI analysing…", run: () => {}, busy: true };
    case "candidates_ready":
      return { label: labels.test, run: c.testAll, busy: false };
    case "testing_candidates":
    case "ranking":
      return { label: "Testing…", run: () => {}, busy: true };
    case "winner_ready":
      return { label: labels.verify, run: c.verify, busy: false };
    case "verifying":
      return { label: "Verifying…", run: () => {}, busy: true };
    case "verified":
    case "failed":
      return { label: "Run again", run: c.runBaseline, busy: false };
  }
}

export function ExperimentShell({
  controller,
  labels,
  left,
  centre,
  right,
  seedNote,
}: {
  controller: ExperimentController;
  labels: Labels;
  left: ReactNode;
  centre: ReactNode;
  right: ReactNode;
  seedNote: ReactNode;
}) {
  const { t } = useI18n();
  const action = nextAction(controller, labels);
  const s = controller.state;
  const tone = s === "verified" ? "good" : s === "failed" ? "bad" : action.busy ? "warn" : "muted";
  return (
    <div className="space-y-3">
      <StatusTimeline state={s} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Button onClick={action.run} loading={action.busy}>
            {t(action.label)}
            {!action.busy && <span aria-hidden>→</span>}
          </Button>
          {s !== "ready" && !action.busy && (
            <Button variant="ghost" onClick={controller.reset} className="px-3">
              {t("Reset")}
            </Button>
          )}
          <span className="hidden items-center gap-2 font-mono text-[11px] text-muted sm:inline-flex">
            <Dot tone={tone} pulse={action.busy} />
            <span className={cx(s === "verified" && "text-good", s === "failed" && "text-bad")}>{t(STATE_LABEL[s])}</span>
          </span>
        </div>
        <div className="font-mono text-[11px] text-faint">{seedNote}</div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)_390px]">
        <div className="space-y-3">{left}</div>
        <div className="min-w-0 space-y-3">{centre}</div>
        <div className="space-y-3 lg:col-span-2 xl:col-span-1">{right}</div>
      </div>
    </div>
  );
}
