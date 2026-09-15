import type {
  A1PlayerFutureHypothesis,
  A1PlayerFutureHypothesisSet
} from "./a1-player-future-hypotheses";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;

export type A1PlayerFutureInterventionCausalMeaning =
  | "OWNER_REQUEST_PERSISTS_COUNTERFACTUAL"
  | "OWNER_DIRECTED_BODY_RESPONSE_PERSISTS_COUNTERFACTUAL"
  | "TRANSITION_HOLD_COUNTERFACTUAL";

export type A1PlayerFutureInterventionUnresolvedReason =
  | "H2_STATIONARY_IS_OBSERVATION_NOT_QUALIFIED_CONTROL"
  | "H2_OWNER_CONSTRAINED_IS_EFFECT_NOT_CONTROL"
  | "H2_EXTERNAL_MOTION_IS_EFFECT_NOT_CONTROL"
  | "H2_MIXED_CAUSALITY_IS_NOT_QUALIFIED_CONTROL";

interface A1PlayerFutureInterventionCommon {
  futureId: string;
  futureFamily: A1PlayerFutureHypothesis["family"];
  sourceTick: number;
  horizonSeconds: number;
  observedNominalVelocity: Vec2;
  bodyMotionProvenance: A1PlayerFutureHypothesis["bodyMotionProvenance"];
  transitionReasons: readonly A1PlayerFutureHypothesis["transitionReasons"][number][];
  staticFeasibilityUsage: "IGNORED_FOR_INTERVENTION_A1_2H_SAME_PHYSICS_LATER";
  physicsExecutionClaim: "NONE_A1_2H_PURE_CONTRACT";
  commandAuthorityClaim: "NONE_A1_2H";
  runtimeAuthorityClaim: "NONE_A1_2H";
}

export interface A1RehearsablePlayerFutureIntervention extends A1PlayerFutureInterventionCommon {
  status: "REHEARSABLE";
  mode: "REPEAT_WORLD_VELOCITY";
  repeatedVelocity: Vec2;
  causalMeaning: A1PlayerFutureInterventionCausalMeaning;
  unresolvedReason: null;
}

export interface A1UnresolvedPlayerFutureIntervention extends A1PlayerFutureInterventionCommon {
  status: "UNRESOLVED";
  mode: "NONE";
  repeatedVelocity: null;
  causalMeaning: null;
  unresolvedReason: A1PlayerFutureInterventionUnresolvedReason;
}

export type A1PlayerFutureIntervention =
  | A1RehearsablePlayerFutureIntervention
  | A1UnresolvedPlayerFutureIntervention;

export interface A1PlayerFutureInterventionPlan {
  kind: "A1_PLAYER_FUTURE_INTERVENTION_PLAN";
  sourceTick: number;
  horizonSeconds: number;
  interventions: readonly A1PlayerFutureIntervention[];
  futureCount: number;
  rehearsableCount: number;
  unresolvedCount: number;
  aggregationClaim: "NONE_PRESERVE_H1_H2_H3_A1_2H";
  fallbackSubstitutionClaim: "NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT_A1_2H";
  physicsExecutionClaim: "NONE_A1_2H_PURE_CONTRACT";
  commandAuthorityClaim: "NONE_A1_2H";
  runtimeAuthorityClaim: "NONE_A1_2H";
}

function isFiniteVector(value: Vec2): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function validateFutureContract(future: A1PlayerFutureHypothesis): void {
  if (!future.id) throw new Error("A1.2h player future requires a non-empty id.");
  if (!Number.isInteger(future.sourceTick) || future.sourceTick < 0) {
    throw new Error(`A1.2h player future ${future.id} requires a non-negative integer source tick.`);
  }
  if (!Number.isFinite(future.horizonSeconds) || future.horizonSeconds <= 0) {
    throw new Error(`A1.2h player future ${future.id} requires a positive finite horizon.`);
  }
  if (!isFiniteVector(future.nominalVelocity)) {
    throw new Error(`A1.2h player future ${future.id} requires finite nominal velocity.`);
  }
  if (future.commandAuthorityClaim !== "NONE_A1_2C_PREDICTION_ONLY") {
    throw new Error(`A1.2h player future ${future.id} unexpectedly carries command authority.`);
  }
  if (future.semanticOrientationAuthority !== "NONE_PHYSICAL_FUTURE_ONLY") {
    throw new Error(`A1.2h player future ${future.id} unexpectedly carries semantic orientation authority.`);
  }
  if (future.worldLegalityClaim !== "STATIC_SWEEP_ONLY_A1_2C") {
    throw new Error(`A1.2h player future ${future.id} has unexpected A1.2c World-legality provenance.`);
  }
  if (future.dynamicCooperationClaim !== "NONE_A1_2C") {
    throw new Error(`A1.2h player future ${future.id} unexpectedly carries dynamic cooperation.`);
  }

  if (future.family === "OWNER_REQUEST_CONTINUATION") {
    if (future.velocityEvidenceSource !== "SAME_STEP_OWNER_REQUEST") {
      throw new Error("A1.2h H1 requires same-step Owner-request velocity provenance.");
    }
    if (future.bodyMotionProvenance !== null) {
      throw new Error("A1.2h H1 must not borrow body-motion provenance.");
    }
    if (future.transitionReasons.length !== 0) {
      throw new Error("A1.2h H1 must not carry transition-control reasons.");
    }
    return;
  }

  if (future.family === "BODY_RESPONSE_CONTINUATION") {
    if (future.velocityEvidenceSource !== "CURRENT_OBSERVED_BODY_RESPONSE") {
      throw new Error("A1.2h H2 requires current observed body-response provenance.");
    }
    if (future.bodyMotionProvenance === null) {
      throw new Error("A1.2h H2 requires explicit A0 body-motion provenance.");
    }
    if (future.transitionReasons.length !== 0) {
      throw new Error("A1.2h H2 must not carry transition-control reasons.");
    }
    return;
  }

  if (future.velocityEvidenceSource !== "A1_2C_TRANSITION_HOLD_CONTROL") {
    throw new Error("A1.2h H3 requires transition-hold provenance.");
  }
  if (magnitude(future.nominalVelocity) > EPSILON) {
    throw new Error("A1.2h H3 must preserve a zero-velocity transition hold.");
  }
  if (future.transitionReasons.length === 0) {
    throw new Error("A1.2h H3 requires at least one explicit transition reason.");
  }
}

function common(future: A1PlayerFutureHypothesis): A1PlayerFutureInterventionCommon {
  return {
    futureId: future.id,
    futureFamily: future.family,
    sourceTick: future.sourceTick,
    horizonSeconds: future.horizonSeconds,
    observedNominalVelocity: { ...future.nominalVelocity },
    bodyMotionProvenance: future.bodyMotionProvenance,
    transitionReasons: [...future.transitionReasons],
    staticFeasibilityUsage: "IGNORED_FOR_INTERVENTION_A1_2H_SAME_PHYSICS_LATER",
    physicsExecutionClaim: "NONE_A1_2H_PURE_CONTRACT",
    commandAuthorityClaim: "NONE_A1_2H",
    runtimeAuthorityClaim: "NONE_A1_2H"
  };
}

export function classifyA1PlayerFutureIntervention(
  future: A1PlayerFutureHypothesis
): A1PlayerFutureIntervention {
  validateFutureContract(future);
  const base = common(future);

  if (future.family === "OWNER_REQUEST_CONTINUATION") {
    return {
      ...base,
      status: "REHEARSABLE",
      mode: "REPEAT_WORLD_VELOCITY",
      repeatedVelocity: { ...future.nominalVelocity },
      causalMeaning: "OWNER_REQUEST_PERSISTS_COUNTERFACTUAL",
      unresolvedReason: null
    };
  }

  if (future.family === "TRANSITION_HOLD") {
    return {
      ...base,
      status: "REHEARSABLE",
      mode: "REPEAT_WORLD_VELOCITY",
      repeatedVelocity: { x: 0, y: 0 },
      causalMeaning: "TRANSITION_HOLD_COUNTERFACTUAL",
      unresolvedReason: null
    };
  }

  if (future.bodyMotionProvenance === "OWNER_DIRECTED") {
    return {
      ...base,
      status: "REHEARSABLE",
      mode: "REPEAT_WORLD_VELOCITY",
      repeatedVelocity: { ...future.nominalVelocity },
      causalMeaning: "OWNER_DIRECTED_BODY_RESPONSE_PERSISTS_COUNTERFACTUAL",
      unresolvedReason: null
    };
  }

  const unresolvedReason: A1PlayerFutureInterventionUnresolvedReason =
    future.bodyMotionProvenance === "OWNER_CONSTRAINED"
      ? "H2_OWNER_CONSTRAINED_IS_EFFECT_NOT_CONTROL"
      : future.bodyMotionProvenance === "EXTERNAL_MOTION_EVIDENT"
        ? "H2_EXTERNAL_MOTION_IS_EFFECT_NOT_CONTROL"
        : future.bodyMotionProvenance === "MIXED_OR_UNCERTAIN"
          ? "H2_MIXED_CAUSALITY_IS_NOT_QUALIFIED_CONTROL"
          : "H2_STATIONARY_IS_OBSERVATION_NOT_QUALIFIED_CONTROL";

  return {
    ...base,
    status: "UNRESOLVED",
    mode: "NONE",
    repeatedVelocity: null,
    causalMeaning: null,
    unresolvedReason
  };
}

/**
 * Pure A1.2h causal contract. One A1.2c future produces exactly one output.
 * Unresolved evidence is retained instead of being replaced by another future.
 */
export function buildA1PlayerFutureInterventionPlan(
  futures: A1PlayerFutureHypothesisSet
): A1PlayerFutureInterventionPlan {
  if (futures.kind !== "A1_PLAYER_FUTURE_HYPOTHESIS_SET") {
    throw new Error("A1.2h requires the A1.2c player-future set contract.");
  }
  if (!Number.isInteger(futures.sourceTick) || futures.sourceTick < 0) {
    throw new Error("A1.2h future set requires a non-negative integer source tick.");
  }
  if (!Number.isFinite(futures.horizonSeconds) || futures.horizonSeconds <= 0) {
    throw new Error("A1.2h future set requires a positive finite horizon.");
  }
  if (futures.aggregationClaim !== "NO_AVERAGING_OR_CENTROID_A1_2C") {
    throw new Error("A1.2h refuses a player-future set with aggregation authority.");
  }
  if (futures.commandAuthorityClaim !== "NONE_A1_2C_PREDICTION_ONLY") {
    throw new Error("A1.2h refuses a player-future set with command authority.");
  }
  if (futures.worldLegalityClaim !== "STATIC_SWEEP_ONLY_A1_2C") {
    throw new Error("A1.2h requires the qualified A1.2c static-sweep boundary.");
  }
  if (futures.dynamicCooperationClaim !== "NONE_A1_2C") {
    throw new Error("A1.2h refuses a player-future set with dynamic cooperation authority.");
  }

  const ids = new Set<string>();
  const interventions = futures.hypotheses.map((future) => {
    if (ids.has(future.id)) throw new Error(`A1.2h duplicate player-future id: ${future.id}.`);
    ids.add(future.id);
    if (future.sourceTick !== futures.sourceTick) {
      throw new Error(`A1.2h future ${future.id} source tick is misaligned with its set.`);
    }
    if (Math.abs(future.horizonSeconds - futures.horizonSeconds) > EPSILON) {
      throw new Error(`A1.2h future ${future.id} horizon is misaligned with its set.`);
    }
    return classifyA1PlayerFutureIntervention(future);
  });

  const rehearsableCount = interventions.filter((value) => value.status === "REHEARSABLE").length;
  const unresolvedCount = interventions.length - rehearsableCount;

  return {
    kind: "A1_PLAYER_FUTURE_INTERVENTION_PLAN",
    sourceTick: futures.sourceTick,
    horizonSeconds: futures.horizonSeconds,
    interventions,
    futureCount: interventions.length,
    rehearsableCount,
    unresolvedCount,
    aggregationClaim: "NONE_PRESERVE_H1_H2_H3_A1_2H",
    fallbackSubstitutionClaim: "NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT_A1_2H",
    physicsExecutionClaim: "NONE_A1_2H_PURE_CONTRACT",
    commandAuthorityClaim: "NONE_A1_2H",
    runtimeAuthorityClaim: "NONE_A1_2H"
  };
}
