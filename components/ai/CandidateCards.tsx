"use client";

import type { ReactNode } from "react";
import type { L10n } from "@/lib/i18n";
import type { CandidateId, CandidateSource, RankedCandidate } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { Badge, cx } from "../ui";

type CandidateLike = {
  id: CandidateId;
  name: L10n;
  hypothesis: L10n;
  reasoning: L10n;
  source: CandidateSource;
  validationNotes: L10n[];
};

/** Each candidate gets its own poster colour so A / B / C read as distinct hypotheses. */
export const CANDIDATE_COLOR: Record<CandidateId, string> = { A: "bg-yellow", B: "bg-cobalt", C: "bg-pink" };

export function CandidateCards<C extends CandidateLike>({
  candidates,
  ranking,
  renderIntervention,
  noun,
  testing,
}: {
  candidates: C[];
  ranking: RankedCandidate[] | null;
  renderIntervention: (c: C) => ReactNode;
  noun: string;
  testing: boolean;
}) {
  const { t, tx } = useI18n();
  return (
    <div className="space-y-2.5">
      {candidates.map((c, i) => {
        const r = ranking?.find((x) => x.id === c.id);
        const isWinner = r?.rank === 1;
        return (
          <article
            key={c.id}
            className={cx("pr-fade-in overflow-hidden rounded-2xl border bg-panel transition-colors", isWinner ? "border-lime" : "border-line", testing && "pr-pulse")}
            style={{ animationDelay: testing ? `${i * 150}ms` : `${i * 90}ms` }}
          >
            <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-extrabold text-black", isWinner ? "bg-lime" : CANDIDATE_COLOR[c.id])}>{c.id}</span>
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                    {t(noun)} {c.id}
                  </div>
                  <h3 className="font-display text-[14px] font-bold leading-tight">{tx(c.name)}</h3>
                </div>
              </div>
              {r ? (
                <div className="shrink-0 text-right">
                  <div className={cx("font-display text-[22px] font-extrabold leading-none tabular-nums", isWinner ? "text-lime" : "text-text")}>{r.score}</div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">#{r.rank} · /100</div>
                </div>
              ) : (
                <Badge tone={c.source === "ai" ? "ai" : "warn"}>{c.source === "ai" ? "AI" : t("Fallback")}</Badge>
              )}
            </div>
            <div className="p-3.5 pt-2">
              {tx(c.hypothesis) && <p className="text-[12px] leading-snug text-muted">{tx(c.hypothesis)}</p>}
              <div className="mt-2.5">{renderIntervention(c)}</div>
              {tx(c.reasoning) && <p className="mt-2 text-[11px] leading-snug text-faint">{tx(c.reasoning)}</p>}
              {c.validationNotes.length > 0 && (
                <div className="mt-2 space-y-0.5 border-t border-line pt-1.5">
                  {c.validationNotes.map((n, k) => (
                    <div key={k} className="font-mono text-[10px] text-yellow/80">
                      {t("validator")}: {tx(n)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {r && <div className={cx("px-3.5 py-2 text-[11px] font-semibold", isWinner ? "bg-lime text-black" : "bg-panel-2 text-muted")}>{tx(r.verdict)}</div>}
          </article>
        );
      })}
    </div>
  );
}
