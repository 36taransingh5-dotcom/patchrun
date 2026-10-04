import type { ReactNode } from "react";

export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

export type Tone = "neutral" | "ai" | "good" | "bad" | "warn" | "muted";

const toneText: Record<Tone, string> = {
  neutral: "text-text",
  ai: "text-ai",
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
  muted: "text-muted",
};

const toneBadge: Record<Tone, string> = {
  neutral: "bg-panel-2 text-text border-line-2",
  ai: "bg-violet text-white border-violet-2/60",
  good: "bg-lime text-black border-lime",
  bad: "bg-coral text-black border-coral",
  warn: "bg-yellow text-black border-yellow",
  muted: "bg-transparent text-muted border-line-2",
};

export function Panel({
  label,
  title,
  right,
  children,
  className,
  bodyClassName,
  accent,
}: {
  label?: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Optional coloured tab on the left of the header, poster-style. */
  accent?: "violet" | "yellow" | "coral" | "lime" | "cobalt" | "pink";
}) {
  const accentBg = accent ? { violet: "bg-violet-2", yellow: "bg-yellow", coral: "bg-coral", lime: "bg-lime", cobalt: "bg-cobalt", pink: "bg-pink" }[accent] : null;
  return (
    <section className={cx("overflow-hidden rounded-2xl border border-line bg-panel", className)}>
      {(label || title || right) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {accentBg && <span className={cx("h-7 w-1.5 shrink-0 rounded-full", accentBg)} />}
            <div className="min-w-0">
              {label && <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</div>}
              {title && <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-text">{title}</div>}
            </div>
          </div>
          {right}
        </header>
      )}
      <div className={cx("px-4 pb-4 pt-2", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]", toneBadge[tone], className)}>
      {children}
    </span>
  );
}

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  const bg: Record<Tone, string> = { neutral: "bg-text", ai: "bg-ai", good: "bg-good", bad: "bg-bad", warn: "bg-warn", muted: "bg-faint" };
  return <span className={cx("inline-block size-2 rounded-full", bg[tone], pulse && "pr-pulse")} />;
}

export function Button({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const styles = {
    primary: "bg-yellow text-black hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#b8921a] shadow-[0_3px_0_0_#b8921a] active:translate-y-0 active:shadow-none disabled:bg-line-2 disabled:text-muted disabled:shadow-none disabled:translate-y-0",
    secondary: "border border-line-2 bg-panel-2 text-text hover:border-muted disabled:text-faint",
    ghost: "text-muted hover:text-text disabled:text-faint",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        "relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full px-6 font-display text-[12px] font-bold uppercase tracking-[0.06em] transition-all disabled:cursor-not-allowed",
        styles,
        className,
      )}
    >
      {loading && <span className="pr-scan absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  size = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  size?: "md" | "lg";
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{label}</div>
      <div className={cx("mt-1 font-display font-bold tabular-nums tracking-tight", toneText[tone], size === "lg" ? "text-[34px] leading-none" : "text-[20px] leading-tight")}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function Meter({ value, tone = "neutral", className }: { value: number; tone?: Tone; className?: string }) {
  const bg: Record<Tone, string> = { neutral: "bg-text/80", ai: "bg-ai", good: "bg-good", bad: "bg-bad", warn: "bg-warn", muted: "bg-faint" };
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-line", className)}>
      <div className={cx("h-full rounded-full transition-[width] duration-700 ease-out", bg[tone])} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("font-mono text-[10px] uppercase tracking-[0.16em] text-faint", className)}>{children}</div>;
}

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
