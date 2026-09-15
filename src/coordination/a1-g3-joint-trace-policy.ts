import type { A1JointHardBodyTraceEvidence } from "./a1-joint-hard-body-trace";

const POLICY_NUMERIC_EPSILON = 1e-8;

export type A1G3JointTraceStatus =
  | "PASS_CLEAR"
  | "PASS_MONOTONIC_EGRESS"
  | "REQUIRE_G4_NEW_RECIPROCAL_CONTACT"
  | "HOLD_PREEXISTING_CONTACT_NOT_EGRESSING"
  | "FAIL_WORSENING_PREEXISTING_OVERLAP"
  | "UNRESOLVED_ASYMMETRIC_CONTACT_EVIDENCE"
  | "UNRESOLVED_GEOMETRY_CONTACT_DIVERGENCE";

export type A1G3JointTraceDecision = "PASS" | "REQUIRE_G4" | "HOLD" | "FAIL" | "UNRESOLVED";

export interface A1G3JointTracePolicyEvidence {
  kind: "A1_G3_JOINT_TRACE_POLICY_EVIDENCE";
  sourceTick: number;
  playerFutureId: string;
  companionCandidateId: string;
  status: A1G3JointTraceStatus;
  decision: A1G3JointTraceDecision;
  reason: string;
  initialHardClearance: number;
  minimumObservedHardClearanceIncludingInitial: number;
  terminalHardClearance: number;
  contactFrameCount: number;
  reciprocalContactFrameCount: number;
  asymmetricContactFrameCount: number;
  startsInHardOverlap: boolean;
  startsAtHardTouch: boolean;
  terminallySeparated: boolean;
  monotonicEgressEvidence: boolean;
  inputProvenance: "QUALIFIED_A1_2K_JOINT_HARD_BODY_TRACE";
  numericPolicyClaim: "NO_PENETRATION_DEPTH_ACCEPTANCE_THRESHOLD_A1_2L";
  contactPolicyClaim: "NEW_RECIPROCAL_CONTACT_REQUIRES_G4_A1_2L";
  cooperationClaim: "NONE_G4_REQUIRED_FOR_CONTACT_QUALITY_A1_2L";
  selectionClaim: "NONE_A1_2L_POLICY_ONLY";
  runtimeAuthorityClaim: "NONE_A1_2L";
  trace: A1JointHardBodyTraceEvidence;
}

function validateTrace(trace: A1JointHardBodyTraceEvidence): void {
  if (trace.kind !== "A1_JOINT_HARD_BODY_TRACE_EVIDENCE") {
    throw new Error("A1.2l requires qualified A1.2k joint hard-body trace evidence.");
  }
  if (trace.samplingScopeClaim !== "INITIAL_STATE_PLUS_POST_STEP_SAMPLES_A1_2K") {
    throw new Error("A1.2l requires the qualified A1.2k sampling scope.");
  }
  if (trace.contactEvidenceClaim !== "RAPIER_CONTACT_RECORDS_PER_POST_STEP_FRAME_A1_2K") {
    throw new Error("A1.2l requires qualified Rapier contact-record evidence.");
  }
  if (trace.continuousClosestApproachClaim !== "NONE_DISCRETE_SAMPLES_PLUS_CONTACT_RECORDS_ONLY_A1_2K") {
    throw new Error("A1.2l refuses trace evidence that invents continuous closest-approach authority.");
  }
  if (trace.g3PolicyClaim !== "NONE_A1_2K_TRACE_ONLY") {
    throw new Error("A1.2l refuses upstream evidence that already claims G3 policy authority.");
  }
  if (trace.cooperationClaim !== "NONE_A1_2K_TRACE_ONLY") {
    throw new Error("A1.2l refuses upstream evidence that already claims cooperation authority.");
  }
  if (trace.selectionClaim !== "NONE_A1_2K_TRACE_ONLY") {
    throw new Error("A1.2l refuses upstream evidence that already claims selection authority.");
  }
  if (trace.runtimeAuthorityClaim !== "NONE_A1_2K_TRACE_ONLY") {
    throw new Error("A1.2l refuses upstream evidence that already claims runtime authority.");
  }
  if (trace.frames.length !== trace.worldStepCount || trace.frames.length < 1) {
    throw new Error("A1.2l requires one qualified trace frame per World step.");
  }
  if (trace.contactFrameCount !== trace.reciprocalContactFrameCount + trace.asymmetricContactFrameCount) {
    throw new Error("A1.2l contact-frame accounting is inconsistent.");
  }
}

function common(
  trace: A1JointHardBodyTraceEvidence,
  status: A1G3JointTraceStatus,
  decision: A1G3JointTraceDecision,
  reason: string,
  monotonicEgressEvidence: boolean
): A1G3JointTracePolicyEvidence {
  return {
    kind: "A1_G3_JOINT_TRACE_POLICY_EVIDENCE",
    sourceTick: trace.sourceTick,
    playerFutureId: trace.playerFutureId,
    companionCandidateId: trace.companionCandidateId,
    status,
    decision,
    reason,
    initialHardClearance: trace.initialHardClearance,
    minimumObservedHardClearanceIncludingInitial: trace.minimumObservedHardClearanceIncludingInitial,
    terminalHardClearance: trace.terminalHardClearance,
    contactFrameCount: trace.contactFrameCount,
    reciprocalContactFrameCount: trace.reciprocalContactFrameCount,
    asymmetricContactFrameCount: trace.asymmetricContactFrameCount,
    startsInHardOverlap: trace.initialHardClearance < -POLICY_NUMERIC_EPSILON,
    startsAtHardTouch: Math.abs(trace.initialHardClearance) <= POLICY_NUMERIC_EPSILON,
    terminallySeparated: trace.terminalHardClearance > POLICY_NUMERIC_EPSILON,
    monotonicEgressEvidence,
    inputProvenance: "QUALIFIED_A1_2K_JOINT_HARD_BODY_TRACE",
    numericPolicyClaim: "NO_PENETRATION_DEPTH_ACCEPTANCE_THRESHOLD_A1_2L",
    contactPolicyClaim: "NEW_RECIPROCAL_CONTACT_REQUIRES_G4_A1_2L",
    cooperationClaim: "NONE_G4_REQUIRED_FOR_CONTACT_QUALITY_A1_2L",
    selectionClaim: "NONE_A1_2L_POLICY_ONLY",
    runtimeAuthorityClaim: "NONE_A1_2L",
    trace
  };
}

function isMonotonicEgress(trace: A1JointHardBodyTraceEvidence): boolean {
  let previous = trace.initialHardClearance;
  for (const frame of trace.frames) {
    if (frame.hardClearance < previous - POLICY_NUMERIC_EPSILON) return false;
    previous = frame.hardClearance;
  }
  return trace.terminalHardClearance > trace.initialHardClearance + POLICY_NUMERIC_EPSILON;
}

/**
 * A1.2l is a bounded G3 hard-body policy over already-qualified A1.2k trace
 * evidence. It deliberately does not define an acceptable penetration depth.
 * New reciprocal contact is routed to G4 cooperation/right-of-way instead of
 * being silently promoted to PASS or treated as a complete cooperation FAIL.
 */
export function evaluateA1G3JointTracePolicy(
  trace: A1JointHardBodyTraceEvidence
): A1G3JointTracePolicyEvidence {
  validateTrace(trace);

  if (trace.asymmetricContactFrameCount > 0) {
    return common(
      trace,
      "UNRESOLVED_ASYMMETRIC_CONTACT_EVIDENCE",
      "UNRESOLVED",
      "player/companion contact records disagree on at least one sampled World step",
      false
    );
  }

  const startsClear = trace.initialHardClearance > POLICY_NUMERIC_EPSILON;
  const startsPreexistingContact = !startsClear;

  if (startsClear) {
    if (trace.reciprocalContactFrameCount > 0) {
      return common(
        trace,
        "REQUIRE_G4_NEW_RECIPROCAL_CONTACT",
        "REQUIRE_G4",
        "an initially clear joint future creates reciprocal physical contact; cooperation/right-of-way must decide whether the command is acceptable",
        false
      );
    }

    if (trace.minimumObservedHardClearanceIncludingInitial <= POLICY_NUMERIC_EPSILON) {
      return common(
        trace,
        "UNRESOLVED_GEOMETRY_CONTACT_DIVERGENCE",
        "UNRESOLVED",
        "sampled hard-body geometry reaches touch/overlap without reciprocal Rapier contact evidence",
        false
      );
    }

    return common(
      trace,
      "PASS_CLEAR",
      "PASS",
      "the joint future remains strictly clear in sampled hard-body geometry and creates no player/companion contact records",
      false
    );
  }

  if (startsPreexistingContact && trace.minimumObservedHardClearanceIncludingInitial < trace.initialHardClearance - POLICY_NUMERIC_EPSILON) {
    return common(
      trace,
      "FAIL_WORSENING_PREEXISTING_OVERLAP",
      "FAIL",
      "pre-existing hard contact/overlap becomes materially deeper somewhere in the qualified joint trace",
      false
    );
  }

  const monotonicEgress = isMonotonicEgress(trace);
  if (monotonicEgress) {
    return common(
      trace,
      "PASS_MONOTONIC_EGRESS",
      "PASS",
      "pre-existing hard contact/overlap never worsens and sampled clearance improves monotonically",
      true
    );
  }

  return common(
    trace,
    "HOLD_PREEXISTING_CONTACT_NOT_EGRESSING",
    "HOLD",
    "pre-existing hard contact/overlap is not worsening but is not proven to egress monotonically",
    false
  );
}
