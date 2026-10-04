// Exercises the real OpenAI SDK request path (proposeWithOpenAI → openai →
// HTTP → structured-output parsing) against a local mock of the Responses API.

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type Captured = { url: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> };
const captured: Captured[] = [];
let reply: (body: Record<string, unknown>) => { status: number; json: unknown } = () => ({ status: 500, json: {} });
let server: http.Server;

const response = (text: string, status = "completed") => ({
  id: "resp_test",
  object: "response",
  created_at: 1,
  status,
  model: "gpt-6.1-sol",
  incomplete_details: status === "incomplete" ? { reason: "max_output_tokens" } : null,
  output: [{ type: "message", id: "msg_test", status: "completed", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] }],
  usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
});

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      const body = JSON.parse(data || "{}");
      captured.push({ url: req.url ?? "", headers: req.headers, body });
      const r = reply(body);
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.json));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv("OPENAI_BASE_URL", `http://127.0.0.1:${port}/v1`);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
});

afterAll(() => {
  vi.unstubAllEnvs();
  server.close();
});

const payload = {
  diagnosis: "d",
  diagnosisZh: "诊断",
  confidence: 0.9,
  evidence: ["e"],
  evidenceZh: ["证据"],
  candidates: [{ name: "n", nameZh: "名", hypothesis: "h", hypothesisZh: "假设", reasoning: "r", reasoningZh: "理由", changes: [{ parameter: "eliteEnemyCount", to: 6, reason: "x", reasonZh: "原因" }] }],
};

describe("OpenAI provider (mock Responses API)", () => {
  it("is selected when only OPENAI_API_KEY is set", async () => {
    const { activeProvider } = await import("@/lib/ai/provider");
    const p = activeProvider();
    expect(p.provider).toBe("openai");
    expect(p.configured).toBe(true);
    expect(p.model).toBe("gpt-6.1-sol");
  });

  it("sends a strict JSON-schema request and parses the result", async () => {
    const { proposeWithOpenAI } = await import("@/lib/ai/openai");
    const { EncounterOutputSchema } = await import("@/lib/ai/prompts");
    reply = () => ({ status: 200, json: response(JSON.stringify(payload)) });

    const out = await proposeWithOpenAI(EncounterOutputSchema, "PROMPT");
    expect(out).toEqual(payload);

    const req = captured.at(-1)!;
    expect(req.url).toBe("/v1/responses");
    expect(req.headers.authorization).toBe("Bearer test-key-not-real");
    expect(req.body.model).toBe("gpt-6.1-sol");
    expect(req.body.reasoning).toEqual({ effort: "low" });
    const format = (req.body.text as { format: { type: string; strict: boolean; schema: unknown } }).format;
    expect(format.type).toBe("json_schema");
    expect(format.strict).toBe(true);
    expect(JSON.stringify(format.schema)).toContain("nameZh");
  });

  it("turns truncated output and auth failures into AiUnavailableError (route then falls back)", async () => {
    const { proposeWithOpenAI } = await import("@/lib/ai/openai");
    const { AiUnavailableError } = await import("@/lib/ai/errors");
    const { EncounterOutputSchema } = await import("@/lib/ai/prompts");
    reply = () => ({ status: 200, json: response('{"diagnosis": "cut off', "incomplete") });
    await expect(proposeWithOpenAI(EncounterOutputSchema, "PROMPT")).rejects.toBeInstanceOf(AiUnavailableError);
    reply = () => ({ status: 401, json: { error: { message: "bad key", type: "invalid_request_error", code: "invalid_api_key" } } });
    await expect(proposeWithOpenAI(EncounterOutputSchema, "PROMPT")).rejects.toThrow(/authentication/);
  });

  it("drives a full encounter experiment in AI mode end to end", async () => {
    const { activeProvider } = await import("@/lib/ai/provider");
    const { generateEncounterExperiment } = await import("@/lib/ai/experimenter");
    const { DEFAULT_ENCOUNTER_CONFIG, DEFAULT_ENCOUNTER_OBJECTIVE } = await import("@/lib/scenarios/encounter/config");
    const three = {
      ...payload,
      candidates: [
        payload.candidates[0],
        { ...payload.candidates[0], name: "b", changes: [{ parameter: "eliteDamageMultiplier", to: 1.2, reason: "x", reasonZh: "原因" }] },
        { ...payload.candidates[0], name: "c", changes: [{ parameter: "healthDropChance", to: 0.2, reason: "x", reasonZh: "原因" }] },
      ],
    };
    reply = () => ({ status: 200, json: response(JSON.stringify(three)) });
    const { propose, ...provider } = activeProvider();
    const r = await generateEncounterExperiment({ config: DEFAULT_ENCOUNTER_CONFIG, seed: 1337, objective: DEFAULT_ENCOUNTER_OBJECTIVE }, propose, provider);
    expect(r.mode).toBe("ai");
    expect(r.provider).toBe("openai");
    expect(r.candidates.map((c) => c.source)).toEqual(["ai", "ai", "ai"]);
    expect(r.diagnosis.zh).toBe("诊断");
  });
});
