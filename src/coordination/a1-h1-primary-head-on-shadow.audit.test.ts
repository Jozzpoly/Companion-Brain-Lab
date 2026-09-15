import { describe, expect, it } from "vitest";
import {
  buildA1CandidateEvidenceCertificateSet,
  type A1CandidateEvidenceCertificate,
  type A1CandidateEvidenceCertificateSet
} from "./a1-candidate-evidence-certificate";
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
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

const H1: A1PlayerFutureFamily = "OWNER_REQUEST_CONTINUATION";
const H2: A1PlayerFutureFamily = "BODY_RESPONSE_CONTINUATION";
const H3: A1PlayerFutureFamily = "TRANSITION_HOLD";
const HORIZONS = [0.5, 0.75, 1, 1.2, 1.5] as const;
const Q_EPSILON = 1e-9;
const PACE_RESOLUTION_METERS = 1e-3;

interface FrontierRow {
  proposalId: string;
  commandVelocity: Vec2;
  q: number;
  paceDelta: number;
  dominatedByProposalIds: readonly string[];
  forcedContentionWithProposalIds: readonly string[];
}

function playerIntent(move: Vec2): MotionIntent {
  return { actorId: "player", move };
}

function future(certificate: A1CandidateEvidenceCertificate, family: A1PlayerFutureFamily) {
  const matches = certificate.futures.filter((candidate) => candidate.futureFamily === family);
  if (matches.length !== 1) {
    throw new Error(`A1.2z4 expected exactly one ${family} future for ${certificate.proposalId}.`);
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
      throw new Error(`A1.2z4 comparable H1 ${certificate.proposalId} requires aligned q and PACE evidence.`);
    }
    rows.push({
      proposalId: certificate.proposalId,
      commandVelocity: { ...certificate.commandVelocity },
      q,
      paceDelta,
      dominatedByProposalIds: [...h1.robustness.dominatedByProposalIds],
      forcedContentionWithProposalIds: [...h1.robustness.forcedContentionWithProposalIds]
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
  const qNoWorse = a.q >= b.q - Q_EPSILON;
  const paceNoWorse = a.paceDelta <= b.paceDelta + PACE_RESOLUTION_METERS;
  const qStrict = a.q > b.q + Q_EPSILON;
  const paceStrict = a.paceDelta < b.paceDelta - PACE_RESOLUTION_METERS;
  return qNoWorse && paceNoWorse && (qStrict || paceStrict);
}

function structuredFrontier(rows: readonly FrontierRow[]): FrontierRow[] {
  const g4 = g4Frontier(rows);
  return g4.filter((candidate) =>
    !g4.some((other) => other.proposalId !== candidate.proposalId && qPaceDominates(other, candidate))
  );
}

async function auditHorizon(horizonSeconds: number) {
  const world = await LabWorld.create("head-on");
  try {
    const snapshot = world.snapshot();
    const situation = buildA1Situation({
      snapshot,
      playerIntent: playerIntent({ x: 1, y: 0 }),
      playerCapability: world.actorMovementCapability("player"),
      companionCapability: world.actorMovementCapability("companion"),
      previousWorldStep: null
    });
    const hypotheses = buildA1PlayerFutureHypotheses({
      situation,
      horizonSeconds,
      staticTraversal: (from, target, radius, options) =>
        world.staticCircleTraversal(from, target, radius, options)
    });
    const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
    const proposalSet = buildA1ConcreteCommandProposalSet({
      situation,
      interventionPlan,
      localAlternativeDeltaSpeed: 3
    });
    const physicalProfiles = proposalSet.proposals.map((proposal) =>
      buildA1FixedCommandCrossFutureProfile({ world, situation, interventionPlan, proposal })
    );
    const orientation = evaluateA1RelationshipOrientation({ situation });
    const relationshipProfiles = physicalProfiles.map((profile) =>
      buildA1TerminalRelationshipUtilityProfile({
        profile,
        situation,
        orientation,
        objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
      })
    );
    const relationGraphs = buildA1G4CrossFutureRelationGraphs({
      proposalSet,
      profiles: physicalProfiles
    });
    const research = buildA1CommandRobustnessResearchSet({
      proposalSet,
      physicalProfiles,
      utilityProfiles: relationshipProfiles,
      relationGraphs
    });
    const paceProfiles = physicalProfiles.map((profile) =>
      buildA1FixedCommandRadialPaceProfile({
        profile,
        situation,
        radialObjective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial
      })
    );
    const certificates = buildA1CandidateEvidenceCertificateSet({
      research,
      relationshipProfiles,
      paceProfiles,
      objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE
    });

    const comparable = comparableRows(certificates);
    const g4 = g4Frontier(comparable);
    const frontier = structuredFrontier(comparable);
    const proposals = proposalSet.proposals.map((proposal) => {
      const certificate = certificates.certificates.find((candidate) => candidate.proposalId === proposal.proposalId)!;
      const h1 = future(certificate, H1);
      const h2 = future(certificate, H2);
      const h3 = future(certificate, H3);
      return {
        proposalId: proposal.proposalId,
        commandVelocity: proposal.commandVelocity,
        originFamilies: [...new Set(proposal.generationOrigins.map((origin) => origin.seedFamily))],
        originFutureFamilies: [...new Set(proposal.generationOrigins.map((origin) => origin.futureFamily))],
        h1: {
          physicalStatus: h1.physicalStatus,
          comparisonEligible: h1.robustness.relationNode.comparisonEligible,
          g3Status: h1.robustness.relationNode.g3Status,
          dominatedByProposalIds: h1.robustness.dominatedByProposalIds,
          preferredOverProposalIds: h1.robustness.preferredOverProposalIds,
          forcedContentionWithProposalIds: h1.robustness.forcedContentionWithProposalIds,
          q: h1.relationship.relationshipUtility?.terminalUtility.totalUtility ?? null,
          paceDelta: h1.radialPace.radialPace?.absoluteRadialErrorDelta ?? null
        },
        h2: {
          physicalStatus: h2.physicalStatus,
          comparisonEligible: h2.robustness.relationNode.comparisonEligible
        },
        h3: {
          physicalStatus: h3.physicalStatus,
          comparisonEligible: h3.robustness.relationNode.comparisonEligible
        }
      };
    });

    return {
      horizonSeconds,
      proposalCount: proposalSet.proposalCount,
      transitionReasons: hypotheses.transitionReasons,
      comparableIds: comparable.map((row) => row.proposalId),
      g4FrontierIds: g4.map((row) => row.proposalId),
      structuredFrontierIds: frontier.map((row) => row.proposalId),
      shadowDecisionState:
        frontier.length === 1 ? "SINGLETON_H1_FRONTIER" : frontier.length === 0 ? "H1_FRONTIER_UNAVAILABLE" : "H1_FRONTIER_AMBIGUOUS",
      singletonShadowCandidate: frontier.length === 1
        ? { proposalId: frontier[0]!.proposalId, commandVelocity: frontier[0]!.commandVelocity }
        : null,
      proposals,
      semantics: {
        h1: "OWNER_REQUEST_PRIMARY_COUNTERFACTUAL",
        h2: "DIAGNOSTIC_ONLY_NO_VOTE_NO_VETO",
        h3: "DIAGNOSTIC_ONLY_NO_VOTE_NO_VETO",
        ordering: "G4_UNDOMINATED_THEN_Q_PACE_PARETO",
        scalarScore: "NONE",
        tieBreak: "NONE",
        selectionAuthority: "NONE_AUDIT_ONLY",
        runtimeAuthority: "NONE"
      }
    };
  } finally {
    world.dispose();
  }
}

describe("Authority-A1.2z4 H1-primary head-on shadow frontier audit", () => {
  it("characterizes whether the already-qualified H1 frontier yields a unique concrete command without inventing a tie-breaker", async () => {
    const results = [];
    for (const horizonSeconds of HORIZONS) results.push(await auditHorizon(horizonSeconds));

    console.log("[A1_2Z4_H1_PRIMARY_HEAD_ON_SHADOW_AUDIT]", JSON.stringify({
      scenario: "head-on",
      playerH1Move: { x: 1, y: 0 },
      localAlternativeDeltaSpeed: 3,
      horizons: HORIZONS,
      results
    }));

    expect(results).toHaveLength(HORIZONS.length);
    expect(results.every((result) => result.proposalCount > 0)).toBe(true);
    expect(results.every((result) => result.semantics.scalarScore === "NONE")).toBe(true);
    expect(results.every((result) => result.semantics.tieBreak === "NONE")).toBe(true);
    expect(results.every((result) => result.semantics.runtimeAuthority === "NONE")).toBe(true);

    const oneSecond = results.find((result) => result.horizonSeconds === 1)!;
    expect(oneSecond.comparableIds.length).toBeGreaterThan(0);
    expect(oneSecond.g4FrontierIds.length).toBeGreaterThan(0);
    expect(oneSecond.g4FrontierIds.length).toBeLessThan(oneSecond.comparableIds.length);
  });
});
