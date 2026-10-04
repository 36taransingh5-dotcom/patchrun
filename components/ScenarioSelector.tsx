"use client";

import type { ScenarioId } from "@/lib/simulation/types";
import { useI18n } from "./I18n";
import { cx } from "./ui";

const SCENARIOS: Array<{ id: ScenarioId; n: string; name: string; text: string; active: string; num: string }> = [
  {
    id: "encounter",
    n: "01",
    name: "Difficulty Cliff",
    text: "Stress-test an encounter across behavioural player profiles.",
    active: "bg-yellow text-black border-yellow",
    num: "text-yellow",
  },
  {
    id: "battleRoyale",
    n: "02",
    name: "Battle Royale Bot Lab",
    text: "Test which bot population best produces the intended match experience.",
    active: "bg-cobalt text-white border-cobalt",
    num: "text-cobalt",
  },
];

export function ScenarioSelector({ value, onChange }: { value: ScenarioId; onChange: (id: ScenarioId) => void }) {
  const { t } = useI18n();
  return (
    <div role="tablist" aria-label={t("Experiment")} className="mt-4 grid gap-3 sm:grid-cols-2">
      {SCENARIOS.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(s.id)}
            className={cx(
              "group relative flex items-center gap-4 overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all",
              active ? s.active : "border-line bg-panel hover:-translate-y-0.5 hover:border-line-2",
            )}
          >
            <span className={cx("font-display text-[44px] font-extrabold leading-none tracking-tight", active ? "opacity-90" : s.num)}>{s.n}</span>
            <span className="min-w-0">
              <span className={cx("block font-mono text-[10px] uppercase tracking-[0.18em]", active ? "opacity-70" : "text-faint")}>{t("Experiment")} {s.n}</span>
              <span className="block font-display text-[16px] font-bold leading-tight">{t(s.name)}</span>
              <span className={cx("mt-0.5 block text-[12px]", active ? "opacity-80" : "text-muted")}>{t(s.text)}</span>
            </span>
            <span className={cx("ml-auto size-3 shrink-0 rounded-full border-2", active ? "border-current bg-current" : "border-line-2")} />
          </button>
        );
      })}
    </div>
  );
}
