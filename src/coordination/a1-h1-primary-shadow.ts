import {
  buildA1CandidateEvidenceCertificateSet,
  type A1CandidateEvidenceCertificate,
  type A1CandidateEvidenceCertificateSet
} from "./a1-candidate-evidence-certificate";
import type { A1CompanionCandidateFamily } from "./a1-companion-candidates";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import type { A1PlayerFutureFamily } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1FixedCommandRadialPaceProfile } from "./a1-radial-pace-evidence";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import type { A1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import type { LabWorld } from "../world/world";
import type { Vec2 } from "../world/types";

const H1: A1PlayerFutureFamily = "OWNER_REQUEST_CONTINUATION";
export const A1_H1_PRIMARY_SHADOW_HORIZONS = [0.5, 0.75, 1, 1.2, 1.5] as const;
export const A1_H1_PRIMARY_SHADOW_Q_EPSILON = 1e-9;
export const A1_H1_PRIMARY_SHADOW_PACE_RESOLUTION_METERS = 1e-3;
export const A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED = 3;

interface FrontierRow {
  proposalId: string;
  commandVelocity: Vec2;
  q: number;
  paceDelta: number;
  dominatedByProposalIds: readonly string[];
}

export interface A1H1PrimaryShadowGenerationOriginTrace {
  futureId: string;
  futureFamily: A1PlayerFutureFamily;
  futureCausalMeaning: string;
  seedId: string;
  taggedSeedId: string;
  seedFamily: A1CompanionCandidateFamily;
  seedLocalBasisSource: "NONE" | "CURRENT_RELATIVE_OFFSET";
  desiredVelocity: Vec2;
  commandVelocity: Vec2;
  capabilityClipped: boolean;
}

export interface A1H1PrimaryShadowProposalStageTrace {
  proposalId: string;
  commandVelocity: Vec2;
  generationOriginCount: number;
  generationOrigins: readonly A1H1PrimaryShadowGenerationOriginTrace[];
  h1GenerationOrigins: readonly A1H1PrimaryShadowGenerationOriginTrace[];
  h1PhysicalStatus: "REHEARSED" | "UNRESOLVED" | "ABSENT" | "UPSTREAM_REJECTED";
  h1FutureId: string | null;
  h1PlayerVelocity: Vec2 | null;
  g3Decision: string | null;
  g3Status: string | null;
  relationStatus: string;
  comparisonEligible: boolean;
  q: number | null;
  paceDelta: number | null;
  dominatedByProposalIds: readonly string[];
  g4Frontier: boolean;
  qPaceDominatedByProposalIds: readonly string[];
  structuredFrontier: boolean;
}

export interface A1H1PrimaryShadowStageTrace {
  kind: "A1_H1_PRIMARY_STAGE_ATTRIBUTION_TRACE";
  sourceTick: number;
  horizonSeconds: number;
  proposalCount: number;
  generationOriginCount: number;
  proposals: readonly A1H1PrimaryShadowProposalStageTrace[];
  semantics: {
    computationPath: "SAME_A1_H1_PRIMARY_SHADOW_EVALUATION_PASS";
    proposalIdentity: "A1_2O_EXECUTABLE_COMMAND";
    tangentIdentity: "POSITIVE_NEGATIVE_PRESERVED_AS_GENERATION_ORIGINS";
    h1: "OWNER_REQUEST_CONTINUATION";
    selection: "NONE_RESEARCH_TRACE_ONLY";
    sidePreference: "NONE";
    movementAuthority: "NONE_SHADOW_ONLY";
  };
}

export interface A1H1PrimaryShadowCandidate {
  proposalId: string;
  commandVelocity: Vec2;
  originFamilies: readonly string[];
  q: number;
  paceDelta: number;
  g3Status: string | null;
}

export interface A1H1PrimaryShadowHorizonResult {
  horizonSeconds: number;
  proposalCount: number;
  transitionReasons: readonly string[];
  comparableIds: readonly string[];
  g4FrontierIds: readonly string[];
  structuredFrontierIds: readonly string[];
  stageTrace: A1H1PrimaryShadowStageTrace;
  shadowDecisionState: "SINGLETON_H1_FRONTIER" | "H1_FRONTIER_AMBIGUOUS" | "H1_FRONTIER_UNAVAILABLE";
  singletonShadowCandidate: A1H1PrimaryShadowCandidate | null;
  frontierCandidates: readonly A1H1PrimaryShadowCandidate[];
}

export interface A1H1PrimaryShadowEvaluation {
  kind: "A1_H1_PRIMARY_LIVE_STATE_SHADOW_EVALUATION";
  sourceTick: number;
  horizons: readonly number[];
  results: readonly A1H1PrimaryShadowHorizonResult[];
  semantics: {
    stateAlignment: "EXACT_A1_SITUATION_LIVE_DECISION_STATE";
    h1: "OWNER_REQUEST_PRIMARY_COUNTERFACTUAL";
    ordering: "G4_UNDOMINATED_THEN_Q_PACE_PARETO";
    horizonPolicy: "NONE_SCAN_ONLY";
    scalarScore: "NONE";
    tieBreak: "NONE";
    sidePreference: "NONE";
    movementAuthority: "NONE_SHADOW_ONLY";
    liveWorldMutation: "NONE_QUERY_ONLY_REHEARSALS";
  };
}

function future(certificate: A1CandidateEvidenceCertificate, family: A1PlayerFutureFamily) {
  const matches = certificate.futures.filter((candidate) => candidate.futureFamily === family);
  if (matches.length !== 1) {
    throw new Error(`A1 H1 shadow expected exactly one ${family} future for ${certificate.proposalId}.`);
  }
  return matches[0]!;
}

function comparableRows(certificates: A1CandidateEvidenceCertificateSet): FrontierRow[] {
  const rows: FrontierRow[] = [];
  for (const certificate of certificates.certificates) {
    const h1 = future(certificate, H1);
    if (!h1.robustness.relationNode.comparisonEligible) continue;
    const q = h1.relationship.relationshipUtility?.terminalUtility.totalUtility;
    const paceDelta = h1.radialPace.radialPace?.absoluteRadialErrorDelta;
    if (q === undefined || paceDelta === undefined) {
      throw new Error(`A1 H1 shadow comparable ${certificate.proposalId} requires aligned q and PACE evidence.`);
    }
    rows.push({
      proposalId: certificate.proposalId,
      commandVelocity: { ...certificate.commandVelocity },
      q,
      paceDelta,
      dominatedByProposalIds: [...h1.robustness.dominatedByProposalIds]
    });
  }
  return rows;
}

function g4Frontier(rows: readonly FrontierRow[]): FrontierRow[] {
  const present = new Set(rows.map((row) => row.proposalId));
  return rows.filter((row) =>
    !row.dominatedByProposalIds.some((proposalId) => present.has(proposalId))
  );
}

function qPaceDominates(a: FrontierRow, b: FrontierRow): boolean {
  const qNoWorse = a.q >= b.q - A1_H1_PRIMARY_SHADOW_Q_EPSILON;
  const paceNoWorse = a.paceDelta <= b.paceDelta + A1_H1_PRIMARY_SHADOW_PACE_RESOLUTION_METERS;
  const qStrict = a.q > b.q + A1_H1_PRIMARY_SHADOW_Q_EPSILON;
  const paceStrict = a.paceDelta < b.paceDelta - A1_H1_PRIMARY_SHADOW_PACE_RESOLUTION_METERS;
  return qNoWorse && paceNoWorse && (qStrict || paceStrict);
}

function structuredFrontier(rows: readonly FrontierRow[]): FrontierRow[] {
  const g4 = g4Frontier(rows);
  return g4.filter((candidate) =>
    !g4.some((other) => other.proposalId !== candidate.proposalId && qPaceDominates(other, candidate))
  );
}

function cloneOrigin(origin: {
  futureId: string;
  futureFamily: A1PlayerFutureFamily;
  futureCausalMeaning: string;
  seedId: string;
  taggedSeedId: string;
  seedFamily: A1CompanionCandidateFamily;
  seedLocalBasisSource: "NONE" | "CURRENT_RELATIVE_OFFSET";
  desiredVelocity: Vec2;
  commandVelocity: Vec2;
  capabilityClipped: boolean;
}): A1H1PrimaryShadowGenerationOriginTrace {
  return {
    futureId: origin.futureId,
    futureFamily: origin.futureFamily,
    futureCausalMeaning: origin.futureCausalMeaning,
    seedId: origin.seedId,
    taggedSeedId: origin.taggedSeedId,
    seedFamily: origin.seedFamily,
    seedLocalBasisSource: origin.seedLocalBasisSource,
    desiredVelocity: { ...origin.desiredVelocity },
    commandVelocity: { ...origin.commandVelocity },
    capabilityClipped: origin.capabilityClipped
  };
}

function buildStageTrace(input: {
  proposalSet: ReturnType<typeof buildA1ConcreteCommandProposalSet>;
  certificates: A1CandidateEvidenceCertificateSet;
  comparable: readonly FrontierRow[];
  g4: readonly FrontierRow[];
  frontier: readonly FrontierRow[];
}): A1H1PrimaryShadowStageTrace {
  const comparableById = new Map(input.comparable.map((row) => [row.proposalId, row]));
  const g4Ids = new Set(input.g4.map((row) => row.proposalId));
  const frontierIds = new Set(input.frontier.map((row) => row.proposalId));

  const proposals = input.proposalSet.proposals.map((proposal): A1H1PrimaryShadowProposalStageTrace => {
    const certificate = input.certificates.certificates.find((value) => value.proposalId === proposal.proposalId);
    if (!certificate) throw new Error(`A1 H1 stage trace lost certificate ${proposal.proposalId}.`);
    const h1 = future(certificate, H1);
    const physical = h1.robustness.physical;
    const relationNode = h1.robustness.relationNode;
    const row = comparableById.get(proposal.proposalId) ?? null;
    const q = h1.relationship.relationshipUtility?.terminalUtility.totalUtility ?? null;
    const paceDelta = h1.radialPace.radialPace?.absoluteRadialErrorDelta ?? null;
    const generationOrigins = proposal.generationOrigins.map(cloneOrigin);
    const h1GenerationOrigins = generationOrigins.filter((origin) => origin.futureFamily === H1);
    const qPaceDominatedByProposalIds = row && g4Ids.has(proposal.proposalId)
      ? input.g4
          .filter((other) => other.proposalId !== proposal.proposalId && qPaceDominates(other, row))
          .map((other) => other.proposalId)
      : [];

    return {
      proposalId: proposal.proposalId,
      commandVelocity: { ...proposal.commandVelocity },
      generationOriginCount: proposal.generationOriginCount,
      generationOrigins,
      h1GenerationOrigins,
      h1PhysicalStatus: physical.status,
      h1FutureId: h1.futureId,
      h1PlayerVelocity: physical.status === "REHEARSED" ? { ...physical.playerVelocity } : null,
      g3Decision: relationNode.g3Decision,
      g3Status: relationNode.g3Status,
      relationStatus: relationNode.relationStatus,
      comparisonEligible: relationNode.comparisonEligible,
      q,
      paceDelta,
      dominatedByProposalIds: [...h1.robustness.dominatedByProposalIds],
      g4Frontier: g4Ids.has(proposal.proposalId),
      qPaceDominatedByProposalIds,
      structuredFrontier: frontierIds.has(proposal.proposalId)
    };
  });

  return {
    kind: "A1_H1_PRIMARY_STAGE_ATTRIBUTION_TRACE",
    sourceTick: input.proposalSet.sourceTick,
    horizonSeconds: input.proposalSet.horizonSeconds,
    proposalCount: input.proposalSet.proposalCount,
    generationOriginCount: input.proposalSet.generationOriginCount,
    proposals,
    semantics: {
      computationPath: "SAME_A1_H1_PRIMARY_SHADOW_EVALUATION_PASS",
      proposalIdentity: "A1_2O_EXECUTABLE_COMMAND",
      tangentIdentity: "POSITIVE_NEGATIVE_PRESERVED_AS_GENERATION_ORIGINS",
      h1: "OWNER_REQUEST_CONTINUATION",
      selection: "NONE_RESEARCH_TRACE_ONLY",
      sidePreference: "NONE",
      movementAuthority: "NONE_SHADOW_ONLY"
    }
  };
}

function candidateFromRow(
  row: FrontierRow,
  certificates: A1CandidateEvidenceCertificateSet,
  origins: ReadonlyMap<string, readonly string[]>
): A1H1PrimaryShadowCandidate {
  const certificate = certificates.certificates.find((value) => value.proposalId === row.proposalId);
  if (!certificate) throw new Error(`A1 H1 shadow lost certificate ${row.proposalId}.`);
  const h1 = future(certificate, H1);
  return {
    proposalId: row.proposalId,
    commandVelocity: { ...row.commandVelocity },
    originFamilies: [...(origins.get(row.proposalId) ?? [])],
    q: row.q,
    paceDelta: row.paceDelta,
    g3Status: h1.robustness.relationNode.g3Status
  };
}

export function evaluateA1H1PrimaryShadowHorizon(input: {
  world: LabWorld;
  situation: A1Situation;
  horizonSeconds: number;
  localAlternativeDeltaSpeed?: number;
}): A1H1PrimaryShadowHorizonResult {
  const localAlternativeDeltaSpeed = input.localAlternativeDeltaSpeed ??
    A1_H1_PRIMARY_SHADOW_LOCAL_ALTERNATIVE_DELTA_SPEED;
  const hypotheses = buildA1PlayerFutureHypotheses({
    situation: input.situation,
    horizonSeconds: input.horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const proposalSet = buildA1ConcreteCommandProposalSet({
    situation: input.situation,
    interventionPlan,
    localAlternativeDeltaSpeed
  });
  const physicalProfiles = proposalSet.proposals.map((proposal) =>
    buildA1FixedCommandCrossFutureProfile({
      world: input.world,
      situation: input.situation,
      interventionPlan,
      proposal
    })
  );
  const orientation = evaluateA1RelationshipOrientation({ situation: input.situation });
  const relationshipProfiles = physicalProfiles.map((profile) =>
    buildA1TerminalRelationshipUtilityProfile({
      profile,
      situation: input.situation,
      orientation,
      objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
    })
  );
  const relationGraphs = buildA1G4CrossFutureRelationGraphs({ proposalSet, profiles: physicalProfiles });
  const research = buildA1CommandRobustnessResearchSet({
    proposalSet,
    physicalProfiles,
    utilityProfiles: relationshipProfiles,
    relationGraphs
  });
  const paceProfiles = physicalProfiles.map((profile) =>
    buildA1FixedCommandRadialPaceProfile({
      profile,
      situation: input.situation,
      radialObjective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial
    })
  );
  const certificates = buildA1CandidateEvidenceCertificateSet({
    research,
    relationshipProfiles,
    paceProfiles,
    objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
  });

  const origins = new Map<string, readonly string[]>(
    proposalSet.proposals.map((proposal) => [
      proposal.proposalId,
      [...new Set(proposal.generationOrigins.map((origin) => origin.seedFamily))]
    ])
  );
  const comparable = comparableRows(certificates);
  const g4 = g4Frontier(comparable);
  const frontier = structuredFrontier(comparable);
  const frontierCandidates = frontier.map((row) => candidateFromRow(row, certificates, origins));
  const stageTrace = buildStageTrace({ proposalSet, certificates, comparable, g4, frontier });

  return {
    horizonSeconds: input.horizonSeconds,
    proposalCount: proposalSet.proposalCount,
    transitionReasons: [...hypotheses.transitionReasons],
    comparableIds: comparable.map((row) => row.proposalId),
    g4FrontierIds: g4.map((row) => row.proposalId),
    structuredFrontierIds: frontier.map((row) => row.proposalId),
    stageTrace,
    shadowDecisionState:
      frontier.length === 1 ? "SINGLETON_H1_FRONTIER" :
      frontier.length === 0 ? "H1_FRONTIER_UNAVAILABLE" :
      "H1_FRONTIER_AMBIGUOUS",
    singletonShadowCandidate: frontierCandidates.length === 1 ? frontierCandidates[0]! : null,
    frontierCandidates
  };
}

export function evaluateA1H1PrimaryLiveStateShadow(input: {
  world: LabWorld;
  situation: A1Situation;
  horizons?: readonly number[];
}): A1H1PrimaryShadowEvaluation {
  const horizons = input.horizons ?? A1_H1_PRIMARY_SHADOW_HORIZONS;
  const results = horizons.map((horizonSeconds) =>
    evaluateA1H1PrimaryShadowHorizon({
      world: input.world,
      situation: input.situation,
      horizonSeconds
    })
  );

  return {
    kind: "A1_H1_PRIMARY_LIVE_STATE_SHADOW_EVALUATION",
    sourceTick: input.situation.tick,
    horizons: [...horizons],
    results,
    semantics: {
      stateAlignment: "EXACT_A1_SITUATION_LIVE_DECISION_STATE",
      h1: "OWNER_REQUEST_PRIMARY_COUNTERFACTUAL",
      ordering: "G4_UNDOMINATED_THEN_Q_PACE_PARETO",
      horizonPolicy: "NONE_SCAN_ONLY",
      scalarScore: "NONE",
      tieBreak: "NONE",
      sidePreference: "NONE",
      movementAuthority: "NONE_SHADOW_ONLY",
      liveWorldMutation: "NONE_QUERY_ONLY_REHEARSALS"
    }
  };
}
