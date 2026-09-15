import type {
  A1ConcreteCommandProposal,
  A1ConcreteCommandProposalSet
} from "./a1-concrete-command-proposals";
import type {
  A1FixedCommandCrossFutureProfile,
  A1FixedCommandFutureProfileEntry,
  A1FixedCommandFutureRehearsed
} from "./a1-fixed-command-cross-future-profile";
import {
  compareA1G4CooperationCandidates,
  type A1G4CooperationComparisonEvidence
} from "./a1-g4-cooperation-preference";
import type { A1G3JointTraceDecision, A1G3JointTraceStatus } from "./a1-g3-joint-trace-policy";
import type { A1PlayerFutureFamily } from "./a1-player-future-hypotheses";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;
const HORIZON_EPSILON = 1e-12;

const FUTURE_FAMILIES: readonly A1PlayerFutureFamily[] = [
  "OWNER_REQUEST_CONTINUATION",
  "BODY_RESPONSE_CONTINUATION",
  "TRANSITION_HOLD"
];

export type A1G4RelationNodeStatus =
  | "COMPARABLE_G3_PASS"
  | "COMPARABLE_G3_REQUIRES_COOPERATION"
  | "EXCLUDED_G3_HOLD"
  | "EXCLUDED_G3_FAIL"
  | "EXCLUDED_G3_UNRESOLVED"
  | "UNAVAILABLE_PLAYER_FUTURE_UNRESOLVED"
  | "UNAVAILABLE_PLAYER_FUTURE_ABSENT"
  | "UPSTREAM_REJECTED_G0_G1_G2";

export interface A1G4RelationGraphNode {
  proposalId: string;
  commandVelocity: Vec2;
  profileStatus: A1FixedCommandFutureProfileEntry["status"];
  g3Decision: A1G3JointTraceDecision | null;
  g3Status: A1G3JointTraceStatus | null;
  relationStatus: A1G4RelationNodeStatus;
  comparisonEligible: boolean;
}

export interface A1G4PreferenceEdge {
  preferredProposalId: string;
  yieldingProposalId: string;
  reason: string;
  policy: A1G4CooperationComparisonEvidence;
}

export interface A1G4UnorderedPair {
  proposalAId: string;
  proposalBId: string;
  policy: A1G4CooperationComparisonEvidence;
}

export interface A1G4ForcedContentionComponent {
  proposalIds: readonly string[];
  pairCount: number;
  semantics: "CONNECTED_BY_PAIRWISE_FORCED_CONTENTION_ONLY_NO_TRANSITIVE_PREFERENCE";
}

export interface A1G4PlayerFutureRelationGraph {
  kind: "A1_G4_PLAYER_FUTURE_RELATION_GRAPH";
  sourceTick: number;
  horizonSeconds: number;
  futureFamily: A1PlayerFutureFamily;
  futureId: string | null;
  nodes: readonly A1G4RelationGraphNode[];
  comparableProposalIds: readonly string[];
  excludedProposalIds: readonly string[];
  comparisonCount: number;
  preferenceEdges: readonly A1G4PreferenceEdge[];
  noPreferencePairs: readonly A1G4UnorderedPair[];
  forcedContentionPairs: readonly A1G4UnorderedPair[];
  forcedContentionComponents: readonly A1G4ForcedContentionComponent[];
  proposalCoverageClaim: "EXACT_A1_2O_PROPOSAL_SET_PRESERVED_A1_2R";
  actionIdentityClaim: "A1_2O_PROPOSAL_ID_PROPAGATED_THROUGH_A1_2P_G3_AGENCY";
  pairwisePolicyClaim: "QUALIFIED_A1_2N_PAIRWISE_G4_ONLY";
  transitivePreferenceClaim: "NONE_A1_2R";
  relationshipUtilityClaim: "NONE_SEPARATE_A1_2Q_EVIDENCE_A1_2R";
  scalarScoreClaim: "NONE_A1_2R";
  selectionClaim: "NONE_RELATION_GRAPH_ONLY_A1_2R";
  runtimeAuthorityClaim: "NONE_A1_2R";
}

export interface A1G4CrossFutureRelationGraphs {
  kind: "A1_G4_CROSS_FUTURE_RELATION_GRAPHS";
  sourceTick: number;
  horizonSeconds: number;
  proposalIds: readonly string[];
  graphs: readonly A1G4PlayerFutureRelationGraph[];
  proposalCoverageClaim: "EXACT_A1_2O_PROPOSAL_SET_PRESERVED_A1_2R";
  futureSeparationClaim: "H1_H2_H3_GRAPHS_NEVER_AGGREGATED_A1_2R";
  relationshipUtilityClaim: "NONE_SEPARATE_A1_2Q_EVIDENCE_A1_2R";
  robustnessAggregationClaim: "NONE_A1_2R";
  scalarScoreClaim: "NONE_A1_2R";
  selectionClaim: "NONE_RELATION_GRAPH_ONLY_A1_2R";
  runtimeAuthorityClaim: "NONE_A1_2R";
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function entryForFamily(
  profile: A1FixedCommandCrossFutureProfile,
  family: A1PlayerFutureFamily
): A1FixedCommandFutureProfileEntry {
  const entries = profile.entries.filter((entry) => entry.futureFamily === family);
  if (entries.length !== 1) {
    throw new Error(`A1.2r profile ${profile.proposalId} must contain exactly one ${family} entry.`);
  }
  return entries[0]!;
}

function validateProposalProfilePair(
  proposal: A1ConcreteCommandProposal,
  profile: A1FixedCommandCrossFutureProfile
): void {
  if (profile.kind !== "A1_FIXED_COMMAND_CROSS_FUTURE_PROFILE") {
    throw new Error(`A1.2r proposal ${proposal.proposalId} requires a qualified A1.2p profile.`);
  }
  if (profile.proposalId !== proposal.proposalId) {
    throw new Error("A1.2r proposal/profile identity mismatch.");
  }
  if (
    profile.sourceTick !== proposal.sourceTick ||
    Math.abs(profile.horizonSeconds - proposal.horizonSeconds) > HORIZON_EPSILON
  ) {
    throw new Error(`A1.2r proposal ${proposal.proposalId} profile source tick/horizon is misaligned.`);
  }
  if (vectorDistance(profile.commandVelocity, proposal.commandVelocity) > EPSILON) {
    throw new Error(`A1.2r proposal ${proposal.proposalId} profile changed executable command velocity.`);
  }
  if (
    profile.commandIdentityClaim !== "A1_2O_EXECUTABLE_WORLD_VELOCITY_WITHIN_DECISION_FRAME" ||
    profile.fixedCommandClaim !== "EXACT_SAME_CONCRETE_COMMAND_ACROSS_FUTURES_A1_2P" ||
    profile.regenerationClaim !== "NONE_A1_2P_REUSE_A1_2O_CANONICAL_REALIZATION"
  ) {
    throw new Error(`A1.2r proposal ${proposal.proposalId} lacks qualified A1.2o/p identity provenance.`);
  }
  if (profile.selectionClaim !== "NONE_A1_2P" || profile.runtimeAuthorityClaim !== "NONE_A1_2P") {
    throw new Error(`A1.2r proposal ${proposal.proposalId} refuses upstream selection/runtime authority.`);
  }
  for (const family of FUTURE_FAMILIES) {
    const entry = entryForFamily(profile, family);
    if (entry.proposalId !== proposal.proposalId) {
      throw new Error(`A1.2r ${family} entry does not preserve proposal identity ${proposal.proposalId}.`);
    }
    if (vectorDistance(entry.commandVelocity, proposal.commandVelocity) > EPSILON) {
      throw new Error(`A1.2r ${family} entry changed command velocity for ${proposal.proposalId}.`);
    }
    if (entry.status === "REHEARSED") {
      if (
        entry.g3.companionCandidateId !== proposal.proposalId ||
        entry.playerAgency.companionCandidateId !== proposal.proposalId ||
        entry.rehearsal.companionCandidateId !== proposal.proposalId
      ) {
        throw new Error(
          `A1.2r ${family} downstream evidence does not propagate concrete proposal identity ${proposal.proposalId}.`
        );
      }
    }
  }
}

function validateInput(input: {
  proposalSet: A1ConcreteCommandProposalSet;
  profiles: readonly A1FixedCommandCrossFutureProfile[];
}): Map<string, A1FixedCommandCrossFutureProfile> {
  const { proposalSet, profiles } = input;
  if (proposalSet.kind !== "A1_CONCRETE_DIRECT_COMMAND_PROPOSAL_SET") {
    throw new Error("A1.2r requires the qualified A1.2o concrete command proposal set.");
  }
  if (
    proposalSet.commandDedupClaim !== "DEDUP_BY_EXECUTABLE_COMMAND_VELOCITY_A1_2O" ||
    proposalSet.familySemanticsClaim !== "NONE_COMMAND_IDENTITY_NOT_FAMILY_LABEL_A1_2O"
  ) {
    throw new Error("A1.2r requires the qualified A1.2o command identity boundary.");
  }
  if (proposalSet.selectionClaim !== "NONE_A1_2O" || proposalSet.runtimeAuthorityClaim !== "NONE_A1_2O") {
    throw new Error("A1.2r refuses an A1.2o proposal set with selection/runtime authority.");
  }
  if (profiles.length !== proposalSet.proposals.length) {
    throw new Error("A1.2r requires exactly one A1.2p profile for every A1.2o proposal.");
  }

  const byId = new Map<string, A1FixedCommandCrossFutureProfile>();
  for (const profile of profiles) {
    if (byId.has(profile.proposalId)) {
      throw new Error(`A1.2r duplicate A1.2p profile for ${profile.proposalId}.`);
    }
    byId.set(profile.proposalId, profile);
  }
  for (const proposal of proposalSet.proposals) {
    const profile = byId.get(proposal.proposalId);
    if (!profile) {
      throw new Error(`A1.2r missing A1.2p profile for ${proposal.proposalId}.`);
    }
    validateProposalProfilePair(proposal, profile);
  }
  for (const profileId of byId.keys()) {
    if (!proposalSet.proposals.some((proposal) => proposal.proposalId === profileId)) {
      throw new Error(`A1.2r profile ${profileId} is not part of the supplied A1.2o proposal set.`);
    }
  }
  return byId;
}

function nodeFor(
  proposal: A1ConcreteCommandProposal,
  entry: A1FixedCommandFutureProfileEntry
): A1G4RelationGraphNode {
  if (entry.status === "UNRESOLVED") {
    return {
      proposalId: proposal.proposalId,
      commandVelocity: { ...proposal.commandVelocity },
      profileStatus: entry.status,
      g3Decision: null,
      g3Status: null,
      relationStatus: "UNAVAILABLE_PLAYER_FUTURE_UNRESOLVED",
      comparisonEligible: false
    };
  }
  if (entry.status === "ABSENT") {
    return {
      proposalId: proposal.proposalId,
      commandVelocity: { ...proposal.commandVelocity },
      profileStatus: entry.status,
      g3Decision: null,
      g3Status: null,
      relationStatus: "UNAVAILABLE_PLAYER_FUTURE_ABSENT",
      comparisonEligible: false
    };
  }
  if (entry.status === "UPSTREAM_REJECTED") {
    return {
      proposalId: proposal.proposalId,
      commandVelocity: { ...proposal.commandVelocity },
      profileStatus: entry.status,
      g3Decision: null,
      g3Status: null,
      relationStatus: "UPSTREAM_REJECTED_G0_G1_G2",
      comparisonEligible: false
    };
  }

  const statusByDecision: Record<A1G3JointTraceDecision, A1G4RelationNodeStatus> = {
    PASS: "COMPARABLE_G3_PASS",
    REQUIRE_G4: "COMPARABLE_G3_REQUIRES_COOPERATION",
    HOLD: "EXCLUDED_G3_HOLD",
    FAIL: "EXCLUDED_G3_FAIL",
    UNRESOLVED: "EXCLUDED_G3_UNRESOLVED"
  };
  return {
    proposalId: proposal.proposalId,
    commandVelocity: { ...proposal.commandVelocity },
    profileStatus: entry.status,
    g3Decision: entry.g3.decision,
    g3Status: entry.g3.status,
    relationStatus: statusByDecision[entry.g3.decision],
    comparisonEligible: entry.g3.decision === "PASS" || entry.g3.decision === "REQUIRE_G4"
  };
}

function rehearsedComparable(
  entry: A1FixedCommandFutureProfileEntry
): entry is A1FixedCommandFutureRehearsed {
  return entry.status === "REHEARSED" &&
    (entry.g3.decision === "PASS" || entry.g3.decision === "REQUIRE_G4");
}

function forcedComponents(
  proposalOrder: readonly string[],
  pairs: readonly A1G4UnorderedPair[]
): A1G4ForcedContentionComponent[] {
  const adjacency = new Map<string, Set<string>>();
  for (const pair of pairs) {
    if (!adjacency.has(pair.proposalAId)) adjacency.set(pair.proposalAId, new Set());
    if (!adjacency.has(pair.proposalBId)) adjacency.set(pair.proposalBId, new Set());
    adjacency.get(pair.proposalAId)!.add(pair.proposalBId);
    adjacency.get(pair.proposalBId)!.add(pair.proposalAId);
  }

  const seen = new Set<string>();
  const components: A1G4ForcedContentionComponent[] = [];
  for (const root of proposalOrder) {
    if (!adjacency.has(root) || seen.has(root)) continue;
    const stack = [root];
    const ids: string[] = [];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      ids.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!seen.has(neighbor)) stack.push(neighbor);
      }
    }
    const ordered = proposalOrder.filter((id) => ids.includes(id));
    const members = new Set(ordered);
    components.push({
      proposalIds: ordered,
      pairCount: pairs.filter(
        (pair) => members.has(pair.proposalAId) && members.has(pair.proposalBId)
      ).length,
      semantics: "CONNECTED_BY_PAIRWISE_FORCED_CONTENTION_ONLY_NO_TRANSITIVE_PREFERENCE"
    });
  }
  return components;
}

function futureIdFor(entries: readonly A1FixedCommandFutureProfileEntry[]): string | null {
  const ids = [...new Set(entries.map((entry) => entry.futureId).filter((id): id is string => id !== null))];
  if (ids.length > 1) {
    throw new Error("A1.2r entries for one player-future family disagree on future identity.");
  }
  return ids[0] ?? null;
}

function buildGraph(input: {
  proposalSet: A1ConcreteCommandProposalSet;
  profilesById: ReadonlyMap<string, A1FixedCommandCrossFutureProfile>;
  family: A1PlayerFutureFamily;
}): A1G4PlayerFutureRelationGraph {
  const entries = input.proposalSet.proposals.map((proposal) =>
    entryForFamily(input.profilesById.get(proposal.proposalId)!, input.family)
  );
  const nodes = input.proposalSet.proposals.map((proposal, index) => nodeFor(proposal, entries[index]!));
  const comparable = input.proposalSet.proposals
    .map((proposal, index) => ({ proposal, entry: entries[index]! }))
    .filter((value): value is { proposal: A1ConcreteCommandProposal; entry: A1FixedCommandFutureRehearsed } =>
      rehearsedComparable(value.entry)
    );

  const preferenceEdges: A1G4PreferenceEdge[] = [];
  const noPreferencePairs: A1G4UnorderedPair[] = [];
  const forcedContentionPairs: A1G4UnorderedPair[] = [];
  let comparisonCount = 0;

  for (let aIndex = 0; aIndex < comparable.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < comparable.length; bIndex += 1) {
      const a = comparable[aIndex]!;
      const b = comparable[bIndex]!;
      const policy = compareA1G4CooperationCandidates({
        candidateA: {
          candidateId: a.proposal.proposalId,
          g3: a.entry.g3,
          agency: a.entry.playerAgency
        },
        candidateB: {
          candidateId: b.proposal.proposalId,
          g3: b.entry.g3,
          agency: b.entry.playerAgency
        }
      });
      comparisonCount += 1;
      if (policy.decision === "PREFER_A" || policy.decision === "PREFER_B") {
        const preferred = policy.decision === "PREFER_A" ? a.proposal.proposalId : b.proposal.proposalId;
        const yielding = policy.decision === "PREFER_A" ? b.proposal.proposalId : a.proposal.proposalId;
        preferenceEdges.push({
          preferredProposalId: preferred,
          yieldingProposalId: yielding,
          reason: policy.reason,
          policy
        });
      } else if (policy.decision === "NO_PREFERENCE") {
        noPreferencePairs.push({
          proposalAId: a.proposal.proposalId,
          proposalBId: b.proposal.proposalId,
          policy
        });
      } else {
        forcedContentionPairs.push({
          proposalAId: a.proposal.proposalId,
          proposalBId: b.proposal.proposalId,
          policy
        });
      }
    }
  }

  return {
    kind: "A1_G4_PLAYER_FUTURE_RELATION_GRAPH",
    sourceTick: input.proposalSet.sourceTick,
    horizonSeconds: input.proposalSet.horizonSeconds,
    futureFamily: input.family,
    futureId: futureIdFor(entries),
    nodes,
    comparableProposalIds: nodes.filter((node) => node.comparisonEligible).map((node) => node.proposalId),
    excludedProposalIds: nodes.filter((node) => !node.comparisonEligible).map((node) => node.proposalId),
    comparisonCount,
    preferenceEdges,
    noPreferencePairs,
    forcedContentionPairs,
    forcedContentionComponents: forcedComponents(
      input.proposalSet.proposals.map((proposal) => proposal.proposalId),
      forcedContentionPairs
    ),
    proposalCoverageClaim: "EXACT_A1_2O_PROPOSAL_SET_PRESERVED_A1_2R",
    actionIdentityClaim: "A1_2O_PROPOSAL_ID_PROPAGATED_THROUGH_A1_2P_G3_AGENCY",
    pairwisePolicyClaim: "QUALIFIED_A1_2N_PAIRWISE_G4_ONLY",
    transitivePreferenceClaim: "NONE_A1_2R",
    relationshipUtilityClaim: "NONE_SEPARATE_A1_2Q_EVIDENCE_A1_2R",
    scalarScoreClaim: "NONE_A1_2R",
    selectionClaim: "NONE_RELATION_GRAPH_ONLY_A1_2R",
    runtimeAuthorityClaim: "NONE_A1_2R"
  };
}

/**
 * Builds three separate pairwise cooperation relation graphs over the complete
 * A1.2o concrete command proposal set. The function preserves all proposal
 * nodes, excludes non-comparable evidence explicitly, and never converts graph
 * structure into a scalar score, global winner or runtime command.
 */
export function buildA1G4CrossFutureRelationGraphs(input: {
  proposalSet: A1ConcreteCommandProposalSet;
  profiles: readonly A1FixedCommandCrossFutureProfile[];
}): A1G4CrossFutureRelationGraphs {
  const profilesById = validateInput(input);
  const graphs = FUTURE_FAMILIES.map((family) => buildGraph({
    proposalSet: input.proposalSet,
    profilesById,
    family
  }));

  return {
    kind: "A1_G4_CROSS_FUTURE_RELATION_GRAPHS",
    sourceTick: input.proposalSet.sourceTick,
    horizonSeconds: input.proposalSet.horizonSeconds,
    proposalIds: input.proposalSet.proposals.map((proposal) => proposal.proposalId),
    graphs,
    proposalCoverageClaim: "EXACT_A1_2O_PROPOSAL_SET_PRESERVED_A1_2R",
    futureSeparationClaim: "H1_H2_H3_GRAPHS_NEVER_AGGREGATED_A1_2R",
    relationshipUtilityClaim: "NONE_SEPARATE_A1_2Q_EVIDENCE_A1_2R",
    robustnessAggregationClaim: "NONE_A1_2R",
    scalarScoreClaim: "NONE_A1_2R",
    selectionClaim: "NONE_RELATION_GRAPH_ONLY_A1_2R",
    runtimeAuthorityClaim: "NONE_A1_2R"
  };
}
