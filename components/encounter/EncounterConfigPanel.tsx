"use client";

import { PARAM_NAMES } from "@/lib/i18n";
import { ENCOUNTER_PARAMS, ENCOUNTER_PARAM_ORDER, formatParam, type EncounterConfig } from "@/lib/scenarios/encounter/config";
import type { ParameterChange } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { SeedInput } from "../SeedInput";
import { Badge, Label, Panel, cx } from "../ui";

export function EncounterConfigPanel({
  config,
  diff,
  diffLabel,
  seed,
  onSeed,
  fingerprint,
  objective,
  onObjective,
  locked,
}: {
  config: EncounterConfig;
  diff: ParameterChange[] | null;
  diffLabel: string | null;
  seed: number;
  onSeed: (s: number) => void;
  fingerprint: string;
  objective: string;
  onObjective: (s: string) => void;
  locked: boolean;
}) {
  const { t, tx } = useI18n();
  return (
    <>
      <Panel accent="yellow" label={t("System config")} title={t("Encounter configuration")} right={diffLabel ? <Badge tone="good">{diffLabel}</Badge> : <Badge tone="muted">{t("current")}</Badge>}>
        <div className="space-y-1">
          {ENCOUNTER_PARAM_ORDER.map((p) => {
            const spec = ENCOUNTER_PARAMS[p];
            const change = diff?.find((d) => d.parameter === p);
            return (
              <div key={p} className={cx("flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5", change ? "bg-lime/15" : "odd:bg-bg/60")}>
                <div className="min-w-0" title={spec.description}>
                  <div className="truncate text-[12px] text-text">{tx(PARAM_NAMES[p])}</div>
                  <div className="font-mono text-[9px] text-faint">
                    {p} · {spec.min}–{spec.max}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-[13px] tabular-nums">
                  {change ? (
                    <span>
                      <span className="text-faint line-through">{formatParam(p, change.from)}</span>
                      <span className="px-1 text-faint">→</span>
                      <span className="font-bold text-lime">{formatParam(p, change.to)}</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-text">{formatParam(p, config[p])}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-faint">{t("Default config is intentionally overtuned at the ELITE WAVE. Interventions may only change these parameters, inside these bounds.")}</p>
      </Panel>

      <Panel accent="cobalt" label={t("Behavioural cohort")} title={t("100 seeded profiles")}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["NOVICE", 35, "bg-novice"],
              ["AVERAGE", 40, "bg-average"],
              ["SKILLED", 25, "bg-skilled"],
            ] as const
          ).map(([l, n, c]) => (
            <div key={l} className="rounded-xl bg-bg py-2">
              <div className="font-display text-[20px] font-extrabold tabular-nums">{n}</div>
              <div className="flex items-center justify-center gap-1 font-mono text-[9px] tracking-wider text-muted">
                <span className={cx("size-2 rounded-full", c)} />
                {t(l)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-faint">{t("Traits: accuracy · reaction · damage avoidance · aggression · resource management.")}</div>
        <SeedInput seed={seed} onSeed={onSeed} fingerprint={fingerprint} disabled={locked} />
      </Panel>

      <Panel accent="pink" label={t("Desired experience")} title={t("Objective sent to the AI")}>
        <textarea
          value={objective}
          disabled={locked}
          onChange={(e) => onObjective(e.target.value.slice(0, 400))}
          rows={4}
          className="w-full resize-none rounded-xl border border-line bg-bg p-2.5 text-[12px] leading-snug text-text outline-none focus:border-yellow disabled:text-muted"
        />
        <Label className="mt-1">{t("used for AI hypotheses · scoring is fixed code")}</Label>
      </Panel>
    </>
  );
}
