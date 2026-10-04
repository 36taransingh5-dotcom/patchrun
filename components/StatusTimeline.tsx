"use client";

import { Fragment } from "react";
import type { ExperimentState } from "@/lib/simulation/types";
import { useI18n } from "./I18n";
import { cx } from "./ui";

const STEPS = [
  { key: "baseline", label: "Baseline", sub: "Behavioural simulation" },
  { key: "detect", label: "Detect", sub: "Deterministic rules" },
  { key: "propose", label: "AI proposes", sub: "3 hypotheses" },
  { key: "test", label: "Counterfactual", sub: "Same cohort + seeds" },
  { key: "rank", label: "Rank", sub: "Deterministic score" },
  { key: "verify", label: "Verify", sub: "Regression check" },
] as const;

/** Index of the active step and how many steps are complete. */
function progress(state: ExperimentState): { active: number; done: number } {
  switch (state) {
    case "ready":
      return { active: -1, done: 0 };
    case "simulating_baseline":
      return { active: 0, done: 0 };
    case "baseline_ready":
      return { active: -1, done: 2 };
    case "ai_analyzing":
      return { active: 2, done: 2 };
    case "candidates_ready":
      return { active: -1, done: 3 };
    case "testing_candidates":
      return { active: 3, done: 3 };
    case "ranking":
      return { active: 4, done: 4 };
    case "winner_ready":
      return { active: -1, done: 5 };
    case "verifying":
      return { active: 5, done: 5 };
    case "verified":
    case "failed":
      return { active: -1, done: 6 };
  }
}

export const STATE_LABEL: Record<ExperimentState, string> = {
  ready: "Ready",
  simulating_baseline: "Simulating baseline…",
  baseline_ready: "Baseline ready",
  ai_analyzing: "AI analysing telemetry…",
  candidates_ready: "Candidates ready",
  testing_candidates: "Testing candidates…",
  ranking: "Ranking…",
  winner_ready: "Winner selected",
  verifying: "Verifying…",
  verified: "Verified",
  failed: "Verification failed",
};

/** Ring nodes joined by a line, echoing a brand-diagram style. */
export function StatusTimeline({ state }: { state: ExperimentState }) {
  const { t } = useI18n();
  const { active, done } = progress(state);
  return (
    <ol className="flex items-start rounded-2xl border border-line bg-panel px-2 py-4 sm:px-6">
      {STEPS.map((step, i) => {
        const isActive = i === active;
        const isDone = i < done && !isActive;
        const failedVerify = state === "failed" && i === 5;
        return (
          <Fragment key={step.key}>
            {i > 0 && <li aria-hidden className={cx("mt-[15px] h-0.5 min-w-1 flex-1 sm:mt-[17px] rounded-full transition-colors duration-500", i <= done ? "bg-lime" : "bg-line-2")} />}
            <li className="flex w-[42px] shrink-0 flex-col items-center text-center sm:w-[92px]">
              <span
                className={cx(
                  "flex size-8 items-center justify-center rounded-full border-2 font-display text-[12px] font-bold transition-colors duration-300 sm:size-9 sm:text-[13px]",
                  failedVerify ? "border-coral bg-coral text-black" : isDone ? "border-lime bg-lime text-black" : isActive ? "pr-ring border-yellow bg-yellow text-black" : "border-line-2 text-faint",
                )}
              >
                {failedVerify ? "×" : isDone ? "✓" : i + 1}
              </span>
              <span className={cx("mt-2 font-mono text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] sm:text-[10px]", isDone || isActive ? "text-text" : "text-faint")}>{t(step.label)}</span>
              <span className="mt-0.5 hidden text-[10px] leading-tight text-faint sm:block">{t(step.sub)}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
