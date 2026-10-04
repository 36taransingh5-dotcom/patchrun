import { L, type L10n } from "@/lib/i18n";
import type { BotArchetype, BotMix } from "@/lib/simulation/types";

export const BOT_ARCHETYPES: BotArchetype[] = ["rusher", "hunter", "survivor", "sentinel", "looter"];

export type Action = "loot" | "rotate" | "engage" | "avoid" | "hold" | "heal";

export type BotProfile = {
  label: string;
  summary: L10n;
  /** Base action tendencies (weights; normalised at runtime). */
  tendencies: Record<Action, number>;
  skill: number;
  awareness: number;
  /** How the bot picks a target when it engages. */
  targeting: "random" | "weakest" | "rotators";
  /** Phases in which the bot is active as an aggressor (sentinels activate late). */
  activeFromPhase: number;
  /** Engagements a bot attempts in a phase when it chooses ENGAGE. */
  engageAttempts: number;
};

export const BOT_PROFILES: Record<BotArchetype, BotProfile> = {
  rusher: {
    label: "RUSHER",
    summary: L("Drops hot and forces fights immediately.", "落地即刚枪，立刻强行开战。"),
    tendencies: { engage: 0.5, rotate: 0.2, loot: 0.15, hold: 0.1, avoid: 0.05, heal: 0 },
    skill: 0.56,
    awareness: 0.35,
    targeting: "random",
    activeFromPhase: 1,
    engageAttempts: 2,
  },
  hunter: {
    label: "HUNTER",
    summary: L("Tracks and picks off the weakest nearby agent.", "追踪并收割附近最弱的对手。"),
    tendencies: { engage: 0.45, rotate: 0.22, loot: 0.13, hold: 0.1, avoid: 0.05, heal: 0.05 },
    skill: 0.6,
    awareness: 0.55,
    targeting: "weakest",
    activeFromPhase: 1,
    engageAttempts: 2,
  },
  survivor: {
    label: "SURVIVOR",
    summary: L("Avoids fights, rotates early, plays for placement.", "避战、提前转点，以排名为目标。"),
    tendencies: { avoid: 0.35, rotate: 0.3, loot: 0.15, hold: 0.15, engage: 0.05, heal: 0 },
    skill: 0.5,
    awareness: 0.65,
    targeting: "random",
    activeFromPhase: 1,
    engageAttempts: 1,
  },
  sentinel: {
    label: "SENTINEL",
    summary: L("Holds key ground mid-to-late match and ambushes rotations.", "中后期占据要点，伏击转点的玩家。"),
    tendencies: { hold: 0.4, engage: 0.25, loot: 0.1, rotate: 0.1, avoid: 0.05, heal: 0.1 },
    skill: 0.62,
    awareness: 0.6,
    targeting: "rotators",
    activeFromPhase: 3,
    engageAttempts: 2,
  },
  looter: {
    label: "LOOTER",
    summary: L("Prioritises loot; fights only when cornered.", "优先搜刮物资，被逼到绝境才交战。"),
    tendencies: { loot: 0.5, rotate: 0.15, hold: 0.15, avoid: 0.1, engage: 0.05, heal: 0.05 },
    skill: 0.4,
    awareness: 0.4,
    targeting: "random",
    activeFromPhase: 1,
    engageAttempts: 1,
  },
};

/** Allowed share per archetype in a candidate strategy (percent). */
export const BOT_MIX_BOUNDS: Record<BotArchetype, { min: number; max: number }> = {
  rusher: { min: 0, max: 70 },
  hunter: { min: 0, max: 60 },
  survivor: { min: 0, max: 70 },
  sentinel: { min: 0, max: 50 },
  looter: { min: 0, max: 50 },
};

/** Intentionally poor for Beginner Onboarding: heavy early aggression. */
export const DEFAULT_BOT_MIX: BotMix = { rusher: 60, hunter: 20, survivor: 20, sentinel: 0, looter: 0 };

export type HumanCohort = "new" | "average" | "skilled";
export const HUMAN_COHORTS: HumanCohort[] = ["new", "average", "skilled"];
export const HUMAN_COHORT_SIZES: Record<HumanCohort, number> = { new: 24, average: 24, skilled: 12 };
export const HUMAN_COUNT = 60;
export const BOT_COUNT = 40;
export const PHASES = 5;
/** Each strategy is evaluated over this many seeded matches (the seed family). */
export const MATCHES_PER_EVALUATION = 24;

export type ObjectiveId = "beginner_onboarding" | "competitive_pressure" | "faster_matches" | "balanced_population";

export const OBJECTIVES: Record<ObjectiveId, { name: L10n; description: L10n }> = {
  beginner_onboarding: {
    name: L("Beginner Onboarding", "新手引导"),
    description: L("Reduce early elimination of new-player profiles without removing meaningful combat.", "降低新玩家画像的早期淘汰，同时不削弱有意义的战斗。"),
  },
  competitive_pressure: {
    name: L("Competitive Pressure", "竞技压力"),
    description: L("Increase meaningful encounters for skilled profiles without overwhelming new players.", "为高手画像增加有意义的交战，同时不压垮新玩家。"),
  },
  faster_matches: {
    name: L("Faster Matches", "更快节奏"),
    description: L("Increase encounter frequency and reduce passive survival.", "提高交战频率，减少消极苟活。"),
  },
  balanced_population: {
    name: L("Balanced Population", "群体均衡"),
    description: L("Reduce extreme outcome disparity across player cohorts.", "缩小各玩家群体之间的极端结果差距。"),
  },
};

export const OBJECTIVE_ORDER = Object.keys(OBJECTIVES) as ObjectiveId[];
export const DEFAULT_OBJECTIVE: ObjectiveId = "beginner_onboarding";

export const COHORT_LABEL: Record<HumanCohort, string> = { new: "NEW", average: "AVERAGE", skilled: "SKILLED" };
