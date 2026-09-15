import type {
  A1CommandRobustnessResearchDossier,
  A1CommandRobustnessResearchSet,
  A1CommandRobustnessFutureObservation
} from "./a1-command-robustness-research-dossier";
import type { A1PlayerFutureFamily } from "./a1-player-future-hypotheses";

const EPSILON = 1e-9;

const FUTURE_FAMILIES: readonly A1PlayerFutureFamily[] = [
  "OWNER_REQUEST_CONTINUATION",
  "BODY_RESPONSE_CONTINUATION",
  "TRANSITION_HOLD"
];

export type A1CrossFutureRole =
  | "OWNER_REQUEST_PRIMARY_COUNTERFACTUAL"
  | "BODY_RESPONSE_DIAGNOSTIC_COUNTERFACTUAL"
  | "TRANSITION_HOLD_DIAGNOSTIC_COUNTERFACTUAL";

export type A1PairUtilityOrder =
  | "A_HIGHER"
  | "B_HIGHER"
  | "EQUAL"
  | "UNAVAILABLE";

export type A1PairCooperationRelation =
  | "A_PREFERRED"
  | "B_PREFERRED"
  | "NO_PREFERENCE"
  | "FORCED_CONTENTION"
  | "NOT_COMPARABLE";

export interface A1CrossFuturePairObservation {
  futureFamily: A1PlayerFutureFamily;
  role: A1CrossFutureRole;
  futureId: string | null;
  aPhysicalStatus: A1CommandRobustnessFutureObservation["physicalStatus"];
  bPhysicalStatus: A1CommandRobustnessFutureObservation["physicalStatus"];
  utilityOrder: A1PairUtilityOrder;
  aTerminalUtility: number | null;
  bTerminalUtility: number | null;
  cooperationRelation: A1PairCooperationRelation;
  evidenceInterpretationClaim: "PAIRWISE_EVIDENCE_ONLY_NO_FUTURE_WEIGHTING_A1_2S1";
}

export interface A1CrossFuturePairContradiction {
  kind: "A1_CROSS_FUTURE_PAIR_CONTRADICTION";
  proposalAId: string;
  proposalBId: string;
  observations: readonly A1CrossFuturePairObservation[];
  missingUtilityFutureFamilies: readonly A1PlayerFutureFamily[];
  hasCrossFutureUtilityPreferenceConflict: boolean;
  hasOwnerAlternateUtilityPreferenceConflict: boolean;
  hasCrossFutureCooperationPreferenceConflict: boolean;
  hasOwnerAlternateCooperationPreferenceConflict: boolean;
  ownerUtilityOrder: A1PairUtilityOrder;
  ownerCooperationRelation: A1PairCooperationRelation;
  futureRoleClaim: "H1_OWNER_REQUEST_H2_BODY_RESPONSE_H3_TRANSITION_HOLD_PROVENANCE_ONLY_A1_2S1";
  weightingClaim: "NONE_A1_2S1";
  voteClaim: "NONE_A1_2S1";
  vetoClaim: "NONE_A1_2S1";
  worstCaseClaim: "NONE_A1_2S1";
  selectionClaim: "NONE_CONTRADICTION_ATLAS_ONLY_A1_2S1";
  runtimeAuthorityClaim: "NONE_A1_2S1";
}

export interface A1CrossFutureContradictionAtlas {
  kind: "A1_CROSS_FUTURE_CONTRADICTION_ATLAS";
  sourceTick: number;
  horizonSeconds: number;
  proposalIds: readonly string[];
  pairs: readonly A1CrossFuturePairContradiction[];
  pairCount: number;
  pairCoverageClaim: "ALL_UNORDERED_A1_2S0_PROPOSAL_PAIRS_A1_2S1";
  futureRoleClaim: "H1_OWNER_REQUEST_H2_BODY_RESPONSE_H3_TRANSITION_HOLD_PROVENANCE_ONLY_A1_2S1";
  contradictionMeaningClaim: "STRUCTURAL_DISAGREEMENT_NOT_POLICY_FAILURE_A1_2S1";
  weightingClaim: "NONE_A1_2S1";
  aggregationClaim: "NONE_A1_2S1";
  scalarScoreClaim: "NONE_A1_2S1";
  selectionClaim: "NONE_CONTRADICTION_ATLAS_ONLY_A1_2S1";
  runtimeAuthorityClaim: "NONE_A1_2S1";
}

function role(family: A1PlayerFutureFamily): A1CrossFutureRole {
  if (family === "OWNER_REQUEST_CONTINUATION") return "OWNER_REQUEST_PRIMARY_COUNTERFACTUAL";
  if (family === "BODY_RESPONSE_CONTINUATION") return "BODY_RESPONSE_DIAGNOSTIC_COUNTERFACTUAL";
  return "TRANSITION_HOLD_DIAGNOSTIC_COUNTERFACTUAL";
}

function exactObservation(
  dossier: A1CommandRobustnessResearchDossier,
  family: A1PlayerFutureFamily
): A1CommandRobustnessFutureObservation {
  const values = dossier.futures.filter((future) => future.futureFamily === family);
  if (values.length !== 1) {
    throw new Error(`A1.2s1 dossier ${dossier.proposalId} requires exactly one ${family} observation.`);
  }
  return values[0]!;
}

function terminalUtility(observation: A1CommandRobustnessFutureObservation): number | null {
  return observation.relationship.relationshipUtility?.terminalUtility.totalUtility ?? null;
}

function utilityOrder(
  a: A1CommandRobustnessFutureObservation,
  b: A1CommandRobustnessFutureObservation
): A1PairUtilityOrder {
  const aUtility = terminalUtility(a);
  const bUtility = terminalUtility(b);
  if (aUtility === null || bUtility === null) return "UNAVAILABLE";
  const delta = aUtility - bUtility;
  if (Math.abs(delta) <= EPSILON) return "EQUAL";
  return delta > 0 ? "A_HIGHER" : "B_HIGHER";
}

function includes(values: readonly string[], id: string): boolean {
  return values.includes(id);
}

function cooperationRelation(input: {
  a: A1CommandRobustnessFutureObservation;
  b: A1CommandRobustnessFutureObservation;
  aId: string;
  bId: string;
}): A1PairCooperationRelation {
  const aPreferred = includes(input.a.preferredOverProposalIds, input.bId);
  const bDominated = includes(input.b.dominatedByProposalIds, input.aId);
  const bPreferred = includes(input.b.preferredOverProposalIds, input.aId);
  const aDominated = includes(input.a.dominatedByProposalIds, input.bId);
  const forced =
    includes(input.a.forcedContentionWithProposalIds, input.bId) &&
    includes(input.b.forcedContentionWithProposalIds, input.aId);
  const noPreference =
    includes(input.a.noPreferenceWithProposalIds, input.bId) &&
    includes(input.b.noPreferenceWithProposalIds, input.aId);

  if (aPreferred !== bDominated) {
    throw new Error(`A1.2s1 asymmetric A-preferred relation for ${input.aId}/${input.bId}.`);
  }
  if (bPreferred !== aDominated) {
    throw new Error(`A1.2s1 asymmetric B-preferred relation for ${input.aId}/${input.bId}.`);
  }

  const relationCount = Number(aPreferred) + Number(bPreferred) + Number(forced) + Number(noPreference);
  if (relationCount > 1) {
    throw new Error(`A1.2s1 pair ${input.aId}/${input.bId} has contradictory A1.2r relation categories.`);
  }
  if (aPreferred) return "A_PREFERRED";
  if (bPreferred) return "B_PREFERRED";
  if (forced) return "FORCED_CONTENTION";
  if (noPreference) return "NO_PREFERENCE";
  return "NOT_COMPARABLE";
}

function oppositeUtility(order: A1PairUtilityOrder): A1PairUtilityOrder | null {
  if (order === "A_HIGHER") return "B_HIGHER";
  if (order === "B_HIGHER") return "A_HIGHER";
  return null;
}

function oppositeCooperation(
  relation: A1PairCooperationRelation
): A1PairCooperationRelation | null {
  if (relation === "A_PREFERRED") return "B_PREFERRED";
  if (relation === "B_PREFERRED") return "A_PREFERRED";
  return null;
}

function buildPair(
  a: A1CommandRobustnessResearchDossier,
  b: A1CommandRobustnessResearchDossier
): A1CrossFuturePairContradiction {
  if (a.sourceTick !== b.sourceTick || Math.abs(a.horizonSeconds - b.horizonSeconds) > EPSILON) {
    throw new Error(`A1.2s1 pair ${a.proposalId}/${b.proposalId} source tick/horizon mismatch.`);
  }
  if (
    a.robustnessPolicyClaim !== "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0" ||
    b.robustnessPolicyClaim !== "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0" ||
    a.selectionClaim !== "NONE_A1_2S0" ||
    b.selectionClaim !== "NONE_A1_2S0" ||
    a.runtimeAuthorityClaim !== "NONE_A1_2S0" ||
    b.runtimeAuthorityClaim !== "NONE_A1_2S0"
  ) {
    throw new Error("A1.2s1 refuses dossiers that already carry robustness policy or authority.");
  }

  const observations = FUTURE_FAMILIES.map((family): A1CrossFuturePairObservation => {
    const aObservation = exactObservation(a, family);
    const bObservation = exactObservation(b, family);
    if (aObservation.futureId !== bObservation.futureId) {
      throw new Error(`A1.2s1 pair ${a.proposalId}/${b.proposalId} ${family} future id mismatch.`);
    }
    return {
      futureFamily: family,
      role: role(family),
      futureId: aObservation.futureId,
      aPhysicalStatus: aObservation.physicalStatus,
      bPhysicalStatus: bObservation.physicalStatus,
      utilityOrder: utilityOrder(aObservation, bObservation),
      aTerminalUtility: terminalUtility(aObservation),
      bTerminalUtility: terminalUtility(bObservation),
      cooperationRelation: cooperationRelation({
        a: aObservation,
        b: bObservation,
        aId: a.proposalId,
        bId: b.proposalId
      }),
      evidenceInterpretationClaim: "PAIRWISE_EVIDENCE_ONLY_NO_FUTURE_WEIGHTING_A1_2S1"
    };
  });

  const availableUtilityOrders = observations
    .map((observation) => observation.utilityOrder)
    .filter((order): order is "A_HIGHER" | "B_HIGHER" | "EQUAL" => order !== "UNAVAILABLE");
  const availableCooperationPreferences = observations
    .map((observation) => observation.cooperationRelation)
    .filter((relation): relation is "A_PREFERRED" | "B_PREFERRED" =>
      relation === "A_PREFERRED" || relation === "B_PREFERRED"
    );
  const owner = observations.find((observation) => observation.futureFamily === "OWNER_REQUEST_CONTINUATION")!;
  const alternate = observations.filter((observation) => observation.futureFamily !== "OWNER_REQUEST_CONTINUATION");
  const ownerOppositeUtility = oppositeUtility(owner.utilityOrder);
  const ownerOppositeCooperation = oppositeCooperation(owner.cooperationRelation);

  return {
    kind: "A1_CROSS_FUTURE_PAIR_CONTRADICTION",
    proposalAId: a.proposalId,
    proposalBId: b.proposalId,
    observations,
    missingUtilityFutureFamilies: observations
      .filter((observation) => observation.utilityOrder === "UNAVAILABLE")
      .map((observation) => observation.futureFamily),
    hasCrossFutureUtilityPreferenceConflict:
      availableUtilityOrders.includes("A_HIGHER") && availableUtilityOrders.includes("B_HIGHER"),
    hasOwnerAlternateUtilityPreferenceConflict:
      ownerOppositeUtility !== null && alternate.some((observation) => observation.utilityOrder === ownerOppositeUtility),
    hasCrossFutureCooperationPreferenceConflict:
      availableCooperationPreferences.includes("A_PREFERRED") &&
      availableCooperationPreferences.includes("B_PREFERRED"),
    hasOwnerAlternateCooperationPreferenceConflict:
      ownerOppositeCooperation !== null &&
      alternate.some((observation) => observation.cooperationRelation === ownerOppositeCooperation),
    ownerUtilityOrder: owner.utilityOrder,
    ownerCooperationRelation: owner.cooperationRelation,
    futureRoleClaim: "H1_OWNER_REQUEST_H2_BODY_RESPONSE_H3_TRANSITION_HOLD_PROVENANCE_ONLY_A1_2S1",
    weightingClaim: "NONE_A1_2S1",
    voteClaim: "NONE_A1_2S1",
    vetoClaim: "NONE_A1_2S1",
    worstCaseClaim: "NONE_A1_2S1",
    selectionClaim: "NONE_CONTRADICTION_ATLAS_ONLY_A1_2S1",
    runtimeAuthorityClaim: "NONE_A1_2S1"
  };
}

/**
 * A1.2s1 exposes where already-qualified H1/H2/H3 evidence agrees, conflicts,
 * or is missing for the same pair of concrete commands. It does not decide how
 * those futures should be weighted and does not promote any robustness policy.
 */
export function buildA1CrossFutureContradictionAtlas(
  research: A1CommandRobustnessResearchSet
): A1CrossFutureContradictionAtlas {
  if (research.kind !== "A1_COMMAND_ROBUSTNESS_RESEARCH_SET") {
    throw new Error("A1.2s1 requires the qualified A1.2s0 robustness research set.");
  }
  if (
    research.robustnessPolicyClaim !== "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0" ||
    research.scalarScoreClaim !== "NONE_A1_2S0" ||
    research.selectionClaim !== "NONE_A1_2S0" ||
    research.runtimeAuthorityClaim !== "NONE_A1_2S0"
  ) {
    throw new Error("A1.2s1 refuses A1.2s0 input with policy, scalarization, selection or runtime authority.");
  }
  if (
    research.proposalIds.length !== research.dossiers.length ||
    research.proposalIds.some((id, index) => research.dossiers[index]?.proposalId !== id)
  ) {
    throw new Error("A1.2s1 requires exact ordered A1.2s0 dossier coverage.");
  }

  const pairs: A1CrossFuturePairContradiction[] = [];
  for (let aIndex = 0; aIndex < research.dossiers.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < research.dossiers.length; bIndex += 1) {
      pairs.push(buildPair(research.dossiers[aIndex]!, research.dossiers[bIndex]!));
    }
  }

  return {
    kind: "A1_CROSS_FUTURE_CONTRADICTION_ATLAS",
    sourceTick: research.sourceTick,
    horizonSeconds: research.horizonSeconds,
    proposalIds: [...research.proposalIds],
    pairs,
    pairCount: pairs.length,
    pairCoverageClaim: "ALL_UNORDERED_A1_2S0_PROPOSAL_PAIRS_A1_2S1",
    futureRoleClaim: "H1_OWNER_REQUEST_H2_BODY_RESPONSE_H3_TRANSITION_HOLD_PROVENANCE_ONLY_A1_2S1",
    contradictionMeaningClaim: "STRUCTURAL_DISAGREEMENT_NOT_POLICY_FAILURE_A1_2S1",
    weightingClaim: "NONE_A1_2S1",
    aggregationClaim: "NONE_A1_2S1",
    scalarScoreClaim: "NONE_A1_2S1",
    selectionClaim: "NONE_CONTRADICTION_ATLAS_ONLY_A1_2S1",
    runtimeAuthorityClaim: "NONE_A1_2S1"
  };
}
