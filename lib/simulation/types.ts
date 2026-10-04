// Scenario-agnostic experiment types shared by both experiments.
// Human-readable text is bilingual (L10n) so the UI can switch language freely.

import type { L10n } from "@/lib/i18n";

export type ScenarioId = "encounter" | "battleRoyale";

export type ExperimentState =
  | "ready"
  | "simulating_baseline"
  | "baseline_ready"
  | "ai_analyzing"
  | "candidates_ready"
  | "testing_candidates"
  | "ranking"
  | "winner_ready"
  | "verifying"
  | "verified"
  | "failed";

export type CandidateId = "A" | "B" | "C";

/** Where a candidate came from. Fallback candidates are never presented as AI output. */
export type CandidateSource = "ai" | "fallback";

export type ParameterChange = {
  parameter: string;
  from: number;
  to: number;
  reason: L10n;
};

export type EncounterCandidate = {
  id: CandidateId;
  name: L10n;
  hypothesis: L10n;
  reasoning: L10n;
  changes: ParameterChange[];
  source: CandidateSource;
  /** Notes added by server-side validation (e.g. values clamped to bounds). */
  validationNotes: L10n[];
};

export type BotArchetype = "rusher" | "hunter" | "survivor" | "sentinel" | "looter";
export type BotMix = Record<BotArchetype, number>;

export type BotStrategyCandidate = {
  id: CandidateId;
  name: L10n;
  hypothesis: L10n;
  reasoning: L10n;
  mix: BotMix;
  source: CandidateSource;
  validationNotes: L10n[];
};

/** Deterministic, code-generated description of what looks wrong. */
export type Finding = {
  detected: boolean;
  severity: "none" | "moderate" | "severe";
  title: L10n;
  lines: L10n[];
  /** Compact machine-readable evidence passed to the AI experimenter. */
  evidence: Record<string, number | string>;
};

export type ExperimentResponse<C> = {
  scenarioId: ScenarioId;
  mode: "ai" | "fallback" | "mixed";
  provider: string | null;
  model: string | null;
  /** Why fallback was used, if it was. */
  fallbackReason: L10n | null;
  diagnosis: L10n;
  confidence: number;
  evidence: L10n[];
  candidates: C[];
  /** The structured payload the AI received (or would have received). */
  aiInput: unknown;
  latencyMs: number;
};

export type ScoreComponent = {
  label: L10n;
  points: number;
  max: number;
  note: L10n;
};

export type RankedCandidate = {
  id: CandidateId;
  score: number;
  components: ScoreComponent[];
  penalties: ScoreComponent[];
  verdict: L10n;
  rank: number;
};

export type VerificationCheck = {
  id: string;
  label: L10n;
  passed: boolean;
  critical: boolean;
  detail: L10n;
};

export type VerificationResult = {
  verified: boolean;
  checks: VerificationCheck[];
  passedCount: number;
  summary: L10n;
  seedsUsed: number[];
};
