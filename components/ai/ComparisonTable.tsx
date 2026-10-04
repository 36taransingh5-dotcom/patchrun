"use client";

import type { L10n } from "@/lib/i18n";
import type { CandidateId, RankedCandidate } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { Badge, Panel, cx } from "../ui";
import { CANDIDATE_COLOR } from "./CandidateCards";

export type Column<T> = {
  label: string;
  value: (t: T) => number;
  format: (v: number) => string;
  /** Which direction is better, used only for subtle colouring of the delta. */
  better?: "up" | "down";
};

export function ComparisonTable<T>({
  base,
  rows,
  columns,
  ranking,
  noun,
  fingerprint,
  seed,
  selected,
  onSelect,
}: {
  base: T;
  rows: Array<{ id: CandidateId; name: L10n; telemetry: T }>;
  columns: Column<T>[];
  ranking: RankedCandidate[] | null;
  noun: string;
  fingerprint: string;
  seed: number;
  selected: "base" | CandidateId;
  onSelect: (id: "base" | CandidateId) => void;
}) {
  const { t, tx } = useI18n();
  const all: Array<{ key: "base" | CandidateId; name: string; telemetry: T }> = [
    { key: "base", name: t("Original"), telemetry: base },
    ...rows.map((r) => ({ key: r.id, name: tx(r.name), telemetry: r.telemetry })),
  ];
  return (
    <Panel
      accent="yellow"
      label={t("Counterfactual simulation")}
      title={t("Same cohort. Same seeds. Different configuration.")}
      right={
        <div className="hidden items-center gap-1.5 sm:flex">
          <Badge tone="muted">
            {t("cohort")} #{fingerprint}
          </Badge>
          <Badge tone="muted">{t("seed {seed}", { seed })}</Badge>
        </div>
      }
      bodyClassName="p-0"
      className="pr-fade-in"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-[12px]">
          <thead>
            <tr className="border-y border-line text-left">
              <th className="px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{t("Version")}</th>
              {columns.map((c) => (
                <th key={c.label} className="px-3 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
                  {t(c.label)}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{t("Score")}</th>
            </tr>
          </thead>
          <tbody>
            {all.map((row) => {
              const r = ranking?.find((x) => x.id === row.key);
              const isWinner = r?.rank === 1;
              const isSel = selected === row.key;
              return (
                <tr
                  key={row.key}
                  onClick={() => onSelect(row.key)}
                  className={cx("cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-panel-2", isSel && "bg-panel-2", isWinner && "bg-lime/[0.06]")}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {row.key === "base" ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-2 font-mono text-[9px] text-muted">0</span>
                      ) : (
                        <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-extrabold text-black", isWinner ? "bg-lime" : CANDIDATE_COLOR[row.key])}>{row.key}</span>
                      )}
                      <span className={cx("whitespace-nowrap font-semibold", isWinner ? "text-lime" : row.key === "base" ? "text-muted" : "text-text", isSel && "underline decoration-yellow decoration-2 underline-offset-4")}>
                        {row.key === "base" ? row.name : `${t(noun)} ${row.key} — ${row.name}`}
                      </span>
                      {isWinner && <Badge tone="good">{t("Winner")}</Badge>}
                    </div>
                  </td>
                  {columns.map((c) => {
                    const v = c.value(row.telemetry);
                    const delta = row.key === "base" ? 0 : v - c.value(base);
                    const good = c.better && delta !== 0 ? (c.better === "up" ? delta > 0 : delta < 0) : null;
                    return (
                      <td key={c.label} className="px-3 py-3 text-right font-mono tabular-nums">
                        <span className={cx(row.key === "base" ? "text-muted" : "text-text")}>{c.format(v)}</span>
                        {good !== null && <span className={cx("ml-1 text-[10px]", good ? "text-lime" : "text-coral")}>{delta > 0 ? "▲" : "▼"}</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    {row.key === "base" ? (
                      <span className="text-faint">—</span>
                    ) : r ? (
                      <span className={cx("font-display text-[15px] font-extrabold tabular-nums", isWinner ? "text-lime" : "text-text")}>{r.score}</span>
                    ) : (
                      <span className="text-faint">…</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-4 py-2 font-mono text-[10px] text-faint">
        {t("Simulated metrics from behavioural profiles — not predictions of real player behaviour. Click a row to view it in the simulation.")}
      </div>
    </Panel>
  );
}
