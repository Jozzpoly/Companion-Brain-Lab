import {
  realizeA1DirectCandidate,
  type A1DirectCandidateRealization
} from "./a1-companion-candidates";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import type { A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentDirectRealization } from "./a1-spatial-commitment-direct-realization";
import {
  buildA1SpatialCommitmentOwnerFlowImpactFromRealization,
  type A1SpatialCommitmentOwnerFlowImpactEvidence
} from "./a1-spatial-commitment-owner-flow-impact";
import type { Vec2 } from "../world/types";
import type { LabWorld } from "../world/world";

const EPSILON = 1e-9;

export interface A1SpatialCommitmentFixedCommandOwnerFlowImpactRow {
  observationHorizonSeconds: number;
  ownerRequestFutureId: string;
  fixedCompanionCommandVelocity: Vec2;
  impact: A1SpatialCommitmentOwnerFlowImpactEvidence;
}

export interface A1SpatialCommitmentFixedCommandOwnerFlowImpactScan {
  kind: "A1_SPATIAL_COMMITMENT_FIXED_COMMAND_OWNER_FLOW_IMPACT_SCAN";
  sourceTick: number;
  commitmentSourceTick: number;
  commandArrivalHypothesisSeconds: number;
  fixedCompanionCommandVelocity: Vec2;
  commandSourceCapabilityClipped: boolean;
  commandSourceTerminalAnchorError: number;
  rows: readonly A1SpatialCommitmentFixedCommandOwnerFlowImpactRow[];
  commandAcrossRowsClaim: "EXACTLY_FIXED_EXECUTABLE_VELOCITY";
  observationAxisClaim: "ONLY_REHEARSAL_DURATION_CHANGES_ACROSS_ROWS";
  holdComparatorClaim: "SAME_OWNER_FUTURE_COMPANION_HOLD_PER_ROW_NOT_POLICY";
  impactClaim: "FRAMEWISE_MEASURED_DIFFERENCE_ONLY_NO_HARM_THRESHOLD";
  horizonPolicyClaim: "NONE_SCAN_ONLY";
  rightOfWayPriorityClaim: "NONE";
  yieldPolicyClaim: "NONE";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function validatedHorizons(values: readonly number[]): number[] {
  if (values.length === 0) {
    throw new Error("A1 fixed-command Owner-flow impact scan requires at least one observation horizon.");
  }
  const result: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("A1 fixed-command Owner-flow impact horizons must be positive and finite.");
    }
    if (result.some((existing) => Math.abs(existing - value) <= EPSILON)) {
      throw new Error(`A1 fixed-command Owner-flow impact scan refuses duplicate horizon ${value}.`);
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
    throw new Error("A1 fixed-command Owner-flow impact requires exactly one Owner-request future.");
  }
  const value = matches[0]!;
  if (value.status !== "REHEARSABLE") {
    throw new Error(
      `A1 fixed-command Owner-flow impact Owner future is unresolved: ${value.unresolvedReason}.`
    );
  }
  return value;
}

function fixedRealization(input: {
  situation: A1Situation;
  commandVelocity: Vec2;
  horizonSeconds: number;
}): A1DirectCandidateRealization {
  const realization = realizeA1DirectCandidate({
    candidate: {
      id: "commitment-anchor-owner-flow-fixed-command",
      family: "COMMITMENT_ANCHOR_DIRECT",
      sourceTick: input.situation.tick,
      desiredVelocity: { ...input.commandVelocity },
      localBasisSource: "NONE"
    },
    capability: input.situation.situated.companionCapability,
    horizonSeconds: input.horizonSeconds
  });
  if (distance(realization.commandVelocity, input.commandVelocity) > EPSILON) {
    throw new Error(
      "A1 fixed-command Owner-flow impact scan changed executable companion velocity across rows."
    );
  }
  return realization;
}

/**
 * Holds one executable commitment command constant while extending only the
 * observation/rehearsal window. Each row compares that same command against the
 * same-future companion-HOLD comparator through the common Owner-flow impact
 * measurement substrate.
 */
export function buildA1SpatialCommitmentFixedCommandOwnerFlowImpactScan(input: {
  world: LabWorld;
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  commandArrivalHypothesisSeconds: number;
  observationHorizons: readonly number[];
}): A1SpatialCommitmentFixedCommandOwnerFlowImpactScan {
  if (
    input.fit.sourceTick !== input.situation.tick ||
    input.fit.commitmentSourceTick > input.fit.sourceTick
  ) {
    throw new Error(
      "A1 fixed-command Owner-flow impact scan requires aligned fit/situation evidence."
    );
  }
  const observationHorizons = validatedHorizons(input.observationHorizons);
  const commandSource = buildA1SpatialCommitmentDirectRealization({
    fit: input.fit,
    situation: input.situation,
    horizonSeconds: input.commandArrivalHypothesisSeconds
  });
  if (
    commandSource.status !== "REALIZED" ||
    !commandSource.realization ||
    commandSource.terminalAnchorError === null
  ) {
    throw new Error(
      "A1 fixed-command Owner-flow impact scan requires a resolved direct-to-anchor command source."
    );
  }

  const fixedCommand = { ...commandSource.realization.commandVelocity };
  const rows = observationHorizons.map(
    (observationHorizonSeconds): A1SpatialCommitmentFixedCommandOwnerFlowImpactRow => {
      const hypotheses = buildA1PlayerFutureHypotheses({
        situation: input.situation,
        horizonSeconds: observationHorizonSeconds,
        staticTraversal: (from, to, radius, options) =>
          input.world.staticCircleTraversal(from, to, radius, options)
      });
      const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
      const h1 = ownerRequest(plan);
      const realization = fixedRealization({
        situation: input.situation,
        commandVelocity: fixedCommand,
        horizonSeconds: observationHorizonSeconds
      });
      const impact = buildA1SpatialCommitmentOwnerFlowImpactFromRealization({
        world: input.world,
        fit: input.fit,
        situation: input.situation,
        ownerRequestIntervention: h1,
        companionRealization: realization
      });

      return {
        observationHorizonSeconds,
        ownerRequestFutureId: h1.futureId,
        fixedCompanionCommandVelocity: { ...realization.commandVelocity },
        impact
      };
    }
  );

  return {
    kind: "A1_SPATIAL_COMMITMENT_FIXED_COMMAND_OWNER_FLOW_IMPACT_SCAN",
    sourceTick: input.situation.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    commandArrivalHypothesisSeconds: input.commandArrivalHypothesisSeconds,
    fixedCompanionCommandVelocity: fixedCommand,
    commandSourceCapabilityClipped: commandSource.realization.capabilityClipped,
    commandSourceTerminalAnchorError: commandSource.terminalAnchorError,
    rows,
    commandAcrossRowsClaim: "EXACTLY_FIXED_EXECUTABLE_VELOCITY",
    observationAxisClaim: "ONLY_REHEARSAL_DURATION_CHANGES_ACROSS_ROWS",
    holdComparatorClaim: "SAME_OWNER_FUTURE_COMPANION_HOLD_PER_ROW_NOT_POLICY",
    impactClaim: "FRAMEWISE_MEASURED_DIFFERENCE_ONLY_NO_HARM_THRESHOLD",
    horizonPolicyClaim: "NONE_SCAN_ONLY",
    rightOfWayPriorityClaim: "NONE",
    yieldPolicyClaim: "NONE",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE"
  };
}
