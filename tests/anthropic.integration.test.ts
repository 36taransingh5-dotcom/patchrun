// Exercises the real SDK request path (proposeWithClaude → @anthropic-ai/sdk →
// HTTP → structured-output parsing) against a local mock of the Messages API.
// No network or API key needed; it checks request shape and response handling.

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type Captured = { headers: http.IncomingHttpHeaders; body: Record<string, unknown> };
const captured: Captured[] = [];
let reply: (body: Record<string, unknown>, n: number) => { status: number; json: unknown } = () => ({ status: 500, json: {} });
let server: http.Server;

const message = (text: string) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      const body = JSON.parse(data || "{}");
      captured.push({ headers: req.headers, body });
      const r = reply(body, captured.length);
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.json));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv("ANTHROPIC_BASE_URL", `http://127.0.0.1:${port}`);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
  vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
});

afterAll(() => {
  vi.unstubAllEnvs();
  server.close();
});

describe("Anthropic provider (mock Messages API)", () => {
  it("sends a structured-output request with the refusal fallback and parses the result", async () => {
    const { proposeWithClaude } = await import("@/lib/ai/anthropic");
    const { EncounterOutputSchema } = await import("@/lib/ai/prompts");
    const payload = {
      diagnosis: "d",
      diagnosisZh: "诊断",
      confidence: 0.9,
      evidence: ["e"],
      evidenceZh: ["证据"],
      candidates: [{ name: "n", nameZh: "名", hypothesis: "h", hypothesisZh: "假设", reasoning: "r", reasoningZh: "理由", changes: [{ parameter: "eliteEnemyCount", to: 6, reason: "x", reasonZh: "原因" }] }],
    };
    reply = () => ({ status: 200, json: message(JSON.stringify(payload)) });

    const out = await proposeWithClaude(EncounterOutputSchema, "PROMPT");
    expect(out).toEqual(payload);

    const req = captured.at(-1)!;
    expect(req.body.model).toBe("claude-opus-5-5");
    expect(req.body.fallbacks).toBe("default");
    expect(String(req.headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
    expect(req.headers["x-api-key"]).toBe("test-key-not-real");
    const oc = req.body.output_config as { effort: string; format: { type: string; schema: unknown } };
    expect(oc.effort).toBe("low");
    expect(oc.format.type).toBe("json_schema");
    expect(JSON.stringify(oc.format.schema)).toContain("eliteEnemyCount");
    expect(JSON.stringify(oc.format.schema)).toContain("nameZh");
  });

  it("retries without the fallback beta if the API rejects it with 400", async () => {
    const { proposeWithClaude } = await import("@/lib/ai/anthropic");
    const { EncounterOutputSchema } = await import("@/lib/ai/prompts");
    const before = captured.length;
    const payload = { diagnosis: "d", diagnosisZh: "诊断", confidence: 0.5, evidence: [], evidenceZh: [], candidates: [] };
    reply = (body) =>
      body.fallbacks ? { status: 400, json: { type: "error", error: { type: "invalid_request_error", message: "fallbacks not supported" } } } : { status: 200, json: message(JSON.stringify(payload)) };
    const out = await proposeWithClaude(EncounterOutputSchema, "PROMPT");
    expect(out).toEqual(payload);
    expect(captured.length - before).toBe(2);
    expect(captured.at(-1)!.body.fallbacks).toBeUndefined();
  });

  it("surfaces auth failures as AiUnavailableError (route then uses fallback)", async () => {
    const { proposeWithClaude, AiUnavailableError } = await import("@/lib/ai/anthropic");
    const { EncounterOutputSchema } = await import("@/lib/ai/prompts");
    reply = () => ({ status: 401, json: { type: "error", error: { type: "authentication_error", message: "bad key" } } });
    await expect(proposeWithClaude(EncounterOutputSchema, "PROMPT")).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
