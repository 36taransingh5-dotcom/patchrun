"use client";

import { ARCHETYPE_NAMES } from "@/lib/i18n";
import { BOT_ARCHETYPES } from "@/lib/scenarios/battleRoyale/config";
import type { BotArchetype, BotMix } from "@/lib/simulation/types";
import { useI18n } from "../I18n";
import { cx } from "../ui";

/** Poster palette, one colour per bot archetype. */
export const ARCHETYPE_COLOR: Record<BotArchetype, string> = {
  rusher: "#ff5d3a",
  hunter: "#ffd23f",
  survivor: "#a6e44a",
  sentinel: "#3a7bff",
  looter: "#ff7eb6",
};

export function MixBar({ mix, compact }: { mix: BotMix; compact?: boolean }) {
  const { tx } = useI18n();
  return (
    <div>
      <div className={cx("flex w-full gap-0.5 overflow-hidden rounded-full bg-line", compact ? "h-2.5" : "h-4")}>
        {BOT_ARCHETYPES.map((k) =>
          mix[k] > 0 ? <div key={k} title={`${tx(ARCHETYPE_NAMES[k])} ${mix[k]}%`} style={{ width: `${mix[k]}%`, background: ARCHETYPE_COLOR[k] }} className="h-full transition-[width] duration-500" /> : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
        {BOT_ARCHETYPES.filter((k) => mix[k] > 0).map((k) => (
          <span key={k} className="flex items-center gap-1 text-muted">
            <span className="size-2 rounded-full" style={{ background: ARCHETYPE_COLOR[k] }} />
            <span className="font-semibold tabular-nums text-text">{mix[k]}%</span> {tx(ARCHETYPE_NAMES[k])}
          </span>
        ))}
      </div>
    </div>
  );
}
