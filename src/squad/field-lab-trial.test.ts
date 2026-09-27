import { describe, expect, it } from "vitest";
import type { CombatTakeoverShadowDecision } from "../brain/combat-takeover-shadow";
import type { CombatMicroSnapshot } from "../world/combat-micro-contract";
import type { FieldLabTrialFrame } from "./field-lab-trial";
import {
  compareFieldLabTrials,
  createFieldLabTrialRecord,
  summarizeFieldLabTrial
} from "./field-lab-trial";

function frame(
  tick: number,
  x: number,
  targetError: number,
  status: "MOVING" | "BLOCKED" | "ARRIVED",
  contactCount = 0
): FieldLabTrialFrame {
  return {
    tick,
    playerPosition: { x: 0, y: 0 },
    cooperativeOutcome: "NONE",
    combatMicro: null,
    combatTakeoverShadow: null,
    members: [{
      memberId: "companion",
      position: { x, y: 0 },
      target: { x: 5, y: 0 },
      targetError,
      authority: "FORMATION",
      orderMode: "MOVE",
      requestedVelocity: { x: 2, y: 0 },
      actualVelocity: { x: status === "BLOCKED" ? 0 : 1, y: 0 },
      motionError: status === "BLOCKED" ? 1 : 0.1,
      contactCount,
      status
    }]
  };
}

function combatSnapshot(input: {
  phase: CombatMicroSnapshot["phase"];
  hostileHealth: number;
  targetActorId: CombatMicroSnapshot["targetActorId"];
  playerHits?: number;
  companionHits?: number;
  lastOutcome?: CombatMicroSnapshot["lastOutcome"];
  lastOutcomeTick?: number | null;
  successfulStrikeHistory?: CombatMicroSnapshot["successfulStrikeHistory"];
}): CombatMicroSnapshot {
  const history = [...(input.successfulStrikeHistory ?? [])];
  return {
    phase: input.phase,
    phaseTicksRemaining:
      input.phase === "PRESSURING" || input.phase === "RECOVERING" ? 10 : 0,
    hostileHealth: input.hostileHealth,
    targetActorId: input.targetActorId,
    actorHitCounts: {
      player: input.playerHits ?? 0,
      companion: input.companionHits ?? 0
    },
    lastHitActorId:
      input.lastOutcome === "ACTOR_HIT" ? input.targetActorId : null,
    lastOutcome: input.lastOutcome ?? "NONE",
    lastOutcomeTick: input.lastOutcomeTick ?? null,
    lastSuccessfulStrikers:
      input.lastOutcome === "HOSTILE_STRUCK" && history.length > 0
        ? [history[history.length - 1]!]
        : [],
    successfulStrikeHistory: history
  };
}

function combatFrame(
  tick: number,
  combatMicro: CombatMicroSnapshot
): FieldLabTrialFrame {
  return {
    ...frame(tick, tick, 5 - Math.min(tick, 4), "MOVING"),
    combatMicro
  };
}

function shadowDecision(
  tick: number,
  recommendation: CombatTakeoverShadowDecision["recommendation"],
  reasonCode: CombatTakeoverShadowDecision["reasonCode"]
): CombatTakeoverShadowDecision {
  return {
    kind: "COMBAT_TAKEOVER_SHADOW",
    tick,
    recommendation,
    reasonCode,
    reason: reasonCode,
    evidence: {
      phase: recommendation === "TAKE_OVER" ? "PRESSURING" : "APPROACHING",
      currentBearer: "player",
      companionPrepared: true,
      preparationSource: "FIELD_LAB_HOLD",
      companionToHostileDistance: 0.8,
      strikeRange: 1.05,
      companionCanStrikeNow: true,
      phaseTicksRemainingObserved: recommendation === "TAKE_OVER" ? 40 : 0,
      hiddenTimingUsedForDecision: false
    },
    actionAttempt: null,
    movementIntent: null,
    runtimeAuthorityClaim: "NONE_SHADOW_OBSERVATION_ONLY"
  };
}

function shadowFrame(
  tick: number,
  recommendation: CombatTakeoverShadowDecision["recommendation"],
  reasonCode: CombatTakeoverShadowDecision["reasonCode"]
): FieldLabTrialFrame {
  return {
    ...frame(tick, tick, 5 - Math.min(tick, 4), "MOVING"),
    combatTakeoverShadow: shadowDecision(tick, recommendation, reasonCode)
  };
}

describe("Field Lab trial traces", () => {
  it("summarizes trajectory, target error and blocked/contact intervals", () => {
    const trial = createFieldLabTrialRecord({
      slot: "A",
      label: "doorway slow",
      startedAtTick: 10,
      frames: [
        frame(11, 0, 5, "MOVING"),
        frame(12, 1, 4, "BLOCKED", 1),
        frame(13, 1, 4, "BLOCKED", 2),
        frame(14, 2, 3, "MOVING")
      ],
      events: [{
        tick: 12,
        category: "FORMATION",
        scope: "GROUP",
        path: "spacingScale",
        before: "1.00",
        after: "0.80"
      }]
    });

    const summary = summarizeFieldLabTrial(trial);
    const companion = summary.members[0]!;

    expect(summary.frameCount).toBe(4);
    expect(summary.endedAtTick).toBe(14);
    expect(summary.events).toEqual([{
      tick: 12,
      category: "FORMATION",
      scope: "GROUP",
      path: "spacingScale",
      before: "1.00",
      after: "0.80"
    }]);
    expect(companion.pathDistance).toBeCloseTo(2);
    expect(companion.meanTargetError).toBeCloseTo(4);
    expect(companion.maxTargetError).toBeCloseTo(5);
    expect(companion.blockedTicks).toBe(2);
    expect(companion.longestBlockedRun).toBe(2);
    expect(companion.blockedEpisodes).toBe(1);
    expect(companion.firstBlockedTickOffset).toBe(2);
    expect(companion.lastBlockedTickOffset).toBe(3);
    expect(companion.contactTicks).toBe(2);
    expect(companion.firstContactTickOffset).toBe(2);
    expect(companion.firstArrivedTickOffset).toBeNull();
    expect(companion.finalStatus).toBe("MOVING");
    expect(companion.finalTargetError).toBeCloseTo(3);
  });

  it("compares B against A without assigning a winner", () => {
    const a = createFieldLabTrialRecord({
      slot: "A",
      label: "A",
      startedAtTick: 0,
      frames: [
        frame(1, 0, 5, "MOVING"),
        frame(2, 1, 4, "BLOCKED"),
        frame(3, 1, 4, "BLOCKED")
      ]
    });
    const b = createFieldLabTrialRecord({
      slot: "B",
      label: "B",
      startedAtTick: 0,
      frames: [
        frame(1, 0, 5, "MOVING"),
        frame(2, 2, 3, "MOVING"),
        frame(3, 4, 1, "ARRIVED")
      ]
    });

    const comparison = compareFieldLabTrials(a, b);
    const companion = comparison.members[0]!;

    expect(companion.pathDistanceDelta).toBeCloseTo(3);
    expect(companion.meanTargetErrorDelta).toBeCloseTo(-4 / 3);
    expect(companion.blockedTicksDelta).toBe(-2);
    expect(companion.longestBlockedRunDelta).toBe(-2);
    const aSummary = comparison.a.members[0]!;
    const bSummary = comparison.b.members[0]!;
    expect(aSummary.firstBlockedTickOffset).toBe(2);
    expect(aSummary.finalStatus).toBe("BLOCKED");
    expect(bSummary.firstBlockedTickOffset).toBeNull();
    expect(bSummary.firstArrivedTickOffset).toBe(3);
    expect(bSummary.finalStatus).toBe("ARRIVED");
    expect(bSummary.finalTargetError).toBeCloseTo(1);
  });

  it("summarizes and compares combat responsibility over time without selecting a winner", () => {
    const initial = combatSnapshot({
      phase: "APPROACHING",
      hostileHealth: 3,
      targetActorId: "player"
    });

    const a = createFieldLabTrialRecord({
      slot: "A",
      label: "no combat intervention",
      startedAtTick: 0,
      initialCombatMicro: initial,
      frames: [
        combatFrame(1, initial),
        combatFrame(2, initial),
        combatFrame(3, initial),
        combatFrame(4, initial)
      ]
    });

    const b = createFieldLabTrialRecord({
      slot: "B",
      label: "C1 takes responsibility",
      startedAtTick: 0,
      initialCombatMicro: initial,
      frames: [
        combatFrame(1, combatSnapshot({
          phase: "RECOVERING",
          hostileHealth: 2,
          targetActorId: "companion",
          lastOutcome: "HOSTILE_STRUCK",
          lastOutcomeTick: 1,
          successfulStrikeHistory: ["companion"]
        })),
        combatFrame(2, combatSnapshot({
          phase: "APPROACHING",
          hostileHealth: 2,
          targetActorId: "companion",
          lastOutcome: "HOSTILE_STRUCK",
          lastOutcomeTick: 1,
          successfulStrikeHistory: ["companion"]
        })),
        combatFrame(3, combatSnapshot({
          phase: "PRESSURING",
          hostileHealth: 2,
          targetActorId: "companion",
          lastOutcome: "HOSTILE_STRUCK",
          lastOutcomeTick: 1,
          successfulStrikeHistory: ["companion"]
        })),
        combatFrame(4, combatSnapshot({
          phase: "RECOVERING",
          hostileHealth: 2,
          targetActorId: "companion",
          companionHits: 1,
          lastOutcome: "ACTOR_HIT",
          lastOutcomeTick: 4,
          successfulStrikeHistory: ["companion"]
        }))
      ]
    });

    const bSummary = summarizeFieldLabTrial(b).combatMicro!;
    expect(bSummary.initialPhase).toBe("APPROACHING");
    expect(bSummary.finalPhase).toBe("RECOVERING");
    expect(bSummary.hostileDamage).toBe(1);
    expect(bSummary.initialTargetActorId).toBe("player");
    expect(bSummary.finalTargetActorId).toBe("companion");
    expect(bSummary.targetTransitions).toBe(1);
    expect(bSummary.phaseTransitions).toBe(4);
    expect(bSummary.targetTicks).toEqual({ player: 0, companion: 4 });
    expect(bSummary.actorHitDelta).toEqual({ player: 0, companion: 1 });
    expect(bSummary.successfulStrikesAdded).toEqual(["companion"]);
    expect(bSummary.outcomeEvents).toEqual({
      HOSTILE_STRUCK: 1,
      ACTOR_HIT: 1
    });

    const comparison = compareFieldLabTrials(a, b).combatMicro!;
    expect(comparison.hostileDamageDelta).toBe(1);
    expect(comparison.playerTargetTicksDelta).toBe(-4);
    expect(comparison.companionTargetTicksDelta).toBe(4);
    expect(comparison.targetTransitionsDelta).toBe(1);
    expect(comparison.phaseTransitionsDelta).toBe(4);
    expect(comparison.playerHitDeltaDelta).toBe(0);
    expect(comparison.companionHitDeltaDelta).toBe(1);
    expect(comparison.successfulStrikeCountDelta).toBe(1);
  });

  it("summarizes and compares zero-authority takeover shadow windows over time", () => {
    const a = createFieldLabTrialRecord({
      slot: "A",
      label: "no takeover opportunity",
      startedAtTick: 0,
      frames: [
        shadowFrame(1, "DO_NOT_TAKE_OVER", "NO_ACTIVE_PRESSURE"),
        shadowFrame(2, "DO_NOT_TAKE_OVER", "NO_ACTIVE_PRESSURE"),
        shadowFrame(3, "DO_NOT_TAKE_OVER", "NO_ACTIVE_PRESSURE"),
        shadowFrame(4, "DO_NOT_TAKE_OVER", "NO_ACTIVE_PRESSURE")
      ]
    });
    const b = createFieldLabTrialRecord({
      slot: "B",
      label: "bounded takeover window",
      startedAtTick: 0,
      frames: [
        shadowFrame(1, "DO_NOT_TAKE_OVER", "NO_ACTIVE_PRESSURE"),
        shadowFrame(2, "TAKE_OVER", "TAKEOVER_CONDITIONS_PRESENT"),
        shadowFrame(3, "TAKE_OVER", "TAKEOVER_CONDITIONS_PRESENT"),
        shadowFrame(4, "DO_NOT_TAKE_OVER", "COMPANION_ALREADY_BEARER")
      ]
    });

    const aSummary = summarizeFieldLabTrial(a).combatTakeoverShadow!;
    expect(aSummary.takeOverTicks).toBe(0);
    expect(aSummary.firstTakeOverTickOffset).toBeNull();
    expect(aSummary.takeOverEpisodes).toBe(0);
    expect(aSummary.recommendationTransitions).toBe(0);
    expect(aSummary.reasonTicks).toEqual({ NO_ACTIVE_PRESSURE: 4 });

    const bSummary = summarizeFieldLabTrial(b).combatTakeoverShadow!;
    expect(bSummary.takeOverTicks).toBe(2);
    expect(bSummary.doNotTakeOverTicks).toBe(2);
    expect(bSummary.firstTakeOverTickOffset).toBe(2);
    expect(bSummary.lastTakeOverTickOffset).toBe(3);
    expect(bSummary.takeOverEpisodes).toBe(1);
    expect(bSummary.longestTakeOverRun).toBe(2);
    expect(bSummary.recommendationTransitions).toBe(2);
    expect(bSummary.reasonTransitions).toBe(2);
    expect(bSummary.initialRecommendation).toBe("DO_NOT_TAKE_OVER");
    expect(bSummary.finalRecommendation).toBe("DO_NOT_TAKE_OVER");
    expect(bSummary.finalReasonCode).toBe("COMPANION_ALREADY_BEARER");
    expect(bSummary.reasonTicks).toEqual({
      NO_ACTIVE_PRESSURE: 1,
      TAKEOVER_CONDITIONS_PRESENT: 2,
      COMPANION_ALREADY_BEARER: 1
    });

    const comparison = compareFieldLabTrials(a, b).combatTakeoverShadow!;
    expect(comparison.takeOverTicksDelta).toBe(2);
    expect(comparison.takeOverEpisodesDelta).toBe(1);
    expect(comparison.longestTakeOverRunDelta).toBe(2);
    expect(comparison.recommendationTransitionsDelta).toBe(2);
    expect(comparison.reasonTransitionsDelta).toBe(2);
    expect(comparison.firstTakeOverTickOffsetDelta).toBeNull();
    expect(comparison.lastTakeOverTickOffsetDelta).toBeNull();
  });

  it("rejects empty traces rather than manufacturing evidence", () => {
    expect(() => createFieldLabTrialRecord({
      slot: "A",
      label: "empty",
      startedAtTick: 0,
      frames: []
    })).toThrow(/at least one recorded frame/);
  });
});
