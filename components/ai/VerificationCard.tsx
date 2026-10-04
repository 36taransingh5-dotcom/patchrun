"use client";

import type { ExperimentState, VerificationResult } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { Badge, Label, Panel, cx } from "../ui";

export function VerificationCard({
  state,
  verification,
  verifiedLabel,
  failedLabel,
}: {
  state: ExperimentState;
  verification: VerificationResult | null;
  verifiedLabel: string;
  failedLabel: string;
}) {
  const { t, tx } = useI18n();
  if (state === "verifying") {
    return (
      <Panel accent="lime" label={t("Regression verification")} title={t("Re-simulating winner on held-out seeds…")}>
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="pr-pulse h-2.5 rounded-full bg-line-2" style={{ width: `${60 + ((i * 37) % 40)}%`, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </Panel>
    );
  }
  if (!verification) return null;
  const ok = verification.verified;
  return (
    <section className={cx("pr-fade-in overflow-hidden rounded-2xl border bg-panel", ok ? "border-lime/60" : "border-coral/60")}>
      <div className={cx("relative flex items-center gap-4 px-4 py-4", ok ? "bg-lime/10" : "bg-coral/10")}>
        <div
          className={cx(
            "pr-stamp flex size-[84px] shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-dashed text-center",
            ok ? "border-lime text-lime" : "border-coral text-coral",
          )}
        >
          <span className="font-display text-[22px] font-extrabold leading-none">{ok ? "✓" : "×"}</span>
          <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">
            {verification.passedCount}/{verification.checks.length}
          </span>
        </div>
        <div className="min-w-0">
          <Label>{t("Regression verification · determined by code")}</Label>
          <div className={cx("mt-1 font-display text-[22px] font-extrabold leading-tight", ok ? "text-lime" : "text-coral")}>{t(ok ? verifiedLabel : failedLabel)}</div>
          <p className="mt-1 text-[12px] text-text/90">{tx(verification.summary)}</p>
        </div>
      </div>
      <ul className="divide-y divide-line/70 px-4">
        {verification.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5 py-2">
            <span className={cx("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black", c.passed ? "bg-lime" : "bg-coral")}>{c.passed ? "✓" : "×"}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {tx(c.label)}
                {c.critical && <Badge tone="muted">{t("critical")}</Badge>}
              </div>
              <div className="font-mono text-[10px] text-faint">{tx(c.detail)}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-4 py-2 font-mono text-[10px] text-faint">
        {t("{n} passed · seeds {seeds} · same cohort", { n: `${verification.passedCount}/${verification.checks.length}`, seeds: verification.seedsUsed.join(", ") })}
      </div>
    </section>
  );
}
