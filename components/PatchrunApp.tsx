"use client";

import { useState } from "react";
import type { ScenarioId } from "@/lib/simulation/types";
import { BattleRoyaleExperiment } from "./battle-royale/BattleRoyaleExperiment";
import { EncounterExperiment } from "./encounter/EncounterExperiment";
import { Header } from "./Header";
import { I18nProvider, useI18n } from "./I18n";
import { ScenarioSelector } from "./ScenarioSelector";

function Footer() {
  const { t } = useI18n();
  const items = [
    { k: "How it works", v: "PATCHRUN does not ask AI for the answer. It asks AI for hypotheses, then uses simulation to find the answer.", c: "bg-yellow" },
    { k: "What the numbers are", v: "Simulated behavioural profiles and seeded, abstract models — a behavioural stress test, not a prediction of real player behaviour.", c: "bg-cobalt" },
    { k: "Scope", v: "Built for pre-deployment experimentation. Human playtesting still matters.", c: "bg-pink" },
  ];
  return (
    <footer className="mt-8 grid gap-3 md:grid-cols-3">
      {items.map((it) => (
        <div key={it.k} className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${it.c}`} />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{t(it.k)}</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t(it.v)}</p>
        </div>
      ))}
    </footer>
  );
}

export function PatchrunApp({ aiStatus }: { aiStatus: { configured: boolean; model: string } }) {
  const [scenario, setScenario] = useState<ScenarioId>("encounter");
  return (
    <I18nProvider>
      <div className="mx-auto max-w-[1600px] px-4 pb-10 sm:px-6">
        <Header aiStatus={aiStatus} />
        <ScenarioSelector value={scenario} onChange={setScenario} />
        {/* Both experiments stay mounted so switching is instant and keeps each one's state. */}
        <div className={scenario === "encounter" ? "mt-3" : "hidden"}>
          <EncounterExperiment aiStatus={aiStatus} />
        </div>
        <div className={scenario === "battleRoyale" ? "mt-3" : "hidden"}>
          <BattleRoyaleExperiment aiStatus={aiStatus} />
        </div>
        <Footer />
      </div>
    </I18nProvider>
  );
}
