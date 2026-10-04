import { same } from "../lib/i18n";
import { DEFAULT_ENCOUNTER_CONFIG, applyChanges } from "../lib/scenarios/encounter/config";
import { generatePopulation } from "../lib/scenarios/encounter/population";
import { runEncounter, detectEncounterProblem } from "../lib/scenarios/encounter/evaluate";
import { encounterFallbackCandidates } from "../lib/scenarios/encounter/fallback";
import { rankEncounterCandidates, verifyEncounterWinner } from "../lib/scenarios/encounter/rank";
import type { EncounterCandidate } from "../lib/simulation/types";

const extra: EncounterCandidate[] = [
  { id: "A", name: same("dmg10"), hypothesis: same(""), reasoning: same(""), source: "ai", validationNotes: [], changes: [{ parameter: "enemyDamage", from: 14, to: 10, reason: same("") }] },
  { id: "B", name: same("elite5+mult"), hypothesis: same(""), reasoning: same(""), source: "ai", validationNotes: [], changes: [{ parameter: "eliteEnemyCount", from: 8, to: 5, reason: same("") }, { parameter: "eliteDamageMultiplier", from: 1.4, to: 1.15, reason: same("") }] },
  { id: "C", name: same("mult1.1"), hypothesis: same(""), reasoning: same(""), source: "ai", validationNotes: [], changes: [{ parameter: "eliteDamageMultiplier", from: 1.4, to: 1.1, reason: same("") }] },
];
for (const seed of [1337, 7, 42, 2026, 5]) {
  const pop = generatePopulation(seed);
  const base = runEncounter(pop, DEFAULT_ENCOUNTER_CONFIG, seed);
  const f = detectEncounterProblem(base.telemetry);
  console.log("seed", seed, f.title.en, f.lines.map((l) => l.en).join(" | "));
  for (const set of [encounterFallbackCandidates(DEFAULT_ENCOUNTER_CONFIG, base.telemetry), extra]) {
    const results = set.map((c) => ({ candidate: c, telemetry: runEncounter(pop, applyChanges(DEFAULT_ENCOUNTER_CONFIG, c.changes), seed).telemetry }));
    const ranked = rankEncounterCandidates(base.telemetry, results);
    for (const r of ranked) {
      const res = results.find((x) => x.candidate.id === r.id)!;
      console.log(`  #${r.rank} ${res.candidate.name.en.padEnd(20)} ${r.score} surv ${res.telemetry.survivalRate} nov ${res.telemetry.cohorts.novice.survivalRate} sk ${res.telemetry.cohorts.skilled.survivalRate} | ${r.verdict.en} | ${r.components.map((c) => c.points).join(",")} ${r.penalties.map((p) => p.label.en).join(",")}`);
    }
    const win = results.find((x) => x.candidate.id === ranked[0].id)!;
    const v = verifyEncounterWinner(pop, DEFAULT_ENCOUNTER_CONFIG, base.telemetry, win.candidate, win.telemetry, seed);
    console.log("  VERIFY", v.verified, v.summary.en, v.checks.filter((c) => !c.passed).map((c) => c.id + ":" + c.detail.en).join("; "));
  }
}
