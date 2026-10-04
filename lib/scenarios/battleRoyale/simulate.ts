import { createRng, type Rng } from "@/lib/random/seededRandom";
import type { BotArchetype } from "@/lib/simulation/types";
import { BOT_PROFILES, PHASES, type Action, type HumanCohort } from "./config";
import type { BotAgent, HumanProfile } from "./population";

type Agent = {
  id: string;
  kind: "human" | "bot";
  cohort?: HumanCohort;
  archetype?: BotArchetype;
  skill: number;
  awareness: number;
  aggression: number;
  health: number;
  gear: number;
  alive: boolean;
  elimPhase: number | null;
  eliminatedBy: "bot" | "human" | "zone" | null;
  fights: number;
  lateFights: number;
  kills: number;
};

export type AgentOutcome = {
  id: string;
  kind: "human" | "bot";
  cohort?: HumanCohort;
  archetype?: BotArchetype;
  /** Phase of elimination (1–5), or 6 for agents alive at the final circle. */
  survivalPhase: number;
  eliminatedBy: Agent["eliminatedBy"];
  fights: number;
  /** Fights in phases 3–5. */
  lateFights: number;
  kills: number;
};

export type MatchRecord = {
  matchIndex: number;
  outcomes: AgentOutcome[];
  fights: number;
  fightsByPhase: number[];
  aliveAfterPhase: number[];
  winnerId: string;
  winnerKind: "human" | "bot";
};

/** From phase 3 the zone forces the lobby down to these sizes; phases 1–2 are decided by combat alone. */
const ZONE_CAPS = [Infinity, Infinity, 40, 20, 8];
const ZONE_DAMAGE = [0, 0, 14, 22, 32];

const HUMAN_TENDENCIES: Record<HumanCohort, Record<Action, number>> = {
  new: { loot: 0.38, rotate: 0.18, engage: 0.07, avoid: 0.18, hold: 0.13, heal: 0.06 },
  average: { loot: 0.32, rotate: 0.24, engage: 0.13, avoid: 0.12, hold: 0.13, heal: 0.06 },
  skilled: { loot: 0.26, rotate: 0.26, engage: 0.22, avoid: 0.08, hold: 0.12, heal: 0.06 },
};

function power(a: Agent): number {
  return a.skill + 0.3 * a.gear + 0.15 * (a.health / 100);
}

function chooseAction(a: Agent, phase: number, rng: Rng): Action {
  let w: Record<Action, number>;
  if (a.kind === "bot") {
    const p = BOT_PROFILES[a.archetype!];
    w = { ...p.tendencies };
    if (phase < p.activeFromPhase) w.engage *= 0.15;
    if (a.archetype === "rusher" && phase <= 2) w.engage *= 2.4; // hot drop
  } else {
    w = { ...HUMAN_TENDENCIES[a.cohort!] };
    w.engage *= 0.7 + 0.6 * a.aggression;
  }
  w.engage *= 1 + 0.2 * (phase - 1);
  if (a.health < 50) w.heal += 0.3;
  return rng.weighted(w);
}

function pickTarget(attacker: Agent, pool: Agent[], actions: Map<string, Action>, rng: Rng): Agent | null {
  const others = pool.filter((p) => p !== attacker);
  if (!others.length) return null;
  const sample = (n: number) => Array.from({ length: Math.min(n, others.length) }, () => others[Math.floor(rng.next() * others.length)]);
  const mode = attacker.kind === "bot" ? BOT_PROFILES[attacker.archetype!].targeting : "random";
  if (mode === "weakest") return sample(5).reduce((a, b) => (power(b) < power(a) ? b : a));
  if (mode === "rotators") {
    const s = sample(4);
    return s.find((t) => actions.get(t.id) === "rotate" || actions.get(t.id) === "loot") ?? s[0];
  }
  return sample(1)[0];
}

function eliminate(a: Agent, phase: number, by: Agent["eliminatedBy"]) {
  a.alive = false;
  a.health = 0;
  a.elimPhase = phase;
  a.eliminatedBy = by;
}

/**
 * One abstract match. Every draw comes from a (seed, match, phase) stream and
 * agents are processed in a seeded order, so a given seed always replays the
 * same match for the same lobby.
 */
export function simulateMatch(humans: HumanProfile[], bots: BotAgent[], seed: number, matchIndex: number): MatchRecord {
  const agents: Agent[] = [
    ...humans.map((h) => ({ id: h.id, kind: "human" as const, cohort: h.cohort, skill: h.skill, awareness: h.awareness, aggression: h.aggression })),
    ...bots.map((b) => ({ id: b.id, kind: "bot" as const, archetype: b.archetype, skill: b.skill, awareness: b.awareness, aggression: 0.5 })),
  ].map((a) => ({ ...a, health: 100, gear: 0, alive: true, elimPhase: null, eliminatedBy: null, fights: 0, lateFights: 0, kills: 0 }));

  const fightsByPhase: number[] = [];
  const aliveAfterPhase: number[] = [];

  for (let phase = 1; phase <= PHASES; phase++) {
    const rng = createRng(seed, "br-match", matchIndex, phase);
    const order = agents.filter((a) => a.alive);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const actions = new Map<string, Action>();
    for (const a of order) actions.set(a.id, chooseAction(a, phase, rng));

    const fightsThisPhase = new Map<string, number>();
    let fights = 0;
    const attempts = order.flatMap((a) => {
      if (actions.get(a.id) !== "engage") return [];
      const n = a.kind === "bot" ? BOT_PROFILES[a.archetype!].engageAttempts : 1;
      return Array.from({ length: n }, () => a);
    });
    for (const attacker of attempts) {
      if (!attacker.alive || (fightsThisPhase.get(attacker.id) ?? 0) >= 2) continue;
      const pool = order.filter((t) => t.alive && (fightsThisPhase.get(t.id) ?? 0) < 2);
      const target = pickTarget(attacker, pool, actions, rng);
      if (!target) continue;
      const escapeRoll = rng.next();
      if (actions.get(target.id) === "avoid" && escapeRoll < target.awareness * 0.7) continue;

      fights++;
      attacker.fights++;
      target.fights++;
      if (phase >= 3) {
        attacker.lateFights++;
        target.lateFights++;
      }
      fightsThisPhase.set(attacker.id, (fightsThisPhase.get(attacker.id) ?? 0) + 1);
      fightsThisPhase.set(target.id, (fightsThisPhase.get(target.id) ?? 0) + 1);

      const holdBonus = actions.get(target.id) === "hold" ? 0.05 : 0;
      const pAttacker = 1 / (1 + Math.exp(-(power(attacker) + 0.05 - power(target) - holdBonus) * 7));
      const [winner, loser, pWin] = rng.next() < pAttacker ? [attacker, target, pAttacker] : [target, attacker, 1 - pAttacker];
      const lethal = rng.next() < (loser.kind === "human" && loser.cohort === "new" ? 0.9 : 0.75);
      const winnerDamage = (20 + 40 * (1 - pWin)) * rng.range(0.5, 1.2);
      if (lethal) {
        eliminate(loser, phase, winner.kind);
        winner.kills++;
        winner.gear = Math.min(1, winner.gear + 0.15);
      } else {
        loser.health = Math.max(5, loser.health - 60);
      }
      winner.health = Math.max(5, winner.health - winnerDamage);
    }
    fightsByPhase.push(fights);

    // Non-combat actions resolve after encounters.
    for (const a of order) {
      if (!a.alive) continue;
      const act = actions.get(a.id);
      const roll = rng.next();
      if (act === "loot") a.gear = Math.min(1, a.gear + 0.2 * (0.5 + roll));
      if (act === "heal") a.health = Math.min(100, a.health + 35);
      if (act !== "rotate" && ZONE_DAMAGE[phase - 1] > 0) {
        a.health -= ZONE_DAMAGE[phase - 1] * roll * (1.2 - a.awareness);
        if (a.health <= 0) eliminate(a, phase, "zone");
      }
    }

    // Zone closes: if the lobby is above the phase cap, the worst-positioned agents are caught.
    const alive = order.filter((a) => a.alive);
    const excess = alive.length - ZONE_CAPS[phase - 1];
    if (excess > 0) {
      const ranked = alive
        .map((a) => ({ a, s: a.health / 100 + a.awareness + (actions.get(a.id) === "rotate" ? 0.5 : 0) + rng.next() * 0.6 }))
        .sort((x, y) => x.s - y.s || x.a.id.localeCompare(y.a.id));
      for (let k = 0; k < excess; k++) eliminate(ranked[k].a, phase, "zone");
    }
    aliveAfterPhase.push(agents.filter((a) => a.alive).length);
  }

  const finalRng = createRng(seed, "br-final", matchIndex);
  const finalists = agents.filter((a) => a.alive).sort((a, b) => a.id.localeCompare(b.id));
  const winner = finalists.reduce((best, a) => {
    const s = power(a) + finalRng.next() * 0.3;
    return s > best.s ? { a, s } : best;
  }, { a: finalists[0], s: -Infinity }).a;

  return {
    matchIndex,
    outcomes: agents.map((a) => ({
      id: a.id,
      kind: a.kind,
      cohort: a.cohort,
      archetype: a.archetype,
      survivalPhase: a.elimPhase ?? PHASES + 1,
      eliminatedBy: a.eliminatedBy,
      fights: a.fights,
      lateFights: a.lateFights,
      kills: a.kills,
    })),
    fights: fightsByPhase.reduce((s, f) => s + f, 0),
    fightsByPhase,
    aliveAfterPhase,
    winnerId: winner?.id ?? "",
    winnerKind: winner?.kind ?? "bot",
  };
}
