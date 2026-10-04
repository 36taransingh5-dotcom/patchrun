"use client";

import { LanguageToggle, useI18n } from "./I18n";
import { cx } from "./ui";

/** Original mark: a sticker-style "patch" on a yellow disc. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="20" fill="var(--color-yellow)" />
      <g transform="rotate(-38 20 20)">
        <rect x="5" y="13.5" width="30" height="13" rx="6.5" fill="#111112" />
        <rect x="14" y="15.5" width="12" height="9" rx="2" fill="var(--color-yellow)" />
        <circle cx="9.5" cy="18" r="1.1" fill="var(--color-yellow)" />
        <circle cx="9.5" cy="22" r="1.1" fill="var(--color-yellow)" />
        <circle cx="30.5" cy="18" r="1.1" fill="var(--color-yellow)" />
        <circle cx="30.5" cy="22" r="1.1" fill="var(--color-yellow)" />
      </g>
    </svg>
  );
}

function RingNode({ top, bottom, filled }: { top: string; bottom: string; filled?: boolean }) {
  return (
    <div
      className={cx(
        "flex size-[74px] shrink-0 flex-col items-center justify-center rounded-full border-2 text-center sm:size-[104px]",
        filled ? "border-yellow bg-yellow text-black" : "border-white/85 text-white",
      )}
    >
      <span className="font-display text-[11px] font-bold leading-tight sm:text-[14px]">{top}</span>
      <span className={cx("mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] sm:text-[9px] sm:tracking-[0.14em]", filled ? "text-black/70" : "text-white/70")}>{bottom}</span>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex min-w-3 flex-1 flex-col items-center gap-1">
      <span className="hidden whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.18em] text-white/70 md:block">{label}</span>
      <div className="relative h-px w-full bg-white/70">
        <span className="absolute -right-0.5 -top-[3px] size-0 border-y-[3.5px] border-l-[6px] border-y-transparent border-l-white/80" />
      </div>
    </div>
  );
}

export function Header({ aiStatus }: { aiStatus: { configured: boolean; model: string } }) {
  const { t } = useI18n();
  return (
    <header className="pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="font-display text-[20px] font-extrabold tracking-[0.06em] text-text">PATCHRUN</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "hidden items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] sm:inline-flex",
              aiStatus.configured ? "border-violet-2/60 bg-violet/40 text-ai" : "border-yellow/40 bg-yellow/10 text-yellow",
            )}
          >
            <span className={cx("size-1.5 rounded-full", aiStatus.configured ? "bg-ai" : "bg-yellow")} />
            {aiStatus.configured ? t("AI experimenter · {model}", { model: aiStatus.model }) : t("AI not configured · deterministic fallback")}
          </span>
          <div className="rounded-full bg-violet p-0.5">
            <LanguageToggle />
          </div>
        </div>
      </div>

      <div className="pr-dots relative mt-4 overflow-hidden rounded-3xl bg-violet px-5 py-6 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border-[28px] border-white/[0.06]" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-48 rounded-full bg-yellow/10" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <h1 className="max-w-3xl font-display text-[26px] font-extrabold leading-[1.1] text-white sm:text-[34px]">{t("AI experimentation infrastructure for game systems")}</h1>
            <p className="mt-3 max-w-2xl text-[14px] text-white/80">{t("Simulate players. Test agents. Generate interventions. Verify outcomes.")}</p>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <RingNode top={t("AI")} bottom={t("proposes")} />
            <Connector label={t("hypotheses")} />
            <RingNode top={t("Simulation")} bottom={t("competes")} />
            <Connector label={t("evidence")} />
            <RingNode top={t("Evidence")} bottom={t("decides")} filled />
          </div>
        </div>
      </div>
    </header>
  );
}
