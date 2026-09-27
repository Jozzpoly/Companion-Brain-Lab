import { describe, expect, it } from "vitest";
import {
  evaluateCombatTakeoverShadow,
  type CombatTakeoverShadowDecision
} from "./combat-takeover-shadow";
import {
  initialCombatMicroSnapshot,
  type CombatMicroSnapshot
} from "../world/combat-micro-contract";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";

const rules = {
  strikeRange: 1.05,
  attackRange: 0.8,
  pressureBreakRange: 1.25,
  pressureTicks: 72,
  recoveryTicks: 42,
  hostileHealth: 3,
  strikeDamage: 1
} as const;

function actor(id: ActorSnapshot["id"], x: number): ActorSnapshot {
  return {
    id,
    position: { x, y: 0 },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(companionX = 0.8, hostileX = 0): WorldSnapshot {
  return {
    tick: 42,
    scenarioId: "squad-field-lab-combat-micro",
    width: 16,
    height: 10,
    actors: [
      actor("player", 0.6),
      actor("companion", companionX),
      actor("hostile", hostileX)
    ],
    obstacles: []
  };
}

function combat(
  phase: CombatMicroSnapshot["phase"],
  targetActorId: CombatMicroSnapshot["targetActorId"] = "player",
  phaseTicksRemaining = phase === "PRESSURING" ? 40 : phase === "RECOVERING" ? 20 : 0
): CombatMicroSnapshot {
  return {
    ...initialCombatMicroSnapshot(rules),
    phase,
    targetActorId,
    phaseTicksRemaining
  };
}

function decide(input: {
  world?: WorldSnapshot;
  state?: CombatMicroSnapshot | null;
  prepared?: boolean;
} = {}): CombatTakeoverShadowDecision {
  return evaluateCombatTakeoverShadow({
    snapshot: input.world ?? snapshot(),
    combat: input.state === undefined ? combat("PRESSURING", "player") : input.state,
    rules,
    companionPrepared: input.prepared ?? true,
    preparationSource: input.prepared === false ? "FOLLOW" : "HOLD"
  });
}

describe("Combat takeover shadow", () => {
  it("recommends takeover only for the manually qualified prepared in-range player-pressure relation", () => {
    const result = decide();

    expect(result.recommendation).toBe("TAKE_OVER");
    expect(result.reasonCode).toBe("TAKEOVER_CONDITIONS_PRESENT");
    expect(result.evidence.currentBearer).toBe("player");
    expect(result.evidence.companionPrepared).toBe(true);
    expect(result.evidence.companionCanStrikeNow).toBe(true);
    expect(result.actionAttempt).toBeNull();
    expect(result.movementIntent).toBeNull();
    expect(result.runtimeAuthorityClaim).toBe("NONE_SHADOW_OBSERVATION_ONLY");
  });

  it("does not confuse STRIKE availability during APPROACHING with a takeover need", () => {
    const result = decide({ state: combat("APPROACHING", "player") });

    expect(result.evidence.companionCanStrikeNow).toBe(true);
    expect(result.recommendation).toBe("DO_NOT_TAKE_OVER");
    expect(result.reasonCode).toBe("NO_ACTIVE_PRESSURE");
  });

  it("does not recommend takeover when C1 already bears the current pressure", () => {
    const result = decide({ state: combat("PRESSURING", "companion") });

    expect(result.recommendation).toBe("DO_NOT_TAKE_OVER");
    expect(result.reasonCode).toBe("COMPANION_ALREADY_BEARER");
  });

  it("requires explicit preparation rather than treating proximity as readiness", () => {
    const result = decide({ prepared: false });

    expect(result.evidence.companionCanStrikeNow).toBe(true);
    expect(result.recommendation).toBe("DO_NOT_TAKE_OVER");
    expect(result.reasonCode).toBe("COMPANION_NOT_PREPARED");
  });

  it("does not recommend takeover when prepared C1 lacks a current material intervention opportunity", () => {
    const result = decide({ world: snapshot(2.0, 0) });

    expect(result.evidence.companionPrepared).toBe(true);
    expect(result.evidence.companionCanStrikeNow).toBe(false);
    expect(result.recommendation).toBe("DO_NOT_TAKE_OVER");
    expect(result.reasonCode).toBe("COMPANION_OUT_OF_STRIKE_RANGE");
  });

  it("does not use hidden pressure timing as a decision threshold", () => {
    const early = decide({ state: combat("PRESSURING", "player", 71) });
    const late = decide({ state: combat("PRESSURING", "player", 1) });

    expect(early.recommendation).toBe("TAKE_OVER");
    expect(late.recommendation).toBe("TAKE_OVER");
    expect(early.reasonCode).toBe(late.reasonCode);
    expect(early.evidence.phaseTicksRemainingObserved).toBe(71);
    expect(late.evidence.phaseTicksRemainingObserved).toBe(1);
    expect(early.evidence.hiddenTimingUsedForDecision).toBe(false);
    expect(late.evidence.hiddenTimingUsedForDecision).toBe(false);
  });

  it("abstains cleanly when Combat Micro is absent", () => {
    const result = decide({ state: null });

    expect(result.recommendation).toBe("DO_NOT_TAKE_OVER");
    expect(result.reasonCode).toBe("NO_COMBAT_STATE");
    expect(result.evidence.currentBearer).toBeNull();
    expect(result.actionAttempt).toBeNull();
  });
});
