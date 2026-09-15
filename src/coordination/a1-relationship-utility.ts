import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";

const EPSILON = 1e-9;
const ORIENTATION_ALIGNMENT_EPSILON = 1e-6;
const TAU = Math.PI * 2;

export interface A1RadialObjectiveTerm {
  preferredRadius: number;
  sigma: number;
  weight: number;
}

export type A1DirectionalObjectiveTerm =
  | {
    kind: "NONE";
  }
  | {
    kind: "AVOID_FORWARD_HEMISPHERE";
    weight: number;
  }
  | {
    kind: "PREFER_BEARING";
    preferredBearingRadians: number;
    sigmaRadians: number;
    weight: number;
  };

/**
 * Pure semantic objective. It intentionally contains no sampling density,
 * route budget, world geometry or execution policy.
 */
export interface A1RelationshipObjectiveProfile {
  radial: A1RadialObjectiveTerm;
  directional: A1DirectionalObjectiveTerm;
}

/**
 * Observation/projection instrument only. Changing this must not change the
 * direct semantic utility function for the same relative state.
 */
export interface A1RelationshipSamplingConfig {
  directions: number;
  radii: readonly number[];
  nearBestUtilityWindow: number;
}

/**
 * First follow-like research objective only. This is an experiment control,
 * not the identity of the companion and not a universal teammate policy.
 */
export const A1_DEFAULT_RELATIONSHIP_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: {
    preferredRadius: 1.45,
    sigma: 0.45,
    weight: 1
  },
  directional: {
    kind: "AVOID_FORWARD_HEMISPHERE",
    weight: 1
  }
};

/** Initial observation mesh donor from CCC-0; not an architectural invariant. */
export const A1_DEFAULT_RELATIONSHIP_SAMPLING: A1RelationshipSamplingConfig = {
  directions: 32,
  radii: [1.15, 1.45, 1.8],
  nearBestUtilityWindow: 0.2
};

export interface A1RelativeRelationshipState {
  relativeOffset: Vec2;
}

export interface A1RelationshipUtilityEvidence {
  relativeOffset: Vec2;
  radius: number;
  radialUtility: number;
  directionalObjectiveKind: A1DirectionalObjectiveTerm["kind"];
  directionalSemanticsActive: boolean;
  relativeBearingRadians: number | null;
  frontness: number | null;
  directionalUtility: number | null;
  orientationStrength: number;
  effectiveDirectionalWeight: number;
  totalUtility: number;
}

export interface A1RelationshipSemanticSample {
  id: string;
  radiusIndex: number;
  directionIndex: number;
  radius: number;
  relativeBearing: number;
  relativeOffset: Vec2;
  utility: A1RelationshipUtilityEvidence;
  semanticEligible: boolean;
}

export interface A1RelationshipSemanticField {
  kind: "A1_RELATIVE_SEMANTIC_FIELD";
  sourceTick: number;
  orientationSource: A1RelationshipOrientationEvidence["source"];
  orientationSourceTick: number | null;
  orientationAgeTicks: number | null;
  orientationStrength: number;
  samplingBasis: Vec2;
  samplingBasisSource: A1RelationshipOrientationEvidence["samplingBasisSource"];
  objective: A1RelationshipObjectiveProfile;
  sampling: A1RelationshipSamplingConfig;
  sampleDirections: number;
  sampleRadii: readonly number[];
  bestUtility: number;
  nearBestUtilityFloor: number;
  samples: readonly A1RelationshipSemanticSample[];
  semanticEligibleSampleIds: readonly string[];
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function normalized(value: Vec2, label: string): Vec2 {
  const vector = finiteVector(value, label);
  const length = magnitude(vector);
  if (length <= EPSILON) throw new Error(`${label} requires a nonzero direction.`);
  return { x: vector.x / length, y: vector.y / length };
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
  return value;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be non-negative and finite.`);
  return value;
}

function cloneObjective(objective: A1RelationshipObjectiveProfile): A1RelationshipObjectiveProfile {
  const radial = {
    preferredRadius: finitePositive(objective.radial.preferredRadius, "A1 objective preferred radius"),
    sigma: finitePositive(objective.radial.sigma, "A1 objective radial sigma"),
    weight: finitePositive(objective.radial.weight, "A1 objective radial weight")
  };

  if (objective.directional.kind === "NONE") {
    return { radial, directional: { kind: "NONE" } };
  }
  if (objective.directional.kind === "AVOID_FORWARD_HEMISPHERE") {
    return {
      radial,
      directional: {
        kind: "AVOID_FORWARD_HEMISPHERE",
        weight: finiteNonNegative(objective.directional.weight, "A1 forward-avoidance weight")
      }
    };
  }
  if (objective.directional.kind === "PREFER_BEARING") {
    if (!Number.isFinite(objective.directional.preferredBearingRadians)) {
      throw new Error("A1 preferred bearing must be finite.");
    }
    const sigmaRadians = finitePositive(objective.directional.sigmaRadians, "A1 bearing sigma");
    if (sigmaRadians > Math.PI) throw new Error("A1 bearing sigma must not exceed PI radians.");
    return {
      radial,
      directional: {
        kind: "PREFER_BEARING",
        preferredBearingRadians: objective.directional.preferredBearingRadians,
        sigmaRadians,
        weight: finiteNonNegative(objective.directional.weight, "A1 preferred-bearing weight")
      }
    };
  }
  throw new Error("Unsupported A1 directional objective kind.");
}

function cloneSampling(config: A1RelationshipSamplingConfig): A1RelationshipSamplingConfig {
  if (!Number.isInteger(config.directions) || config.directions < 4) {
    throw new Error("A1 relationship sampling requires at least four directions.");
  }
  if (config.radii.length === 0 || config.radii.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("A1 relationship sampling requires positive finite radii.");
  }
  if (
    !Number.isFinite(config.nearBestUtilityWindow) ||
    config.nearBestUtilityWindow < 0 ||
    config.nearBestUtilityWindow > 1
  ) {
    throw new Error("A1 relationship sampling near-best utility window must be in [0, 1].");
  }
  return {
    directions: config.directions,
    radii: [...config.radii],
    nearBestUtilityWindow: config.nearBestUtilityWindow
  };
}

function validatedOrientation(input: A1RelationshipOrientationEvidence): {
  direction: Vec2 | null;
  strength: number;
  samplingBasis: Vec2;
} {
  if (!Number.isInteger(input.tick) || input.tick < 0) {
    throw new Error("A1 relationship utility requires a non-negative integer orientation tick.");
  }
  if (!Number.isFinite(input.strength) || input.strength < -EPSILON || input.strength > 1 + EPSILON) {
    throw new Error("A1 relationship utility requires orientation strength in [0, 1].");
  }
  const strength = clamp01(input.strength);
  const samplingBasis = normalized(input.samplingBasis, "A1 relationship sampling basis");

  if (input.source === "NONE") {
    if (
      input.direction !== null ||
      input.sourceTick !== null ||
      input.ageTicks !== null ||
      strength > EPSILON ||
      input.samplingBasisSource !== "WORLD_AXIS_SAMPLING_ONLY"
    ) {
      throw new Error("A1 NONE orientation must be semantically directionless and use non-semantic sampling basis provenance.");
    }
    return { direction: null, strength: 0, samplingBasis };
  }

  if (
    !input.direction ||
    input.sourceTick === null ||
    input.ageTicks === null ||
    input.sourceTick + input.ageTicks !== input.tick ||
    input.samplingBasisSource !== "SEMANTIC_ORIENTATION" ||
    strength <= EPSILON
  ) {
    throw new Error("A1 semantic orientation requires aligned source/age provenance, live direction, strength and semantic sampling-basis provenance.");
  }
  const direction = normalized(input.direction, "A1 relationship semantic orientation");
  if (dot(direction, samplingBasis) < 1 - ORIENTATION_ALIGNMENT_EPSILON) {
    throw new Error("A1 semantic sampling basis must align with the semantic orientation direction.");
  }
  return {
    direction,
    strength,
    samplingBasis
  };
}

function wrapSignedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function bearingRelativeToOrientation(relativeDirection: Vec2, forward: Vec2): number {
  const positivePerpendicular = { x: -forward.y, y: forward.x };
  return Math.atan2(
    dot(relativeDirection, positivePerpendicular),
    dot(relativeDirection, forward)
  );
}

function directionalUtility(input: {
  objective: A1DirectionalObjectiveTerm;
  relativeDirection: Vec2;
  orientationDirection: Vec2;
}): {
  relativeBearingRadians: number;
  frontness: number | null;
  utility: number | null;
  weight: number;
} {
  const relativeBearingRadians = bearingRelativeToOrientation(
    input.relativeDirection,
    input.orientationDirection
  );

  if (input.objective.kind === "NONE") {
    return {
      relativeBearingRadians,
      frontness: null,
      utility: null,
      weight: 0
    };
  }
  if (input.objective.kind === "AVOID_FORWARD_HEMISPHERE") {
    const frontness = Math.max(0, dot(input.relativeDirection, input.orientationDirection));
    return {
      relativeBearingRadians,
      frontness,
      utility: 1 - frontness * frontness,
      weight: input.objective.weight
    };
  }

  const bearingError = wrapSignedAngle(
    relativeBearingRadians - input.objective.preferredBearingRadians
  );
  const normalizedError = bearingError / input.objective.sigmaRadians;
  return {
    relativeBearingRadians,
    frontness: null,
    utility: Math.exp(-0.5 * normalizedError * normalizedError),
    weight: input.objective.weight
  };
}

export function evaluateA1RelationshipUtility(input: {
  state: A1RelativeRelationshipState;
  orientation: A1RelationshipOrientationEvidence;
  objective?: A1RelationshipObjectiveProfile;
}): A1RelationshipUtilityEvidence {
  const objective = cloneObjective(input.objective ?? A1_DEFAULT_RELATIONSHIP_OBJECTIVE);
  const relativeOffset = finiteVector(input.state.relativeOffset, "A1 relative relationship state");
  const radius = magnitude(relativeOffset);
  const radialDelta = (radius - objective.radial.preferredRadius) / objective.radial.sigma;
  const radialUtility = Math.exp(-0.5 * radialDelta * radialDelta);
  const orientation = validatedOrientation(input.orientation);

  let relativeBearingRadians: number | null = null;
  let frontness: number | null = null;
  let directionalValue: number | null = null;
  let effectiveDirectionalWeight = 0;

  if (orientation.direction && radius > EPSILON && orientation.strength > EPSILON) {
    const relativeDirection = {
      x: relativeOffset.x / radius,
      y: relativeOffset.y / radius
    };
    const directional = directionalUtility({
      objective: objective.directional,
      relativeDirection,
      orientationDirection: orientation.direction
    });
    relativeBearingRadians = directional.relativeBearingRadians;
    frontness = directional.frontness;
    directionalValue = directional.utility;
    effectiveDirectionalWeight = directional.weight * orientation.strength;
  }

  const directionalSemanticsActive =
    directionalValue !== null && effectiveDirectionalWeight > EPSILON;
  const totalWeight = objective.radial.weight + effectiveDirectionalWeight;
  const weightedUtility =
    objective.radial.weight * radialUtility +
    effectiveDirectionalWeight * (directionalValue ?? 1);
  const totalUtility = clamp01(weightedUtility / totalWeight);

  return {
    relativeOffset,
    radius,
    radialUtility,
    directionalObjectiveKind: objective.directional.kind,
    directionalSemanticsActive,
    relativeBearingRadians,
    frontness,
    directionalUtility: directionalValue,
    orientationStrength: orientation.strength,
    effectiveDirectionalWeight,
    totalUtility
  };
}

function addBasisScaled(forward: Vec2, perpendicular: Vec2, bearing: number, radius: number): Vec2 {
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  return {
    x: (forward.x * cos + perpendicular.x * sin) * radius,
    y: (forward.y * cos + perpendicular.y * sin) * radius
  };
}

export function sampleA1RelationshipSemanticField(input: {
  orientation: A1RelationshipOrientationEvidence;
  objective?: A1RelationshipObjectiveProfile;
  sampling?: A1RelationshipSamplingConfig;
}): A1RelationshipSemanticField {
  const objective = cloneObjective(input.objective ?? A1_DEFAULT_RELATIONSHIP_OBJECTIVE);
  const sampling = cloneSampling(input.sampling ?? A1_DEFAULT_RELATIONSHIP_SAMPLING);
  const orientation = validatedOrientation(input.orientation);
  const forward = orientation.samplingBasis;
  const perpendicular = { x: -forward.y, y: forward.x };
  const samples: A1RelationshipSemanticSample[] = [];

  for (let radiusIndex = 0; radiusIndex < sampling.radii.length; radiusIndex += 1) {
    const radius = sampling.radii[radiusIndex];
    if (radius === undefined) continue;

    for (let directionIndex = 0; directionIndex < sampling.directions; directionIndex += 1) {
      const relativeBearing = (directionIndex / sampling.directions) * TAU;
      const relativeOffset = addBasisScaled(forward, perpendicular, relativeBearing, radius);
      const utility = evaluateA1RelationshipUtility({
        state: { relativeOffset },
        orientation: input.orientation,
        objective
      });
      samples.push({
        id: `r${radiusIndex}.b${directionIndex}`,
        radiusIndex,
        directionIndex,
        radius,
        relativeBearing,
        relativeOffset,
        utility,
        semanticEligible: false
      });
    }
  }

  const bestUtility = samples.reduce((best, sample) => Math.max(best, sample.utility.totalUtility), 0);
  const nearBestUtilityFloor = clamp01(bestUtility - sampling.nearBestUtilityWindow);
  const semanticEligibleSampleIds: string[] = [];
  for (const sample of samples) {
    sample.semanticEligible = sample.utility.totalUtility + EPSILON >= nearBestUtilityFloor;
    if (sample.semanticEligible) semanticEligibleSampleIds.push(sample.id);
  }

  return {
    kind: "A1_RELATIVE_SEMANTIC_FIELD",
    sourceTick: input.orientation.tick,
    orientationSource: input.orientation.source,
    orientationSourceTick: input.orientation.sourceTick,
    orientationAgeTicks: input.orientation.ageTicks,
    orientationStrength: orientation.strength,
    samplingBasis: { ...orientation.samplingBasis },
    samplingBasisSource: input.orientation.samplingBasisSource,
    objective,
    sampling,
    sampleDirections: sampling.directions,
    sampleRadii: [...sampling.radii],
    bestUtility,
    nearBestUtilityFloor,
    samples,
    semanticEligibleSampleIds
  };
}
