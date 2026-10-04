// Server-side validation of model output. Nothing the model returns is trusted:
// parameters must be known, values numeric and in bounds, mixes must sum to 100,
// and the three candidates must be meaningfully different from each other.

import type {
  BotArchetype,
  BotMix,
  BotStrategyCandidate,
  CandidateId,
  EncounterCandidate,
} from "@/lib/simulation/types";
import { L, type L10n } from "@/lib/i18n";
import { ENCOUNTER_PARAMS, type EncounterConfig, type EncounterParam } from "@/lib/scenarios/encounter/config";
import { BOT_ARCHETYPES, BOT_MIX_BOUNDS } from "@/lib/scenarios/battleRoyale/config";

export const IDS: CandidateId[] = ["A", "B", "C"];
const MAX_CHANGES = 3;

export type ValidationOutcome<C> = { valid: C[]; errors: string[] };

const text = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;

/** English text plus the model's Chinese version; falls back to English if Chinese is missing. */
const bi = (en: unknown, zh: unknown, max: number, fallback = ""): L10n => {
  const e = text(en, max, fallback);
  return { en: e, zh: text(zh, max, e) };
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// ───────────────────────────── Encounter ─────────────────────────────

export function validateEncounterCandidates(raw: unknown, config: EncounterConfig): ValidationOutcome<EncounterCandidate> {
  const errors: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  if (list.length !== 3) errors.push(`Expected exactly 3 candidates, received ${list.length}.`);

  const valid: EncounterCandidate[] = [];
  for (const [index, item] of list.slice(0, 3).entries()) {
    const label = `Candidate ${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`${label}: not an object.`);
      continue;
    }
    const notes: L10n[] = [];
    const rawChanges = Array.isArray(item.changes) ? item.changes : [];
    if (rawChanges.length > MAX_CHANGES) notes.push(L(`Only the first ${MAX_CHANGES} of ${rawChanges.length} changes were kept.`, `仅保留了 ${rawChanges.length} 项改动中的前 ${MAX_CHANGES} 项。`));

    const seen = new Set<string>();
    const changes: EncounterCandidate["changes"] = [];
    for (const c of rawChanges.slice(0, MAX_CHANGES)) {
      if (!isRecord(c)) continue;
      const parameter = String(c.parameter ?? "");
      if (!(parameter in ENCOUNTER_PARAMS)) {
        errors.push(`${label}: unknown parameter "${parameter}" rejected.`);
        continue;
      }
      if (seen.has(parameter)) continue;
      const to = typeof c.to === "number" ? c.to : Number.NaN;
      if (!Number.isFinite(to)) {
        errors.push(`${label}: non-numeric value for ${parameter} rejected.`);
        continue;
      }
      const spec = ENCOUNTER_PARAMS[parameter as EncounterParam];
      let bounded = Math.min(spec.max, Math.max(spec.min, to));
      bounded = spec.integer ? Math.round(bounded) : Math.round(bounded * 100) / 100;
      if (bounded !== to) notes.push(L(`${parameter} ${to} adjusted to ${bounded} (bounds ${spec.min}–${spec.max}).`, `${parameter} ${to} 已调整为 ${bounded}（范围 ${spec.min}–${spec.max}）。`));
      const from = config[parameter as EncounterParam];
      if (bounded === from) {
        notes.push(L(`${parameter} change dropped (no-op).`, `${parameter} 改动无效，已丢弃。`));
        continue;
      }
      seen.add(parameter);
      changes.push({ parameter, from, to: bounded, reason: bi(c.reason, c.reasonZh, 200) });
    }
    if (!changes.length) {
      errors.push(`${label}: no valid parameter changes.`);
      continue;
    }
    const candidate: EncounterCandidate = {
      id: IDS[valid.length],
      name: bi(item.name, item.nameZh, 48, `Candidate ${IDS[valid.length]}`),
      hypothesis: bi(item.hypothesis, item.hypothesisZh, 320),
      reasoning: bi(item.reasoning, item.reasoningZh, 600),
      changes,
      source: "ai",
      validationNotes: notes,
    };
    const dup = valid.find((v) => encounterNearDuplicate(v, candidate));
    if (dup) {
      errors.push(`${label}: near-identical to candidate ${dup.id}; rejected.`);
      continue;
    }
    valid.push(candidate);
  }
  return { valid, errors };
}

/** Same parameter set and every value within 10% of the allowed range → not a distinct hypothesis. */
export function encounterNearDuplicate(a: Pick<EncounterCandidate, "changes">, b: Pick<EncounterCandidate, "changes">): boolean {
  const pa = a.changes.map((c) => c.parameter).sort().join(",");
  const pb = b.changes.map((c) => c.parameter).sort().join(",");
  if (pa !== pb) return false;
  return a.changes.every((ca) => {
    const cb = b.changes.find((c) => c.parameter === ca.parameter)!;
    const spec = ENCOUNTER_PARAMS[ca.parameter as EncounterParam];
    return Math.abs(ca.to - cb.to) <= 0.1 * (spec.max - spec.min);
  });
}

// ─────────────────────────── Battle Royale ───────────────────────────

/** Largest-remainder rounding so integer percentages always total exactly 100. */
export function normalizeMix(weights: Partial<Record<BotArchetype, number>>): BotMix {
  const total = BOT_ARCHETYPES.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  const exact = BOT_ARCHETYPES.map((k) => ({ k, v: total ? (Math.max(0, weights[k] ?? 0) / total) * 100 : 0 }));
  const floored = exact.map((e) => ({ ...e, f: Math.floor(e.v) }));
  let remainder = 100 - floored.reduce((s, e) => s + e.f, 0);
  const order = [...floored].sort((a, b) => b.v - b.f - (a.v - a.f) || a.k.localeCompare(b.k));
  for (const e of order) {
    if (remainder <= 0) break;
    e.f += 1;
    remainder--;
  }
  return Object.fromEntries(floored.map((e) => [e.k, e.f])) as BotMix;
}

export function validateBotStrategies(raw: unknown, current: BotMix): ValidationOutcome<BotStrategyCandidate> {
  const errors: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  if (list.length !== 3) errors.push(`Expected exactly 3 strategies, received ${list.length}.`);
  const valid: BotStrategyCandidate[] = [];

  for (const [index, item] of list.slice(0, 3).entries()) {
    const label = `Strategy ${index + 1}`;
    if (!isRecord(item) || !isRecord(item.mix)) {
      errors.push(`${label}: missing bot mix.`);
      continue;
    }
    const notes: L10n[] = [];
    const mixIn = item.mix;
    const unknown = Object.keys(mixIn).filter((k) => !(BOT_ARCHETYPES as string[]).includes(k));
    if (unknown.length) errors.push(`${label}: unknown archetype(s) ${unknown.join(", ")} ignored.`);
    const weights: Partial<Record<BotArchetype, number>> = {};
    let bad = false;
    for (const k of BOT_ARCHETYPES) {
      const v = mixIn[k] ?? 0;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        errors.push(`${label}: ${k} must be a non-negative number.`);
        bad = true;
        break;
      }
      weights[k] = v;
    }
    if (bad) continue;
    const sum = BOT_ARCHETYPES.reduce((s, k) => s + (weights[k] ?? 0), 0);
    if (Math.abs(sum - 100) > 2) {
      errors.push(`${label}: percentages sum to ${sum}, not 100; rejected.`);
      continue;
    }
    // Clamp each archetype to its allowed range, then renormalise to exactly 100.
    for (const k of BOT_ARCHETYPES) {
      const { min, max } = BOT_MIX_BOUNDS[k];
      const v = weights[k] ?? 0;
      const c = Math.min(max, Math.max(min, v));
      if (c !== v) notes.push(L(`${k} ${v}% clamped to ${c}%.`, `${k} ${v}% 已限制为 ${c}%。`));
      weights[k] = c;
    }
    const mix = normalizeMix(weights);
    if (Math.abs(sum - 100) > 0 || notes.length) notes.push(L("Mix renormalised to total 100%.", "配比已重新归一化为 100%。"));
    if (BOT_ARCHETYPES.every((k) => mix[k] === current[k])) {
      errors.push(`${label}: identical to the current mix; rejected.`);
      continue;
    }
    const candidate: BotStrategyCandidate = {
      id: IDS[valid.length],
      name: bi(item.name, item.nameZh, 48, `Strategy ${IDS[valid.length]}`),
      hypothesis: bi(item.hypothesis, item.hypothesisZh, 320),
      reasoning: bi(item.reasoning, item.reasoningZh, 600),
      mix,
      source: "ai",
      validationNotes: notes.filter((n, i) => notes.findIndex((m) => m.en === n.en) === i),
    };
    const dup = valid.find((v) => mixDistance(v.mix, mix) < 10);
    if (dup) {
      errors.push(`${label}: near-identical to strategy ${dup.id}; rejected.`);
      continue;
    }
    valid.push(candidate);
  }
  return { valid, errors };
}

/** Total variation distance in percentage points. */
export function mixDistance(a: BotMix, b: BotMix): number {
  return BOT_ARCHETYPES.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0) / 2;
}
