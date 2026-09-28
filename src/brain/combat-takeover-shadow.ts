import type {
  CombatMicroRules,
  CombatMicroSnapshot
} from "../world/combat-micro-contract";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";

export type CombatTakeoverShadowRecommendation =
  | "TAKE_OVER"
  | "DO_NOT_TAKE_OVER";

export type CombatTakeoverShadowReasonCode =
  | "NO_COMBAT_STATE"
  | "NO_ACTIVE_PRESSURE"
  | "COMPANION_ALREADY_BEARER"
  | "COMPANION_NOT_PREPARED"
  | "COMPANION_OUT_OF_STRIKE_RANGE"
  | "TAKEOVER_CONDITIONS_PRESENT";

export interface CombatTakeoverShadowEvidence {
  phase: CombatMicroSnapshot["phase"] | "NONE";
  currentBearer: CombatMicroSnapshot["targetActorId"] | null;
  companionPrepared: boolean;
  preparationSource: string;
  preparationReasonCode: string;
  preparationReason: string;
  companionToHostileDistance: number | null;
  strikeRange: number;
  companionCanStrikeNow: boolean;
  phaseTicksRemainingObserved: number | null;
  hiddenTimingUsedForDecision: false;
}

export interface CombatTakeoverShadowDecision {
  kind: "COMBAT_TAKEOVER_SHADOW";
  tick: number;
  recommendation: CombatTakeoverShadowRecommendation;
  reasonCode: CombatTakeoverShadowReasonCode;
  reason: string;
  evidence: CombatTakeoverShadowEvidence;
  actionAttempt: null;
  movementIntent: null;
  runtimeAuthorityClaim: "NONE_SHADOW_OBSERVATION_ONLY";
}

export interface EvaluateCombatTakeoverShadowInput {
  snapshot: WorldSnapshot;
  combat: CombatMicroSnapshot | null;
  rules: CombatMicroRules;
  companionPrepared: boolean;
  preparationSource: string;
  preparationReasonCode?: string;
  preparationReason?: string;
}

function body(snapshot: WorldSnapshot, id: "companion" | "hostile"): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Combat takeover shadow requires World body ${id}.`);
  return value;
}

function distance(a: ActorSnapshot, b: ActorSnapshot): number {
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

function result(
  input: EvaluateCombatTakeoverShadowInput,
  evidence: CombatTakeoverShadowEvidence,
  recommendation: CombatTakeoverShadowRecommendation,
  reasonCode: CombatTakeoverShadowReasonCode,
  reason: string
): CombatTakeoverShadowDecision {
  return {
    kind: "COMBAT_TAKEOVER_SHADOW",
    tick: input.snapshot.tick,
    recommendation,
    reasonCode,
    reason,
    evidence,
    actionAttempt: null,
    movementIntent: null,
    runtimeAuthorityClaim: "NONE_SHADOW_OBSERVATION_ONLY"
  };
}

/**
 * Zero-authority observer over the manually qualified Combat Micro takeover relation.
 *
 * It answers one narrow question only:
 * "Given the current material state, does C1 have the already-prepared, already-in-range
 * opportunity to take responsibility from a player who is presently under pressure?"
 *
 * It does not approach, STRIKE, schedule a later action, infer hidden timing or mutate World.
 */
export function evaluateCombatTakeoverShadow(
  input: EvaluateCombatTakeoverShadowInput
): CombatTakeoverShadowDecision {
  if (!Number.isFinite(input.rules.strikeRange) || input.rules.strikeRange <= 0) {
    throw new Error("Combat takeover shadow requires finite positive strikeRange.");
  }

  const combat = input.combat;
  if (!combat) {
    return result(
      input,
      {
        phase: "NONE",
        currentBearer: null,
        companionPrepared: input.companionPrepared,
        preparationSource: input.preparationSource,
        preparationReasonCode: input.preparationReasonCode ?? "UNSPECIFIED_PREPARATION_EVIDENCE",
        preparationReason: input.preparationReason ?? "no richer preparation evidence supplied",
        companionToHostileDistance: null,
        strikeRange: input.rules.strikeRange,
        companionCanStrikeNow: false,
        phaseTicksRemainingObserved: null,
        hiddenTimingUsedForDecision: false
      },
      "DO_NOT_TAKE_OVER",
      "NO_COMBAT_STATE",
      "no Combat Micro state exists; there is no bounded takeover question to answer"
    );
  }

  const companion = body(input.snapshot, "companion");
  const hostile = body(input.snapshot, "hostile");
  const companionToHostileDistance = distance(companion, hostile);
  const companionCanStrikeNow =
    companionToHostileDistance <= input.rules.strikeRange + 1e-9;
  const evidence: CombatTakeoverShadowEvidence = {
    phase: combat.phase,
    currentBearer: combat.targetActorId,
    companionPrepared: input.companionPrepared,
    preparationSource: input.preparationSource,
    preparationReasonCode: input.preparationReasonCode ?? "UNSPECIFIED_PREPARATION_EVIDENCE",
    preparationReason: input.preparationReason ?? "no richer preparation evidence supplied",
    companionToHostileDistance,
    strikeRange: input.rules.strikeRange,
    companionCanStrikeNow,
    phaseTicksRemainingObserved: combat.phaseTicksRemaining,
    hiddenTimingUsedForDecision: false
  };

  if (combat.phase !== "PRESSURING") {
    return result(
      input,
      evidence,
      "DO_NOT_TAKE_OVER",
      "NO_ACTIVE_PRESSURE",
      `combat phase is ${combat.phase}; the manually qualified takeover relation requires current material pressure, not mere STRIKE availability`
    );
  }

  if (combat.targetActorId === "companion") {
    return result(
      input,
      evidence,
      "DO_NOT_TAKE_OVER",
      "COMPANION_ALREADY_BEARER",
      "C1 already bears the current pressure; taking over from the player would be semantically false"
    );
  }

  if (!input.companionPrepared) {
    return result(
      input,
      evidence,
      "DO_NOT_TAKE_OVER",
      "COMPANION_NOT_PREPARED",
      "the player bears current pressure, but C1 lacks the explicit prepared availability qualified by the manual campaign"
    );
  }

  if (!companionCanStrikeNow) {
    return result(
      input,
      evidence,
      "DO_NOT_TAKE_OVER",
      "COMPANION_OUT_OF_STRIKE_RANGE",
      `the player bears current pressure and C1 is prepared, but the current ${companionToHostileDistance.toFixed(3)}m distance exceeds the factual ${input.rules.strikeRange.toFixed(3)}m STRIKE range`
    );
  }

  return result(
    input,
    evidence,
    "TAKE_OVER",
    "TAKEOVER_CONDITIONS_PRESENT",
    "the player bears current pressure, C1 is explicitly prepared, and C1 has a factual in-range intervention opportunity"
  );
}
