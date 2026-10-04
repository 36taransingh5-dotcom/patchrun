"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { L10n, Lang } from "@/lib/i18n";
import { ZH } from "./i18n-zh";

const KEY = "patchrun.lang";
const EVENT = "patchrun:lang";

// Language lives in localStorage behind a tiny external store so the server
// render (always English) and the client never disagree during hydration.
function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function write(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // storage unavailable: the choice just won't persist
  }
  window.dispatchEvent(new Event(EVENT));
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a UI string (English is the key); `{name}` placeholders are filled from vars. */
  t: (en: string, vars?: Record<string, string | number>) => string;
  /** Pick the current language from engine-produced bilingual text. */
  tx: (text: L10n) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  const t = useCallback(
    (en: string, vars?: Record<string, string | number>) => {
      const s = lang === "zh" ? (ZH[en] ?? en) : en;
      return vars ? s.replace(/\{(\w+)\}/g, (_: string, k: string) => String(vars[k] ?? `{${k}}`)) : s;
    },
    [lang],
  );
  const value = useMemo<Ctx>(() => ({ lang, setLang: write, t, tx: (x) => x[lang] }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div role="group" aria-label="Language / 语言" className="inline-flex rounded-full border border-white/25 bg-black/25 p-0.5 font-mono text-[11px] font-semibold">
      {(["en", "zh"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`rounded-full px-3 py-1 transition-colors ${lang === l ? "bg-yellow text-black" : "text-white/80 hover:text-white"}`}
        >
          {l === "en" ? "EN" : "中文"}
        </button>
      ))}
    </div>
  );
}
