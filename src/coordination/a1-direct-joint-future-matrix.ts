import type { A1DirectCandidateRealization } from "./a1-companion-candidates";
import type {
  A1PlayerFutureHypothesis,
  A1PlayerFutureHypothesisSet
} from "./a1-player-future-hypotheses";
import type { A1Situation } from "./a1-situation";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  a1RelationshipObjectiveSignature,
  evaluateA1RelationshipUtility,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipUtilityEvidence
} from "./a1-relationship-utility";
import type {
  StaticCircleTraversalResult,
  StaticTraversalOptions,
  Vec2
} from "../world/types";

const EPSILON = 1e-8;

export type A1DirectJointMatrixG0 =
  | { status: "PASS"; reasons: readonly [] }
  | { status: "FAIL_EVIDENCE_ALIGNMENT"; reasons: readonly string[] };

export type A1DirectJointMatrixG1 =
  | { status: "PASS_DIRECT_COMMAND_ADMISSIBLE"; reason: string }
  | { status: "FAIL_DIRECT_REALIZATION"; reason: string }
  | { status: "NOT_EVALUATED_G0_FAIL"; reason: string };

export type A1DirectJointMatrixG2 =
  | {
      status: "PASS_STATIC_HARD_LEGALITY";
      reason: string;
      intendedEndpoint: Vec2;
      blockerLabel: null;
    }
  | {
      status: "FAIL_STATIC_HARD_LEGALITY";
      reason: string;
      intendedEndpoint: Vec2;
      blockerLabel: string;
    }
  | {
      status: "NOT_EVALUATED_UPSTREAM_FAIL";
      reason: string;
      intendedEndpoint: null;
      blockerLabel: null;
    };

export interface A1DirectJointFutureRow {
  playerFutureId: string;
  playerFutureFamily: A1PlayerFutureHypothesis["family"];
  playerVelocityEvidenceSource: A1PlayerFutureHypothesis["velocityEvidenceSource"];
  playerStaticClipped: boolean;
  playerEndpoint: Vec2;
  u1Status: "EVALUATED_DIRECT_OBJECTIVE" | "NOT_EVALUATED_G2_FAIL";
  futureRelativeOffset: Vec2 | null;
  futureUtility: A1RelationshipUtilityEvidence | null;
  utilityDelta: number | null;
}

export interface A1DirectJointFutureMatrix {
  kind: "A1_DIRECT_JOINT_FUTURE_MATRIX";
  sourceTick: number;
  horizonSeconds: number;
  candidateId: string;
  candidateFamily: A1DirectCandidateRealization["family"];
  objectiveSignature: string;
  orientationSource: A1RelationshipOrientationEvidence["source"];
  companionOrigin: Vec2;
  companionEndpoint: Vec2 | null;
  g0: A1DirectJointMatrixG0;
  g1: A1DirectJointMatrixG1;
  g2: A1DirectJointMatrixG2;
  currentRelativeOffset: Vec2 | null;
  currentUtility: A1RelationshipUtilityEvidence | null;
  rows: readonly A1DirectJointFutureRow[];
  jointSafetyClaim: "NONE_A1_2D";
  cooperationClaim: "NONE_A1_2D";
  selectionClaim: "NONE_MATRIX_ONLY_A1_2D";
  robustnessAggregationClaim: "NONE_MATRIX_ONLY_A1_2D";
  routeTopologyClaim: "NONE_A1_2D";
  runtimeAuthorityClaim: "NONE_A1_2D";
  temporalPathLegalityClaim: "NONE_DIRECT_ONLY_A1_2D";
}

export type A1DirectJointStaticTraversalQuery = (
  from: Vec2,
  target: Vec2,
  radius: number,
  options?: StaticTraversalOptions
) => StaticCircleTraversalResult;

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(value: Vec2, amount: number): Vec2 {
  return { x: value.x * amount, y: value.y * amount };
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

function g0AlignmentReasons(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
  playerFutures: A1PlayerFutureHypothesisSet;
  orientation: A1RelationshipOrientationEvidence;
}): string[] {
  const reasons: string[] = [];
  const tick = input.situation.tick;
  const horizon = input.realization.horizonSeconds;
  const playerOrigin = input.situation.situated.playerBody.position;

  if (input.situation.situated.tick !== tick) {
    reasons.push("situated evidence tick does not equal A1 situation tick");
  }
  if (input.realization.sourceTick !== tick) {
    reasons.push("DIRECT realization source tick does not equal A1 situation tick");
  }
  if (input.playerFutures.sourceTick !== tick) {
    reasons.push("player-future set source tick does not equal A1 situation tick");
  }
  if (input.orientation.tick !== tick) {
    reasons.push("relationship orientation tick does not equal A1 situation tick");
  }
  if (!approximatelyEqual(input.playerFutures.horizonSeconds, horizon)) {
    reasons.push("player-future and companion-realization horizons differ");
  }
  if (input.playerFutures.commandAuthorityClaim !== "NONE_A1_2C_PREDICTION_ONLY") {
    reasons.push("player-future set carries unexpected command-authority claim");
  }
  if (input.playerFutures.aggregationClaim !== "NO_AVERAGING_OR_CENTROID_A1_2C") {
    reasons.push("player-future set carries unexpected aggregation claim");
  }

  for (const future of input.playerFutures.hypotheses) {
    if (future.sourceTick !== tick) {
      reasons.push(`player future ${future.id} source tick is misaligned`);
    }
    if (!approximatelyEqual(future.horizonSeconds, horizon)) {
      reasons.push(`player future ${future.id} horizon is misaligned`);
    }
    if (vectorDistance(future.origin, playerOrigin) > EPSILON) {
      reasons.push(`player future ${future.id} origin is not current player body position`);
    }
    if (future.commandAuthorityClaim !== "NONE_A1_2C_PREDICTION_ONLY") {
      reasons.push(`player future ${future.id} carries unexpected command-authority claim`);
    }
    if (future.semanticOrientationAuthority !== "NONE_PHYSICAL_FUTURE_ONLY") {
      reasons.push(`player future ${future.id} carries forbidden semantic-orientation authority`);
    }
  }

  return reasons;
}

function g1FailureReason(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
}): string | null {
  const capability = input.situation.situated.companionCapability;
  const realization = input.realization;

  if (realization.kind !== "A1_DIRECT_CANDIDATE_REALIZATION") {
    return "A1.2d accepts DIRECT realization evidence only";
  }
  if (realization.reachabilityClaim !== "DIRECT_COMMAND_ADMISSIBLE_ONLY") {
    return "DIRECT realization does not carry the qualified A1.2b reachability claim";
  }
  if (realization.worldLegalityClaim !== "NONE_A1_2B") {
    return "DIRECT realization unexpectedly claims World legality before G2";
  }
  if (!approximatelyEqual(realization.capabilityMaxSpeed, capability.maxSpeed)) {
    return "DIRECT realization maxSpeed does not match current companion MovementCapability";
  }

  const commandVelocity = finiteVector(realization.commandVelocity, "A1.2d DIRECT command velocity");
  if (magnitude(commandVelocity) > capability.maxSpeed + EPSILON) {
    return "DIRECT command velocity exceeds current companion MovementCapability maxSpeed";
  }

  const predictedDisplacement = finiteVector(
    realization.predictedDisplacement,
    "A1.2d DIRECT predicted displacement"
  );
  const expectedDisplacement = scale(commandVelocity, realization.horizonSeconds);
  if (vectorDistance(predictedDisplacement, expectedDisplacement) > EPSILON) {
    return "DIRECT predicted displacement does not match command velocity over the declared horizon";
  }

  return null;
}

function validatedStaticTraversal(input: {
  result: StaticCircleTraversalResult;
  from: Vec2;
  to: Vec2;
  radius: number;
}): StaticCircleTraversalResult {
  const { result } = input;
  if (
    vectorDistance(result.from, input.from) > EPSILON ||
    vectorDistance(result.to, input.to) > EPSILON ||
    !approximatelyEqual(result.radius, input.radius)
  ) {
    throw new Error("A1.2d static traversal result does not align with the requested companion sweep.");
  }
  if (result.clear && result.blocker) {
    throw new Error("A1.2d static traversal cannot be clear while reporting a blocker.");
  }
  if (!result.clear && !result.blocker) {
    throw new Error("A1.2d blocked static traversal requires first-blocker evidence.");
  }
  return result;
}

function nonEvaluatedRows(playerFutures: A1PlayerFutureHypothesisSet): A1DirectJointFutureRow[] {
  return playerFutures.hypotheses.map((future) => ({
    playerFutureId: future.id,
    playerFutureFamily: future.family,
    playerVelocityEvidenceSource: future.velocityEvidenceSource,
    playerStaticClipped: future.staticFeasibility.clipped,
    playerEndpoint: { ...future.staticFeasibility.feasibleEndpoint },
    u1Status: "NOT_EVALUATED_G2_FAIL",
    futureRelativeOffset: null,
    futureUtility: null,
    utilityDelta: null
  }));
}

function baseClaims() {
  return {
    jointSafetyClaim: "NONE_A1_2D" as const,
    cooperationClaim: "NONE_A1_2D" as const,
    selectionClaim: "NONE_MATRIX_ONLY_A1_2D" as const,
    robustnessAggregationClaim: "NONE_MATRIX_ONLY_A1_2D" as const,
    routeTopologyClaim: "NONE_A1_2D" as const,
    runtimeAuthorityClaim: "NONE_A1_2D" as const,
    temporalPathLegalityClaim: "NONE_DIRECT_ONLY_A1_2D" as const
  };
}

/**
 * A1.2d is a DIRECT-only gate matrix, not a selector.
 *
 * It proves ordering: aligned evidence -> qualified DIRECT command-admissibility
 * -> companion hard-static legality -> direct A1.1 relationship utility per
 * separate player-future hypothesis. A G2-failed candidate is never repaired
 * or scored. Dynamic body safety/cooperation and robustness aggregation remain
 * explicitly outside this slice.
 */
export function evaluateA1DirectJointFutureMatrix(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
  playerFutures: A1PlayerFutureHypothesisSet;
  orientation: A1RelationshipOrientationEvidence;
  objective?: A1RelationshipObjectiveProfile;
  staticTraversal: A1DirectJointStaticTraversalQuery;
}): A1DirectJointFutureMatrix {
  if (!Number.isFinite(input.realization.horizonSeconds) || input.realization.horizonSeconds <= 0) {
    throw new Error("A1.2d DIRECT matrix requires a positive finite realization horizon.");
  }
  const objective = input.objective ?? A1_DEFAULT_RELATIONSHIP_OBJECTIVE;
  const objectiveSignature = a1RelationshipObjectiveSignature(objective);
  const companionOrigin = finiteVector(
    input.situation.situated.companionBody.position,
    "A1.2d companion origin"
  );
  const common = {
    kind: "A1_DIRECT_JOINT_FUTURE_MATRIX" as const,
    sourceTick: input.situation.tick,
    horizonSeconds: input.realization.horizonSeconds,
    candidateId: input.realization.candidateId,
    candidateFamily: input.realization.family,
    objectiveSignature,
    orientationSource: input.orientation.source,
    companionOrigin,
    ...baseClaims()
  };

  const alignmentReasons = g0AlignmentReasons(input);
  if (alignmentReasons.length > 0) {
    return {
      ...common,
      companionEndpoint: null,
      g0: { status: "FAIL_EVIDENCE_ALIGNMENT", reasons: alignmentReasons },
      g1: {
        status: "NOT_EVALUATED_G0_FAIL",
        reason: "DIRECT reachability was not evaluated because evidence alignment failed"
      },
      g2: {
        status: "NOT_EVALUATED_UPSTREAM_FAIL",
        reason: "static legality was not evaluated because G0 failed",
        intendedEndpoint: null,
        blockerLabel: null
      },
      currentRelativeOffset: null,
      currentUtility: null,
      rows: []
    };
  }

  const g1Failure = g1FailureReason(input);
  if (g1Failure) {
    return {
      ...common,
      companionEndpoint: null,
      g0: { status: "PASS", reasons: [] },
      g1: { status: "FAIL_DIRECT_REALIZATION", reason: g1Failure },
      g2: {
        status: "NOT_EVALUATED_UPSTREAM_FAIL",
        reason: "static legality was not evaluated because G1 failed",
        intendedEndpoint: null,
        blockerLabel: null
      },
      currentRelativeOffset: null,
      currentUtility: null,
      rows: []
    };
  }

  const companionEndpoint = add(companionOrigin, input.realization.predictedDisplacement);
  const radius = input.situation.situated.companionCapability.radius;
  const traversal = validatedStaticTraversal({
    result: input.staticTraversal(
      companionOrigin,
      companionEndpoint,
      radius,
      { initialOverlap: "allow-egress" }
    ),
    from: companionOrigin,
    to: companionEndpoint,
    radius
  });

  if (!traversal.clear) {
    const blockerLabel = traversal.blocker!.label;
    return {
      ...common,
      companionEndpoint,
      g0: { status: "PASS", reasons: [] },
      g1: {
        status: "PASS_DIRECT_COMMAND_ADMISSIBLE",
        reason: "qualified A1.2b DIRECT realization matches current companion MovementCapability"
      },
      g2: {
        status: "FAIL_STATIC_HARD_LEGALITY",
        reason: `companion hard-radius DIRECT sweep is blocked by ${blockerLabel}`,
        intendedEndpoint: { ...companionEndpoint },
        blockerLabel
      },
      currentRelativeOffset: null,
      currentUtility: null,
      rows: nonEvaluatedRows(input.playerFutures)
    };
  }

  const playerOrigin = finiteVector(
    input.situation.situated.playerBody.position,
    "A1.2d player origin"
  );
  const currentRelativeOffset = subtract(companionOrigin, playerOrigin);
  const currentUtility = evaluateA1RelationshipUtility({
    state: { relativeOffset: currentRelativeOffset },
    orientation: input.orientation,
    objective
  });
  const rows: A1DirectJointFutureRow[] = input.playerFutures.hypotheses.map((future) => {
    const playerEndpoint = finiteVector(
      future.staticFeasibility.feasibleEndpoint,
      `A1.2d player future ${future.id} endpoint`
    );
    const futureRelativeOffset = subtract(companionEndpoint, playerEndpoint);
    const futureUtility = evaluateA1RelationshipUtility({
      state: { relativeOffset: futureRelativeOffset },
      orientation: input.orientation,
      objective
    });
    return {
      playerFutureId: future.id,
      playerFutureFamily: future.family,
      playerVelocityEvidenceSource: future.velocityEvidenceSource,
      playerStaticClipped: future.staticFeasibility.clipped,
      playerEndpoint,
      u1Status: "EVALUATED_DIRECT_OBJECTIVE",
      futureRelativeOffset,
      futureUtility,
      utilityDelta: futureUtility.totalUtility - currentUtility.totalUtility
    };
  });

  return {
    ...common,
    companionEndpoint,
    g0: { status: "PASS", reasons: [] },
    g1: {
      status: "PASS_DIRECT_COMMAND_ADMISSIBLE",
      reason: "qualified A1.2b DIRECT realization matches current companion MovementCapability"
    },
    g2: {
      status: "PASS_STATIC_HARD_LEGALITY",
      reason: "companion hard-radius DIRECT sweep is clear of static World geometry",
      intendedEndpoint: { ...companionEndpoint },
      blockerLabel: null
    },
    currentRelativeOffset,
    currentUtility,
    rows
  };
}
