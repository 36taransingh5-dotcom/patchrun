import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AiUnavailableError } from "./errors";
import { SYSTEM_PROMPT } from "./prompts";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const TIMEOUT_MS = Number(process.env.PATCHRUN_AI_TIMEOUT_MS || 30_000);

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient() {
  // No SDK-level retries: the experimenter owns the single retry so the whole request fits the 60s function budget.
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  return client;
}

export { AiUnavailableError };

/**
 * One structured-output call. Returns the schema-parsed object, or throws.
 * `retryNote` carries validation feedback on the single retry.
 */
export async function proposeWithClaude<S extends z.ZodType>(schema: S, prompt: string, retryNote?: string): Promise<z.infer<S>> {
  if (!aiConfigured()) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
  const content = retryNote ? `${prompt}\n\nYour previous answer was rejected by server-side validation:\n${retryNote}\nReturn a corrected answer.` : prompt;
  const request = {
    model: AI_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content }],
    output_config: { effort: "low" as const, format: betaZodOutputFormat(schema) },
  };
  try {
    let response;
    try {
      response = await getClient().beta.messages.parse({
        ...request,
        // Server-side refusal fallback: a declined request is re-run on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (error) {
      // If this account/model rejects the fallback beta, retry once without it rather than dropping to rule-based mode.
      if (!(error instanceof Anthropic.BadRequestError)) throw error;
      response = await getClient().beta.messages.parse(request);
    }
    if (response.stop_reason === "refusal") throw new AiUnavailableError("Model declined the request");
    if (response.stop_reason === "max_tokens") throw new AiUnavailableError("Model output was truncated");
    if (!response.parsed_output) throw new AiUnavailableError("Model output did not match the schema");
    return response.parsed_output as z.infer<S>;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new AiUnavailableError("Anthropic authentication failed");
    if (error instanceof Anthropic.RateLimitError) throw new AiUnavailableError("Anthropic rate limit reached");
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new AiUnavailableError(`Anthropic request timed out after ${TIMEOUT_MS / 1000}s`);
    if (error instanceof Anthropic.APIError) throw new AiUnavailableError(`Anthropic API error ${error.status ?? ""}`.trim());
    throw new AiUnavailableError(error instanceof Error ? error.message : "Unknown AI error");
  }
}
