"use client";

import type { ExperimentState } from "@/lib/simulation/types";
import { useI18n } from "./I18n";
import { cx } from "./ui";

/** The headline demo moment, on the violet brand band: what was held constant, and what was proven. */
export function ProofStrip({ state, fingerprint, seed, cohortLabel }: { state: ExperimentState; fingerprint: string; seed: number; cohortLabel: string }) {
  const { t } = useI18n();
  const tested = ["ranking", "winner_ready", "verifying", "verified", "failed"].includes(state);
  if (!tested && state !== "testing_candidates") return null;
  const final = state === "verified" || state === "failed";
  const items: Array<{ k: string; v: string; on: boolean; tone?: "good" | "bad" }> = [
    { k: t("Same cohort"), v: `${cohortLabel} · #${fingerprint}`, on: true },
    { k: t("Same seeds"), v: t("seed {seed}", { seed }), on: true },
    { k: t("3 interventions tested"), v: state === "testing_candidates" ? t("running…") : "A · B · C", on: tested },
    {
      k: state === "failed" ? t("Winner failed verification") : t("Winner verified"),
      v: state === "verified" ? t("regression check passed") : state === "failed" ? t("see checks") : state === "verifying" ? t("checking…") : t("pending"),
      on: final,
      tone: state === "failed" ? "bad" : "good",
    },
  ];
  return (
    <div className="pr-fade-in pr-dots grid grid-cols-2 gap-2 rounded-2xl bg-violet p-2 md:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={i}
          className={cx(
            "rounded-xl px-3 py-2.5 transition-colors duration-500",
            it.on ? (it.tone === "bad" ? "bg-coral text-black" : it.tone === "good" ? "bg-lime text-black" : "bg-white/12 text-white") : "bg-black/20 text-white/50",
          )}
        >
          <div className="font-display text-[12px] font-bold uppercase leading-tight tracking-[0.04em]">{it.k}</div>
          <div className={cx("mt-1 font-mono text-[10px]", it.on && it.tone ? "text-black/70" : "text-white/60")}>{it.v}</div>
        </div>
      ))}
    </div>
  );
}
