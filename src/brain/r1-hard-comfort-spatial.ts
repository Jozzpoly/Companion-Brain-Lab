import {
  S2C_ROUTE_CLEARANCE,
  type StaticTraversalQuery
} from "../navigation/static-router";
import type {
  MotionIntent,
  StaticCircleOccupancyResult,
  Vec2
} from "../world/types";
import {
  S3_SPATIAL_INTERVAL_TICKS,
  buildSpatialVelocityCandidates,
  chooseSpatialVelocity,
  observeSpatialEnvironment,
  type SpatialLocomotionDecision,
  type SpatialLocomotionInput,
  type SpatialVelocityCandidate
} from "./spatial-locomotion";

const COMFORT_STAY_VIOLATED_PENALTY = 1.25;
const COMFORT_ENTER_VIOLATION_PENALTY = 3.5;
const COMFORT_HOLD_WHILE_EGRESS_EXISTS_PENALTY = 4.0;

export type StaticOccupancyQuery = (
  center: Vec2,
  radius: number
) => StaticCircleOccupancyResult;

export interface R1SpatialLocomotionInput extends SpatialLocomotionInput {
  occupancy: StaticOccupancyQuery;
}

export interface R1SpatialRepairEvidence {
  comfortRadius: number;
  comfortStartViolated: boolean;
  comfortStartBlockers: readonly string[];
  rehabilitatedCandidateIds: readonly string[];
  hardRejectedCandidateIds: readonly string[];
  comfortExitCandidateIds: readonly string[];
  comfortViolatedCandidateIds: readonly string[];
}

export interface R1SpatialEvaluation {
  decision: SpatialLocomotionDecision;
  repair: R1SpatialRepairEvidence;
}

function baseScore(candidate: SpatialVelocityCandidate): number {
  return candidate.terms.routeDistance +
    candidate.terms.relationshipDistance +
    candidate.terms.clearancePenalty +
    candidate.terms.playerRiskPenalty +
    candidate.terms.continuityPenalty +
    candidate.terms.unnecessaryMotionPenalty;
}

function isStaticReject(candidate: SpatialVelocityCandidate): boolean {
  return candidate.rejectionReason?.startsWith("static:") ?? false;
}

function cloneCandidate(candidate: SpatialVelocityCandidate): SpatialVelocityCandidate {
  return {
    ...candidate,
    move: { ...candidate.move },
    worldVelocity: { ...candidate.worldVelocity },
    predictedPosition: { ...candidate.predictedPosition },
    terms: { ...candidate.terms }
  };
}

export function repairHardComfortCandidates(options: {
  input: R1SpatialLocomotionInput;
  candidates: readonly SpatialVelocityCandidate[];
}): { candidates: SpatialVelocityCandidate[]; evidence: R1SpatialRepairEvidence } {
  const companion = options.input.snapshot.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("R1 hard/comfort adapter requires companion state.");

  const comfortRadius = companion.radius + S2C_ROUTE_CLEARANCE;
  const comfortStart = options.input.occupancy(companion.position, comfortRadius);
  const comfortStartViolated = !comfortStart.clear;
  const rehabilitatedCandidateIds: string[] = [];
  const hardRejectedCandidateIds: string[] = [];
  const comfortExitCandidateIds: string[] = [];
  const comfortViolatedCandidateIds: string[] = [];

  const repaired = options.candidates.map((source) => {
    const candidate = cloneCandidate(source);
    const moving = candidate.speedFraction > 0.001;

    if (moving && isStaticReject(candidate)) {
      const hardTraversal = options.input.query(
        companion.position,
        candidate.predictedPosition,
        companion.radius
      );
      if (!hardTraversal.clear) {
        candidate.rejectionReason = `hard-static:${hardTraversal.blocker?.label ?? "unknown"}`;
        hardRejectedCandidateIds.push(candidate.id);
        return candidate;
      }

      candidate.hardRejected = false;
      candidate.rejectionReason = null;
      candidate.score = baseScore(candidate);
      rehabilitatedCandidateIds.push(candidate.id);
    }

    if (candidate.hardRejected) return candidate;

    const comfortEnd = options.input.occupancy(candidate.predictedPosition, comfortRadius);
    const comfortEndViolated = !comfortEnd.clear;
    if (comfortEndViolated) {
      comfortViolatedCandidateIds.push(candidate.id);
      candidate.score = baseScore(candidate) + (
        comfortStartViolated
          ? COMFORT_STAY_VIOLATED_PENALTY
          : COMFORT_ENTER_VIOLATION_PENALTY
      );
    } else {
      candidate.score = baseScore(candidate);
      if (comfortStartViolated && moving) comfortExitCandidateIds.push(candidate.id);
    }

    return candidate;
  });

  if (comfortStartViolated && comfortExitCandidateIds.length > 0) {
    const stop = repaired.find((candidate) => candidate.id === "stop" && !candidate.hardRejected);
    if (stop) stop.score += COMFORT_HOLD_WHILE_EGRESS_EXISTS_PENALTY;
  }

  return {
    candidates: repaired,
    evidence: {
      comfortRadius,
      comfortStartViolated,
      comfortStartBlockers: [...comfortStart.blockers],
      rehabilitatedCandidateIds,
      hardRejectedCandidateIds,
      comfortExitCandidateIds,
      comfortViolatedCandidateIds
    }
  };
}

export function evaluateR1SpatialLocomotion(input: R1SpatialLocomotionInput): R1SpatialEvaluation {
  const observation = observeSpatialEnvironment(input);
  const original = buildSpatialVelocityCandidates({
    observation,
    query: input.query,
    previousMove: input.previousMove
  });
  const repaired = repairHardComfortCandidates({ input, candidates: original });
  return {
    decision: chooseSpatialVelocity({ observation, candidates: repaired.candidates }),
    repair: repaired.evidence
  };
}

export class R1HardComfortSpatialBrain {
  private previousMove: Vec2 = { x: 0, y: 0 };
  private decisionValue: SpatialLocomotionDecision | null = null;
  private repairValue: R1SpatialRepairEvidence | null = null;
  private nextDecisionTick = 0;

  reset(): void {
    this.previousMove = { x: 0, y: 0 };
    this.decisionValue = null;
    this.repairValue = null;
    this.nextDecisionTick = 0;
  }

  intent(input: Omit<R1SpatialLocomotionInput, "previousMove">): MotionIntent {
    if (this.decisionValue === null || input.snapshot.tick >= this.nextDecisionTick) {
      const evaluation = evaluateR1SpatialLocomotion({ ...input, previousMove: this.previousMove });
      this.decisionValue = evaluation.decision;
      this.repairValue = evaluation.repair;
      this.previousMove = { ...this.decisionValue.selectedMove };
      this.nextDecisionTick = input.snapshot.tick + S3_SPATIAL_INTERVAL_TICKS;
    }
    return { actorId: "companion", move: { ...this.decisionValue.selectedMove } };
  }

  debugState(): SpatialLocomotionDecision | null {
    return this.decisionValue;
  }

  repairEvidence(): R1SpatialRepairEvidence | null {
    return this.repairValue ? {
      ...this.repairValue,
      comfortStartBlockers: [...this.repairValue.comfortStartBlockers],
      rehabilitatedCandidateIds: [...this.repairValue.rehabilitatedCandidateIds],
      hardRejectedCandidateIds: [...this.repairValue.hardRejectedCandidateIds],
      comfortExitCandidateIds: [...this.repairValue.comfortExitCandidateIds],
      comfortViolatedCandidateIds: [...this.repairValue.comfortViolatedCandidateIds]
    } : null;
  }
}
