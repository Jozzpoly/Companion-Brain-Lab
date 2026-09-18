import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import type { A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentJointFutureSetEvidence } from "./a1-spatial-commitment-joint-future";
import { buildA1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";
import {
  buildA1SpatialCommitmentDeliberationFrame,
  type A1SpatialCommitmentDeliberationFrame
} from "./a1-spatial-commitment-deliberation";
import type { LabWorld } from "../world/world";

const EPSILON = 1e-12;

export const A1_COMMITMENT_DELIBERATION_RESEARCH_HORIZONS = [
  0.25,
  0.5,
  0.75,
  1
] as const;

export interface A1SpatialCommitmentDeliberationHorizonRow {
  horizonSeconds: number;
  ownerRequestFutureId: string | null;
  ownerRequestAnchorOverlap: boolean | null;
  ownerRequestJointContact: boolean | null;
  yieldReasonPresent: boolean;
  directCapabilityClipped: boolean | null;
  directTerminalAnchorError: number | null;
  directCommandVelocity: { x: number; y: number } | null;
  deliberation: A1SpatialCommitmentDeliberationFrame;
}

export interface A1SpatialCommitmentDeliberationHorizonScan {
  kind: "A1_SPATIAL_COMMITMENT_DELIBERATION_HORIZON_SCAN";
  sourceTick: number;
  commitmentSourceTick: number;
  horizons: readonly number[];
  rows: readonly A1SpatialCommitmentDeliberationHorizonRow[];
  horizonMeaning: "EXECUTION_ARRIVAL_HYPOTHESIS_AND_REHEARSAL_DURATION";
  horizonPolicyClaim: "NONE_SCAN_ONLY";
  crossHorizonAggregationClaim: "NONE";
  preferredHorizonClaim: "NONE";
  persistenceClaim: "NONE_PER_HORIZON_COUNTERFACTUALS_ONLY";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
}

function validateHorizons(horizons: readonly number[]): number[] {
  if (horizons.length === 0) {
    throw new Error("A1 commitment deliberation horizon scan requires at least one horizon.");
  }
  const result: number[] = [];
  for (const horizon of horizons) {
    if (!Number.isFinite(horizon) || horizon <= 0) {
      throw new Error("A1 commitment deliberation horizon scan requires positive finite horizons.");
    }
    if (result.some((value) => Math.abs(value - horizon) <= EPSILON)) {
      throw new Error(`A1 commitment deliberation horizon scan refuses duplicate horizon ${horizon}.`);
    }
    result.push(horizon);
  }
  return result;
}

function yieldReason(frame: A1SpatialCommitmentDeliberationFrame): boolean {
  const option = frame.options.find((value) => value.option === "YIELD_TO_OWNER_FLOW");
  if (!option) throw new Error("A1 commitment deliberation horizon scan lost yield hypothesis.");
  return option.reasonsForConsideration.includes("OWNER_REQUEST_JOINT_CONTACT");
}

/**
 * Research-only scan over explicit arrival/rehearsal hypotheses.
 *
 * The horizon is deliberately not treated as a neutral observation window:
 * direct-to-anchor realization uses it as the intended arrival time, so each row
 * is a different execution counterfactual as well as a different rehearsal
 * duration. No row is preferred or aggregated.
 */
export function buildA1SpatialCommitmentDeliberationHorizonScan(input: {
  world: LabWorld;
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  horizons?: readonly number[];
}): A1SpatialCommitmentDeliberationHorizonScan {
  if (
    input.fit.sourceTick !== input.situation.tick ||
    input.fit.commitmentSourceTick > input.fit.sourceTick
  ) {
    throw new Error("A1 commitment deliberation horizon scan requires aligned fit/situation evidence.");
  }
  const horizons = validateHorizons(
    input.horizons ?? A1_COMMITMENT_DELIBERATION_RESEARCH_HORIZONS
  );

  const rows = horizons.map((horizonSeconds): A1SpatialCommitmentDeliberationHorizonRow => {
    const hypotheses = buildA1PlayerFutureHypotheses({
      situation: input.situation,
      horizonSeconds,
      staticTraversal: (from, to, radius, options) =>
        input.world.staticCircleTraversal(from, to, radius, options)
    });
    const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
    const playerFutureSet = buildA1SpatialCommitmentPlayerFutureSetEvidence({
      world: input.world,
      fit: input.fit,
      snapshot: input.world.snapshot(),
      plan
    });
    const jointFutureSet = buildA1SpatialCommitmentJointFutureSetEvidence({
      world: input.world,
      fit: input.fit,
      situation: input.situation,
      playerFutureSet
    });
    const review = buildA1SpatialCommitmentReviewEvidence(
      input.fit,
      null,
      null,
      playerFutureSet,
      jointFutureSet
    );
    const deliberation = buildA1SpatialCommitmentDeliberationFrame(review);
    const h1 = deliberation.ownerRequestFutureId;
    const ownerEntry = h1
      ? playerFutureSet.futures.find((value) => value.futureId === h1) ?? null
      : null;
    const ownerRequestAnchorOverlap = ownerEntry?.interventionStatus === "REHEARSABLE"
      ? ownerEntry.occupancy.status === "SAMPLED_PLAYER_FUTURE_OVERLAP"
      : ownerEntry
        ? null
        : null;
    const ownerRequestJointContact = h1
      ? jointFutureSet.contactFutureIds.includes(h1)
      : null;

    return {
      horizonSeconds,
      ownerRequestFutureId: h1,
      ownerRequestAnchorOverlap,
      ownerRequestJointContact,
      yieldReasonPresent: yieldReason(deliberation),
      directCapabilityClipped:
        jointFutureSet.directRealization.realization?.capabilityClipped ?? null,
      directTerminalAnchorError:
        jointFutureSet.directRealization.terminalAnchorError,
      directCommandVelocity:
        jointFutureSet.directRealization.realization
          ? { ...jointFutureSet.directRealization.realization.commandVelocity }
          : null,
      deliberation
    };
  });

  return {
    kind: "A1_SPATIAL_COMMITMENT_DELIBERATION_HORIZON_SCAN",
    sourceTick: input.situation.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    horizons,
    rows,
    horizonMeaning: "EXECUTION_ARRIVAL_HYPOTHESIS_AND_REHEARSAL_DURATION",
    horizonPolicyClaim: "NONE_SCAN_ONLY",
    crossHorizonAggregationClaim: "NONE",
    preferredHorizonClaim: "NONE",
    persistenceClaim: "NONE_PER_HORIZON_COUNTERFACTUALS_ONLY",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE"
  };
}
