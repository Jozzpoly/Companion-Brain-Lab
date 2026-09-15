import {
  evaluateA1DirectPlayerHardRadiusSafety,
  type A1DirectHardRadiusSafetyEvidence,
  type A1HardRadiusSafetyEvidence
} from "./a1-hard-radius-joint-safety";
import type { A1DirectCandidateRealization } from "./a1-companion-candidates";
import type { A1PlayerFutureHypothesis } from "./a1-player-future-hypotheses";
import type { A1Situation } from "./a1-situation";
import type { Vec2 } from "../world/types";

const CLEARANCE_EPSILON = 1e-8;
const TIME_EPSILON = 1e-9;

export type A1G3EgressPolicyStatus =
  | "PASS_CLEAR"
  | "PASS_MONOTONIC_EGRESS"
  | "HOLD_PREDICTED_TOUCH"
  | "HOLD_PREEXISTING_CONTACT_NOT_EGRESSING"
  | "FAIL_NEW_OVERLAP"
  | "FAIL_WORSENING_PREEXISTING_OVERLAP";

export type A1G3GateDecision = "PASS" | "HOLD" | "FAIL";

export interface A1G3EgressPolicyEvidence {
  kind: "A1_G3_EGRESS_POLICY_EVIDENCE";
  sourceTick: number;
  status: A1G3EgressPolicyStatus;
  decision: A1G3GateDecision;
  reason: string;
  initialHardClearance: number;
  minimumHardClearance: number;
  terminalHardClearance: number;
  startsInHardOverlap: boolean;
  startsAtHardTouch: boolean;
  endsInHardOverlap: boolean;
  monotonicEgressEvidence: boolean;
  physicalEvidence: A1HardRadiusSafetyEvidence;
  hardSafetyScopeClaim: "PLAYER_COMPANION_HARD_RADII_ONLY_A1_2F";
  touchPolicyClaim: "PREDICTED_TOUCH_HOLDS_A1_2F";
  cooperationClaim: "NONE_A1_2F";
  selectionClaim: "NONE_A1_2F_POLICY_ONLY";
  runtimeAuthorityClaim: "NONE_A1_2F";
}

export interface A1DirectG3EgressPolicyEvidence extends A1G3EgressPolicyEvidence {
  candidateId: string;
  candidateFamily: A1DirectCandidateRealization["family"];
  playerFutureId: string;
  playerFutureFamily: A1PlayerFutureHypothesis["family"];
  inputProvenance: "QUALIFIED_A1_2E_DIRECT_HARD_RADIUS_EVIDENCE";
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function finiteClearance(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function validatePhysicalEvidence(evidence: A1HardRadiusSafetyEvidence): void {
  if (evidence.kind !== "A1_HARD_RADIUS_PIECEWISE_SAFETY") {
    throw new Error("A1.2f requires A1.2e hard-radius physical evidence.");
  }
  if (evidence.comfortEnvelopeClaim !== "NONE_A1_2E_HARD_RADII_ONLY") {
    throw new Error("A1.2f refuses physical evidence that imports a comfort-envelope claim.");
  }
  if (evidence.staticLegalityClaim !== "NONE_A1_2E_PRIMITIVE_ONLY") {
    throw new Error("A1.2f refuses A1.2e evidence that claims static legality.");
  }
  if (evidence.cooperationClaim !== "NONE_A1_2E_PRIMITIVE_ONLY") {
    throw new Error("A1.2f refuses A1.2e evidence that claims cooperation.");
  }
  if (evidence.gateAuthorityClaim !== "NONE_A1_2E_PRIMITIVE_ONLY") {
    throw new Error("A1.2f requires pre-policy A1.2e evidence with zero gate authority.");
  }
  if (evidence.segments.length === 0) {
    throw new Error("A1.2f requires at least one A1.2e physical trajectory segment.");
  }
}

function segmentsAreMonotonicEgress(evidence: A1HardRadiusSafetyEvidence): boolean {
  return evidence.segments.every((segment) =>
    segment.closestApproachTimeSeconds <= segment.startTimeSeconds + TIME_EPSILON
  );
}

function common(input: {
  physicalEvidence: A1HardRadiusSafetyEvidence;
  initialHardClearance: number;
  terminalHardClearance: number;
  status: A1G3EgressPolicyStatus;
  decision: A1G3GateDecision;
  reason: string;
  monotonicEgressEvidence: boolean;
}): A1G3EgressPolicyEvidence {
  return {
    kind: "A1_G3_EGRESS_POLICY_EVIDENCE",
    sourceTick: input.physicalEvidence.sourceTick,
    status: input.status,
    decision: input.decision,
    reason: input.reason,
    initialHardClearance: input.initialHardClearance,
    minimumHardClearance: input.physicalEvidence.hardClearance,
    terminalHardClearance: input.terminalHardClearance,
    startsInHardOverlap: input.initialHardClearance < -CLEARANCE_EPSILON,
    startsAtHardTouch: Math.abs(input.initialHardClearance) <= CLEARANCE_EPSILON,
    endsInHardOverlap: input.terminalHardClearance < -CLEARANCE_EPSILON,
    monotonicEgressEvidence: input.monotonicEgressEvidence,
    physicalEvidence: input.physicalEvidence,
    hardSafetyScopeClaim: "PLAYER_COMPANION_HARD_RADII_ONLY_A1_2F",
    touchPolicyClaim: "PREDICTED_TOUCH_HOLDS_A1_2F",
    cooperationClaim: "NONE_A1_2F",
    selectionClaim: "NONE_A1_2F_POLICY_ONLY",
    runtimeAuthorityClaim: "NONE_A1_2F"
  };
}

/**
 * Converts raw A1.2e hard-radius geometry into a bounded G3 policy result.
 *
 * The policy deliberately distinguishes new/worsening overlap from recovery.
 * Pre-existing contact can pass only when every piecewise segment has its
 * closest point at the segment start and terminal hard clearance improves.
 * Predicted touch from a previously clear state holds rather than silently
 * becoming either a hard collision or a normal pass.
 */
export function evaluateA1G3EgressPolicy(input: {
  physicalEvidence: A1HardRadiusSafetyEvidence;
  initialHardClearance: number;
  terminalHardClearance: number;
}): A1G3EgressPolicyEvidence {
  validatePhysicalEvidence(input.physicalEvidence);
  const initial = finiteClearance(input.initialHardClearance, "A1.2f initial hard clearance");
  const terminal = finiteClearance(input.terminalHardClearance, "A1.2f terminal hard clearance");
  const minimum = input.physicalEvidence.hardClearance;
  if (!Number.isFinite(minimum)) {
    throw new Error("A1.2f minimum hard clearance must be finite.");
  }

  const startsOverlapping = initial < -CLEARANCE_EPSILON;
  const startsTouching = Math.abs(initial) <= CLEARANCE_EPSILON;
  const monotonicSegments = segmentsAreMonotonicEgress(input.physicalEvidence);
  const materiallyImproves = terminal > initial + CLEARANCE_EPSILON;
  const monotonicEgress = monotonicSegments && materiallyImproves;

  if (startsOverlapping) {
    if (minimum < initial - CLEARANCE_EPSILON) {
      return common({
        physicalEvidence: input.physicalEvidence,
        initialHardClearance: initial,
        terminalHardClearance: terminal,
        status: "FAIL_WORSENING_PREEXISTING_OVERLAP",
        decision: "FAIL",
        reason: "pre-existing hard overlap becomes deeper somewhere inside the predicted trajectory",
        monotonicEgressEvidence: false
      });
    }
    if (monotonicEgress) {
      return common({
        physicalEvidence: input.physicalEvidence,
        initialHardClearance: initial,
        terminalHardClearance: terminal,
        status: "PASS_MONOTONIC_EGRESS",
        decision: "PASS",
        reason: "pre-existing hard overlap never worsens and clearance increases monotonically across every segment",
        monotonicEgressEvidence: true
      });
    }
    return common({
      physicalEvidence: input.physicalEvidence,
      initialHardClearance: initial,
      terminalHardClearance: terminal,
      status: "HOLD_PREEXISTING_CONTACT_NOT_EGRESSING",
      decision: "HOLD",
      reason: "pre-existing hard overlap is not proven to egress monotonically",
      monotonicEgressEvidence: false
    });
  }

  if (startsTouching) {
    if (minimum < -CLEARANCE_EPSILON) {
      return common({
        physicalEvidence: input.physicalEvidence,
        initialHardClearance: initial,
        terminalHardClearance: terminal,
        status: "FAIL_NEW_OVERLAP",
        decision: "FAIL",
        reason: "initial hard contact becomes penetration inside the predicted trajectory",
        monotonicEgressEvidence: false
      });
    }
    if (monotonicEgress) {
      return common({
        physicalEvidence: input.physicalEvidence,
        initialHardClearance: initial,
        terminalHardClearance: terminal,
        status: "PASS_MONOTONIC_EGRESS",
        decision: "PASS",
        reason: "initial hard contact immediately and monotonically separates",
        monotonicEgressEvidence: true
      });
    }
    return common({
      physicalEvidence: input.physicalEvidence,
      initialHardClearance: initial,
      terminalHardClearance: terminal,
      status: "HOLD_PREEXISTING_CONTACT_NOT_EGRESSING",
      decision: "HOLD",
      reason: "initial hard contact is not proven to separate monotonically",
      monotonicEgressEvidence: false
    });
  }

  if (minimum < -CLEARANCE_EPSILON) {
    return common({
      physicalEvidence: input.physicalEvidence,
      initialHardClearance: initial,
      terminalHardClearance: terminal,
      status: "FAIL_NEW_OVERLAP",
      decision: "FAIL",
      reason: "an initially clear player/companion pair enters hard-body overlap",
      monotonicEgressEvidence: false
    });
  }

  if (Math.abs(minimum) <= CLEARANCE_EPSILON) {
    return common({
      physicalEvidence: input.physicalEvidence,
      initialHardClearance: initial,
      terminalHardClearance: terminal,
      status: "HOLD_PREDICTED_TOUCH",
      decision: "HOLD",
      reason: "trajectory reaches the hard-contact boundary; A1.2f does not silently promote touch to PASS",
      monotonicEgressEvidence: false
    });
  }

  return common({
    physicalEvidence: input.physicalEvidence,
    initialHardClearance: initial,
    terminalHardClearance: terminal,
    status: "PASS_CLEAR",
    decision: "PASS",
    reason: "trajectory remains strictly outside player/companion hard-body overlap",
    monotonicEgressEvidence: false
  });
}

/**
 * Qualified adapter from A1 situation + A1.2b DIRECT + A1.2c player future.
 * It delegates physical trajectory truth to A1.2e, then applies only the
 * egress-aware G3 policy above. No G2, G4, selection or runtime authority is
 * granted here.
 */
export function evaluateA1DirectPlayerG3EgressPolicy(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
  playerFuture: A1PlayerFutureHypothesis;
}): A1DirectG3EgressPolicyEvidence {
  const physicalEvidence: A1DirectHardRadiusSafetyEvidence =
    evaluateA1DirectPlayerHardRadiusSafety(input);
  const threshold = physicalEvidence.hardRadiusThreshold;
  const playerOrigin = input.situation.situated.playerBody.position;
  const companionOrigin = input.situation.situated.companionBody.position;
  const initialHardClearance = distance(playerOrigin, companionOrigin) - threshold;
  const companionEndpoint = add(companionOrigin, input.realization.predictedDisplacement);
  const playerEndpoint = input.playerFuture.staticFeasibility.feasibleEndpoint;
  const terminalHardClearance = distance(playerEndpoint, companionEndpoint) - threshold;
  const policy = evaluateA1G3EgressPolicy({
    physicalEvidence,
    initialHardClearance,
    terminalHardClearance
  });

  return {
    ...policy,
    candidateId: input.realization.candidateId,
    candidateFamily: input.realization.family,
    playerFutureId: input.playerFuture.id,
    playerFutureFamily: input.playerFuture.family,
    inputProvenance: "QUALIFIED_A1_2E_DIRECT_HARD_RADIUS_EVIDENCE"
  };
}
