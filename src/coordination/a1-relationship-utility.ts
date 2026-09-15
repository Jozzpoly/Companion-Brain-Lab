import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";

const EPSILON = 1e-9;
const TAU = Math.PI * 2;

export interface A1RelationshipSemanticProfile {
  preferredRadius: number;
  radialSigma: number;
  radialWeight: number;
  directionalWeight: number;
  sampleDirections: number;
  sampleRadii: readonly number[];
  nearBestUtilityWindow: number;
}

/**
 * First research profile only. These values are experiment controls, not a
 * teammate-design invariant. The representation contract is profile-driven so
 * A1.1 can falsify/tune semantics without changing its world/execution seams.
 */
export const A1_DEFAULT_RELATIONSHIP_PROFILE: A1RelationshipSemanticProfile = {
  preferredRadius: 1.45,
  radialSigma: 0.45,
  radialWeight: 1,
  directionalWeight: 1,
  sampleDirections: 32,
  sampleRadii: [1.15, 1.45, 1.8],
  nearBestUtilityWindow: 0.2
};

export interface A1RelativeRelationshipState {
  relativeOffset: Vec2;
}

export interface A1RelationshipUtilityEvidence {
  relativeOffset: Vec2;
  radius: number;
  radialUtility: number;
  directionalSemanticsActive: boolean;
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
  orientationSource: A1RelationshipOrientationEvidence["source"];
  orientationStrength: number;
  samplingBasis: Vec2;
  samplingBasisSource: A1RelationshipOrientationEvidence["samplingBasisSource"];
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

function validatedProfile(profile: A1RelationshipSemanticProfile): A1RelationshipSemanticProfile {
  if (!Number.isFinite(profile.preferredRadius) || profile.preferredRadius <= 0) {
    throw new Error("A1 relationship profile requires a positive finite preferred radius.");
  }
  if (!Number.isFinite(profile.radialSigma) || profile.radialSigma <= 0) {
    throw new Error("A1 relationship profile requires a positive finite radial sigma.");
  }
  if (!Number.isFinite(profile.radialWeight) || profile.radialWeight <= 0) {
    throw new Error("A1 relationship profile requires a positive finite radial weight.");
  }
  if (!Number.isFinite(profile.directionalWeight) || profile.directionalWeight < 0) {
    throw new Error("A1 relationship profile requires a finite non-negative directional weight.");
  }
  if (!Number.isInteger(profile.sampleDirections) || profile.sampleDirections < 4) {
    throw new Error("A1 relationship profile requires at least four sample directions.");
  }
  if (profile.sampleRadii.length === 0 || profile.sampleRadii.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("A1 relationship profile requires positive finite sample radii.");
  }
  if (
    !Number.isFinite(profile.nearBestUtilityWindow) ||
    profile.nearBestUtilityWindow < 0 ||
    profile.nearBestUtilityWindow > 1
  ) {
    throw new Error("A1 relationship profile near-best utility window must be in [0, 1].");
  }
  return {
    ...profile,
    sampleRadii: [...profile.sampleRadii]
  };
}

function validatedOrientation(input: A1RelationshipOrientationEvidence): {
  direction: Vec2 | null;
  strength: number;
  samplingBasis: Vec2;
} {
  if (!Number.isFinite(input.strength) || input.strength < -EPSILON || input.strength > 1 + EPSILON) {
    throw new Error("A1 relationship utility requires orientation strength in [0, 1].");
  }
  const strength = clamp01(input.strength);
  const samplingBasis = normalized(input.samplingBasis, "A1 relationship sampling basis");

  if (input.source === "NONE") {
    if (input.direction !== null || strength > EPSILON || input.samplingBasisSource !== "WORLD_AXIS_SAMPLING_ONLY") {
      throw new Error("A1 NONE orientation must be semantically directionless and use non-semantic sampling basis provenance.");
    }
    return { direction: null, strength: 0, samplingBasis };
  }

  if (!input.direction || input.samplingBasisSource !== "SEMANTIC_ORIENTATION" || strength <= EPSILON) {
    throw new Error("A1 semantic orientation requires a live direction, strength and semantic sampling-basis provenance.");
  }
  return {
    direction: normalized(input.direction, "A1 relationship semantic orientation"),
    strength,
    samplingBasis
  };
}

export function evaluateA1RelationshipUtility(input: {
  state: A1RelativeRelationshipState;
  orientation: A1RelationshipOrientationEvidence;
  profile?: A1RelationshipSemanticProfile;
}): A1RelationshipUtilityEvidence {
  const profile = validatedProfile(input.profile ?? A1_DEFAULT_RELATIONSHIP_PROFILE);
  const relativeOffset = finiteVector(input.state.relativeOffset, "A1 relative relationship state");
  const radius = magnitude(relativeOffset);
  const radialDelta = (radius - profile.preferredRadius) / profile.radialSigma;
  const radialUtility = Math.exp(-0.5 * radialDelta * radialDelta);
  const orientation = validatedOrientation(input.orientation);

  let directionalSemanticsActive = false;
  let frontness: number | null = null;
  let directionalUtility: number | null = null;
  let effectiveDirectionalWeight = 0;

  if (orientation.direction && radius > EPSILON && orientation.strength > EPSILON) {
    const relativeDirection = {
      x: relativeOffset.x / radius,
      y: relativeOffset.y / radius
    };
    frontness = Math.max(0, dot(relativeDirection, orientation.direction));
    directionalUtility = 1 - frontness * frontness;
    effectiveDirectionalWeight = profile.directionalWeight * orientation.strength;
    directionalSemanticsActive = effectiveDirectionalWeight > EPSILON;
  }

  const totalWeight = profile.radialWeight + effectiveDirectionalWeight;
  const weightedUtility =
    profile.radialWeight * radialUtility +
    effectiveDirectionalWeight * (directionalUtility ?? 1);
  const totalUtility = clamp01(weightedUtility / totalWeight);

  return {
    relativeOffset,
    radius,
    radialUtility,
    directionalSemanticsActive,
    frontness,
    directionalUtility,
    orientationStrength: orientation.strength,
    effectiveDirectionalWeight,
    totalUtility
  };
}

function addBasisScaled(forward: Vec2, right: Vec2, bearing: number, radius: number): Vec2 {
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  return {
    x: (forward.x * cos + right.x * sin) * radius,
    y: (forward.y * cos + right.y * sin) * radius
  };
}

export function sampleA1RelationshipSemanticField(input: {
  orientation: A1RelationshipOrientationEvidence;
  profile?: A1RelationshipSemanticProfile;
}): A1RelationshipSemanticField {
  const profile = validatedProfile(input.profile ?? A1_DEFAULT_RELATIONSHIP_PROFILE);
  const orientation = validatedOrientation(input.orientation);
  const forward = orientation.samplingBasis;
  const right = { x: -forward.y, y: forward.x };
  const samples: A1RelationshipSemanticSample[] = [];

  for (let radiusIndex = 0; radiusIndex < profile.sampleRadii.length; radiusIndex += 1) {
    const radius = profile.sampleRadii[radiusIndex];
    if (radius === undefined) continue;

    for (let directionIndex = 0; directionIndex < profile.sampleDirections; directionIndex += 1) {
      const relativeBearing = (directionIndex / profile.sampleDirections) * TAU;
      const relativeOffset = addBasisScaled(forward, right, relativeBearing, radius);
      const utility = evaluateA1RelationshipUtility({
        state: { relativeOffset },
        orientation: input.orientation,
        profile
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
  const nearBestUtilityFloor = clamp01(bestUtility - profile.nearBestUtilityWindow);
  const semanticEligibleSampleIds: string[] = [];
  for (const sample of samples) {
    sample.semanticEligible = sample.utility.totalUtility + EPSILON >= nearBestUtilityFloor;
    if (sample.semanticEligible) semanticEligibleSampleIds.push(sample.id);
  }

  return {
    kind: "A1_RELATIVE_SEMANTIC_FIELD",
    orientationSource: input.orientation.source,
    orientationStrength: orientation.strength,
    samplingBasis: { ...orientation.samplingBasis },
    samplingBasisSource: input.orientation.samplingBasisSource,
    sampleDirections: profile.sampleDirections,
    sampleRadii: [...profile.sampleRadii],
    bestUtility,
    nearBestUtilityFloor,
    samples,
    semanticEligibleSampleIds
  };
}
