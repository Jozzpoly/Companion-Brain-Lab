import type {
  A1FixedCommandCrossFutureProfile,
  A1FixedCommandFutureProfileEntry,
  A1FixedCommandFutureRehearsed
} from "./a1-fixed-command-cross-future-profile";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  a1RelationshipObjectiveSignature,
  evaluateA1RelationshipUtility,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipUtilityEvidence
} from "./a1-relationship-utility";
import type { A1Situation } from "./a1-situation";
import type { ActorSnapshot, Vec2 } from "../world/types";

const EPSILON = 1e-9;

export interface A1TerminalRelationshipUtilityEvidence {
  initialRelativeOffset: Vec2;
  terminalRelativeOffset: Vec2;
  initialUtility: A1RelationshipUtilityEvidence;
  terminalUtility: A1RelationshipUtilityEvidence;
  utilityDelta: number;
  terminalStateSource: "A1_2P_LAST_SAME_PHYSICS_REHEARSAL_FRAME";
  relativeOffsetSemantics: "COMPANION_MINUS_PLAYER";
  orientationUsage: "SOURCE_TICK_A1_1_SEMANTIC_ORIENTATION_HELD_FIXED_OVER_REHEARSAL";
  objectiveUsage: "EXPLICIT_A1_1_RELATIONSHIP_OBJECTIVE";
  samplingUsage: "NONE_DIRECT_SEMANTIC_UTILITY_ONLY";
  routeProjectionUsage: "NONE_A1_2Q";
}

export interface A1TerminalRelationshipUtilityEntry {
  futureFamily: A1FixedCommandFutureProfileEntry["futureFamily"];
  futureId: A1FixedCommandFutureProfileEntry["futureId"];
  sourceStatus: A1FixedCommandFutureProfileEntry["status"];
  source: A1FixedCommandFutureProfileEntry;
  relationshipUtility: A1TerminalRelationshipUtilityEvidence | null;
  utilityAvailability:
    | "AVAILABLE_REHEARSED_TERMINAL_STATE"
    | "UNAVAILABLE_NON_REHEARSED_FUTURE";
}

export interface A1TerminalRelationshipUtilityProfile {
  kind: "A1_TERMINAL_RELATIONSHIP_UTILITY_PROFILE";
  sourceTick: number;
  horizonSeconds: number;
  proposalId: string;
  commandVelocity: Vec2;
  objectiveSignature: string;
  orientationSource: A1RelationshipOrientationEvidence["source"];
  orientationSourceTick: number | null;
  orientationAgeTicks: number | null;
  orientationStrength: number;
  initialRelativeOffset: Vec2;
  initialUtility: A1RelationshipUtilityEvidence;
  entries: readonly A1TerminalRelationshipUtilityEntry[];
  utilityAvailableCount: number;
  utilityUnavailableCount: number;
  terminalTruthClaim: "ACTUAL_SAME_PHYSICS_TERMINAL_RELATIVE_STATE_A1_2Q";
  familySemanticsClaim: "NONE_UTILITY_DEPENDS_ON_RELATIVE_STATE_ORIENTATION_OBJECTIVE_ONLY_A1_2Q";
  playerFlowUsage: "NONE_A1_2Q";
  samplingUsage: "NONE_A1_2Q";
  utilityAggregationClaim: "NONE_PRESERVE_PLAYER_FUTURES_A1_2Q";
  cooperationClaim: "NONE_A1_2Q";
  selectionClaim: "NONE_A1_2Q";
  runtimeAuthorityClaim: "NONE_A1_2Q";
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(actors: readonly ActorSnapshot[], id: "player" | "companion"): ActorSnapshot {
  const found = actors.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`A1.2q terminal rehearsal frame is missing ${id}.`);
  return found;
}

function validateProfile(input: {
  profile: A1FixedCommandCrossFutureProfile;
  situation: A1Situation;
  orientation: A1RelationshipOrientationEvidence;
}): void {
  if (input.profile.kind !== "A1_FIXED_COMMAND_CROSS_FUTURE_PROFILE") {
    throw new Error("A1.2q requires a qualified A1.2p fixed-command profile.");
  }
  if (
    input.profile.fixedCommandClaim !== "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P" ||
    input.profile.regenerationClaim !== "NONE_A1_2P_REUSE_A1_2O_CANONICAL_REALIZATION"
  ) {
    throw new Error("A1.2q requires the qualified A1.2p fixed-command/no-regeneration boundary.");
  }
  if (
    input.profile.selectionClaim !== "NONE_A1_2P" ||
    input.profile.runtimeAuthorityClaim !== "NONE_A1_2P"
  ) {
    throw new Error("A1.2q refuses upstream selection or runtime authority.");
  }
  if (
    input.situation.tick !== input.profile.sourceTick ||
    input.situation.situated.tick !== input.profile.sourceTick
  ) {
    throw new Error("A1.2q situation and fixed-command profile source ticks are misaligned.");
  }
  if (input.orientation.tick !== input.profile.sourceTick) {
    throw new Error("A1.2q relationship orientation tick must equal the fixed-command profile source tick.");
  }

  const profileCommand = input.profile.commandVelocity;
  for (const entry of input.profile.entries) {
    if (vectorDistance(entry.commandVelocity, profileCommand) > EPSILON) {
      throw new Error("A1.2q fixed-command profile contains an entry with a different companion command.");
    }
    if (entry.selectionClaim !== "NONE_A1_2P" || entry.runtimeAuthorityClaim !== "NONE_A1_2P") {
      throw new Error("A1.2q refuses entry-level selection or runtime authority.");
    }
  }
}

function terminalRelativeOffset(entry: A1FixedCommandFutureRehearsed): Vec2 {
  const frame = entry.rehearsal.physical.frames.at(-1);
  if (!frame) throw new Error("A1.2q rehearsed future has no terminal same-physics frame.");
  const player = actor(frame.actors, "player");
  const companion = actor(frame.actors, "companion");
  return subtract(companion.position, player.position);
}

/**
 * A1.2q attaches the already-qualified A1.1 relationship objective to the
 * actual terminal relative state produced by each A1.2p same-physics branch.
 * It is semantic evidence only: no future aggregation, G4 scalarization,
 * selection or runtime movement authority is introduced here.
 */
export function buildA1TerminalRelationshipUtilityProfile(input: {
  profile: A1FixedCommandCrossFutureProfile;
  situation: A1Situation;
  orientation: A1RelationshipOrientationEvidence;
  objective: A1RelationshipObjectiveProfile;
}): A1TerminalRelationshipUtilityProfile {
  validateProfile(input);
  const objectiveSignature = a1RelationshipObjectiveSignature(input.objective);
  const initialRelativeOffset = subtract(
    input.situation.situated.companionBody.position,
    input.situation.situated.playerBody.position
  );
  const initialUtility = evaluateA1RelationshipUtility({
    state: { relativeOffset: initialRelativeOffset },
    orientation: input.orientation,
    objective: input.objective
  });

  const entries = input.profile.entries.map((entry): A1TerminalRelationshipUtilityEntry => {
    if (entry.status !== "REHEARSED") {
      return {
        futureFamily: entry.futureFamily,
        futureId: entry.futureId,
        sourceStatus: entry.status,
        source: entry,
        relationshipUtility: null,
        utilityAvailability: "UNAVAILABLE_NON_REHEARSED_FUTURE"
      };
    }

    const terminalOffset = terminalRelativeOffset(entry);
    const terminalUtility = evaluateA1RelationshipUtility({
      state: { relativeOffset: terminalOffset },
      orientation: input.orientation,
      objective: input.objective
    });
    return {
      futureFamily: entry.futureFamily,
      futureId: entry.futureId,
      sourceStatus: entry.status,
      source: entry,
      relationshipUtility: {
        initialRelativeOffset: { ...initialRelativeOffset },
        terminalRelativeOffset: terminalOffset,
        initialUtility,
        terminalUtility,
        utilityDelta: terminalUtility.totalUtility - initialUtility.totalUtility,
        terminalStateSource: "A1_2P_LAST_SAME_PHYSICS_REHEARSAL_FRAME",
        relativeOffsetSemantics: "COMPANION_MINUS_PLAYER",
        orientationUsage: "SOURCE_TICK_A1_1_SEMANTIC_ORIENTATION_HELD_FIXED_OVER_REHEARSAL",
        objectiveUsage: "EXPLICIT_A1_1_RELATIONSHIP_OBJECTIVE",
        samplingUsage: "NONE_DIRECT_SEMANTIC_UTILITY_ONLY",
        routeProjectionUsage: "NONE_A1_2Q"
      },
      utilityAvailability: "AVAILABLE_REHEARSED_TERMINAL_STATE"
    };
  });

  return {
    kind: "A1_TERMINAL_RELATIONSHIP_UTILITY_PROFILE",
    sourceTick: input.profile.sourceTick,
    horizonSeconds: input.profile.horizonSeconds,
    proposalId: input.profile.proposalId,
    commandVelocity: { ...input.profile.commandVelocity },
    objectiveSignature,
    orientationSource: input.orientation.source,
    orientationSourceTick: input.orientation.sourceTick,
    orientationAgeTicks: input.orientation.ageTicks,
    orientationStrength: input.orientation.strength,
    initialRelativeOffset,
    initialUtility,
    entries,
    utilityAvailableCount: entries.filter((entry) => entry.relationshipUtility !== null).length,
    utilityUnavailableCount: entries.filter((entry) => entry.relationshipUtility === null).length,
    terminalTruthClaim: "ACTUAL_SAME_PHYSICS_TERMINAL_RELATIVE_STATE_A1_2Q",
    familySemanticsClaim: "NONE_UTILITY_DEPENDS_ON_RELATIVE_STATE_ORIENTATION_OBJECTIVE_ONLY_A1_2Q",
    playerFlowUsage: "NONE_A1_2Q",
    samplingUsage: "NONE_A1_2Q",
    utilityAggregationClaim: "NONE_PRESERVE_PLAYER_FUTURES_A1_2Q",
    cooperationClaim: "NONE_A1_2Q",
    selectionClaim: "NONE_A1_2Q",
    runtimeAuthorityClaim: "NONE_A1_2Q"
  };
}
