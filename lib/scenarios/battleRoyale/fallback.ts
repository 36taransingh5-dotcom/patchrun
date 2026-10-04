import { L, type L10n } from "@/lib/i18n";
import type { BotMix, BotStrategyCandidate, CandidateId } from "@/lib/simulation/types";
import type { ObjectiveId } from "./config";
import type { BattleRoyaleTelemetry } from "./evaluate";

const mix = (rusher: number, hunter: number, survivor: number, sentinel: number, looter: number): BotMix => ({ rusher, hunter, survivor, sentinel, looter });
const s = (id: CandidateId, name: L10n, hypothesis: L10n, reasoning: L10n, m: BotMix): BotStrategyCandidate => ({ id, name, hypothesis, reasoning, mix: m, source: "fallback", validationNotes: [] });

/**
 * Rule-based strategies used when the AI is unavailable. Always labelled
 * DETERMINISTIC FALLBACK. Rules follow the objective: reduce early aggression
 * for onboarding, add late pressure for competitive play, add aggression for pacing.
 */
export function battleRoyaleFallbackCandidates(objective: ObjectiveId, current: BotMix, t: BattleRoyaleTelemetry): BotStrategyCandidate[] {
  const newEarly = Math.round(t.cohorts.new.earlyElimination * 100);
  switch (objective) {
    case "competitive_pressure":
      return [
        s("A", L("Late Sentinels", "后期哨卫"),
          L("Rule: skilled profiles survive uncontested late, so add ground-holding sentinels.", "规则：高手后期缺少对抗，加入占点的哨卫。"),
          L("Sentinels activate from phase 3 and ambush rotations, where skilled profiles spend the late game.", "哨卫从第 3 阶段开始活跃并伏击转点，正是高手后期的活动区域。"),
          mix(30, 20, 0, 50, 0)),
        s("B", L("Hunter Pack", "猎手小队"),
          L("Rule: more hunters create more targeted engagements.", "规则：更多猎手带来更多针对性交战。"),
          L("Hunters prefer weaker targets, so this raises encounters but may hit new profiles.", "猎手偏好弱目标，会增加交战，但可能波及新玩家。"),
          mix(30, 45, 15, 10, 0)),
        s("C", L("Balanced Aggro", "均衡进攻"),
          L("Rule: spread aggression across archetypes.", "规则：把攻击性分散到各类机器人。"),
          L("An even mix keeps pressure on all phases without a single dominant style.", "均衡的配比让各阶段都有压力，且没有单一主导风格。"),
          mix(25, 20, 20, 20, 15)),
      ];
    case "faster_matches":
      return [
        s("A", L("Fewer Campers", "减少蹲守"),
          L("Rule: passive survival is high, so replace survivors with active bots.", "规则：消极存活偏高，用主动型机器人替换生存者。"),
          L("Survivors and looters avoid fights; converting them to rushers raises encounter frequency.", "生存者和搜刮者回避战斗；改为突击者可提高交战频率。"),
          mix(60, 25, 5, 10, 0)),
        s("B", L("Mid-Game Hunters", "中期猎手"),
          L("Rule: add hunters to force mid-match engagements.", "规则：加入猎手以强制中期交战。"),
          L("Hunters stay engaged after the drop and keep the lobby moving.", "猎手在落地后持续交战，推动对局节奏。"),
          mix(40, 40, 10, 10, 0)),
        s("C", L("Zone Holders", "守圈者"),
          L("Rule: sentinels contest rotations late.", "规则：哨卫在后期争夺转点路线。"),
          L("Sentinels punish passive late-game rotation.", "哨卫惩罚后期的消极转点。"),
          mix(45, 15, 5, 35, 0)),
      ];
    case "balanced_population":
      return [
        s("A", L("Even Spread", "平均分布"),
          L("Rule: disparity is extreme, so flatten the mix.", "规则：差距极端，应拉平配比。"),
          L("An even population avoids any one style dominating a cohort.", "均衡的机器人构成可避免某一风格压制某个群体。"),
          mix(20, 20, 20, 20, 20)),
        s("B", L("Fewer Hunters", "减少猎手"),
          L("Rule: hunters target the weakest, widening the gap.", "规则：猎手专挑最弱目标，拉大差距。"),
          L("Removing hunters reduces targeted pressure on new profiles.", "移除猎手可减少针对新玩家的压力。"),
          mix(35, 0, 30, 20, 15)),
        s("C", L("Survivor Lobby", "生存者大厅"),
          L("Rule: survivors reduce fights for everyone.", "规则：生存者会减少所有人的交战。"),
          L("Fewer fights compresses outcome spread, but may flatten skill expression.", "更少的交战会压缩结果差距，但可能削弱技术表现。"),
          mix(10, 5, 50, 15, 20)),
      ];
    case "beginner_onboarding":
    default:
      return [
        s("A", L("Softer Opening", "温和开局"),
          L(`Rule: NEW early elimination is ${newEarly}%, so move rusher share into survivors.`, `规则：新玩家早期淘汰率为 ${newEarly}%，将突击者份额转给生存者。`),
          L("Fewer hot-drop rushers should reduce phase 1–2 engagements; hunters are left unchanged.", "减少落地刚枪的突击者应能减少第 1–2 阶段交战；猎手保持不变。"),
          mix(Math.max(0, current.rusher - 35), current.hunter, current.survivor + 35, current.sentinel, current.looter)),
        s("B", L("Late-Pressure Mix", "后期施压组合"),
          L("Rule: shift early aggression into sentinels, which activate from phase 3.", "规则：把早期攻击性转移到从第 3 阶段才活跃的哨卫。"),
          L("Keeps combat pressure for average and skilled profiles later while protecting the opening.", "保护开局的同时，在后期对普通玩家和高手保持战斗压力。"),
          mix(15, 10, 30, 35, 10)),
        s("C", L("Low Aggression", "低攻击性"),
          L("Rule: replace most aggressive bots with looters and survivors.", "规则：用搜刮者和生存者替换大部分进攻型机器人。"),
          L("Minimises early bot pressure; risks making bots harmless.", "最大限度降低早期机器人压力；但有让机器人失去威胁的风险。"),
          mix(10, 5, 40, 0, 45)),
      ];
  }
}
