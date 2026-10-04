import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { AiUnavailableError } from "./errors";
import { SYSTEM_PROMPT } from "./prompts";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-6.1-sol";
const TIMEOUT_MS = Number(process.env.PATCHRUN_AI_TIMEOUT_MS || 30_000);

/** OPENAI_API_KEY is canonical; lowercase `openai` is accepted because Vercel can't rename a sensitive variable. */
const apiKey = () => process.env.OPENAI_API_KEY || process.env.openai || "";

export function openAiConfigured(): boolean {
  return Boolean(apiKey());
}

let client: OpenAI | null = null;
function getClient() {
  // No SDK-level retries: the experimenter owns the single retry so the whole request fits the 60s function budget.
  client ??= new OpenAI({ apiKey: apiKey(), timeout: TIMEOUT_MS, maxRetries: 0 });
  return client;
}

/** One structured-output call via the Responses API. Same contract as proposeWithClaude. */
export async function proposeWithOpenAI<S extends z.ZodType>(schema: S, prompt: string, retryNote?: string): Promise<z.infer<S>> {
  if (!openAiConfigured()) throw new AiUnavailableError("OPENAI_API_KEY is not set");
  const input = retryNote ? `${prompt}\n\nYour previous answer was rejected by server-side validation:\n${retryNote}\nReturn a corrected answer.` : prompt;
  try {
    const response = await getClient().responses.parse({
      model: OPENAI_MODEL,
      instructions: SYSTEM_PROMPT,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 8000,
      text: { format: zodTextFormat(schema, "patchrun_experiment") },
    });
    if (response.status === "incomplete") throw new AiUnavailableError(`Model output was incomplete (${response.incomplete_details?.reason ?? "unknown"})`);
    const refused = response.output.some((item) => item.type === "message" && item.content.some((c) => c.type === "refusal"));
    if (refused) throw new AiUnavailableError("Model declined the request");
    if (!response.output_parsed) throw new AiUnavailableError("Model output did not match the schema");
    return response.output_parsed as z.infer<S>;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    if (error instanceof OpenAI.AuthenticationError) throw new AiUnavailableError("OpenAI authentication failed");
    if (error instanceof OpenAI.RateLimitError) throw new AiUnavailableError("OpenAI rate limit or quota reached");
    if (error instanceof OpenAI.NotFoundError) throw new AiUnavailableError(`OpenAI model "${OPENAI_MODEL}" not found (set OPENAI_MODEL)`);
    if (error instanceof OpenAI.APIConnectionTimeoutError) throw new AiUnavailableError(`OpenAI request timed out after ${TIMEOUT_MS / 1000}s`);
    if (error instanceof OpenAI.APIError) throw new AiUnavailableError(`OpenAI API error ${error.status ?? ""}`.trim());
    throw new AiUnavailableError(error instanceof Error ? error.message : "Unknown AI error");
  }
}
