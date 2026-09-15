import { describe, expect, it } from "vitest";
import {
  buildA1CandidateEvidenceCertificateSet,
  type A1CandidateEvidenceCertificate,
  type A1CandidateEvidenceCertificateSet
} from "./a1-candidate-evidence-certificate";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import {
  buildA1CrossFutureContradictionAtlas,
  type A1CrossFutureContradictionAtlas,
  type A1PairCooperationRelation,
  type A1PairUtilityOrder
} from "./a1-cross-future-contradiction-atlas";
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
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

const Q_EPSILON = 1e-9;
const PACE_RESOLUTION_METERS = 1e-3;
const RELATIVE_STATE_TOLERANCE_METERS = 1e-3;
const H1: A1PlayerFutureFamily = "OWNER_REQUEST_CONTINUATION";
const DIAGNOSTIC_FUTURES = [
  "BODY_RESPONSE_CONTINUATION",
  "TRANSITION_HOLD"
] as const satisfies readonly A1PlayerFutureFamily[];
const HORIZONS = [0.75, 1, 1.2, 1.5] as const;
const TRANSLATION_STEPS = [0, 20, 40] as const;

type DiagnosticFamily = typeof DIAGNOSTIC_FUTURES[number];

interface FrontierRow {
  proposalId: string;
  q: number;
  paceDelta: number;
  dominatedByProposalIds: readonly string[];
}

interface DiagnosticObservation {
  family: DiagnosticFamily;
  status: "SUPPORT" | "EXCLUSION" | "UNAVAILABLE";
  alternateFrontierIds: readonly string[];
  preferenceReversal: boolean;
  utilityPreferenceReversal: boolean;
  cooperationPreferenceReversal: boolean;
  conflictingWithProposalIds: readonly string[];
}

interface TranslationObservation {
  translationSteps: number;
  translationMeters: number;
  horizonSeconds: number;
  playerX: number;
  companionX: number;
  relativeX: number;
  h1FeasibleFraction: number;
  h1Clipped: boolean;
  h1EffectiveVelocityX: number;
  proposalCount: number;
  h1FrontierIds: readonly string[];
  survivors: readonly {
    proposalId: string;
    diagnostics: readonly DiagnosticObservation[];
  }[];
  exclusionCount: number;
  preferenceReversalCount: number;
  utilityPreferenceReversalCount: number;
  cooperationPreferenceReversalCount: number;
  selectionClaim: "NONE_TRANSLATION_CONFOUND_AUDIT_ONLY_A1_2Z";
  runtimeAuthorityClaim: "NONE_A1_2Z";
}

function intent(actorId: "player" | "companion", x: number, y = 0): MotionIntent {
  return { actorId, move: { x, y } };
}

async function translatedReversalSnapshot(translationSteps: number): Promise<{
  world: LabWorld;
  snapshot: WorldSnapshot;
}> {
  const world = await LabWorld.create("open");
  for (let index = 0; index < translationSteps; index += 1) {
    world.step([intent("player", 1), intent("companion", 1)]);
  }
  const snapshot = world.step([intent("player", 1), intent("companion", 0)]);
  return { world, snapshot };
}

function future(
  certificate: A1CandidateEvidenceCertificate,
  family: A1PlayerFutureFamily
) {
  const matches = certificate.futures.filter((candidate) => candidate.futureFamily === family);
  if (matches.length !== 1) {
    throw new Error(`A1.2z expected exactly one ${family} future for ${certificate.proposalId}.`);
  }
  return matches[0]!;
}

function comparableRows(
  certificates: A1CandidateEvidenceCertificateSet,
  family: A1PlayerFutureFamily
): FrontierRow[] {
  const rows: FrontierRow[] = [];
  for (const certificate of certificates.certificates) {
    const evidence = future(certificate, family);
    if (!evidence.robustness.relationNode.comparisonEligible) continue;
    const q = evidence.relationship.relationshipUtility?.terminalUtility.totalUtility;
    const paceDelta = evidence.radialPace.radialPace?.absoluteRadialErrorDelta;
    if (q === undefined || paceDelta === undefined) {
      throw new Error(`A1.2z comparable ${certificate.proposalId}/${family} requires aligned q and PACE evidence.`);
    }
    rows.push({
      proposalId: certificate.proposalId,
      q,
      paceDelta,
      dominatedByProposalIds: evidence.robustness.dominatedByProposalIds
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

function structuredFrontierIds(
  certificates: A1CandidateEvidenceCertificateSet,
  family: A1PlayerFutureFamily
): string[] {
  const rows = g4Frontier(comparableRows(certificates, family));
  return rows
    .filter((candidate) =>
      !rows.some((other) => other.proposalId !== candidate.proposalId && qPaceDominates(other, candidate))
    )
    .map((row) => row.proposalId)
    .sort();
}

function pairFor(atlas: A1CrossFutureContradictionAtlas, aId: string, bId: string) {
  const pair = atlas.pairs.find((candidate) =>
    (candidate.proposalAId === aId && candidate.proposalBId === bId) ||
    (candidate.proposalAId === bId && candidate.proposalBId === aId)
  );
  if (!pair) throw new Error(`A1.2z missing s1 pair ${aId}/${bId}.`);
  return pair;
}

function oppositeUtility(a: A1PairUtilityOrder, b: A1PairUtilityOrder): boolean {
  return (a === "A_HIGHER" && b === "B_HIGHER") || (a === "B_HIGHER" && b === "A_HIGHER");
}

function oppositeCooperation(a: A1PairCooperationRelation, b: A1PairCooperationRelation): boolean {
  return (a === "A_PREFERRED" && b === "B_PREFERRED") ||
    (a === "B_PREFERRED" && b === "A_PREFERRED");
}

function reversalAgainstAlternate(input: {
  atlas: A1CrossFutureContradictionAtlas;
  h1ProposalId: string;
  alternateProposalId: string;
  family: DiagnosticFamily;
}) {
  const pair = pairFor(input.atlas, input.h1ProposalId, input.alternateProposalId);
  const owner = pair.observations.find((observation) => observation.futureFamily === H1);
  const alternate = pair.observations.find((observation) => observation.futureFamily === input.family);
  if (!owner || !alternate) throw new Error("A1.2z s1 pair must preserve H1 and requested diagnostic future.");
  const utility = oppositeUtility(owner.utilityOrder, alternate.utilityOrder);
  const cooperation = oppositeCooperation(owner.cooperationRelation, alternate.cooperationRelation);
  return { utility, cooperation, any: utility || cooperation };
}

function evaluate(world: LabWorld, snapshot: WorldSnapshot, horizonSeconds: number) {
  const situation = buildA1Situation({
    snapshot,
    playerIntent: intent("player", -1),
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: world.latestAuthorityA0StepEvidence()
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
    localAlternativeDeltaSpeed: 1
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
  const atlas = buildA1CrossFutureContradictionAtlas(research);
  const h1Hypothesis = hypotheses.hypotheses.find((candidate) => candidate.family === H1)!;
  const h1FrontierIds = structuredFrontierIds(certificates, H1);

  const survivors = h1FrontierIds.map((proposalId) => ({
    proposalId,
    diagnostics: DIAGNOSTIC_FUTURES.map((family): DiagnosticObservation => {
      const certificate = certificates.certificates.find((candidate) => candidate.proposalId === proposalId)!;
      const diagnostic = future(certificate, family);
      if (!diagnostic.robustness.relationNode.comparisonEligible) {
        return {
          family,
          status: "UNAVAILABLE",
          alternateFrontierIds: structuredFrontierIds(certificates, family),
          preferenceReversal: false,
          utilityPreferenceReversal: false,
          cooperationPreferenceReversal: false,
          conflictingWithProposalIds: []
        };
      }

      const alternateFrontierIds = structuredFrontierIds(certificates, family);
      if (alternateFrontierIds.includes(proposalId)) {
        return {
          family,
          status: "SUPPORT",
          alternateFrontierIds,
          preferenceReversal: false,
          utilityPreferenceReversal: false,
          cooperationPreferenceReversal: false,
          conflictingWithProposalIds: []
        };
      }

      const reversals = alternateFrontierIds.map((alternateProposalId) => ({
        alternateProposalId,
        evidence: reversalAgainstAlternate({
          atlas,
          h1ProposalId: proposalId,
          alternateProposalId,
          family
        })
      }));
      const conflicting = reversals.filter((entry) => entry.evidence.any);
      return {
        family,
        status: "EXCLUSION",
        alternateFrontierIds,
        preferenceReversal: conflicting.length > 0,
        utilityPreferenceReversal: conflicting.some((entry) => entry.evidence.utility),
        cooperationPreferenceReversal: conflicting.some((entry) => entry.evidence.cooperation),
        conflictingWithProposalIds: conflicting.map((entry) => entry.alternateProposalId).sort()
      };
    })
  }));

  const diagnostics = survivors.flatMap((survivor) => survivor.diagnostics);
  return {
    playerX: snapshot.actors.find((actor) => actor.id === "player")!.position.x,
    companionX: snapshot.actors.find((actor) => actor.id === "companion")!.position.x,
    relativeX: snapshot.actors.find((actor) => actor.id === "companion")!.position.x -
      snapshot.actors.find((actor) => actor.id === "player")!.position.x,
    h1FeasibleFraction: h1Hypothesis.staticFeasibility.feasibleFraction,
    h1Clipped: h1Hypothesis.staticFeasibility.clipped,
    h1EffectiveVelocityX: h1Hypothesis.effectiveVelocity.x,
    proposalCount: proposalSet.proposalCount,
    h1FrontierIds,
    survivors,
    exclusionCount: diagnostics.filter((entry) => entry.status === "EXCLUSION").length,
    preferenceReversalCount: diagnostics.filter((entry) => entry.preferenceReversal).length,
    utilityPreferenceReversalCount: diagnostics.filter((entry) => entry.utilityPreferenceReversal).length,
    cooperationPreferenceReversalCount: diagnostics.filter((entry) => entry.cooperationPreferenceReversal).length
  };
}

async function matrix(): Promise<TranslationObservation[]> {
  const results: TranslationObservation[] = [];
  for (const translationSteps of TRANSLATION_STEPS) {
    const { world, snapshot } = await translatedReversalSnapshot(translationSteps);
    try {
      for (const horizonSeconds of HORIZONS) {
        const evidence = evaluate(world, snapshot, horizonSeconds);
        results.push({
          translationSteps,
          translationMeters: translationSteps * 0.05,
          horizonSeconds,
          ...evidence,
          selectionClaim: "NONE_TRANSLATION_CONFOUND_AUDIT_ONLY_A1_2Z",
          runtimeAuthorityClaim: "NONE_A1_2Z"
        });
      }
    } finally {
      world.dispose();
    }
  }
  return results;
}

describe("Authority-A1.2z reversal robustness translation confound", () => {
  it("tests whether y-style diagnostic exclusions and preference reversals survive translation of the same local relative state", async () => {
    const results = await matrix();
    console.log("[A1_2Z_REVERSAL_ROBUSTNESS_TRANSLATION]", JSON.stringify({
      qEpsilon: Q_EPSILON,
      paceAuditResolutionMeters: PACE_RESOLUTION_METERS,
      relativeStateToleranceMeters: RELATIVE_STATE_TOLERANCE_METERS,
      horizons: HORIZONS,
      translations: TRANSLATION_STEPS,
      semantics: {
        translation: "PRESERVE_LOCAL_RELATIVE_STATE_WHILE_MOVING_WORLD_POSITION",
        h1: "OWNER_REQUEST_PRIMARY_COUNTERFACTUAL",
        diagnostics: "H2_H3_NO_VOTE_NO_VETO",
        winner: "NONE",
        runtimeAuthority: "NONE"
      },
      results
    }));

    expect(results).toHaveLength(TRANSLATION_STEPS.length * HORIZONS.length);
    const baselineRelativeX = results.find((entry) => entry.translationSteps === 0)!.relativeX;
    expect(results.every((entry) =>
      Math.abs(entry.relativeX - baselineRelativeX) <= RELATIVE_STATE_TOLERANCE_METERS
    )).toBe(true);

    const origin12 = results.find((entry) => entry.translationSteps === 0 && entry.horizonSeconds === 1.2)!;
    const origin15 = results.find((entry) => entry.translationSteps === 0 && entry.horizonSeconds === 1.5)!;
    expect(origin12.preferenceReversalCount).toBeGreaterThan(0);
    expect(origin15.preferenceReversalCount).toBeGreaterThan(0);

    const horizonsWithTranslationSensitiveReversal = HORIZONS.filter((horizonSeconds) => {
      const observations = results.filter((entry) => entry.horizonSeconds === horizonSeconds);
      return new Set(observations.map((entry) => entry.preferenceReversalCount)).size > 1;
    });
    expect(horizonsWithTranslationSensitiveReversal.length).toBeGreaterThan(0);

    expect(results.every((entry) => entry.selectionClaim === "NONE_TRANSLATION_CONFOUND_AUDIT_ONLY_A1_2Z")).toBe(true);
    expect(results.every((entry) => entry.runtimeAuthorityClaim === "NONE_A1_2Z")).toBe(true);
  });
});
