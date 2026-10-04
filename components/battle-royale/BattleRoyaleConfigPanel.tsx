"use client";

import { ARCHETYPE_NAMES } from "@/lib/i18n";
import { BOT_ARCHETYPES, BOT_PROFILES, OBJECTIVES, OBJECTIVE_ORDER, type ObjectiveId } from "@/lib/scenarios/battleRoyale/config";
import { botCounts } from "@/lib/scenarios/battleRoyale/population";
import type { BotMix } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { SeedInput } from "../SeedInput";
import { Badge, Panel, cx } from "../ui";
import { ARCHETYPE_COLOR } from "./MixBar";

export function BattleRoyaleConfigPanel({
  mix,
  preview,
  previewLabel,
  objective,
  onObjective,
  seed,
  onSeed,
  fingerprint,
  locked,
}: {
  mix: BotMix;
  preview: BotMix | null;
  previewLabel: string | null;
  objective: ObjectiveId;
  onObjective: (o: ObjectiveId) => void;
  seed: number;
  onSeed: (s: number) => void;
  fingerprint: string;
  locked: boolean;
}) {
  const { t, tx } = useI18n();
  const shown = preview ?? mix;
  const counts = botCounts(shown);
  return (
    <>
      <Panel accent="pink" label={t("Experience objective")} title={t("What the lobby should feel like")}>
        <div className="space-y-1.5">
          {OBJECTIVE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => onObjective(id)}
              className={cx(
                "w-full rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed",
                id === objective ? "border-yellow bg-yellow text-black" : "border-line hover:border-line-2",
              )}
            >
              <div className={cx("font-display text-[12px] font-bold", id === objective ? "text-black" : "text-text")}>{tx(OBJECTIVES[id].name)}</div>
              <div className={cx("text-[11px] leading-snug", id === objective ? "text-black/70" : "text-faint")}>{tx(OBJECTIVES[id].description)}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel accent="cobalt" label={t("System config")} title={t("Bot population · 40 bots")} right={previewLabel ? <Badge tone="good">{previewLabel}</Badge> : <Badge tone="muted">{t("current")}</Badge>}>
        <div className="space-y-2.5">
          {BOT_ARCHETYPES.map((k) => {
            const changed = preview && preview[k] !== mix[k];
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 font-semibold text-text">
                    <span className="size-2.5 rounded-full" style={{ background: ARCHETYPE_COLOR[k] }} />
                    {tx(ARCHETYPE_NAMES[k])}
                  </span>
                  <span className="font-mono tabular-nums">
                    {changed && <span className="text-faint line-through">{mix[k]}%</span>}
                    {changed && <span className="px-1 text-faint">→</span>}
                    <span className={cx(changed ? "font-bold text-lime" : "text-text")}>{shown[k]}%</span>
                    <span className="text-faint"> · {counts[k]}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-line">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${shown[k]}%`, background: ARCHETYPE_COLOR[k] }} />
                </div>
                <div className="mt-0.5 text-[10px] text-faint">{tx(BOT_PROFILES[k].summary)}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel accent="yellow" label={t("Lobby")} title={t("100 agents · 5 shrinking phases")}>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {(
            [
              ["NEW", 24, "bg-novice"],
              ["AVG", 24, "bg-average"],
              ["SKILLED", 12, "bg-skilled"],
              ["BOTS", 40, "bg-bot"],
            ] as const
          ).map(([l, n, c]) => (
            <div key={l} className="rounded-xl bg-bg py-2">
              <div className="font-display text-[18px] font-extrabold tabular-nums">{n}</div>
              <div className="flex items-center justify-center gap-1 font-mono text-[9px] tracking-wider text-muted">
                <span className={cx("size-2", l === "BOTS" ? "rounded-[2px]" : "rounded-full", c)} />
                {t(l)}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-faint">{t("Generic, abstract Battle Royale model. Each strategy is scored over a seeded family of 24 matches with the same 60 human profiles.")}</p>
        <SeedInput seed={seed} onSeed={onSeed} fingerprint={fingerprint} disabled={locked} />
      </Panel>
    </>
  );
}
