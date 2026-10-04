"use client";

import type { ReactNode } from "react";
import type { L10n } from "@/lib/i18n";
import type { RankedCandidate } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { Label, cx } from "../ui";

export function WinnerCard({
  ranked,
  name,
  noun,
  headline,
  intervention,
  runnersUp,
}: {
  ranked: RankedCandidate;
  name: L10n;
  noun: string;
  /** Before → after metrics; `guardrail` ones are shown neutrally rather than as an improvement. */
  headline: Array<{ label: string; before: string; after: string; guardrail?: boolean }>;
  intervention: ReactNode;
  runnersUp: Array<{ id: string; name: L10n; score: number; verdict: L10n }>;
}) {
  const { t, tx } = useI18n();
  const strengths = ranked.components.filter((c) => c.points >= c.max * 0.7);
  const weaknesses = ranked.components.filter((c) => c.points < c.max * 0.5);
  return (
    <section className="pr-fade-in overflow-hidden rounded-2xl border border-lime/60 bg-panel">
      <div className="flex items-center justify-between gap-3 bg-lime px-4 py-3 text-black">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/60">{t("Selected by deterministic scoring — not by the AI")}</div>
          <div className="truncate font-display text-[16px] font-extrabold">
            {t("Winner")}: {t(noun)} {ranked.id} — {tx(name)}
          </div>
        </div>
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-full bg-black text-lime">
          <span className="font-display text-[18px] font-extrabold leading-none">{ranked.score}</span>
          <span className="font-mono text-[8px] text-lime/70">/100</span>
        </div>
      </div>
      <div className="p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {headline.map((h) => (
            <div key={h.label} className="rounded-xl bg-bg px-3 py-2.5">
              <Label>{h.label}</Label>
              <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span className="font-mono text-[16px] text-muted line-through decoration-faint/60">{h.before}</span>
                <span className="text-faint">→</span>
                <span className={cx("font-display text-[24px] font-extrabold", h.guardrail ? "text-text" : "text-lime")}>{h.after}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">{intervention}</div>
        <div className="mt-3">
          <Label className="mb-1.5">{t("Why")}</Label>
          <ul className="space-y-1.5 text-[12px]">
            {strengths.map((c) => (
              <li key={c.label.en} className="flex justify-between gap-3">
                <span>
                  <span className="font-bold text-lime">+ </span>
                  {tx(c.label)} <span className="text-faint">· {tx(c.note)}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {c.points}/{c.max}
                </span>
              </li>
            ))}
            {weaknesses.map((c) => (
              <li key={c.label.en} className="flex justify-between gap-3">
                <span>
                  <span className="font-bold text-yellow">− </span>
                  {tx(c.label)} <span className="text-faint">· {tx(c.note)}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {c.points}/{c.max}
                </span>
              </li>
            ))}
            {ranked.penalties.map((p) => (
              <li key={p.label.en} className="flex justify-between gap-3">
                <span>
                  <span className="font-bold text-coral">− </span>
                  {tx(p.label)} <span className="text-faint">· {tx(p.note)}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-coral">{p.points}</span>
              </li>
            ))}
          </ul>
        </div>
        {runnersUp.length > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <Label className="mb-1.5">{t("Trade-offs vs. alternatives")}</Label>
            <ul className="space-y-1 text-[11px] text-muted">
              {runnersUp.map((r) => (
                <li key={r.id} className="flex justify-between gap-3">
                  <span>
                    {t(noun)} {r.id} — {tx(r.name)}: <span className="text-faint">{tx(r.verdict)}</span>
                  </span>
                  <span className="font-mono">{r.score}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
