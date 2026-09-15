import type { A1Situation } from "./a1-situation";
import type {
  StaticCircleTraversalResult,
  StaticTraversalOptions,
  Vec2
} from "../world/types";

const EPSILON = 1e-9;

export type A1PlayerFutureFamily =
  | "OWNER_REQUEST_CONTINUATION"
  | "BODY_RESPONSE_CONTINUATION"
  | "TRANSITION_HOLD";

export type A1PlayerFutureVelocitySource =
  | "SAME_STEP_OWNER_REQUEST"
  | "CURRENT_OBSERVED_BODY_RESPONSE"
  | "A1_2C_TRANSITION_HOLD_CONTROL";

export type A1TransitionReason =
  | "OWNER_REQUEST_STOPPED"
  | "OWNER_REQUEST_REVERSED"
  | "BODY_CAUSALITY_UNCERTAIN";

export interface A1PlayerFutureStaticFeasibility {
  query: "PLAYER_HARD_RADIUS_STATIC_SWEEP";
  initialOverlapPolicy: "allow-egress";
  radius: number;
  clear: boolean;
  clipped: boolean;
  blockerLabel: string | null;
  intendedEndpoint: Vec2;
  feasibleEndpoint: Vec2;
  intendedDistance: number;
  feasibleDistance: number;
  feasibleFraction: number;
}

export interface A1PlayerFutureHypothesis {
  id: string;
  family: A1PlayerFutureFamily;
  velocityEvidenceSource: A1PlayerFutureVelocitySource;
  sourceTick: number;
  horizonSeconds: number;
  origin: Vec2;
  nominalVelocity: Vec2;
  effectiveVelocity: Vec2;
  bodyMotionProvenance: A1Situation["situated"]["playerMotionProvenance"]["state"] | null;
  transitionReasons: readonly A1TransitionReason[];
  staticFeasibility: A1PlayerFutureStaticFeasibility;
  semanticOrientationAuthority: "NONE_PHYSICAL_FUTURE_ONLY";
  commandAuthorityClaim: "NONE_A1_2C_PREDICTION_ONLY";
  worldLegalityClaim: "STATIC_SWEEP_ONLY_A1_2C";
  dynamicCooperationClaim: "NONE_A1_2C";
}

export interface A1PlayerFutureHypothesisSet {
  kind: "A1_PLAYER_FUTURE_HYPOTHESIS_SET";
  sourceTick: number;
  horizonSeconds: number;
  hypotheses: readonly A1PlayerFutureHypothesis[];
  transitionReasons: readonly A1TransitionReason[];
  aggregationClaim: "NO_AVERAGING_OR_CENTROID_A1_2C";
  commandAuthorityClaim: "NONE_A1_2C_PREDICTION_ONLY";
  worldLegalityClaim: "STATIC_SWEEP_ONLY_A1_2C";
  dynamicCooperationClaim: "NONE_A1_2C";
}

export type A1StaticTraversalQuery = (
  from: Vec2,
  target: Vec2,
  radius: number,
  options?: StaticTraversalOptions
) => StaticCircleTraversalResult;

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function addScaled(origin: Vec2, velocity: Vec2, seconds: number): Vec2 {
  return {
    x: origin.x + velocity.x * seconds,
    y: origin.y + velocity.y * seconds
  };
}

function effectiveVelocity(origin: Vec2, endpoint: Vec2, horizonSeconds: number): Vec2 {
  return {
    x: (endpoint.x - origin.x) / horizonSeconds,
    y: (endpoint.y - origin.y) / horizonSeconds
  };
}

function staticFeasibility(input: {
  origin: Vec2;
  nominalVelocity: Vec2;
  horizonSeconds: number;
  radius: number;
  staticTraversal: A1StaticTraversalQuery;
}): A1PlayerFutureStaticFeasibility {
  const intendedEndpoint = addScaled(input.origin, input.nominalVelocity, input.horizonSeconds);
  const traversal = input.staticTraversal(
    input.origin,
    intendedEndpoint,
    input.radius,
    { initialOverlap: "allow-egress" }
  );

  if (
    vectorDistance(traversal.from, input.origin) > EPSILON ||
    vectorDistance(traversal.to, intendedEndpoint) > EPSILON ||
    Math.abs(traversal.radius - input.radius) > EPSILON
  ) {
    throw new Error("A1.2c static traversal result does not align with the requested player sweep.");
  }
  if (traversal.clear && traversal.blocker) {
    throw new Error("A1.2c static traversal cannot be clear while reporting a blocker.");
  }
  if (!traversal.clear && !traversal.blocker) {
    throw new Error("A1.2c blocked static traversal requires first-blocker evidence.");
  }

  const feasibleEndpoint = traversal.clear
    ? intendedEndpoint
    : { ...traversal.blocker!.hitCenter };
  const feasibleDistance = Math.hypot(
    feasibleEndpoint.x - input.origin.x,
    feasibleEndpoint.y - input.origin.y
  );
  const intendedDistance = Math.hypot(
    intendedEndpoint.x - input.origin.x,
    intendedEndpoint.y - input.origin.y
  );

  return {
    query: "PLAYER_HARD_RADIUS_STATIC_SWEEP",
    initialOverlapPolicy: "allow-egress",
    radius: input.radius,
    clear: traversal.clear,
    clipped: !traversal.clear,
    blockerLabel: traversal.blocker?.label ?? null,
    intendedEndpoint,
    feasibleEndpoint,
    intendedDistance,
    feasibleDistance,
    feasibleFraction: intendedDistance > EPSILON
      ? Math.max(0, Math.min(1, feasibleDistance / intendedDistance))
      : 1
  };
}

function hypothesis(input: {
  family: A1PlayerFutureFamily;
  velocityEvidenceSource: A1PlayerFutureVelocitySource;
  sourceTick: number;
  horizonSeconds: number;
  origin: Vec2;
  nominalVelocity: Vec2;
  radius: number;
  staticTraversal: A1StaticTraversalQuery;
  bodyMotionProvenance: A1PlayerFutureHypothesis["bodyMotionProvenance"];
  transitionReasons?: readonly A1TransitionReason[];
}): A1PlayerFutureHypothesis {
  const nominalVelocity = finiteVector(input.nominalVelocity, `${input.family} nominal velocity`);
  const feasibility = staticFeasibility({
    origin: input.origin,
    nominalVelocity,
    horizonSeconds: input.horizonSeconds,
    radius: input.radius,
    staticTraversal: input.staticTraversal
  });

  return {
    id: input.family.toLowerCase().replaceAll("_", "-"),
    family: input.family,
    velocityEvidenceSource: input.velocityEvidenceSource,
    sourceTick: input.sourceTick,
    horizonSeconds: input.horizonSeconds,
    origin: { ...input.origin },
    nominalVelocity,
    effectiveVelocity: effectiveVelocity(
      input.origin,
      feasibility.feasibleEndpoint,
      input.horizonSeconds
    ),
    bodyMotionProvenance: input.bodyMotionProvenance,
    transitionReasons: [...(input.transitionReasons ?? [])],
    staticFeasibility: feasibility,
    semanticOrientationAuthority: "NONE_PHYSICAL_FUTURE_ONLY",
    commandAuthorityClaim: "NONE_A1_2C_PREDICTION_ONLY",
    worldLegalityClaim: "STATIC_SWEEP_ONLY_A1_2C",
    dynamicCooperationClaim: "NONE_A1_2C"
  };
}

function transitionReasons(situation: A1Situation): A1TransitionReason[] {
  const previousRequested = situation.situated.playerBody.requestedVelocity;
  const sameStepRequested = situation.playerRequestedVelocity.velocity;
  const previousRequestedSpeed = magnitude(previousRequested);
  const sameStepRequestedSpeed = magnitude(sameStepRequested);
  const reasons: A1TransitionReason[] = [];

  if (previousRequestedSpeed > EPSILON && sameStepRequestedSpeed <= EPSILON) {
    reasons.push("OWNER_REQUEST_STOPPED");
  }

  if (
    previousRequestedSpeed > EPSILON &&
    sameStepRequestedSpeed > EPSILON &&
    dot(previousRequested, sameStepRequested) < 0
  ) {
    reasons.push("OWNER_REQUEST_REVERSED");
  }

  const provenance = situation.situated.playerMotionProvenance.state;
  if (
    provenance === "OWNER_CONSTRAINED" ||
    provenance === "EXTERNAL_MOTION_EVIDENT" ||
    provenance === "MIXED_OR_UNCERTAIN"
  ) {
    reasons.push("BODY_CAUSALITY_UNCERTAIN");
  }

  return reasons;
}

/**
 * Builds separate, provenance-preserving player futures for A1.2c.
 *
 * This is prediction evidence only. It does not choose a companion command,
 * reserve dynamic space, or grant body-response velocity semantic orientation
 * authority. Static legality is only a player hard-radius sweep against World
 * static geometry.
 */
export function buildA1PlayerFutureHypotheses(input: {
  situation: A1Situation;
  horizonSeconds: number;
  staticTraversal: A1StaticTraversalQuery;
}): A1PlayerFutureHypothesisSet {
  if (!Number.isFinite(input.horizonSeconds) || input.horizonSeconds <= 0) {
    throw new Error("A1.2c player futures require a positive finite horizonSeconds.");
  }
  if (input.situation.situated.tick !== input.situation.tick) {
    throw new Error("A1.2c situated evidence tick must equal A1 situation tick.");
  }
  if (input.situation.playerRequestedVelocity.sourceTick !== input.situation.tick) {
    throw new Error("A1.2c same-step Owner request must align with A1 situation tick.");
  }
  if (input.situation.situated.playerBody.sourceTick !== input.situation.tick) {
    throw new Error("A1.2c player body evidence must align with A1 situation tick.");
  }
  const capability = input.situation.situated.playerCapability;
  if (capability.actorId !== "player") {
    throw new Error("A1.2c requires player MovementCapability truth.");
  }
  if (!Number.isFinite(capability.radius) || capability.radius <= 0) {
    throw new Error("A1.2c player capability radius must be positive and finite.");
  }

  const origin = finiteVector(
    input.situation.situated.playerBody.position,
    "A1.2c player future origin"
  );
  const reasons = transitionReasons(input.situation);
  const hypotheses: A1PlayerFutureHypothesis[] = [
    hypothesis({
      family: "OWNER_REQUEST_CONTINUATION",
      velocityEvidenceSource: "SAME_STEP_OWNER_REQUEST",
      sourceTick: input.situation.tick,
      horizonSeconds: input.horizonSeconds,
      origin,
      nominalVelocity: input.situation.playerRequestedVelocity.velocity,
      radius: capability.radius,
      staticTraversal: input.staticTraversal,
      bodyMotionProvenance: null
    }),
    hypothesis({
      family: "BODY_RESPONSE_CONTINUATION",
      velocityEvidenceSource: "CURRENT_OBSERVED_BODY_RESPONSE",
      sourceTick: input.situation.tick,
      horizonSeconds: input.horizonSeconds,
      origin,
      nominalVelocity: input.situation.situated.playerBody.actualVelocity,
      radius: capability.radius,
      staticTraversal: input.staticTraversal,
      bodyMotionProvenance: input.situation.situated.playerMotionProvenance.state
    })
  ];

  if (reasons.length > 0) {
    hypotheses.push(hypothesis({
      family: "TRANSITION_HOLD",
      velocityEvidenceSource: "A1_2C_TRANSITION_HOLD_CONTROL",
      sourceTick: input.situation.tick,
      horizonSeconds: input.horizonSeconds,
      origin,
      nominalVelocity: { x: 0, y: 0 },
      radius: capability.radius,
      staticTraversal: input.staticTraversal,
      bodyMotionProvenance: input.situation.situated.playerMotionProvenance.state,
      transitionReasons: reasons
    }));
  }

  return {
    kind: "A1_PLAYER_FUTURE_HYPOTHESIS_SET",
    sourceTick: input.situation.tick,
    horizonSeconds: input.horizonSeconds,
    hypotheses,
    transitionReasons: reasons,
    aggregationClaim: "NO_AVERAGING_OR_CENTROID_A1_2C",
    commandAuthorityClaim: "NONE_A1_2C_PREDICTION_ONLY",
    worldLegalityClaim: "STATIC_SWEEP_ONLY_A1_2C",
    dynamicCooperationClaim: "NONE_A1_2C"
  };
}
