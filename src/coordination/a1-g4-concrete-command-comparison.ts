import type { A1FixedCommandFutureRehearsed } from "./a1-fixed-command-cross-future-profile";
import {
  compareA1G4CooperationCandidatesWithIdentity,
  type A1G4CooperationComparisonEvidence,
  type A1G4CooperationPreferenceDecision
} from "./a1-g4-cooperation-preference";
import type { Vec2 } from "../world/types";

const COMMAND_EPSILON = 1e-9;

export interface A1G4ConcreteCommandComparisonEvidence {
  kind: "A1_G4_CONCRETE_COMMAND_COMPARISON_EVIDENCE";
  sourceTick: number;
  playerFutureId: string;
  playerFutureFamily: A1FixedCommandFutureRehearsed["futureFamily"];
  playerCausalMeaning: A1FixedCommandFutureRehearsed["playerCausalMeaning"];
  proposalAId: string;
  proposalBId: string;
  commandAVelocity: Vec2;
  commandBVelocity: Vec2;
  candidateAProvenanceId: string;
  candidateBProvenanceId: string;
  sameCandidateProvenanceId: boolean;
  policy: A1G4CooperationComparisonEvidence;
  decision: A1G4CooperationPreferenceDecision;
  preferredProposalId: string | null;
  actionIdentityClaim: "A1_2O_PROPOSAL_ID_EXECUTABLE_COMMAND_IDENTITY";
  candidateIdClaim: "A1_2L_M_CANDIDATE_ID_PROVENANCE_ONLY_NOT_ACTION_ID_A1_2R0";
  policyReuseClaim: "A1_2N_POLICY_REUSED_WITH_EXPLICIT_ACTION_COMPARISON_IDS_A1_2R0";
  relationshipUtilityClaim: "NONE_A1_2R0_G4_ONLY";
  graphAggregationClaim: "NONE_PAIRWISE_COMPARISON_ONLY_A1_2R0";
  selectionClaim: "NONE_PAIRWISE_RELATION_ONLY_A1_2R0";
  runtimeAuthorityClaim: "NONE_A1_2R0";
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function validateEntry(label: "A" | "B", entry: A1FixedCommandFutureRehearsed): void {
  if (entry.status !== "REHEARSED") {
    throw new Error(`A1.2r0 command ${label} requires a REHEARSED A1.2p future entry.`);
  }
  if (!entry.proposalId) {
    throw new Error(`A1.2r0 command ${label} requires a non-empty A1.2o proposal id.`);
  }
  finiteVector(entry.commandVelocity, `A1.2r0 command ${label} velocity`);
  if (entry.fixedCommandClaim !== "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P") {
    throw new Error(`A1.2r0 command ${label} requires the qualified A1.2p fixed-command boundary.`);
  }
  if (entry.selectionClaim !== "NONE_A1_2P" || entry.runtimeAuthorityClaim !== "NONE_A1_2P") {
    throw new Error(`A1.2r0 command ${label} refuses upstream selection or runtime authority.`);
  }
  if (vectorDistance(entry.commandVelocity, entry.rehearsal.companionCommandVelocity) > COMMAND_EPSILON) {
    throw new Error(`A1.2r0 command ${label} velocity does not match its same-physics rehearsal.`);
  }
  if (vectorDistance(entry.commandVelocity, entry.playerAgency.companionCommandVelocity) > COMMAND_EPSILON) {
    throw new Error(`A1.2r0 command ${label} velocity does not match A1.2m agency evidence.`);
  }
}

function preferredProposal(
  decision: A1G4CooperationPreferenceDecision,
  a: A1FixedCommandFutureRehearsed,
  b: A1FixedCommandFutureRehearsed
): string | null {
  if (decision === "PREFER_A") return a.proposalId;
  if (decision === "PREFER_B") return b.proposalId;
  return null;
}

/**
 * A1.2r0 repairs the identity boundary needed before relation-graph work.
 * A1.2o proposal ids identify concrete executable commands; A1.2l/m candidate
 * ids remain generation/evidence provenance. The qualified A1.2n cooperation
 * policy is reused unchanged with proposal ids supplied only as comparison
 * identity. No graph aggregation, ranking, selection or runtime authority is
 * introduced here.
 */
export function compareA1G4ConcreteCommands(input: {
  commandA: A1FixedCommandFutureRehearsed;
  commandB: A1FixedCommandFutureRehearsed;
}): A1G4ConcreteCommandComparisonEvidence {
  const a = input.commandA;
  const b = input.commandB;
  validateEntry("A", a);
  validateEntry("B", b);

  if (a.proposalId === b.proposalId) {
    throw new Error("A1.2r0 requires two distinct A1.2o proposal ids.");
  }
  if (vectorDistance(a.commandVelocity, b.commandVelocity) <= COMMAND_EPSILON) {
    throw new Error(
      "A1.2r0 distinct proposal ids unexpectedly resolve to the same executable command velocity; A1.2o dedup identity is violated."
    );
  }

  const policy = compareA1G4CooperationCandidatesWithIdentity({
    candidateA: {
      candidateId: a.g3.companionCandidateId,
      g3: a.g3,
      agency: a.playerAgency
    },
    candidateB: {
      candidateId: b.g3.companionCandidateId,
      g3: b.g3,
      agency: b.playerAgency
    },
    comparisonAId: a.proposalId,
    comparisonBId: b.proposalId
  });

  return {
    kind: "A1_G4_CONCRETE_COMMAND_COMPARISON_EVIDENCE",
    sourceTick: policy.sourceTick,
    playerFutureId: policy.playerFutureId,
    playerFutureFamily: a.futureFamily,
    playerCausalMeaning: a.playerCausalMeaning,
    proposalAId: a.proposalId,
    proposalBId: b.proposalId,
    commandAVelocity: { ...a.commandVelocity },
    commandBVelocity: { ...b.commandVelocity },
    candidateAProvenanceId: a.g3.companionCandidateId,
    candidateBProvenanceId: b.g3.companionCandidateId,
    sameCandidateProvenanceId: a.g3.companionCandidateId === b.g3.companionCandidateId,
    policy,
    decision: policy.decision,
    preferredProposalId: preferredProposal(policy.decision, a, b),
    actionIdentityClaim: "A1_2O_PROPOSAL_ID_EXECUTABLE_COMMAND_IDENTITY",
    candidateIdClaim: "A1_2L_M_CANDIDATE_ID_PROVENANCE_ONLY_NOT_ACTION_ID_A1_2R0",
    policyReuseClaim: "A1_2N_POLICY_REUSED_WITH_EXPLICIT_ACTION_COMPARISON_IDS_A1_2R0",
    relationshipUtilityClaim: "NONE_A1_2R0_G4_ONLY",
    graphAggregationClaim: "NONE_PAIRWISE_COMPARISON_ONLY_A1_2R0",
    selectionClaim: "NONE_PAIRWISE_RELATION_ONLY_A1_2R0",
    runtimeAuthorityClaim: "NONE_A1_2R0"
  };
}
