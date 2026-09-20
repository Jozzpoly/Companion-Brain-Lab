import {
  realizeA1DirectCandidate,
  type A1DirectCandidateRealization
} from "./a1-companion-candidates";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import type { A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentDirectRealization } from "./a1-spatial-commitment-direct-realization";
import type { ActorSnapshot, Vec2 } from "../world/types";
import type { LabWorld } from "../world/world";

const EPSILON = 1e-9;

export interface A1SpatialCommitmentFixedCommandObservationRow {
  observationHorizonSeconds: number;
  ownerRequestFutureId: string;
  fixedCompanionCommandVelocity: Vec2;
  companionPredictedEndpoint: Vec2;
  companionPredictedAnchorError: number;
  contactFrameCount: number;
  firstContactStepIndex: number | null;
  minSampledCenterDistance: number;
}

export interface A1SpatialCommitmentFixedCommandObservationScan {
  kind: "A1_SPATIAL_COMMITMENT_FIXED_COMMAND_OBSERVATION_SCAN";
  sourceTick: number;
  commitmentSourceTick: number;
  commandArrivalHypothesisSeconds: number;
  fixedCompanionCommandVelocity: Vec2;
  commandSourceCapabilityClipped: boolean;
  commandSourceTerminalAnchorError: number;
  rows: readonly A1SpatialCommitmentFixedCommandObservationRow[];
  commandAcrossRowsClaim: "EXACTLY_FIXED_EXECUTABLE_VELOCITY";
  observationAxisClaim: "ONLY_REHEARSAL_DURATION_CHANGES_ACROSS_ROWS";
  arrivalHypothesisClaim: "COMMAND_SOURCE_PROVENANCE_ONLY_NOT_RECOMPUTED_PER_ROW";
  ownerFutureClaim: "OWNER_REQUEST_CONTINUATION_REBUILT_AT_EACH_OBSERVATION_HORIZON";
  contactEvidenceClaim: "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY";
  horizonPolicyClaim: "NONE_SCAN_ONLY";
  yieldPolicyClaim: "NONE";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
}

function actor(
  actors: readonly ActorSnapshot[],
  id: "player" | "companion"
): ActorSnapshot {
  const value = actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1 fixed-command observation scan is missing ${id}.`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function validateHorizons(values: readonly number[]): number[] {
  if (values.length === 0) {
    throw new Error("A1 fixed-command observation scan requires at least one observation horizon.");
  }
  const result: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("A1 fixed-command observation horizons must be positive and finite.");
    }
    if (result.some((existing) => Math.abs(existing - value) <= EPSILON)) {
      throw new Error(`A1 fixed-command observation scan refuses duplicate horizon ${value}.`);
    }
    result.push(value);
  }
  return result;
}

function ownerRequest(plan: ReturnType<typeof buildA1PlayerFutureInterventionPlan>) {
  const matches = plan.interventions.filter(
    (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (matches.length !== 1) {
    throw new Error("A1 fixed-command observation scan requires exactly one Owner-request future.");
  }
  const value = matches[0]!;
  if (value.status !== "REHEARSABLE") {
    throw new Error(`A1 fixed-command observation scan Owner future is unresolved: ${value.unresolvedReason}.`);
  }
  return value;
}

function rowRealization(input: {
  situation: A1Situation;
  commandVelocity: Vec2;
  horizonSeconds: number;
}): A1DirectCandidateRealization {
  const realization = realizeA1DirectCandidate({
    candidate: {
      id: "commitment-anchor-fixed-command",
      family: "COMMITMENT_ANCHOR_DIRECT",
      sourceTick: input.situation.tick,
      desiredVelocity: { ...input.commandVelocity },
      localBasisSource: "NONE"
    },
    capability: input.situation.situated.companionCapability,
    horizonSeconds: input.horizonSeconds
  });
  if (distance(realization.commandVelocity, input.commandVelocity) > EPSILON) {
    throw new Error("A1 fixed-command observation scan changed the executable companion velocity across rows.");
  }
  return realization;
}

/**
 * Separates rehearsal duration from direct-to-anchor command generation.
 *
 * One executable companion velocity is materialized from an explicit arrival
 * hypothesis once. Every row then reuses that exact velocity while only the
 * rehearsal duration changes. This is research evidence only.
 */
export function buildA1SpatialCommitmentFixedCommandObservationScan(input: {
  world: LabWorld;
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  commandArrivalHypothesisSeconds: number;
  observationHorizons: readonly number[];
}): A1SpatialCommitmentFixedCommandObservationScan {
  if (
    input.fit.sourceTick !== input.situation.tick ||
    input.fit.commitmentSourceTick > input.fit.sourceTick
  ) {
    throw new Error("A1 fixed-command observation scan requires aligned fit and situation evidence.");
  }
  const observationHorizons = validateHorizons(input.observationHorizons);
  const commandSource = buildA1SpatialCommitmentDirectRealization({
    fit: input.fit,
    situation: input.situation,
    horizonSeconds: input.commandArrivalHypothesisSeconds
  });
  if (
    commandSource.status !== "REALIZED" ||
    !commandSource.realization ||
    !commandSource.anchorWorldPosition ||
    commandSource.terminalAnchorError === null
  ) {
    throw new Error("A1 fixed-command observation scan requires a resolved direct-to-anchor command source.");
  }

  const fixedCommand = { ...commandSource.realization.commandVelocity };
  const anchor = { ...commandSource.anchorWorldPosition };
  const sourceSnapshot = input.world.snapshot();
  const sourcePlayer = actor(sourceSnapshot.actors, "player");
  const sourceCompanion = actor(sourceSnapshot.actors, "companion");

  const rows = observationHorizons.map(
    (observationHorizonSeconds): A1SpatialCommitmentFixedCommandObservationRow => {
      const hypotheses = buildA1PlayerFutureHypotheses({
        situation: input.situation,
        horizonSeconds: observationHorizonSeconds,
        staticTraversal: (from, to, radius, options) =>
          input.world.staticCircleTraversal(from, to, radius, options)
      });
      const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
      const h1 = ownerRequest(plan);
      const companionRealization = rowRealization({
        situation: input.situation,
        commandVelocity: fixedCommand,
        horizonSeconds: observationHorizonSeconds
      });
      const rehearsal = rehearseA1DirectJointPhysicalFuture({
        world: input.world,
        situation: input.situation,
        playerIntervention: h1,
        companionRealization
      });

      let contactFrameCount = 0;
      let firstContactStepIndex: number | null = null;
      let minSampledCenterDistance = distance(
        sourcePlayer.position,
        sourceCompanion.position
      );
      for (const frame of rehearsal.physical.frames) {
        const player = actor(frame.actors, "player");
        const companion = actor(frame.actors, "companion");
        minSampledCenterDistance = Math.min(
          minSampledCenterDistance,
          distance(player.position, companion.position)
        );
        const reciprocal =
          player.contacts.some((contact) => contact.with === "companion") &&
          companion.contacts.some((contact) => contact.with === "player");
        if (reciprocal) {
          contactFrameCount += 1;
          firstContactStepIndex ??= frame.stepIndex;
        }
      }

      const companionPredictedEndpoint = {
        x: sourceCompanion.position.x + companionRealization.predictedDisplacement.x,
        y: sourceCompanion.position.y + companionRealization.predictedDisplacement.y
      };
      return {
        observationHorizonSeconds,
        ownerRequestFutureId: h1.futureId,
        fixedCompanionCommandVelocity: { ...companionRealization.commandVelocity },
        companionPredictedEndpoint,
        companionPredictedAnchorError: distance(companionPredictedEndpoint, anchor),
        contactFrameCount,
        firstContactStepIndex,
        minSampledCenterDistance
      };
    }
  );

  return {
    kind: "A1_SPATIAL_COMMITMENT_FIXED_COMMAND_OBSERVATION_SCAN",
    sourceTick: input.situation.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    commandArrivalHypothesisSeconds: input.commandArrivalHypothesisSeconds,
    fixedCompanionCommandVelocity: fixedCommand,
    commandSourceCapabilityClipped: commandSource.realization.capabilityClipped,
    commandSourceTerminalAnchorError: commandSource.terminalAnchorError,
    rows,
    commandAcrossRowsClaim: "EXACTLY_FIXED_EXECUTABLE_VELOCITY",
    observationAxisClaim: "ONLY_REHEARSAL_DURATION_CHANGES_ACROSS_ROWS",
    arrivalHypothesisClaim: "COMMAND_SOURCE_PROVENANCE_ONLY_NOT_RECOMPUTED_PER_ROW",
    ownerFutureClaim: "OWNER_REQUEST_CONTINUATION_REBUILT_AT_EACH_OBSERVATION_HORIZON",
    contactEvidenceClaim: "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY",
    horizonPolicyClaim: "NONE_SCAN_ONLY",
    yieldPolicyClaim: "NONE",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE"
  };
}
