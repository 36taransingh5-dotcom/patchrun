// Local stand-in for the Anthropic Messages API, for smoke-testing the AI path
// without a key: ANTHROPIC_BASE_URL=http://127.0.0.1:4599 ANTHROPIC_API_KEY=mock npm start
// Returns fixed, clearly-labelled test candidates. Never used in production.
import http from "node:http";

const encounter = {
  diagnosis: "[MOCK MODEL] Failures cluster at the ELITE WAVE because two elites attack at once for most of the wave.",
  diagnosisZh: "[模拟模型] 失败集中在精英波次，因为大部分时间有两个精英同时进攻。",
  confidence: 0.8,
  evidence: ["[mock] ELITE WAVE holds ~70% of failures", "[mock] novice survival ~11%"],
  evidenceZh: ["[模拟] 精英波次约占 70% 的失败", "[模拟] 新手存活约 11%"],
  candidates: [
    { name: "Thin The Wave", nameZh: "精简波次", hypothesis: "Fewer elites shortens overlap.", hypothesisZh: "减少精英可缩短重叠时间。", reasoning: "Mock.", reasoningZh: "模拟。", changes: [{ parameter: "eliteEnemyCount", to: 6, reason: "mock", reasonZh: "模拟" }] },
    { name: "Softer Elites", nameZh: "温和精英", hypothesis: "Lower elite damage.", hypothesisZh: "降低精英伤害。", reasoning: "Mock.", reasoningZh: "模拟。", changes: [{ parameter: "eliteDamageMultiplier", to: 1.15, reason: "mock", reasonZh: "模拟" }] },
    { name: "Global Nerf", nameZh: "全局削弱", hypothesis: "Lower all enemy damage.", hypothesisZh: "降低所有敌人伤害。", reasoning: "Mock.", reasoningZh: "模拟。", changes: [{ parameter: "enemyDamage", to: 9, reason: "mock", reasonZh: "模拟" }, { parameter: "bossDamage", to: 16, reason: "mock", reasonZh: "模拟" }] },
  ],
};
const br = {
  diagnosis: "[MOCK MODEL] Hot-drop rushers and hunters eliminate NEW profiles in phases 1–2.",
  diagnosisZh: "[模拟模型] 落地刚枪的突击者和猎手在第 1–2 阶段淘汰了新玩家。",
  confidence: 0.75,
  evidence: ["[mock] NEW early elimination ~66%"],
  evidenceZh: ["[模拟] 新玩家早期淘汰约 66%"],
  candidates: [
    { name: "Fewer Rushers", nameZh: "减少突击者", hypothesis: "", hypothesisZh: "", reasoning: "Mock.", reasoningZh: "模拟。", mix: { rusher: 30, hunter: 20, survivor: 50, sentinel: 0, looter: 0 } },
    { name: "Sentinel Shift", nameZh: "转向哨卫", hypothesis: "", hypothesisZh: "", reasoning: "Mock.", reasoningZh: "模拟。", mix: { rusher: 20, hunter: 10, survivor: 30, sentinel: 30, looter: 10 } },
    { name: "Loot Lobby", nameZh: "搜刮大厅", hypothesis: "", hypothesisZh: "", reasoning: "Mock.", reasoningZh: "模拟。", mix: { rusher: 5, hunter: 5, survivor: 40, sentinel: 0, looter: 50 } },
  ],
};

http
  .createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      const isBr = data.includes("battleRoyale");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        id: "msg_mock", type: "message", role: "assistant", model: "claude-opus-5-5",
        content: [{ type: "text", text: JSON.stringify(isBr ? br : encounter) }],
        stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
      }));
      console.log(new Date().toISOString(), "mock reply", isBr ? "battleRoyale" : "encounter");
    });
  })
  .listen(4599, "127.0.0.1", () => console.log("mock Anthropic API on http://127.0.0.1:4599"));
