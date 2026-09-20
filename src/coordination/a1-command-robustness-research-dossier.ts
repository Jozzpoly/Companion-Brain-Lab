import type {
  A1ConcreteCommandProposal,
  A1ConcreteCommandProposalSet
} from "./a1-concrete-command-proposals";
import type {
  A1FixedCommandCrossFutureProfile,
  A1FixedCommandFutureProfileEntry
} from "./a1-fixed-command-cross-future-profile";
import type {
  A1G4CrossFutureRelationGraphs,
  A1G4PlayerFutureRelationGraph,
  A1G4RelationGraphNode
} from "./a1-g4-command-relation-graph";
import type { A1PlayerFutureFamily } from "./a1-player-future-hypotheses";
import type {
  A1TerminalRelationshipUtilityEntry,
  A1TerminalRelationshipUtilityProfile
} from "./a1-terminal-relationship-utility";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;
const HORIZON_EPSILON = 1e-12;

const FUTURE_FAMILIES: readonly A1PlayerFutureFamily[] = [
  "OWNER_REQUEST_CONTINUATION",
  "BODY_RESPONSE_CONTINUATION",
  "TRANSITION_HOLD"
];

export interface A1CommandRobustnessFutureObservation {
  futureFamily: A1PlayerFutureFamily;
  futureId: string | null;
  physicalStatus: A1FixedCommandFutureProfileEntry["status"];
  physical: A1FixedCommandFutureProfileEntry;
  relationship: A1TerminalRelationshipUtilityEntry;
  relationNode: A1G4RelationGraphNode;
  preferredOverProposalIds: readonly string[];
  dominatedByProposalIds: readonly string[];
  noPreferenceWithProposalIds: readonly string[];
  forcedContentionWithProposalIds: readonly string[];
  forcedContentionComponentPeerIds: readonly string[];
  missingEvidenceMeaning: "PRESERVE_SOURCE_STATUS_NEVER_IMPUTE_SCORE_OR_FAILURE_A1_2S0";
  aggregationClaim: "NONE_SINGLE_FUTURE_OBSERVATION_A1_2S0";
}

export interface A1CommandRobustnessResearchDossier {
  kind: "A1_COMMAND_ROBUSTNESS_RESEARCH_DOSSIER";
  sourceTick: number;
  horizonSeconds: number;
  proposalId: string;
  commandVelocity: Vec2;
  generationOriginCount: number;
  canonicalFamilyProvenance: A1ConcreteCommandProposal["canonicalFamilyProvenance"];
  futures: readonly A1CommandRobustnessFutureObservation[];
  commandIdentityClaim: "A1_2O_PROPOSAL_ID_EXECUTABLE_COMMAND_IDENTITY";
  futureSeparationClaim: "H1_H2_H3_PRESERVED_AS_SEPARATE_OBSERVATIONS_A1_2S0";
  missingEvidenceClaim: "UNRESOLVED_ABSENT_REJECTED_ARE_NOT_ADVERSE_SCORES_A1_2S0";
  relationshipUtilityClaim: "A1_2Q_EVIDENCE_PRESERVED_NOT_AGGREGATED_A1_2S0";
  cooperationClaim: "A1_2R_RELATIONS_PRESERVED_NOT_SCALARIZED_A1_2S0";
  robustnessPolicyClaim: "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0";
  voteClaim: "NONE_A1_2S0";
  vetoClaim: "NONE_A1_2S0";
  scalarScoreClaim: "NONE_A1_2S0";
  selectionClaim: "NONE_A1_2S0";
  runtimeAuthorityClaim: "NONE_A1_2S0";
}

export interface A1CommandRobustnessResearchSet {
  kind: "A1_COMMAND_ROBUSTNESS_RESEARCH_SET";
  sourceTick: number;
  horizonSeconds: number;
  proposalIds: readonly string[];
  dossiers: readonly A1CommandRobustnessResearchDossier[];
  exactCoverageClaim: "EXACT_A1_2O_PROPOSAL_SET_A1_2S0";
  evidenceCompositionClaim: "A1_2P_Q_R_ALIGNED_WITHOUT_POLICY_A1_2S0";
  futureSeparationClaim: "NO_CROSS_FUTURE_AGGREGATION_A1_2S0";
  unresolvedMeaningClaim: "MISSING_EVIDENCE_NOT_NEGATIVE_EVIDENCE_A1_2S0";
  robustnessPolicyClaim: "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0";
  scalarScoreClaim: "NONE_A1_2S0";
  selectionClaim: "NONE_A1_2S0";
  runtimeAuthorityClaim: "NONE_A1_2S0";
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function exactOne<T>(values: readonly T[], label: string): T {
  if (values.length !== 1) throw new Error(`A1.2s0 requires exactly one ${label}.`);
  return values[0]!;
}

function otherProposal(pair: { proposalAId: string; proposalBId: string }, proposalId: string): string {
  if (pair.proposalAId === proposalId) return pair.proposalBId;
  if (pair.proposalBId === proposalId) return pair.proposalAId;
  throw new Error(`A1.2s0 pair does not contain proposal ${proposalId}.`);
}

function graphFor(
  graphs: A1G4CrossFutureRelationGraphs,
  family: A1PlayerFutureFamily
): A1G4PlayerFutureRelationGraph {
  return exactOne(
    graphs.graphs.filter((graph) => graph.futureFamily === family),
    `${family} A1.2r graph`
  );
}

function profileMaps(input: {
  proposalSet: A1ConcreteCommandProposalSet;
  physicalProfiles: readonly A1FixedCommandCrossFutureProfile[];
  utilityProfiles: readonly A1TerminalRelationshipUtilityProfile[];
}): {
  physical: ReadonlyMap<string, A1FixedCommandCrossFutureProfile>;
  utility: ReadonlyMap<string, A1TerminalRelationshipUtilityProfile>;
} {
  if (
    input.physicalProfiles.length !== input.proposalSet.proposals.length ||
    input.utilityProfiles.length !== input.proposalSet.proposals.length
  ) {
    throw new Error("A1.2s0 requires exactly one A1.2p and one A1.2q profile per A1.2o proposal.");
  }
  const physical = new Map<string, A1FixedCommandCrossFutureProfile>();
  const utility = new Map<string, A1TerminalRelationshipUtilityProfile>();
  for (const profile of input.physicalProfiles) {
    if (physical.has(profile.proposalId)) throw new Error(`A1.2s0 duplicate physical profile ${profile.proposalId}.`);
    physical.set(profile.proposalId, profile);
  }
  for (const profile of input.utilityProfiles) {
    if (utility.has(profile.proposalId)) throw new Error(`A1.2s0 duplicate utility profile ${profile.proposalId}.`);
    utility.set(profile.proposalId, profile);
  }
  return { physical, utility };
}

function validateTopLevel(input: {
  proposalSet: A1ConcreteCommandProposalSet;
  physicalProfiles: readonly A1FixedCommandCrossFutureProfile[];
  utilityProfiles: readonly A1TerminalRelationshipUtilityProfile[];
  relationGraphs: A1G4CrossFutureRelationGraphs;
}): ReturnType<typeof profileMaps> {
  const { proposalSet, relationGraphs } = input;
  if (proposalSet.kind !== "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL_SET") {
    throw new Error("A1.2s0 requires qualified A1.2o concrete command proposals.");
  }
  if (
    proposalSet.commandDedupClaim !== "DEDUP_BY_EXECUTABLE_COMMAND_VELOCITY_A1_2O" ||
    proposalSet.familySemanticsClaim !== "NONE_COMMAND_IDENTITY_NOT_FAMILY_LABEL_A1_2O"
  ) {
    throw new Error("A1.2s0 requires the A1.2o executable-command identity boundary.");
  }
  if (proposalSet.selectionClaim !== "NONE_A1_2O" || proposalSet.runtimeAuthorityClaim !== "NONE_A1_2O") {
    throw new Error("A1.2s0 refuses upstream selection/runtime authority from A1.2o.");
  }
  if (relationGraphs.kind !== "A1_G4_CROSS_FUTURE_RELATION_GRAPHS") {
    throw new Error("A1.2s0 requires qualified A1.2r cross-future relation graphs.");
  }
  if (
    relationGraphs.sourceTick !== proposalSet.sourceTick ||
    Math.abs(relationGraphs.horizonSeconds - proposalSet.horizonSeconds) > HORIZON_EPSILON ||
    relationGraphs.proposalCoverageClaim !== "EXACT_A1_2O_PROPOSAL_SET_PRESERVED_A1_2R" ||
    relationGraphs.futureSeparationClaim !== "H1_H2_H3_GRAPHS_NEVER_AGGREGATED_A1_2R" ||
    relationGraphs.robustnessAggregationClaim !== "NONE_A1_2R" ||
    relationGraphs.scalarScoreClaim !== "NONE_A1_2R" ||
    relationGraphs.selectionClaim !== "NONE_RELATION_GRAPH_ONLY_A1_2R" ||
    relationGraphs.runtimeAuthorityClaim !== "NONE_A1_2R"
  ) {
    throw new Error("A1.2s0 relation-graph provenance is misaligned or already claims policy/authority.");
  }
  const proposalIds = proposalSet.proposals.map((proposal) => proposal.proposalId);
  if (
    relationGraphs.proposalIds.length !== proposalIds.length ||
    relationGraphs.proposalIds.some((id, index) => id !== proposalIds[index])
  ) {
    throw new Error("A1.2s0 relation graphs do not preserve exact A1.2o proposal ordering/coverage.");
  }
  return profileMaps(input);
}

function validateProposalEvidence(input: {
  proposal: A1ConcreteCommandProposal;
  physical: A1FixedCommandCrossFutureProfile;
  utility: A1TerminalRelationshipUtilityProfile;
}): void {
  const { proposal, physical, utility } = input;
  if (
    physical.proposalId !== proposal.proposalId ||
    utility.proposalId !== proposal.proposalId
  ) {
    throw new Error(`A1.2s0 evidence identity mismatch for ${proposal.proposalId}.`);
  }
  if (
    physical.sourceTick !== proposal.sourceTick ||
    utility.sourceTick !== proposal.sourceTick ||
    Math.abs(physical.horizonSeconds - proposal.horizonSeconds) > HORIZON_EPSILON ||
    Math.abs(utility.horizonSeconds - proposal.horizonSeconds) > HORIZON_EPSILON
  ) {
    throw new Error(`A1.2s0 source tick/horizon mismatch for ${proposal.proposalId}.`);
  }
  if (
    vectorDistance(physical.commandVelocity, proposal.commandVelocity) > EPSILON ||
    vectorDistance(utility.commandVelocity, proposal.commandVelocity) > EPSILON
  ) {
    throw new Error(`A1.2s0 command velocity mismatch for ${proposal.proposalId}.`);
  }
  if (
    physical.selectionClaim !== "NONE_A1_2P" ||
    physical.runtimeAuthorityClaim !== "NONE_A1_2P" ||
    utility.utilityAggregationClaim !== "NONE_PRESERVE_PLAYER_FUTURES_A1_2Q" ||
    utility.selectionClaim !== "NONE_A1_2Q" ||
    utility.runtimeAuthorityClaim !== "NONE_A1_2Q"
  ) {
    throw new Error(`A1.2s0 refuses upstream aggregation/selection/runtime authority for ${proposal.proposalId}.`);
  }
}

function observation(input: {
  proposalId: string;
  physical: A1FixedCommandCrossFutureProfile;
  utility: A1TerminalRelationshipUtilityProfile;
  graph: A1G4PlayerFutureRelationGraph;
  family: A1PlayerFutureFamily;
}): A1CommandRobustnessFutureObservation {
  const physical = exactOne(
    input.physical.entries.filter((entry) => entry.futureFamily === input.family),
    `${input.proposalId}/${input.family} physical entry`
  );
  const relationship = exactOne(
    input.utility.entries.filter((entry) => entry.futureFamily === input.family),
    `${input.proposalId}/${input.family} utility entry`
  );
  const relationNode = exactOne(
    input.graph.nodes.filter((node) => node.proposalId === input.proposalId),
    `${input.proposalId}/${input.family} relation node`
  );

  if (
    relationship.futureId !== physical.futureId ||
    relationship.sourceStatus !== physical.status ||
    relationNode.profileStatus !== physical.status
  ) {
    throw new Error(`A1.2s0 ${input.proposalId}/${input.family} p/q/r status or future identity mismatch.`);
  }
  if (vectorDistance(relationNode.commandVelocity, physical.commandVelocity) > EPSILON) {
    throw new Error(`A1.2s0 ${input.proposalId}/${input.family} relation node changed command velocity.`);
  }
  if (
    (physical.status === "REHEARSED") !== (relationship.relationshipUtility !== null)
  ) {
    throw new Error(`A1.2s0 ${input.proposalId}/${input.family} utility availability contradicts physical rehearsal status.`);
  }

  const preferredOverProposalIds = input.graph.preferenceEdges
    .filter((edge) => edge.preferredProposalId === input.proposalId)
    .map((edge) => edge.yieldingProposalId);
  const dominatedByProposalIds = input.graph.preferenceEdges
    .filter((edge) => edge.yieldingProposalId === input.proposalId)
    .map((edge) => edge.preferredProposalId);
  const noPreferenceWithProposalIds = input.graph.noPreferencePairs
    .filter((pair) => pair.proposalAId === input.proposalId || pair.proposalBId === input.proposalId)
    .map((pair) => otherProposal(pair, input.proposalId));
  const forcedContentionWithProposalIds = input.graph.forcedContentionPairs
    .filter((pair) => pair.proposalAId === input.proposalId || pair.proposalBId === input.proposalId)
    .map((pair) => otherProposal(pair, input.proposalId));
  const forcedContentionComponentPeerIds = [...new Set(
    input.graph.forcedContentionComponents
      .filter((component) => component.proposalIds.includes(input.proposalId))
      .flatMap((component) => component.proposalIds)
      .filter((id) => id !== input.proposalId)
  )];

  return {
    futureFamily: input.family,
    futureId: physical.futureId,
    physicalStatus: physical.status,
    physical,
    relationship,
    relationNode,
    preferredOverProposalIds,
    dominatedByProposalIds,
    noPreferenceWithProposalIds,
    forcedContentionWithProposalIds,
    forcedContentionComponentPeerIds,
    missingEvidenceMeaning: "PRESERVE_SOURCE_STATUS_NEVER_IMPUTE_SCORE_OR_FAILURE_A1_2S0",
    aggregationClaim: "NONE_SINGLE_FUTURE_OBSERVATION_A1_2S0"
  };
}

/**
 * A1.2s0 composes already-qualified A1.2p/q/r evidence into a research dossier
 * per concrete command. It deliberately publishes no robustness policy,
 * score, vote, veto, winner or runtime command. Missing counterfactual evidence
 * remains missing evidence rather than becoming an adverse synthetic outcome.
 */
export function buildA1CommandRobustnessResearchSet(input: {
  proposalSet: A1ConcreteCommandProposalSet;
  physicalProfiles: readonly A1FixedCommandCrossFutureProfile[];
  utilityProfiles: readonly A1TerminalRelationshipUtilityProfile[];
  relationGraphs: A1G4CrossFutureRelationGraphs;
}): A1CommandRobustnessResearchSet {
  const maps = validateTopLevel(input);
  const dossiers = input.proposalSet.proposals.map((proposal): A1CommandRobustnessResearchDossier => {
    const physical = maps.physical.get(proposal.proposalId);
    const utility = maps.utility.get(proposal.proposalId);
    if (!physical || !utility) throw new Error(`A1.2s0 missing p/q evidence for ${proposal.proposalId}.`);
    validateProposalEvidence({ proposal, physical, utility });

    const futures = FUTURE_FAMILIES.map((family) => observation({
      proposalId: proposal.proposalId,
      physical,
      utility,
      graph: graphFor(input.relationGraphs, family),
      family
    }));

    return {
      kind: "A1_COMMAND_ROBUSTNESS_RESEARCH_DOSSIER",
      sourceTick: proposal.sourceTick,
      horizonSeconds: proposal.horizonSeconds,
      proposalId: proposal.proposalId,
      commandVelocity: { ...proposal.commandVelocity },
      generationOriginCount: proposal.generationOriginCount,
      canonicalFamilyProvenance: proposal.canonicalFamilyProvenance,
      futures,
      commandIdentityClaim: "A1_2O_PROPOSAL_ID_EXECUTABLE_COMMAND_IDENTITY",
      futureSeparationClaim: "H1_H2_H3_PRESERVED_AS_SEPARATE_OBSERVATIONS_A1_2S0",
      missingEvidenceClaim: "UNRESOLVED_ABSENT_REJECTED_ARE_NOT_ADVERSE_SCORES_A1_2S0",
      relationshipUtilityClaim: "A1_2Q_EVIDENCE_PRESERVED_NOT_AGGREGATED_A1_2S0",
      cooperationClaim: "A1_2R_RELATIONS_PRESERVED_NOT_SCALARIZED_A1_2S0",
      robustnessPolicyClaim: "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0",
      voteClaim: "NONE_A1_2S0",
      vetoClaim: "NONE_A1_2S0",
      scalarScoreClaim: "NONE_A1_2S0",
      selectionClaim: "NONE_A1_2S0",
      runtimeAuthorityClaim: "NONE_A1_2S0"
    };
  });

  return {
    kind: "A1_COMMAND_ROBUSTNESS_RESEARCH_SET",
    sourceTick: input.proposalSet.sourceTick,
    horizonSeconds: input.proposalSet.horizonSeconds,
    proposalIds: input.proposalSet.proposals.map((proposal) => proposal.proposalId),
    dossiers,
    exactCoverageClaim: "EXACT_A1_2O_PROPOSAL_SET_A1_2S0",
    evidenceCompositionClaim: "A1_2P_Q_R_ALIGNED_WITHOUT_POLICY_A1_2S0",
    futureSeparationClaim: "NO_CROSS_FUTURE_AGGREGATION_A1_2S0",
    unresolvedMeaningClaim: "MISSING_EVIDENCE_NOT_NEGATIVE_EVIDENCE_A1_2S0",
    robustnessPolicyClaim: "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0",
    scalarScoreClaim: "NONE_A1_2S0",
    selectionClaim: "NONE_A1_2S0",
    runtimeAuthorityClaim: "NONE_A1_2S0"
  };
}
