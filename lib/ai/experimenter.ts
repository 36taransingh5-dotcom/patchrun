// Orchestrates one "generate experiments" request: recompute baseline
// telemetry from (config, seed), ask the model for hypotheses, validate them,
// retry once with the validation errors, and fall back deterministically.
// The model call is injected so this module stays testable without network.

import type { z } from "zod";
import { L, type L10n } from "@/lib/i18n";
import { DEFAULT_BOT_MIX, type ObjectiveId } from "@/lib/scenarios/battleRoyale/config";
import { detectBattleRoyaleProblem, runBattleRoyaleFromSeed } from "@/lib/scenarios/battleRoyale/evaluate";
import { battleRoyaleFallbackCandidates } from "@/lib/scenarios/battleRoyale/fallback";
import type { EncounterConfig } from "@/lib/scenarios/encounter/config";
import { detectEncounterProblem, runEncounterFromSeed } from "@/lib/scenarios/encounter/evaluate";
import { encounterFallbackCandidates } from "@/lib/scenarios/encounter/fallback";
import type { BotMix, BotStrategyCandidate, EncounterCandidate, ExperimentResponse } from "@/lib/simulation/types";
import { BattleRoyaleOutputSchema, EncounterOutputSchema, battleRoyaleAiInput, encounterAiInput, userPrompt } from "./prompts";
import { IDS, encounterNearDuplicate, mixDistance, validateBotStrategies, validateEncounterCandidates } from "./validate";

export type ProposeFn = <S extends z.ZodType>(schema: S, prompt: string, retryNote?: string) => Promise<z.infer<S>>;

export type ProviderInfo = { provider: string; model: string; configured: boolean };

type ModelOutput = { diagnosis: string; diagnosisZh?: string; confidence: number; evidence: string[]; evidenceZh?: string[]; candidates: unknown[] };

/** Skip the validation retry if the first call already used this much of the request budget. */
const RETRY_BUDGET_MS = 20_000;

async function runWithRetry<C>(
  propose: ProposeFn,
  schema: z.ZodType,
  prompt: string,
  validate: (raw: unknown) => { valid: C[]; errors: string[] },
): Promise<{ output: ModelOutput; valid: C[]; errors: string[] }> {
  const started = Date.now();
  let output = (await propose(schema, prompt)) as ModelOutput;
  let result = validate(output.candidates);
  if (result.valid.length < 3 && Date.now() - started < RETRY_BUDGET_MS) {
    // Retry once, telling the model exactly what validation rejected.
    try {
      const retried = (await propose(schema, prompt, result.errors.join("\n"))) as ModelOutput;
      const retriedResult = validate(retried.candidates);
      if (retriedResult.valid.length >= result.valid.length) {
        output = retried;
        result = retriedResult;
      }
    } catch {
      // keep the first attempt's valid candidates
    }
  }
  return { output, ...result };
}

const clamp01 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
const strings = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, n).map((s) => s.slice(0, 240)) : []);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Pair the model's English and Chinese prose; missing Chinese falls back to English. */
function bilingualOutput(o: ModelOutput): { diagnosis: L10n; evidence: L10n[] } {
  const en = strings(o.evidence, 4);
  const zh = strings(o.evidenceZh, 4);
  const d = str(o.diagnosis, 600);
  return { diagnosis: { en: d, zh: str(o.diagnosisZh, 600) || d }, evidence: en.map((e, i) => ({ en: e, zh: zh[i] || e })) };
}

const NO_PROVIDER = L("No AI provider configured (set ANTHROPIC_API_KEY).", "未配置 AI 服务（请设置 ANTHROPIC_API_KEY）。");
const aiFailed = (msg: string) => L(`AI request failed: ${msg}`, `AI 请求失败：${msg}`);
const aiInvalid = (errs: string) => L(`AI output failed validation: ${errs}`, `AI 输出未通过校验：${errs}`);
const partial = (n: number, noun: L10n) =>
  L(`${n} AI ${noun.en} rejected by validation; replaced with deterministic fallback.`, `${n} 个 AI ${noun.zh}未通过校验，已用确定性回退替换。`);

function fill<C extends { id: string }>(valid: C[], fallback: C[], isDuplicate: (a: C, b: C) => boolean): C[] {
  const out = [...valid];
  for (const f of fallback) {
    if (out.length >= 3) break;
    if (!out.some((v) => isDuplicate(v, f))) out.push(f);
  }
  return out.slice(0, 3).map((c, i) => ({ ...c, id: IDS[i] }));
}

export async function generateEncounterExperiment(
  args: { config: EncounterConfig; seed: number; objective: string },
  propose: ProposeFn | null,
  provider: ProviderInfo,
): Promise<ExperimentResponse<EncounterCandidate>> {
  const started = Date.now();
  const { telemetry } = runEncounterFromSeed(args.config, args.seed);
  const finding = detectEncounterProblem(telemetry);
  const aiInput = encounterAiInput(args.config, telemetry, finding, args.objective);
  const fallback = encounterFallbackCandidates(args.config, telemetry);
  const fallbackResponse = (reason: L10n): ExperimentResponse<EncounterCandidate> => ({
    scenarioId: "encounter",
    mode: "fallback",
    provider: null,
    model: null,
    fallbackReason: reason,
    diagnosis: finding.detected
      ? L(
          `Rule-based diagnosis: ${finding.lines[0].en} Failures are concentrated rather than spread across the run, which points at the ${aiInput.deterministicFinding.evidence.hotspot} configuration.`,
          `规则诊断：${finding.lines[0].zh}失败集中而非分散在整个流程中，问题指向该阶段的配置。`,
        )
      : L("Rule-based diagnosis: no severe single-stage cliff detected; candidates probe the highest-hazard stage.", "规则诊断：未检测到严重的单阶段断崖；候选方案针对风险最高的阶段。"),
    confidence: finding.detected ? 0.7 : 0.4,
    evidence: finding.lines,
    candidates: fallback,
    aiInput,
    latencyMs: Date.now() - started,
  });

  if (!propose || !provider.configured) return fallbackResponse(NO_PROVIDER);
  try {
    const { output, valid, errors } = await runWithRetry(propose, EncounterOutputSchema, userPrompt(aiInput), (raw) =>
      validateEncounterCandidates(raw, args.config),
    );
    if (valid.length === 0) return fallbackResponse(aiInvalid(errors.slice(0, 2).join(" ")));
    const candidates = fill(valid, fallback, encounterNearDuplicate);
    return {
      scenarioId: "encounter",
      mode: valid.length === 3 ? "ai" : "mixed",
      provider: provider.provider,
      model: provider.model,
      fallbackReason: valid.length === 3 ? null : partial(3 - valid.length, L("candidate(s)", "候选方案")),
      ...bilingualOutput(output),
      confidence: clamp01(output.confidence),
      candidates,
      aiInput,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return fallbackResponse(aiFailed(error instanceof Error ? error.message : "unknown error"));
  }
}

export async function generateBattleRoyaleExperiment(
  args: { mix: BotMix; seed: number; objective: ObjectiveId },
  propose: ProposeFn | null,
  provider: ProviderInfo,
): Promise<ExperimentResponse<BotStrategyCandidate>> {
  const started = Date.now();
  const mix = args.mix ?? DEFAULT_BOT_MIX;
  const { telemetry } = runBattleRoyaleFromSeed(mix, args.seed);
  const finding = detectBattleRoyaleProblem(telemetry, args.objective);
  const aiInput = battleRoyaleAiInput(mix, args.objective, telemetry, finding);
  const fallback = battleRoyaleFallbackCandidates(args.objective, mix, telemetry);
  const fallbackResponse = (reason: L10n): ExperimentResponse<BotStrategyCandidate> => ({
    scenarioId: "battleRoyale",
    mode: "fallback",
    provider: null,
    model: null,
    fallbackReason: reason,
    diagnosis: finding.detected
      ? L(`Rule-based diagnosis: ${finding.lines[0].en}`, `规则诊断：${finding.lines[0].zh}`)
      : L(`Rule-based diagnosis: ${finding.lines[0].en} Candidates probe alternative mixes for the objective.`, `规则诊断：${finding.lines[0].zh}候选方案针对该目标尝试其他配比。`),
    confidence: finding.detected ? 0.65 : 0.4,
    evidence: finding.lines,
    candidates: fallback,
    aiInput,
    latencyMs: Date.now() - started,
  });

  if (!propose || !provider.configured) return fallbackResponse(NO_PROVIDER);
  try {
    const { output, valid, errors } = await runWithRetry(propose, BattleRoyaleOutputSchema, userPrompt(aiInput), (raw) => validateBotStrategies(raw, mix));
    if (valid.length === 0) return fallbackResponse(aiInvalid(errors.slice(0, 2).join(" ")));
    const candidates = fill(valid, fallback, (a, b) => mixDistance(a.mix, b.mix) < 10);
    return {
      scenarioId: "battleRoyale",
      mode: valid.length === 3 ? "ai" : "mixed",
      provider: provider.provider,
      model: provider.model,
      fallbackReason: valid.length === 3 ? null : partial(3 - valid.length, L("strategy(ies)", "策略")),
      ...bilingualOutput(output),
      confidence: clamp01(output.confidence),
      candidates,
      aiInput,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return fallbackResponse(aiFailed(error instanceof Error ? error.message : "unknown error"));
  }
}
