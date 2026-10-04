import { AI_MODEL, aiConfigured, proposeWithClaude } from "@/lib/ai/anthropic";
import { generateBattleRoyaleExperiment, generateEncounterExperiment } from "@/lib/ai/experimenter";
import { BOT_ARCHETYPES, DEFAULT_BOT_MIX, DEFAULT_OBJECTIVE, OBJECTIVES, type ObjectiveId } from "@/lib/scenarios/battleRoyale/config";
import { DEFAULT_ENCOUNTER_CONFIG, DEFAULT_ENCOUNTER_OBJECTIVE, ENCOUNTER_PARAMS, ENCOUNTER_PARAM_ORDER, type EncounterConfig } from "@/lib/scenarios/encounter/config";
import type { BotMix } from "@/lib/simulation/types";

export const maxDuration = 60;

const provider = () => ({ provider: "anthropic", model: AI_MODEL, configured: aiConfigured() });

function parseSeed(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 2 ** 31 ? n : 1337;
}

/** Client input is untrusted: unknown keys are ignored and values are bounds-checked. */
function parseEncounterConfig(v: unknown): EncounterConfig {
  const config = { ...DEFAULT_ENCOUNTER_CONFIG };
  if (v && typeof v === "object") {
    for (const p of ENCOUNTER_PARAM_ORDER) {
      const x = (v as Record<string, unknown>)[p];
      const spec = ENCOUNTER_PARAMS[p];
      if (typeof x === "number" && Number.isFinite(x)) config[p] = Math.min(spec.max, Math.max(spec.min, x));
    }
  }
  return config;
}

function parseMix(v: unknown): BotMix {
  if (!v || typeof v !== "object") return DEFAULT_BOT_MIX;
  const mix = {} as BotMix;
  for (const k of BOT_ARCHETYPES) {
    const x = (v as Record<string, unknown>)[k];
    mix[k] = typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : 0;
  }
  return BOT_ARCHETYPES.reduce((s, k) => s + mix[k], 0) === 100 ? mix : DEFAULT_BOT_MIX;
}

export async function GET() {
  return Response.json({ ai: provider() });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const seed = parseSeed(body.seed);
  const propose = aiConfigured() ? proposeWithClaude : null;

  if (body.scenarioId === "encounter") {
    const objective = typeof body.objective === "string" && body.objective.trim() ? body.objective.slice(0, 400) : DEFAULT_ENCOUNTER_OBJECTIVE;
    const result = await generateEncounterExperiment({ config: parseEncounterConfig(body.config), seed, objective }, propose, provider());
    return Response.json(result);
  }
  if (body.scenarioId === "battleRoyale") {
    const objective = (typeof body.objective === "string" && body.objective in OBJECTIVES ? body.objective : DEFAULT_OBJECTIVE) as ObjectiveId;
    const result = await generateBattleRoyaleExperiment({ mix: parseMix(body.config), seed, objective }, propose, provider());
    return Response.json(result);
  }
  return Response.json({ error: "Unknown scenarioId" }, { status: 400 });
}
