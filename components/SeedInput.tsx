"use client";

import { useState } from "react";
import { useI18n } from "./I18n";
import { Label } from "./ui";

export function SeedInput({ seed, onSeed, fingerprint, disabled }: { seed: number; onSeed: (s: number) => void; fingerprint: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(seed));
  const commit = () => {
    const n = Number(draft);
    if (Number.isInteger(n) && n >= 0 && n <= 2 ** 31) onSeed(n);
    else setDraft(String(seed));
  };
  return (
    <div className="mt-3 flex items-end justify-between gap-2 border-t border-line pt-3">
      <label className="block">
        <Label>{t("Seed")}</Label>
        <input
          value={draft}
          disabled={disabled}
          inputMode="numeric"
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="mt-1 w-24 rounded-full border border-line-2 bg-bg px-3 py-1 font-mono text-[12px] text-text outline-none focus:border-yellow disabled:text-muted"
        />
      </label>
      <div className="text-right">
        <Label>{t("Cohort fingerprint")}</Label>
        <div className="mt-1 font-mono text-[12px] text-muted">#{fingerprint}</div>
      </div>
    </div>
  );
}
