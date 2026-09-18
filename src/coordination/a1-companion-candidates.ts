import {
  stepMotionContinuity,
  type MotionContinuityConfig
} from "../brain/motion-continuity";
import type { MovementCapability } from "../world/movement-capability";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;
const TEMPORAL_INPUT_SPEED_ENVELOPE_MULTIPLIER = 1.5;

export type A1CompanionCandidateFamily =
  | "HOLD"
  | "MAINTAIN_CURRENT"
  | "PLAYER_FEED_FORWARD"
  | "COMMITMENT_ANCHOR_DIRECT"
  | "RELATIVE_RADIAL_INWARD"
  | "RELATIVE_RADIAL_OUTWARD"
  | "RELATIVE_TANGENT_POSITIVE"
  | "RELATIVE_TANGENT_NEGATIVE";

export interface A1VelocityEvidence {
  id: string;
  sourceTick: number;
  velocity: Vec2;
}

export interface A1CompanionCandidateSeed {
  id: string;
  family: A1CompanionCandidateFamily;
  sourceTick: number;
  desiredVelocity: Vec2;
  localBasisSource: "NONE" | "CURRENT_RELATIVE_OFFSET";
}

export interface A1CompanionCandidateSet {
  kind: "A1_COMPANION_CANDIDATE_SET";
  sourceTick: number;
  capabilityMaxSpeed: number;
  localAlternativeDeltaSpeed: number;
  localBasisAvailable: boolean;
  seeds: readonly A1CompanionCandidateSeed[];
}

export interface A1DirectCandidateRealization {
  kind: "A1_DIRECT_CANDIDATE_REALIZATION";
  sourceTick: number;
  candidateId: string;
  family: A1CompanionCandidateFamily;
  horizonSeconds: number;
  desiredVelocity: Vec2;
  commandVelocity: Vec2;
  capabilityMaxSpeed: number;
  capabilityClipped: boolean;
  predictedDisplacement: Vec2;
  terminalVelocity: Vec2;
  reachabilityClaim: "DIRECT_COMMAND_ADMISSIBLE_ONLY";
  worldLegalityClaim: "NONE_A1_2B";
}

export interface A1TemporalActuationModel {
  source: "A1_2B_EXPERIMENTAL_ACTUATION_MODEL";
  integrationStepSeconds: number;
  maxAcceleration: number;
  maxBrakingAcceleration: number;
  maxJerk: number;
}

export interface A1TemporalCandidateRealization {
  kind: "A1_TEMPORAL_CANDIDATE_REALIZATION";
  sourceTick: number;
  candidateId: string;
  family: A1CompanionCandidateFamily;
  horizonSeconds: number;
  desiredVelocity: Vec2;
  boundedDesiredVelocity: Vec2;
  capabilityMaxSpeed: number;
  capabilityClipped: boolean;
  initialVelocity: Vec2;
  initialAcceleration: Vec2;
  terminalVelocity: Vec2;
  terminalAcceleration: Vec2;
  predictedDisplacement: Vec2;
  terminalVelocityError: number;
  integrationSteps: number;
  actuationModel: A1TemporalActuationModel;
  reachabilityClaim: "TEMPORAL_EXPERIMENTAL_MODEL_ROLLOUT";
  worldLegalityClaim: "NONE_A1_2B";
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function normalized(value: Vec2): Vec2 | null {
  const length = magnitude(value);
  return length > EPSILON ? { x: value.x / length, y: value.y / length } : null;
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(value: Vec2, amount: number): Vec2 {
  return { x: value.x * amount, y: value.y * amount };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function clampMagnitude(value: Vec2, maximum: number): { value: Vec2; clipped: boolean } {
  const length = magnitude(value);
  if (length <= maximum + EPSILON || length <= EPSILON) {
    return { value: { ...value }, clipped: false };
  }
  const ratio = maximum / length;
  return {
    value: { x: value.x * ratio, y: value.y * ratio },
    clipped: true
  };
}

function validatedCapability(capability: MovementCapability): MovementCapability {
  if (capability.actorId !== "companion") {
    throw new Error("A1 companion candidate generation requires companion MovementCapability truth.");
  }
  if (!Number.isFinite(capability.maxSpeed) || capability.maxSpeed <= 0) {
    throw new Error("A1 companion capability maxSpeed must be positive and finite.");
  }
  if (!Number.isFinite(capability.radius) || capability.radius <= 0) {
    throw new Error("A1 companion capability radius must be positive and finite.");
  }
  return { ...capability };
}

function alignedVelocityEvidence(value: A1VelocityEvidence, tick: number, label: string): A1VelocityEvidence {
  if (!value.id) throw new Error(`${label} requires a non-empty id.`);
  if (!Number.isInteger(value.sourceTick) || value.sourceTick !== tick) {
    throw new Error(`${label} sourceTick must equal candidate-set tick ${tick}.`);
  }
  return {
    id: value.id,
    sourceTick: value.sourceTick,
    velocity: finiteVector(value.velocity, `${label} velocity`)
  };
}

function seed(
  tick: number,
  family: A1CompanionCandidateFamily,
  desiredVelocity: Vec2,
  localBasisSource: A1CompanionCandidateSeed["localBasisSource"]
): A1CompanionCandidateSeed {
  return {
    id: family.toLowerCase().replaceAll("_", "-"),
    family,
    sourceTick: tick,
    desiredVelocity: finiteVector(desiredVelocity, `${family} desired velocity`),
    localBasisSource
  };
}

/**
 * Builds a compact, deterministic set of velocity hypotheses. These are not
 * selected commands and they are not yet checked against World geometry.
 * The local alternatives are symmetric around player feed-forward so no one
 * relative direction acquires hidden semantic preference before utility scoring.
 */
export function buildA1CompanionCandidateSet(input: {
  tick: number;
  companionCurrentVelocity: A1VelocityEvidence;
  playerFuture: A1VelocityEvidence;
  currentRelativeOffset: Vec2;
  capability: MovementCapability;
  localAlternativeDeltaSpeed: number;
}): A1CompanionCandidateSet {
  if (!Number.isInteger(input.tick) || input.tick < 0) {
    throw new Error("A1 candidate-set tick must be a non-negative integer.");
  }
  const capability = validatedCapability(input.capability);
  if (
    !Number.isFinite(input.localAlternativeDeltaSpeed) ||
    input.localAlternativeDeltaSpeed <= 0 ||
    input.localAlternativeDeltaSpeed > capability.maxSpeed
  ) {
    throw new Error("A1 local alternative delta speed must be positive, finite and no greater than companion maxSpeed.");
  }
  const companionCurrentVelocity = alignedVelocityEvidence(
    input.companionCurrentVelocity,
    input.tick,
    "A1 companion current velocity"
  );
  const playerFuture = alignedVelocityEvidence(input.playerFuture, input.tick, "A1 player future");
  const relativeOffset = finiteVector(input.currentRelativeOffset, "A1 current relative offset");
  const basis = normalized(relativeOffset);

  const seeds: A1CompanionCandidateSeed[] = [
    seed(input.tick, "HOLD", { x: 0, y: 0 }, "NONE"),
    seed(input.tick, "MAINTAIN_CURRENT", companionCurrentVelocity.velocity, "NONE"),
    seed(input.tick, "PLAYER_FEED_FORWARD", playerFuture.velocity, "NONE")
  ];

  if (basis) {
    const tangent = { x: -basis.y, y: basis.x };
    const delta = input.localAlternativeDeltaSpeed;
    seeds.push(
      seed(
        input.tick,
        "RELATIVE_RADIAL_INWARD",
        add(playerFuture.velocity, scale(basis, -delta)),
        "CURRENT_RELATIVE_OFFSET"
      ),
      seed(
        input.tick,
        "RELATIVE_RADIAL_OUTWARD",
        add(playerFuture.velocity, scale(basis, delta)),
        "CURRENT_RELATIVE_OFFSET"
      ),
      seed(
        input.tick,
        "RELATIVE_TANGENT_POSITIVE",
        add(playerFuture.velocity, scale(tangent, delta)),
        "CURRENT_RELATIVE_OFFSET"
      ),
      seed(
        input.tick,
        "RELATIVE_TANGENT_NEGATIVE",
        add(playerFuture.velocity, scale(tangent, -delta)),
        "CURRENT_RELATIVE_OFFSET"
      )
    );
  }

  return {
    kind: "A1_COMPANION_CANDIDATE_SET",
    sourceTick: input.tick,
    capabilityMaxSpeed: capability.maxSpeed,
    localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed,
    localBasisAvailable: basis !== null,
    seeds
  };
}

export function realizeA1DirectCandidate(input: {
  candidate: A1CompanionCandidateSeed;
  capability: MovementCapability;
  horizonSeconds: number;
}): A1DirectCandidateRealization {
  const capability = validatedCapability(input.capability);
  if (!Number.isFinite(input.horizonSeconds) || input.horizonSeconds <= 0) {
    throw new Error("A1 DIRECT candidate realization requires a positive finite horizonSeconds.");
  }
  const desiredVelocity = finiteVector(input.candidate.desiredVelocity, "A1 DIRECT desired velocity");
  const bounded = clampMagnitude(desiredVelocity, capability.maxSpeed);
  const predictedDisplacement = scale(bounded.value, input.horizonSeconds);

  return {
    kind: "A1_DIRECT_CANDIDATE_REALIZATION",
    sourceTick: input.candidate.sourceTick,
    candidateId: input.candidate.id,
    family: input.candidate.family,
    horizonSeconds: input.horizonSeconds,
    desiredVelocity,
    commandVelocity: bounded.value,
    capabilityMaxSpeed: capability.maxSpeed,
    capabilityClipped: bounded.clipped,
    predictedDisplacement,
    terminalVelocity: { ...bounded.value },
    reachabilityClaim: "DIRECT_COMMAND_ADMISSIBLE_ONLY",
    worldLegalityClaim: "NONE_A1_2B"
  };
}

function validatedActuationModel(model: A1TemporalActuationModel): A1TemporalActuationModel {
  if (model.source !== "A1_2B_EXPERIMENTAL_ACTUATION_MODEL") {
    throw new Error("A1 TEMPORAL realization requires explicit experimental actuation-model provenance.");
  }
  if (!Number.isFinite(model.integrationStepSeconds) || model.integrationStepSeconds <= 0) {
    throw new Error("A1 TEMPORAL integrationStepSeconds must be positive and finite.");
  }
  if (!Number.isFinite(model.maxAcceleration) || model.maxAcceleration <= 0) {
    throw new Error("A1 TEMPORAL maxAcceleration must be positive and finite.");
  }
  if (!Number.isFinite(model.maxBrakingAcceleration) || model.maxBrakingAcceleration <= 0) {
    throw new Error("A1 TEMPORAL maxBrakingAcceleration must be positive and finite.");
  }
  if (!Number.isFinite(model.maxJerk) || model.maxJerk <= 0) {
    throw new Error("A1 TEMPORAL maxJerk must be positive and finite.");
  }
  return { ...model };
}

/**
 * Experimental temporal prediction adapter around the existing pure continuity
 * donor. The model's accel/brake/jerk parameters are explicit caller-owned
 * experiment configuration; they are deliberately not MovementCapability truth.
 */
export function realizeA1TemporalCandidate(input: {
  candidate: A1CompanionCandidateSeed;
  capability: MovementCapability;
  horizonSeconds: number;
  initialVelocity: Vec2;
  initialAcceleration: Vec2;
  actuationModel: A1TemporalActuationModel;
}): A1TemporalCandidateRealization {
  const capability = validatedCapability(input.capability);
  if (!Number.isFinite(input.horizonSeconds) || input.horizonSeconds <= 0) {
    throw new Error("A1 TEMPORAL candidate realization requires a positive finite horizonSeconds.");
  }
  const actuationModel = validatedActuationModel(input.actuationModel);
  const desiredVelocity = finiteVector(input.candidate.desiredVelocity, "A1 TEMPORAL desired velocity");
  const initialVelocity = finiteVector(input.initialVelocity, "A1 TEMPORAL initial velocity");
  const initialAcceleration = finiteVector(input.initialAcceleration, "A1 TEMPORAL initial acceleration");
  if (magnitude(initialVelocity) > capability.maxSpeed * TEMPORAL_INPUT_SPEED_ENVELOPE_MULTIPLIER + EPSILON) {
    throw new Error(
      "A1 TEMPORAL initial velocity exceeds the continuity donor's explicit 1.5x capability input envelope."
    );
  }
  const accelerationEnvelope = Math.max(
    actuationModel.maxAcceleration,
    actuationModel.maxBrakingAcceleration
  );
  if (magnitude(initialAcceleration) > accelerationEnvelope + EPSILON) {
    throw new Error(
      "A1 TEMPORAL initial acceleration lies outside the explicit experimental actuation-model envelope."
    );
  }
  const boundedDesired = clampMagnitude(desiredVelocity, capability.maxSpeed);
  const preferredMove = scale(boundedDesired.value, 1 / capability.maxSpeed);
  const config: MotionContinuityConfig = {
    maxSpeed: capability.maxSpeed,
    maxAcceleration: actuationModel.maxAcceleration,
    maxBrakingAcceleration: actuationModel.maxBrakingAcceleration,
    maxJerk: actuationModel.maxJerk
  };

  let velocity = { ...initialVelocity };
  let acceleration = { ...initialAcceleration };
  let displacement = { x: 0, y: 0 };
  let remaining = input.horizonSeconds;
  let integrationSteps = 0;

  while (remaining > EPSILON) {
    const dt = Math.min(actuationModel.integrationStepSeconds, remaining);
    const step = stepMotionContinuity({
      currentVelocity: velocity,
      preferredMove,
      previousAcceleration: acceleration,
      deltaSeconds: dt,
      config
    });
    velocity = { ...step.commandedVelocity };
    acceleration = { ...step.acceleration };
    displacement = add(displacement, scale(velocity, dt));
    remaining -= dt;
    integrationSteps += 1;
    if (integrationSteps > 100_000) {
      throw new Error("A1 TEMPORAL integration exceeded bounded step count.");
    }
  }

  return {
    kind: "A1_TEMPORAL_CANDIDATE_REALIZATION",
    sourceTick: input.candidate.sourceTick,
    candidateId: input.candidate.id,
    family: input.candidate.family,
    horizonSeconds: input.horizonSeconds,
    desiredVelocity,
    boundedDesiredVelocity: boundedDesired.value,
    capabilityMaxSpeed: capability.maxSpeed,
    capabilityClipped: boundedDesired.clipped,
    initialVelocity,
    initialAcceleration,
    terminalVelocity: velocity,
    terminalAcceleration: acceleration,
    predictedDisplacement: displacement,
    terminalVelocityError: magnitude(subtract(boundedDesired.value, velocity)),
    integrationSteps,
    actuationModel,
    reachabilityClaim: "TEMPORAL_EXPERIMENTAL_MODEL_ROLLOUT",
    worldLegalityClaim: "NONE_A1_2B"
  };
}
