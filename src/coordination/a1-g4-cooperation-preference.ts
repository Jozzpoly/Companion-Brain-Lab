import type { A1G3JointTracePolicyEvidence } from "./a1-g3-joint-trace-policy";
import type { A1PlayerAgencyTrajectoryEvidence } from "./a1-player-agency-trajectory";

const ALIGNMENT_EPSILON = 1e-8;

export type A1G4CandidateViability = "G3_PASS" | "G3_REQUIRES_COOPERATION";

export interface A1G4CandidateEvidence {
  candidateId: string;
  g3: A1G3JointTracePolicyEvidence;
  agency: A1PlayerAgencyTrajectoryEvidence;
}

export type A1G4CooperationComparisonStatus =
  | "YIELD_PREFERRED_OVER_NEW_CONTACT"
  | "NO_COOPERATION_PREFERENCE_BOTH_G3_PASS"
  | "FORCED_CONTENTION_NO_G3_PASS_ALTERNATIVE";

export type A1G4CooperationPreferenceDecision =
  | "PREFER_A"
  | "PREFER_B"
  | "NO_PREFERENCE"
  | "FORCED_CONTENTION";

export interface A1G4CooperationComparisonEvidence {
  kind: "A1_G4_COOPERATION_COMPARISON_EVIDENCE";
  sourceTick: number;
  playerFutureId: string;
  playerFutureFamily: A1PlayerAgencyTrajectoryEvidence["playerFutureFamily"];
  playerCausalMeaning: A1PlayerAgencyTrajectoryEvidence["playerCausalMeaning"];
  playerFlowBasisState: A1PlayerAgencyTrajectoryEvidence["flowBasisState"];
  candidateAId: string;
  candidateBId: string;
  candidateAViability: A1G4CandidateViability;
  candidateBViability: A1G4CandidateViability;
  status: A1G4CooperationComparisonStatus;
  decision: A1G4CooperationPreferenceDecision;
  preferredCandidateId: string | null;
  reason: string;
  candidateFamilySemanticsClaim: "NONE_OUTCOME_EVIDENCE_ONLY_A1_2N";
  comfortEnvelopeClaim: "NONE_A1_2N";
  cooperationScopeClaim: "ASYMMETRIC_PLAYER_AGENCY_NEW_CONTACT_AVOIDANCE_A1_2N";
  globalSelectionClaim: "NONE_PAIRWISE_COOPERATION_ONLY_A1_2N";
  runtimeAuthorityClaim: "NONE_A1_2N";
  candidateA: A1G4CandidateEvidence;
  candidateB: A1G4CandidateEvidence;
}

function vectorDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function validateCandidate(label: "A" | "B", value: A1G4CandidateEvidence): A1G4CandidateViability {
  if (!value.candidateId) throw new Error(`A1.2n candidate ${label} requires a non-empty id.`);
  if (value.agency.kind !== "A1_PLAYER_AGENCY_TRAJECTORY_EVIDENCE") {
    throw new Error(`A1.2n candidate ${label} requires qualified A1.2m agency evidence.`);
  }
  if (value.g3.kind !== "A1_G3_JOINT_TRACE_POLICY_EVIDENCE") {
    throw new Error(`A1.2n candidate ${label} requires qualified A1.2l G3 evidence.`);
  }
  if (value.agency.cooperationDecisionClaim !== "NONE_A1_2M_EVIDENCE_ONLY") {
    throw new Error(`A1.2n candidate ${label} agency evidence already claims cooperation authority.`);
  }
  if (value.agency.selectionClaim !== "NONE_A1_2M_EVIDENCE_ONLY") {
    throw new Error(`A1.2n candidate ${label} agency evidence already claims selection authority.`);
  }
  if (value.agency.runtimeAuthorityClaim !== "NONE_A1_2M_EVIDENCE_ONLY") {
    throw new Error(`A1.2n candidate ${label} agency evidence already claims runtime authority.`);
  }
  if (value.g3.cooperationClaim !== "NONE_G4_REQUIRED_FOR_CONTACT_QUALITY_A1_2L") {
    throw new Error(`A1.2n candidate ${label} G3 evidence has unexpected cooperation provenance.`);
  }
  if (value.g3.selectionClaim !== "NONE_A1_2L_POLICY_ONLY") {
    throw new Error(`A1.2n candidate ${label} G3 evidence already claims selection authority.`);
  }
  if (value.g3.runtimeAuthorityClaim !== "NONE_A1_2L") {
    throw new Error(`A1.2n candidate ${label} G3 evidence already claims runtime authority.`);
  }
  if (value.candidateId !== value.agency.companionCandidateId) {
    throw new Error(`A1.2n candidate ${label} id does not match A1.2m agency evidence.`);
  }
  if (value.candidateId !== value.g3.companionCandidateId) {
    throw new Error(`A1.2n candidate ${label} id does not match A1.2l G3 evidence.`);
  }
  if (value.agency.sourceTick !== value.g3.sourceTick) {
    throw new Error(`A1.2n candidate ${label} source tick is misaligned between G3 and agency evidence.`);
  }
  if (value.agency.playerFutureId !== value.g3.playerFutureId) {
    throw new Error(`A1.2n candidate ${label} player future is misaligned between G3 and agency evidence.`);
  }

  if (value.g3.decision === "PASS") return "G3_PASS";
  if (value.g3.decision === "REQUIRE_G4") return "G3_REQUIRES_COOPERATION";

  throw new Error(
    `A1.2n refuses candidate ${label} because upstream G3 decision ${value.g3.decision} is not cooperation-comparable.`
  );
}

function assertSamePlayerFuture(a: A1G4CandidateEvidence, b: A1G4CandidateEvidence): void {
  if (a.agency.sourceTick !== b.agency.sourceTick) {
    throw new Error("A1.2n requires candidate futures from the same source tick.");
  }
  if (a.agency.playerFutureId !== b.agency.playerFutureId) {
    throw new Error("A1.2n requires candidate futures under the same player-future id.");
  }
  if (a.agency.playerFutureFamily !== b.agency.playerFutureFamily) {
    throw new Error("A1.2n requires candidate futures under the same player-future family.");
  }
  if (a.agency.playerCausalMeaning !== b.agency.playerCausalMeaning) {
    throw new Error("A1.2n requires candidate futures under the same player causal meaning.");
  }
  if (vectorDistance(a.agency.playerVelocity, b.agency.playerVelocity) > ALIGNMENT_EPSILON) {
    throw new Error("A1.2n requires candidate futures under the same rehearsed player velocity.");
  }
  if (a.agency.flowBasisState !== b.agency.flowBasisState) {
    throw new Error("A1.2n requires candidate futures with the same player-flow basis state.");
  }
}

function common(input: {
  a: A1G4CandidateEvidence;
  b: A1G4CandidateEvidence;
  aViability: A1G4CandidateViability;
  bViability: A1G4CandidateViability;
  status: A1G4CooperationComparisonStatus;
  decision: A1G4CooperationPreferenceDecision;
  preferredCandidateId: string | null;
  reason: string;
}): A1G4CooperationComparisonEvidence {
  return {
    kind: "A1_G4_COOPERATION_COMPARISON_EVIDENCE",
    sourceTick: input.a.agency.sourceTick,
    playerFutureId: input.a.agency.playerFutureId,
    playerFutureFamily: input.a.agency.playerFutureFamily,
    playerCausalMeaning: input.a.agency.playerCausalMeaning,
    playerFlowBasisState: input.a.agency.flowBasisState,
    candidateAId: input.a.candidateId,
    candidateBId: input.b.candidateId,
    candidateAViability: input.aViability,
    candidateBViability: input.bViability,
    status: input.status,
    decision: input.decision,
    preferredCandidateId: input.preferredCandidateId,
    reason: input.reason,
    candidateFamilySemanticsClaim: "NONE_OUTCOME_EVIDENCE_ONLY_A1_2N",
    comfortEnvelopeClaim: "NONE_A1_2N",
    cooperationScopeClaim: "ASYMMETRIC_PLAYER_AGENCY_NEW_CONTACT_AVOIDANCE_A1_2N",
    globalSelectionClaim: "NONE_PAIRWISE_COOPERATION_ONLY_A1_2N",
    runtimeAuthorityClaim: "NONE_A1_2N",
    candidateA: input.a,
    candidateB: input.b
  };
}

/**
 * First bounded G4 policy: compare two otherwise G3-comparable candidate
 * futures under the exact same player counterfactual. New reciprocal contact
 * is avoidable player-agency conflict when another candidate passes G3.
 *
 * This deliberately does not score comfort distance, cross-front etiquette,
 * relationship utility or candidate family names. It is pairwise cooperation
 * evidence only, not a global selector.
 */
export function compareA1G4CooperationCandidates(input: {
  candidateA: A1G4CandidateEvidence;
  candidateB: A1G4CandidateEvidence;
}): A1G4CooperationComparisonEvidence {
  const a = input.candidateA;
  const b = input.candidateB;
  if (a.candidateId === b.candidateId) {
    throw new Error("A1.2n requires two distinct candidate ids.");
  }
  const aViability = validateCandidate("A", a);
  const bViability = validateCandidate("B", b);
  assertSamePlayerFuture(a, b);

  if (aViability === "G3_PASS" && bViability === "G3_REQUIRES_COOPERATION") {
    return common({
      a,
      b,
      aViability,
      bViability,
      status: "YIELD_PREFERRED_OVER_NEW_CONTACT",
      decision: "PREFER_A",
      preferredCandidateId: a.candidateId,
      reason: "candidate A preserves a G3-pass joint future while candidate B creates new reciprocal player/companion contact under the same player future"
    });
  }

  if (bViability === "G3_PASS" && aViability === "G3_REQUIRES_COOPERATION") {
    return common({
      a,
      b,
      aViability,
      bViability,
      status: "YIELD_PREFERRED_OVER_NEW_CONTACT",
      decision: "PREFER_B",
      preferredCandidateId: b.candidateId,
      reason: "candidate B preserves a G3-pass joint future while candidate A creates new reciprocal player/companion contact under the same player future"
    });
  }

  if (aViability === "G3_REQUIRES_COOPERATION" && bViability === "G3_REQUIRES_COOPERATION") {
    return common({
      a,
      b,
      aViability,
      bViability,
      status: "FORCED_CONTENTION_NO_G3_PASS_ALTERNATIVE",
      decision: "FORCED_CONTENTION",
      preferredCandidateId: null,
      reason: "both candidate futures create new reciprocal contact; this bounded G4 slice has no clear yielding alternative to prefer"
    });
  }

  return common({
    a,
    b,
    aViability,
    bViability,
    status: "NO_COOPERATION_PREFERENCE_BOTH_G3_PASS",
    decision: "NO_PREFERENCE",
    preferredCandidateId: null,
    reason: "both candidate futures already pass G3; this bounded G4 slice does not invent a comfort or family-label preference between them"
  });
}
