import { DEFAULT_BOT_MIX, OBJECTIVE_ORDER } from "../lib/scenarios/battleRoyale/config";
import { generateHumans } from "../lib/scenarios/battleRoyale/population";
import { runBattleRoyale, detectBattleRoyaleProblem } from "../lib/scenarios/battleRoyale/evaluate";
import { battleRoyaleFallbackCandidates } from "../lib/scenarios/battleRoyale/fallback";
import { rankBotStrategies, verifyBotStrategy } from "../lib/scenarios/battleRoyale/rank";
for (const seed of [1337, 7, 42]) {
  const humans = generateHumans(seed);
  const base = runBattleRoyale(humans, DEFAULT_BOT_MIX, seed).telemetry;
  for (const obj of OBJECTIVE_ORDER) {
    const f = detectBattleRoyaleProblem(base, obj);
    console.log(seed, obj, f.title.en, f.lines[0].en);
    const cands = battleRoyaleFallbackCandidates(obj, DEFAULT_BOT_MIX, base);
    const results = cands.map((c) => ({ candidate: c, telemetry: runBattleRoyale(humans, c.mix, seed).telemetry }));
    const ranked = rankBotStrategies(obj, base, results);
    for (const r of ranked) {
      const t = results.find((x) => x.candidate.id === r.id)!;
      console.log(`  #${r.rank} ${t.candidate.name.en.padEnd(18)} ${r.score} N ${t.telemetry.cohorts.new.earlyElimination} | ${r.verdict.en} | ${r.components.map((c) => c.points).join(",")} ${r.penalties.map((p) => p.label.en).join(",")}`);
    }
    const win = results.find((x) => x.candidate.id === ranked[0].id)!;
    const v = verifyBotStrategy(obj, humans, DEFAULT_BOT_MIX, base, win.candidate, win.telemetry, seed);
    console.log("  VERIFY", v.verified, v.summary.en, v.checks.filter((c) => !c.passed).map((c) => c.label.en + ":" + c.detail.en).join("; "));
  }
}
