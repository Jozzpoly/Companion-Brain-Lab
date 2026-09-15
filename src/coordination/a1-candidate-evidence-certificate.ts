import type {
  A1CommandRobustnessFutureObservation,
  A1CommandRobustnessResearchDossier,
  A1CommandRobustnessResearchSet
} from "./a1-command-robustness-research-dossier";
import type { A1PlayerFutureFamily } from "./a1-player-future-hypotheses";
import type {
  A1FixedCommandRadialPaceProfile,
  A1RadialPaceEntry
} from "./a1-radial-pace-evidence";
import {
  a1RelationshipObjectiveSignature,
  type A1RelationshipObjectiveProfile
} from "./a1-relationship-utility";
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

export interface A1CandidateEvidenceFutureCertificate {
  futureFamily: A1PlayerFutureFamily;
  futureId: string | null;
  physicalStatus: A1CommandRobustnessFutureObservation["physicalStatus"];
  robustness: A1CommandRobustnessFutureObservation;
  relationship: A1TerminalRelationshipUtilityEntry;
  radialPace: A1RadialPaceEntry;
  terminalStateAlignment:
    | "ALIGNED_SAME_PHYSICS_REHEARSED_TERMINAL_STATE_A1_2V"
    | "ALIGNED_NON_REHEARSED_MISSING_EVIDENCE_A1_2V";
  cooperationRepresentationClaim: "PAIRWISE_RELATIONS_RETAINED_IN_A1_2S0_SOURCE_NOT_SCALARIZED_A1_2V";
  aggregationClaim: "NONE_SINGLE_FUTURE_EVIDENCE_A1_2V";
}

export interface A1CandidateEvidenceCertificate {
  kind: "A1_CANDIDATE_EVIDENCE_CERTIFICATE";
  sourceTick: number;
  horizonSeconds: number;
  proposalId: string;
  commandVelocity: Vec2;
  sourceDossier: A1CommandRobustnessResearchDossier;
  relationshipProfile: A1TerminalRelationshipUtilityProfile;
  paceProfile: A1FixedCommandRadialPaceProfile;
  objective: A1RelationshipObjectiveProfile;
  objectiveSignature: string;
  futures: readonly A1CandidateEvidenceFutureCertificate[];
  identityClaim: "A1_2S0_Q_U_PROPOSAL_AND_FUTURE_IDENTITY_ALIGNED_A1_2V";
  terminalTruthClaim: "Q_AND_PACE_SHARE_A1_2P_SAME_PHYSICS_TERMINAL_STATE_A1_2V";
  objectiveAlignmentClaim: "Q_OBJECTIVE_SIGNATURE_AND_PACE_RADIAL_OBJECTIVE_EXPLICITLY_ALIGNED_A1_2V";
  unaryEvidenceClaim: "Q_AND_RADIAL_PACE_PRESERVED_AS_SEPARATE_AXES_A1_2V";
  cooperationClaim: "A1_2S0_PAIRWISE_G4_RELATIONS_PRESERVED_NOT_SCALARIZED_A1_2V";
  futureAggregationClaim: "NONE_H1_H2_H3_REMAIN_SEPARATE_A1_2V";
  scalarScoreClaim: "NONE_A1_2V";
  weightingClaim: "NONE_A1_2V";
  transitiveOrderClaim: "NONE_A1_2V";
  selectionClaim: "NONE_CERTIFICATE_ONLY_A1_2V";
  runtimeAuthorityClaim: "NONE_A1_2V";
}

export interface A1CandidateEvidenceCertificateSet {
  kind: "A1_CANDIDATE_EVIDENCE_CERTIFICATE_SET";
  sourceTick: number;
  horizonSeconds: number;
  proposalIds: readonly string[];
  certificates: readonly A1CandidateEvidenceCertificate[];
  objective: A1RelationshipObjectiveProfile;
  objectiveSignature: string;
  exactCoverageClaim: "EXACT_A1_2S0_PROPOSAL_SET_A1_2V";
  compositionClaim: "A1_2S0_Q_U_ALIGNED_WITHOUT_POLICY_A1_2V";
  cooperationRepresentationClaim: "RELATIONAL_G4_REMAINS_RELATIONAL_A1_2V";
  missingEvidenceClaim: "MISSING_EVIDENCE_REMAINS_MISSING_NOT_NEGATIVE_A1_2V";
  scalarScoreClaim: "NONE_A1_2V";
  weightingClaim: "NONE_A1_2V";
  selectionClaim: "NONE_CERTIFICATE_SET_ONLY_A1_2V";
  runtimeAuthorityClaim: "NONE_A1_2V";
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function exactOne<T>(values: readonly T[], label: string): T {
  if (values.length !== 1) throw new Error(`A1.2v requires exactly one ${label}.`);
  return values[0]!;
}

function nearlyEqual(a: number, b: number, epsilon = EPSILON): boolean {
  return Math.abs(a - b) <= epsilon;
}

function copyObjective(objective: A1RelationshipObjectiveProfile): A1RelationshipObjectiveProfile {
  const radial = { ...objective.radial };
  if (objective.directional.kind === "NONE") {
    return { radial, directional: { kind: "NONE" } };
  }
  if (objective.directional.kind === "AVOID_FORWARD_HEMISPHERE") {
    return {
      radial,
      directional: {
        kind: "AVOID_FORWARD_HEMISPHERE",
        weight: objective.directional.weight
      }
    };
  }
  return {
    radial,
    directional: {
      kind: "PREFER_BEARING",
      preferredBearingRadians: objective.directional.preferredBearingRadians,
      sigmaRadians: objective.directional.sigmaRadians,
      weight: objective.directional.weight
    }
  };
}

function objectiveRadialMatches(
  profile: A1FixedCommandRadialPaceProfile,
  objective: A1RelationshipObjectiveProfile
): boolean {
  return nearlyEqual(profile.radialObjective.preferredRadius, objective.radial.preferredRadius) &&
    nearlyEqual(profile.radialObjective.sigma, objective.radial.sigma) &&
    nearlyEqual(profile.radialObjective.weight, objective.radial.weight);
}

function profileMap<T extends { proposalId: string }>(
  values: readonly T[],
  expectedCount: number,
  label: string
): ReadonlyMap<string, T> {
  if (values.length !== expectedCount) {
    throw new Error(`A1.2v requires exactly one ${label} per A1.2s0 proposal.`);
  }
  const map = new Map<string, T>();
  for (const value of values) {
    if (map.has(value.proposalId)) throw new Error(`A1.2v duplicate ${label} ${value.proposalId}.`);
    map.set(value.proposalId, value);
  }
  return map;
}

function validateResearch(research: A1CommandRobustnessResearchSet): void {
  if (research.kind !== "A1_COMMAND_ROBUSTNESS_RESEARCH_SET") {
    throw new Error("A1.2v requires the qualified A1.2s0 research set.");
  }
  if (
    research.exactCoverageClaim !== "EXACT_A1_2O_PROPOSAL_SET_A1_2S0" ||
    research.evidenceCompositionClaim !== "A1_2P_Q_R_ALIGNED_WITHOUT_POLICY_A1_2S0" ||
    research.futureSeparationClaim !== "NO_CROSS_FUTURE_AGGREGATION_A1_2S0" ||
    research.robustnessPolicyClaim !== "NONE_RESEARCH_DOSSIER_ONLY_A1_2S0" ||
    research.scalarScoreClaim !== "NONE_A1_2S0" ||
    research.selectionClaim !== "NONE_A1_2S0" ||
    research.runtimeAuthorityClaim !== "NONE_A1_2S0"
  ) {
    throw new Error("A1.2v refuses A1.2s0 input with altered coverage, aggregation, policy, selection or authority.");
  }
  if (
    research.proposalIds.length !== research.dossiers.length ||
    research.proposalIds.some((id, index) => research.dossiers[index]?.proposalId !== id)
  ) {
    throw new Error("A1.2v requires exact ordered A1.2s0 dossier coverage.");
  }
}

function validateProfiles(input: {
  dossier: A1CommandRobustnessResearchDossier;
  relationship: A1TerminalRelationshipUtilityProfile;
  pace: A1FixedCommandRadialPaceProfile;
  objective: A1RelationshipObjectiveProfile;
  objectiveSignature: string;
}): void {
  const { dossier, relationship, pace, objective, objectiveSignature } = input;
  if (relationship.kind !== "A1_TERMINAL_RELATIONSHIP_UTILITY_PROFILE") {
    throw new Error(`A1.2v ${dossier.proposalId} requires a qualified A1.2q relationship profile.`);
  }
  if (pace.kind !== "A1_FIXED_COMMAND_RADIAL_PACE_PROFILE") {
    throw new Error(`A1.2v ${dossier.proposalId} requires a qualified A1.2u PACE profile.`);
  }
  if (
    relationship.proposalId !== dossier.proposalId ||
    pace.proposalId !== dossier.proposalId ||
    relationship.sourceTick !== dossier.sourceTick ||
    pace.sourceTick !== dossier.sourceTick ||
    Math.abs(relationship.horizonSeconds - dossier.horizonSeconds) > HORIZON_EPSILON ||
    Math.abs(pace.horizonSeconds - dossier.horizonSeconds) > HORIZON_EPSILON ||
    vectorDistance(relationship.commandVelocity, dossier.commandVelocity) > EPSILON ||
    vectorDistance(pace.commandVelocity, dossier.commandVelocity) > EPSILON
  ) {
    throw new Error(`A1.2v ${dossier.proposalId} source identity, tick, horizon or command is misaligned.`);
  }
  if (relationship.objectiveSignature !== objectiveSignature) {
    throw new Error(`A1.2v ${dossier.proposalId} q objective signature does not match the explicit certificate objective.`);
  }
  if (!objectiveRadialMatches(pace, objective)) {
    throw new Error(`A1.2v ${dossier.proposalId} PACE radial objective does not match the explicit certificate objective.`);
  }
  if (
    relationship.utilityAggregationClaim !== "NONE_PRESERVE_PLAYER_FUTURES_A1_2Q" ||
    relationship.cooperationClaim !== "NONE_A1_2Q" ||
    relationship.selectionClaim !== "NONE_A1_2Q" ||
    relationship.runtimeAuthorityClaim !== "NONE_A1_2Q" ||
    pace.paceSemanticsClaim !== "RAW_RADIAL_RELATIONSHIP_PROGRESS_ONLY_A1_2U" ||
    pace.directionalObjectiveUsage !== "NONE_A1_2U" ||
    pace.relationshipUtilityUsage !== "NONE_A1_2U" ||
    pace.classificationClaim !== "NONE_RAW_CONTINUOUS_EVIDENCE_A1_2U" ||
    pace.futureAggregationClaim !== "NONE_PRESERVE_H1_H2_H3_A1_2U" ||
    pace.cooperationClaim !== "NONE_A1_2U" ||
    pace.selectionClaim !== "NONE_A1_2U" ||
    pace.runtimeAuthorityClaim !== "NONE_A1_2U"
  ) {
    throw new Error(`A1.2v ${dossier.proposalId} refuses q/PACE input with aggregation, policy, selection or authority.`);
  }
}

function alignedFuture(input: {
  dossier: A1CommandRobustnessResearchDossier;
  relationshipProfile: A1TerminalRelationshipUtilityProfile;
  paceProfile: A1FixedCommandRadialPaceProfile;
  family: A1PlayerFutureFamily;
}): A1CandidateEvidenceFutureCertificate {
  const robustness = exactOne(
    input.dossier.futures.filter((future) => future.futureFamily === input.family),
    `${input.dossier.proposalId}/${input.family} A1.2s0 observation`
  );
  const relationship = exactOne(
    input.relationshipProfile.entries.filter((entry) => entry.futureFamily === input.family),
    `${input.dossier.proposalId}/${input.family} A1.2q entry`
  );
  const radialPace = exactOne(
    input.paceProfile.entries.filter((entry) => entry.futureFamily === input.family),
    `${input.dossier.proposalId}/${input.family} A1.2u entry`
  );

  if (
    robustness.futureId !== relationship.futureId ||
    robustness.futureId !== radialPace.futureId ||
    robustness.physicalStatus !== relationship.sourceStatus ||
    robustness.physicalStatus !== radialPace.sourceStatus
  ) {
    throw new Error(`A1.2v ${input.dossier.proposalId}/${input.family} future identity or status mismatch.`);
  }

  const rehearsed = robustness.physicalStatus === "REHEARSED";
  if (rehearsed) {
    const q = relationship.relationshipUtility;
    const pace = radialPace.radialPace;
    if (!q || !pace) {
      throw new Error(`A1.2v ${input.dossier.proposalId}/${input.family} rehearsed future is missing q or PACE evidence.`);
    }
    if (
      vectorDistance(q.initialRelativeOffset, pace.initialRelativeOffset) > EPSILON ||
      vectorDistance(q.terminalRelativeOffset, pace.terminalRelativeOffset) > EPSILON ||
      !nearlyEqual(q.initialUtility.radius, pace.initialRadius) ||
      !nearlyEqual(q.terminalUtility.radius, pace.terminalRadius)
    ) {
      throw new Error(`A1.2v ${input.dossier.proposalId}/${input.family} q and PACE do not share the same physical relative state.`);
    }
  } else if (relationship.relationshipUtility !== null || radialPace.radialPace !== null) {
    throw new Error(`A1.2v ${input.dossier.proposalId}/${input.family} non-rehearsed future fabricated q or PACE evidence.`);
  }

  return {
    futureFamily: input.family,
    futureId: robustness.futureId,
    physicalStatus: robustness.physicalStatus,
    robustness,
    relationship,
    radialPace,
    terminalStateAlignment: rehearsed
      ? "ALIGNED_SAME_PHYSICS_REHEARSED_TERMINAL_STATE_A1_2V"
      : "ALIGNED_NON_REHEARSED_MISSING_EVIDENCE_A1_2V",
    cooperationRepresentationClaim: "PAIRWISE_RELATIONS_RETAINED_IN_A1_2S0_SOURCE_NOT_SCALARIZED_A1_2V",
    aggregationClaim: "NONE_SINGLE_FUTURE_EVIDENCE_A1_2V"
  };
}

/**
 * A1.2v is a certificate/alignment boundary only. It keeps the already-qualified
 * A1.2s0 q/G4 evidence and A1.2u radial PACE evidence causally co-located while
 * refusing to turn unary evidence or pairwise cooperation relations into a
 * scalar, transitive order, winner or runtime command.
 */
export function buildA1CandidateEvidenceCertificateSet(input: {
  research: A1CommandRobustnessResearchSet;
  relationshipProfiles: readonly A1TerminalRelationshipUtilityProfile[];
  paceProfiles: readonly A1FixedCommandRadialPaceProfile[];
  objective: A1RelationshipObjectiveProfile;
}): A1CandidateEvidenceCertificateSet {
  validateResearch(input.research);
  const objective = copyObjective(input.objective);
  const objectiveSignature = a1RelationshipObjectiveSignature(objective);
  const relationshipMap = profileMap(
    input.relationshipProfiles,
    input.research.dossiers.length,
    "A1.2q relationship profile"
  );
  const paceMap = profileMap(
    input.paceProfiles,
    input.research.dossiers.length,
    "A1.2u PACE profile"
  );

  const certificates = input.research.dossiers.map((dossier): A1CandidateEvidenceCertificate => {
    const relationshipProfile = relationshipMap.get(dossier.proposalId);
    const paceProfile = paceMap.get(dossier.proposalId);
    if (!relationshipProfile || !paceProfile) {
      throw new Error(`A1.2v missing q/PACE evidence for ${dossier.proposalId}.`);
    }
    validateProfiles({
      dossier,
      relationship: relationshipProfile,
      pace: paceProfile,
      objective,
      objectiveSignature
    });
    const futures = FUTURE_FAMILIES.map((family) => alignedFuture({
      dossier,
      relationshipProfile,
      paceProfile,
      family
    }));

    return {
      kind: "A1_CANDIDATE_EVIDENCE_CERTIFICATE",
      sourceTick: dossier.sourceTick,
      horizonSeconds: dossier.horizonSeconds,
      proposalId: dossier.proposalId,
      commandVelocity: { ...dossier.commandVelocity },
      sourceDossier: dossier,
      relationshipProfile,
      paceProfile,
      objective: copyObjective(objective),
      objectiveSignature,
      futures,
      identityClaim: "A1_2S0_Q_U_PROPOSAL_AND_FUTURE_IDENTITY_ALIGNED_A1_2V",
      terminalTruthClaim: "Q_AND_PACE_SHARE_A1_2P_SAME_PHYSICS_TERMINAL_STATE_A1_2V",
      objectiveAlignmentClaim: "Q_OBJECTIVE_SIGNATURE_AND_PACE_RADIAL_OBJECTIVE_EXPLICITLY_ALIGNED_A1_2V",
      unaryEvidenceClaim: "Q_AND_RADIAL_PACE_PRESERVED_AS_SEPARATE_AXES_A1_2V",
      cooperationClaim: "A1_2S0_PAIRWISE_G4_RELATIONS_PRESERVED_NOT_SCALARIZED_A1_2V",
      futureAggregationClaim: "NONE_H1_H2_H3_REMAIN_SEPARATE_A1_2V",
      scalarScoreClaim: "NONE_A1_2V",
      weightingClaim: "NONE_A1_2V",
      transitiveOrderClaim: "NONE_A1_2V",
      selectionClaim: "NONE_CERTIFICATE_ONLY_A1_2V",
      runtimeAuthorityClaim: "NONE_A1_2V"
    };
  });

  return {
    kind: "A1_CANDIDATE_EVIDENCE_CERTIFICATE_SET",
    sourceTick: input.research.sourceTick,
    horizonSeconds: input.research.horizonSeconds,
    proposalIds: [...input.research.proposalIds],
    certificates,
    objective: copyObjective(objective),
    objectiveSignature,
    exactCoverageClaim: "EXACT_A1_2S0_PROPOSAL_SET_A1_2V",
    compositionClaim: "A1_2S0_Q_U_ALIGNED_WITHOUT_POLICY_A1_2V",
    cooperationRepresentationClaim: "RELATIONAL_G4_REMAINS_RELATIONAL_A1_2V",
    missingEvidenceClaim: "MISSING_EVIDENCE_REMAINS_MISSING_NOT_NEGATIVE_A1_2V",
    scalarScoreClaim: "NONE_A1_2V",
    weightingClaim: "NONE_A1_2V",
    selectionClaim: "NONE_CERTIFICATE_SET_ONLY_A1_2V",
    runtimeAuthorityClaim: "NONE_A1_2V"
  };
}
