"use client";

import { useEffect, useState } from "react";
import { hashSeed } from "@/lib/random/seededRandom";
import { PHASES } from "@/lib/scenarios/battleRoyale/config";
import type { MatchRecord } from "@/lib/scenarios/battleRoyale/simulate";
import { useI18n } from "../I18n";
import { Badge, Panel, cx } from "../ui";

const SIZE = 300;
const C = SIZE / 2;
/** Ring k (1..5) holds agents eliminated in phase k; the centre holds finalists. */
const ringRadius = (k: number) => (k >= PHASES + 1 ? 16 : 140 - (k - 1) * 25);
const COHORT_FILL = { new: "var(--color-novice)", average: "var(--color-average)", skilled: "var(--color-skilled)" } as const;
/** Zone rings alternate violet / ink, like stacked poster bands. */
const RING_FILL = ["#2a1a66", "#1e1640", "#2a1a66", "#1e1640", "#2a1a66"];

function position(id: string, ring: number) {
  const angle = (hashSeed("ring", id) / 2 ** 32) * Math.PI * 2;
  const jitter = ((hashSeed("jit", id) % 1000) / 1000 - 0.5) * (ring >= PHASES + 1 ? 14 : 9);
  const r = ringRadius(ring) + jitter;
  return { x: C + Math.cos(angle) * r, y: C + Math.sin(angle) * r };
}

function Rings({ match, animate }: { match: MatchRecord; animate: boolean }) {
  const { t } = useI18n();
  const [reveal, setReveal] = useState(animate ? 0 : PHASES + 1);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setReveal((r) => (r > PHASES ? r : r + 1)), 320);
    return () => clearInterval(timer);
  }, [animate]);
  const alive = reveal === 0 ? 100 : reveal > PHASES ? match.aliveAfterPhase[PHASES - 1] : match.aliveAfterPhase[reveal - 1];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
        {Array.from({ length: PHASES }, (_, i) => (
          <circle key={i} cx={C} cy={C} r={ringRadius(i + 1) + 12} fill={RING_FILL[i]} fillOpacity={reveal > i ? 1 : 0.35} stroke="rgba(255,255,255,0.18)" strokeDasharray={i === 0 ? undefined : "2 4"} />
        ))}
        <circle cx={C} cy={C} r={ringRadius(PHASES + 1) + 10} fill="var(--color-yellow)" fillOpacity={reveal > PHASES ? 0.9 : 0.15} />
        {match.outcomes.map((o) => {
          const eliminated = o.survivalPhase <= PHASES && o.survivalPhase <= reveal;
          const ring = eliminated ? o.survivalPhase : Math.min(reveal + 1, o.survivalPhase);
          const { x, y } = position(o.id, reveal === 0 ? 1 : ring);
          const fill = o.kind === "bot" ? "var(--color-bot)" : COHORT_FILL[o.cohort!];
          return (
            <g key={o.id} style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 0.45s ease-out" }}>
              {o.kind === "bot" ? (
                <rect x={-2.2} y={-2.2} width={4.4} height={4.4} rx={1} fill={fill} opacity={eliminated ? 0.22 : 0.95} />
              ) : (
                <circle r={2.8} fill={fill} opacity={eliminated ? 0.25 : 1} stroke={eliminated ? "none" : "#111"} strokeWidth={0.6} />
              )}
              {eliminated && o.kind === "human" && o.cohort === "new" && o.survivalPhase <= 2 && <circle r={4.6} fill="none" stroke="var(--color-coral)" strokeOpacity={0.8} strokeWidth={1} />}
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-1 top-1 rounded-2xl bg-black/50 px-3 py-2 font-mono text-[10px] backdrop-blur-sm">
        <div className="font-semibold text-yellow">{reveal === 0 ? t("DROP") : reveal > PHASES ? t("FINAL CIRCLE") : t("PHASE {n}", { n: reveal })}</div>
        <div className="font-display text-[22px] font-extrabold tabular-nums text-white">{alive}</div>
        <div className="text-white/60">{t("alive")}</div>
      </div>
    </div>
  );
}

export function BattleRoyaleSimulation({
  match,
  animateKey,
  viewing,
  views,
  activeView,
  onView,
}: {
  match: MatchRecord | null;
  animateKey: string;
  viewing: string;
  views: string[];
  activeView: string;
  onView: (key: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Panel
      accent="violet"
      label={t("Abstract match simulation · sample match 1 of 24")}
      title={viewing}
      right={
        views.length > 1 ? (
          <div className="flex gap-1 rounded-full bg-bg p-0.5">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                className={cx("rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors", v === activeView ? "bg-yellow text-black" : "text-faint hover:text-text")}
              >
                {v === "base" ? t("Orig") : v}
              </button>
            ))}
          </div>
        ) : (
          <Badge tone="muted">{t("seeded")}</Badge>
        )
      }
    >
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        {match ? (
          <Rings key={animateKey} match={match} animate />
        ) : (
          <div className="mx-auto flex aspect-square w-full max-w-[340px] items-center justify-center rounded-full border-2 border-dashed border-line-2 font-mono text-[11px] text-faint">{t("Run the baseline")}</div>
        )}
        <div className="space-y-3 font-mono text-[10px] text-muted">
          <div>
            <div className="mb-1.5 text-faint">{t("LEGEND")}</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-novice" />{t("NEW human")} ×24</div>
              <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-average" />{t("AVERAGE human")} ×24</div>
              <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-skilled" />{t("SKILLED human")} ×12</div>
              <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-bot" />{t("Bot")} ×40</div>
              <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-coral" />{t("NEW, out in phase 1–2")}</div>
            </div>
          </div>
          <div className="leading-relaxed text-faint">{t("Outer ring = eliminated in phase 1. Agents move inward as they survive each shrinking phase. Same agent, same angle, in every version.")}</div>
          {match && (
            <div>
              <div className="mb-1.5 text-faint">{t("ALIVE AFTER PHASE")}</div>
              <div className="flex flex-wrap gap-1">
                {match.aliveAfterPhase.map((a, i) => (
                  <span key={i} className="rounded-full bg-bg px-2 py-0.5 tabular-nums text-text">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
