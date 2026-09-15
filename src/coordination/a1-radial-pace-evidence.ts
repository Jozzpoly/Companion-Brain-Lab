import type {
  A1FixedCommandCrossFutureProfile,
  A1FixedCommandFutureProfileEntry,
  A1FixedCommandFutureRehearsed
} from "./a1-fixed-command-cross-future-profile";
import type { A1RadialObjectiveTerm } from "./a1-relationship-utility";
import type { A1Situation } from "./a1-situation";
import type { ActorSnapshot, Vec2 } from "../world/types";

const EPSILON = 1e-9;

export interface A1RadialPaceEvidence {
  initialRelativeOffset: Vec2;
  terminalRelativeOffset: Vec2;
  initialRadius: number;
  terminalRadius: number;
  preferredRadius: number;
  initialSignedRadialError: number;
  terminalSignedRadialError: number;
  initialAbsoluteRadialError: number;
  terminalAbsoluteRadialError: number;
  radialSeparationDelta: number;
  radialSeparationRate: number;
  absoluteRadialErrorDelta: number;
  absoluteRadialErrorRate: number;
  terminalStateSource: "A1_2P_LAST_SAME_PHYSICS_REHEARSAL_FRAME";
  relativeOffsetSemantics: "COMPANION_MINUS_PLAYER";
  radialErrorSemantics: "RADIUS_MINUS_EXPLICIT_PREFERRED_RADIUS_A1_2U";
  deltaSemantics: "TERMINAL_MINUS_INITIAL_NEGATIVE_ABSOLUTE_ERROR_DELTA_MEANS_TOWARD_RADIAL_OBJECTIVE";
}

export interface A1RadialPaceEntry {
  futureFamily: A1FixedCommandFutureProfileEntry["futureFamily"];
  futureId: A1FixedCommandFutureProfileEntry["futureId"];
  sourceStatus: A1FixedCommandFutureProfileEntry["status"];
  source: A1FixedCommandFutureProfileEntry;
  radialPace: A1RadialPaceEvidence | null;
  paceAvailability:
    | "AVAILABLE_REHEARSED_TERMINAL_STATE"
    | "UNAVAILABLE_NON_REHEARSED_FUTURE";
}

export interface A1FixedCommandRadialPaceProfile {
  kind: "A1_FIXED_COMMAND_RADIAL_PACE_PROFILE";
  sourceTick: number;
  horizonSeconds: number;
  proposalId: string;
  commandVelocity: Vec2;
  radialObjective: A1RadialObjectiveTerm;
  initialRelativeOffset: Vec2;
  initialRadius: number;
  initialSignedRadialError: number;
  initialAbsoluteRadialError: number;
  entries: readonly A1RadialPaceEntry[];
  paceAvailableCount: number;
  paceUnavailableCount: number;
  terminalTruthClaim: "ACTUAL_SAME_PHYSICS_TERMINAL_RELATIVE_STATE_A1_2U";
  paceSemanticsClaim: "RAW_RADIAL_RELATIONSHIP_PROGRESS_ONLY_A1_2U";
  radialObjectiveUsage: "PREFERRED_RADIUS_DRIVES_ERROR_SIGMA_WEIGHT_PRESERVED_AS_PROVENANCE_ONLY_A1_2U";
  directionalObjectiveUsage: "NONE_A1_2U";
  relationshipUtilityUsage: "NONE_A1_2U";
  classificationClaim: "NONE_RAW_CONTINUOUS_EVIDENCE_A1_2U";
  futureAggregationClaim: "NONE_PRESERVE_H1_H2_H3_A1_2U";
  cooperationClaim: "NONE_A1_2U";
  selectionClaim: "NONE_A1_2U";
  runtimeAuthorityClaim: "NONE_A1_2U";
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(actors: readonly ActorSnapshot[], id: "player" | "companion"): ActorSnapshot {
  const found = actors.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`A1.2u terminal rehearsal frame is missing ${id}.`);
  return found;
}

function validatedRadialObjective(value: A1RadialObjectiveTerm): A1RadialObjectiveTerm {
  if (!Number.isFinite(value.preferredRadius) || value.preferredRadius <= 0) {
    throw new Error("A1.2u radial objective preferredRadius must be positive and finite.");
  }
  if (!Number.isFinite(value.sigma) || value.sigma <= 0) {
    throw new Error("A1.2u radial objective sigma provenance must be positive and finite.");
  }
  if (!Number.isFinite(value.weight) || value.weight <= 0) {
    throw new Error("A1.2u radial objective weight provenance must be positive and finite.");
  }
  return { ...value };
}

function validateProfile(input: {
  profile: A1FixedCommandCrossFutureProfile;
  situation: A1Situation;
}): void {
  if (input.profile.kind !== "A1_FIXED_COMMAND_CROSS_FUTURE_PROFILE") {
    throw new Error("A1.2u requires a qualified A1.2p fixed-command profile.");
  }
  if (
    input.profile.fixedCommandClaim !== "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P" ||
    input.profile.regenerationClaim !== "NONE_A1_2P_REUSE_A1_2O_CANONICAL_REALIZATION"
  ) {
    throw new Error("A1.2u requires the qualified A1.2p fixed-command/no-regeneration boundary.");
  }
  if (
    input.profile.utilityAggregationClaim !== "NONE_A1_2P" ||
    input.profile.cooperationAggregationClaim !== "NONE_A1_2P" ||
    input.profile.selectionClaim !== "NONE_A1_2P" ||
    input.profile.runtimeAuthorityClaim !== "NONE_A1_2P"
  ) {
    throw new Error("A1.2u refuses upstream aggregation, selection or runtime authority.");
  }
  if (
    input.situation.tick !== input.profile.sourceTick ||
    input.situation.situated.tick !== input.profile.sourceTick
  ) {
    throw new Error("A1.2u situation and fixed-command profile source ticks are misaligned.");
  }
  if (!Number.isFinite(input.profile.horizonSeconds) || input.profile.horizonSeconds <= 0) {
    throw new Error("A1.2u requires a positive finite rehearsal horizon.");
  }

  for (const entry of input.profile.entries) {
    if (vectorDistance(entry.commandVelocity, input.profile.commandVelocity) > EPSILON) {
      throw new Error("A1.2u fixed-command profile contains an entry with a different companion command.");
    }
    if (
      entry.utilityAggregationClaim !== "NONE_A1_2P" ||
      entry.cooperationAggregationClaim !== "NONE_A1_2P" ||
      entry.selectionClaim !== "NONE_A1_2P" ||
      entry.runtimeAuthorityClaim !== "NONE_A1_2P"
    ) {
      throw new Error("A1.2u refuses entry-level aggregation, selection or runtime authority.");
    }
  }
}

function terminalRelativeOffset(entry: A1FixedCommandFutureRehearsed): Vec2 {
  const frame = entry.rehearsal.physical.frames.at(-1);
  if (!frame) throw new Error("A1.2u rehearsed future has no terminal same-physics frame.");
  const player = actor(frame.actors, "player");
  const companion = actor(frame.actors, "companion");
  return subtract(companion.position, player.position);
}

function radialEvidence(input: {
  initialRelativeOffset: Vec2;
  terminalRelativeOffset: Vec2;
  preferredRadius: number;
  horizonSeconds: number;
}): A1RadialPaceEvidence {
  const initialRadius = magnitude(input.initialRelativeOffset);
  const terminalRadius = magnitude(input.terminalRelativeOffset);
  const initialSignedRadialError = initialRadius - input.preferredRadius;
  const terminalSignedRadialError = terminalRadius - input.preferredRadius;
  const initialAbsoluteRadialError = Math.abs(initialSignedRadialError);
  const terminalAbsoluteRadialError = Math.abs(terminalSignedRadialError);
  const radialSeparationDelta = terminalRadius - initialRadius;
  const absoluteRadialErrorDelta = terminalAbsoluteRadialError - initialAbsoluteRadialError;

  return {
    initialRelativeOffset: { ...input.initialRelativeOffset },
    terminalRelativeOffset: { ...input.terminalRelativeOffset },
    initialRadius,
    terminalRadius,
    preferredRadius: input.preferredRadius,
    initialSignedRadialError,
    terminalSignedRadialError,
    initialAbsoluteRadialError,
    terminalAbsoluteRadialError,
    radialSeparationDelta,
    radialSeparationRate: radialSeparationDelta / input.horizonSeconds,
    absoluteRadialErrorDelta,
    absoluteRadialErrorRate: absoluteRadialErrorDelta / input.horizonSeconds,
    terminalStateSource: "A1_2P_LAST_SAME_PHYSICS_REHEARSAL_FRAME",
    relativeOffsetSemantics: "COMPANION_MINUS_PLAYER",
    radialErrorSemantics: "RADIUS_MINUS_EXPLICIT_PREFERRED_RADIUS_A1_2U",
    deltaSemantics: "TERMINAL_MINUS_INITIAL_NEGATIVE_ABSOLUTE_ERROR_DELTA_MEANS_TOWARD_RADIAL_OBJECTIVE"
  };
}

/**
 * A1.2u exposes raw radial relationship-progress evidence from the exact same
 * A1.2p terminal physical states. It deliberately does not consume q utility,
 * directional semantics, thresholds, pairwise preferences, selection or
 * movement authority.
 */
export function buildA1FixedCommandRadialPaceProfile(input: {
  profile: A1FixedCommandCrossFutureProfile;
  situation: A1Situation;
  radialObjective: A1RadialObjectiveTerm;
}): A1FixedCommandRadialPaceProfile {
  validateProfile(input);
  const radialObjective = validatedRadialObjective(input.radialObjective);
  const initialRelativeOffset = subtract(
    input.situation.situated.companionBody.position,
    input.situation.situated.playerBody.position
  );
  const initialRadius = magnitude(initialRelativeOffset);
  const initialSignedRadialError = initialRadius - radialObjective.preferredRadius;
  const initialAbsoluteRadialError = Math.abs(initialSignedRadialError);

  const entries = input.profile.entries.map((entry): A1RadialPaceEntry => {
    if (entry.status !== "REHEARSED") {
      return {
        futureFamily: entry.futureFamily,
        futureId: entry.futureId,
        sourceStatus: entry.status,
        source: entry,
        radialPace: null,
        paceAvailability: "UNAVAILABLE_NON_REHEARSED_FUTURE"
      };
    }

    return {
      futureFamily: entry.futureFamily,
      futureId: entry.futureId,
      sourceStatus: entry.status,
      source: entry,
      radialPace: radialEvidence({
        initialRelativeOffset,
        terminalRelativeOffset: terminalRelativeOffset(entry),
        preferredRadius: radialObjective.preferredRadius,
        horizonSeconds: input.profile.horizonSeconds
      }),
      paceAvailability: "AVAILABLE_REHEARSED_TERMINAL_STATE"
    };
  });

  return {
    kind: "A1_FIXED_COMMAND_RADIAL_PACE_PROFILE",
    sourceTick: input.profile.sourceTick,
    horizonSeconds: input.profile.horizonSeconds,
    proposalId: input.profile.proposalId,
    commandVelocity: { ...input.profile.commandVelocity },
    radialObjective,
    initialRelativeOffset,
    initialRadius,
    initialSignedRadialError,
    initialAbsoluteRadialError,
    entries,
    paceAvailableCount: entries.filter((entry) => entry.radialPace !== null).length,
    paceUnavailableCount: entries.filter((entry) => entry.radialPace === null).length,
    terminalTruthClaim: "ACTUAL_SAME_PHYSICS_TERMINAL_RELATIVE_STATE_A1_2U",
    paceSemanticsClaim: "RAW_RADIAL_RELATIONSHIP_PROGRESS_ONLY_A1_2U",
    radialObjectiveUsage: "PREFERRED_RADIUS_DRIVES_ERROR_SIGMA_WEIGHT_PRESERVED_AS_PROVENANCE_ONLY_A1_2U",
    directionalObjectiveUsage: "NONE_A1_2U",
    relationshipUtilityUsage: "NONE_A1_2U",
    classificationClaim: "NONE_RAW_CONTINUOUS_EVIDENCE_A1_2U",
    futureAggregationClaim: "NONE_PRESERVE_H1_H2_H3_A1_2U",
    cooperationClaim: "NONE_A1_2U",
    selectionClaim: "NONE_A1_2U",
    runtimeAuthorityClaim: "NONE_A1_2U"
  };
}
