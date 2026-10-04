import "server-only";
import { AI_MODEL, aiConfigured, proposeWithClaude } from "./anthropic";
import type { ProposeFn, ProviderInfo } from "./experimenter";
import { OPENAI_MODEL, openAiConfigured, proposeWithOpenAI } from "./openai";

/**
 * Picks the model provider from server env: Anthropic if ANTHROPIC_API_KEY is
 * set, otherwise OpenAI if OPENAI_API_KEY is set, otherwise none (fallback mode).
 */
export function activeProvider(): ProviderInfo & { propose: ProposeFn | null } {
  if (aiConfigured()) return { provider: "anthropic", model: AI_MODEL, configured: true, propose: proposeWithClaude };
  if (openAiConfigured()) return { provider: "openai", model: OPENAI_MODEL, configured: true, propose: proposeWithOpenAI };
  return { provider: "none", model: AI_MODEL, configured: false, propose: null };
}
