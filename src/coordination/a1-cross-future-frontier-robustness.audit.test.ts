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
const HORIZONS = [0.5, 0.75, 1, 1.2, 1.5] as const;
const H1: A1PlayerFutureFamily = "OWNER_REQUEST_CONTINUATION";
const DIAGNOSTIC_FUTURES = [
  "BODY_RESPONSE_CONTINUATION",
  "TRANSITION_HOLD"
] as const satisfies readonly A1PlayerFutureFamily[];

type Scenario = "open" | "head-on" | "doorway" | "pillar";
type DiagnosticFamily = typeof DIAGNOSTIC_FUTURES[number];
type DiagnosticStatus = "FRONTIER_SUPPORT" | "DIAGNOSTIC_FRONTIER_EXCLUSION" | "UNAVAILABLE";

interface FrontierRow {
  proposalId: string;
  q: number;
  paceDelta: number;
  dominatedByProposalIds: readonly string[];
}

interface DiagnosticAnnotation {
  futureFamily: DiagnosticFamily;
  status: DiagnosticStatus;
  alternateFrontierIds: readonly string[];
  preferenceReversalEvident: boolean;
  utilityPreferenceReversalEvident: boolean;
  cooperationPreferenceReversalEvident: boolean;
  conflictingWithProposalIds: readonly string[];
  interpretationClaim:
    "DIAGNOSTIC_EVIDENCE_ONLY_NO_VOTE_NO_VETO_NO_OWNER_REQUEST_REPLACEMENT_A1_2Y";
}

interface H1SurvivorObservation {
  proposalId: string;
  diagnostics: readonly DiagnosticAnnotation[];
}

interface StateObservation {
  stateId: string;
  scenario: Scenario;
  tick: number;
  horizonSeconds: number;
  transitionReasons: readonly string[];
  proposalCount: number;
  h1FrontierIds: readonly string[];
  h1FrontierUnavailable: boolean;
  survivors: readonly H1SurvivorObservation[];
  selectionClaim: "NONE_ROBUSTNESS_ATLAS_ONLY_A1_2Y";
  runtimeAuthorityClaim: "NONE_A1_2Y";
}

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move };
}

function player(x: number, y = 0): MotionIntent {
  return motion("player", { x, y });
}

function companionHold(): MotionIntent {
  return motion("companion", { x: 0, y: 0 });
}

function decision(input: {
  world: LabWorld;
  snapshot?: WorldSnapshot;
  playerMove: Vec2;
  horizonSeconds: number;
  localAlternativeDeltaSpeed?: number;
}) {
  const snapshot = input.snapshot ?? input.world.snapshot();
  const situation = buildA1Situation({
    snapshot,
    playerIntent: motion("player", input.playerMove),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0 ? null : input.world.latestAuthorityA0StepEvidence()
  });
  const hypotheses = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds: input.horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventionPlan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const proposalSet = buildA1ConcreteCommandProposalSet({
    situation,
    interventionPlan,
    localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed ?? 1
  });
  const physicalProfiles = proposalSet.proposals.map((proposal) =>
    buildA1FixedCommandCrossFutureProfile({
      world: input.world,
      situation,
      interventionPlan,
      proposal
    })
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
  const contradictionAtlas = buildA1CrossFutureContradictionAtlas(research);

  return {
    situation,
    hypotheses,
    proposalSet,
    certificates,
    contradictionAtlas
  };
}

function future(
  certificate: A1CandidateEvidenceCertificate,
  family: A1PlayerFutureFamily
) {
  const matches = certificate.futures.filter((candidate) => candidate.futureFamily === family);
  if (matches.length !== 1) {
    throw new Error(`A1.2y expected exactly one ${family} future for ${certificate.proposalId}.`);
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
      throw new Error(`A1.2y comparable ${certificate.proposalId}/${family} requires aligned q and PACE evidence.`);
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

function qPaceParetoFrontier(rows: readonly FrontierRow[]): FrontierRow[] {
  return rows.filter((candidate) =>
    !rows.some((other) => other.proposalId !== candidate.proposalId && qPaceDominates(other, candidate))
  );
}

function structuredFrontierIds(
  certificates: A1CandidateEvidenceCertificateSet,
  family: A1PlayerFutureFamily
): string[] {
  return qPaceParetoFrontier(g4Frontier(comparableRows(certificates, family)))
    .map((row) => row.proposalId)
    .sort();
}

function pairFor(
  atlas: A1CrossFutureContradictionAtlas,
  aId: string,
  bId: string
) {
  const pair = atlas.pairs.find((candidate) =>
    (candidate.proposalAId === aId && candidate.proposalBId === bId) ||
    (candidate.proposalAId === bId && candidate.proposalBId === aId)
  );
  if (!pair) throw new Error(`A1.2y missing s1 pair ${aId}/${bId}.`);
  return pair;
}

function oppositeUtility(a: A1PairUtilityOrder, b: A1PairUtilityOrder): boolean {
  return (a === "A_HIGHER" && b === "B_HIGHER") || (a === "B_HIGHER" && b === "A_HIGHER");
}

function oppositeCooperation(a: A1PairCooperationRelation, b: A1PairCooperationRelation): boolean {
  return (a === "A_PREFERRED" && b === "B_PREFERRED") ||
    (a === "B_PREFERRED" && b === "A_PREFERRED");
}

function familyPreferenceReversal(input: {
  atlas: A1CrossFutureContradictionAtlas;
  h1ProposalId: string;
  alternateProposalId: string;
  family: DiagnosticFamily;
}) {
  const pair = pairFor(input.atlas, input.h1ProposalId, input.alternateProposalId);
  const owner = pair.observations.find((observation) => observation.futureFamily === H1);
  const alternate = pair.observations.find((observation) => observation.futureFamily === input.family);
  if (!owner || !alternate) throw new Error("A1.2y s1 pair must preserve all three future observations.");

  const utility = oppositeUtility(owner.utilityOrder, alternate.utilityOrder);
  const cooperation = oppositeCooperation(owner.cooperationRelation, alternate.cooperationRelation);
  return { utility, cooperation, any: utility || cooperation };
}

function annotation(input: {
  certificates: A1CandidateEvidenceCertificateSet;
  atlas: A1CrossFutureContradictionAtlas;
  h1ProposalId: string;
  family: DiagnosticFamily;
}): DiagnosticAnnotation {
  const certificate = input.certificates.certificates.find((candidate) =>
    candidate.proposalId === input.h1ProposalId
  );
  if (!certificate) throw new Error(`A1.2y missing certificate ${input.h1ProposalId}.`);
  const alternateEvidence = future(certificate, input.family);
  const alternateRows = comparableRows(input.certificates, input.family);
  const alternateFrontierIds = structuredFrontierIds(input.certificates, input.family);
  const comparable = alternateRows.some((row) => row.proposalId === input.h1ProposalId);

  if (!comparable) {
    return {
      futureFamily: input.family,
      status: "UNAVAILABLE",
      alternateFrontierIds,
      preferenceReversalEvident: false,
      utilityPreferenceReversalEvident: false,
      cooperationPreferenceReversalEvident: false,
      conflictingWithProposalIds: [],
      interpretationClaim:
        "DIAGNOSTIC_EVIDENCE_ONLY_NO_VOTE_NO_VETO_NO_OWNER_REQUEST_REPLACEMENT_A1_2Y"
    };
  }

  if (!alternateEvidence.robustness.relationNode.comparisonEligible) {
    throw new Error("A1.2y comparable row and certificate eligibility disagree.");
  }

  if (alternateFrontierIds.includes(input.h1ProposalId)) {
    return {
      futureFamily: input.family,
      status: "FRONTIER_SUPPORT",
      alternateFrontierIds,
      preferenceReversalEvident: false,
      utilityPreferenceReversalEvident: false,
      cooperationPreferenceReversalEvident: false,
      conflictingWithProposalIds: [],
      interpretationClaim:
        "DIAGNOSTIC_EVIDENCE_ONLY_NO_VOTE_NO_VETO_NO_OWNER_REQUEST_REPLACEMENT_A1_2Y"
    };
  }

  const reversals = alternateFrontierIds.map((alternateProposalId) => ({
    alternateProposalId,
    reversal: familyPreferenceReversal({
      atlas: input.atlas,
      h1ProposalId: input.h1ProposalId,
      alternateProposalId,
      family: input.family
    })
  }));
  const conflicting = reversals.filter((entry) => entry.reversal.any);

  return {
    futureFamily: input.family,
    status: "DIAGNOSTIC_FRONTIER_EXCLUSION",
    alternateFrontierIds,
    preferenceReversalEvident: conflicting.length > 0,
    utilityPreferenceReversalEvident: conflicting.some((entry) => entry.reversal.utility),
    cooperationPreferenceReversalEvident: conflicting.some((entry) => entry.reversal.cooperation),
    conflictingWithProposalIds: conflicting.map((entry) => entry.alternateProposalId).sort(),
    interpretationClaim:
      "DIAGNOSTIC_EVIDENCE_ONLY_NO_VOTE_NO_VETO_NO_OWNER_REQUEST_REPLACEMENT_A1_2Y"
  };
}

function summarizeState(input: {
  stateId: string;
  scenario: Scenario;
  result: ReturnType<typeof decision>;
}): StateObservation {
  const h1FrontierIds = structuredFrontierIds(input.result.certificates, H1);
  return {
    stateId: input.stateId,
    scenario: input.scenario,
    tick: input.result.situation.tick,
    horizonSeconds: input.result.proposalSet.horizonSeconds,
    transitionReasons: input.result.hypotheses.transitionReasons,
    proposalCount: input.result.proposalSet.proposalCount,
    h1FrontierIds,
    h1FrontierUnavailable: h1FrontierIds.length === 0,
    survivors: h1FrontierIds.map((proposalId) => ({
      proposalId,
      diagnostics: DIAGNOSTIC_FUTURES.map((family) => annotation({
        certificates: input.result.certificates,
        atlas: input.result.contradictionAtlas,
        h1ProposalId: proposalId,
        family
      }))
    })),
    selectionClaim: "NONE_ROBUSTNESS_ATLAS_ONLY_A1_2Y",
    runtimeAuthorityClaim: "NONE_A1_2Y"
  };
}

async function matrix(): Promise<StateObservation[]> {
  const results: StateObservation[] = [];

  for (const horizonSeconds of HORIZONS) {
    const world = await LabWorld.create("open");
    try {
      results.push(summarizeState({
        stateId: `open-initial-forward-${horizonSeconds}`,
        scenario: "open",
        result: decision({ world, playerMove: { x: 1, y: 0 }, horizonSeconds })
      }));
    } finally {
      world.dispose();
    }
  }

  for (const horizonSeconds of HORIZONS) {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([player(1), companionHold()]);
      results.push(summarizeState({
        stateId: `open-established-forward-${horizonSeconds}`,
        scenario: "open",
        result: decision({
          world,
          snapshot: after,
          playerMove: { x: 1, y: 0 },
          horizonSeconds
        })
      }));
      results.push(summarizeState({
        stateId: `open-reversal-${horizonSeconds}`,
        scenario: "open",
        result: decision({
          world,
          snapshot: after,
          playerMove: { x: -1, y: 0 },
          horizonSeconds
        })
      }));
    } finally {
      world.dispose();
    }
  }

  for (const horizonSeconds of HORIZONS) {
    const world = await LabWorld.create("head-on");
    try {
      results.push(summarizeState({
        stateId: `head-on-forward-${horizonSeconds}`,
        scenario: "head-on",
        result: decision({
          world,
          playerMove: { x: 1, y: 0 },
          horizonSeconds,
          localAlternativeDeltaSpeed: 3
        })
      }));
    } finally {
      world.dispose();
    }
  }

  for (const horizonSeconds of HORIZONS) {
    const world = await LabWorld.create("doorway");
    try {
      results.push(summarizeState({
        stateId: `doorway-forward-${horizonSeconds}`,
        scenario: "doorway",
        result: decision({ world, playerMove: { x: 1, y: 0 }, horizonSeconds })
      }));
    } finally {
      world.dispose();
    }
  }

  for (const horizonSeconds of HORIZONS) {
    const world = await LabWorld.create("pillar");
    try {
      results.push(summarizeState({
        stateId: `pillar-forward-${horizonSeconds}`,
        scenario: "pillar",
        result: decision({ world, playerMove: { x: 1, y: 0 }, horizonSeconds })
      }));
    } finally {
      world.dispose();
    }
  }

  return results;
}

function diagnosticObservations(results: readonly StateObservation[]) {
  return results.flatMap((state) =>
    state.survivors.flatMap((survivor) =>
      survivor.diagnostics.map((diagnostic) => ({ state, survivor, diagnostic }))
    )
  );
}

describe("Authority-A1.2y H1 survivor cross-future robustness", () => {
  it("characterizes alternate-future support, exclusion and missing evidence without allowing a diagnostic vote or veto", async () => {
    const results = await matrix();
    const observations = diagnosticObservations(results);
    const counts = {
      support: observations.filter(({ diagnostic }) => diagnostic.status === "FRONTIER_SUPPORT").length,
      exclusion: observations.filter(({ diagnostic }) => diagnostic.status === "DIAGNOSTIC_FRONTIER_EXCLUSION").length,
      unavailable: observations.filter(({ diagnostic }) => diagnostic.status === "UNAVAILABLE").length,
      exclusionWithPreferenceReversal: observations.filter(({ diagnostic }) =>
        diagnostic.status === "DIAGNOSTIC_FRONTIER_EXCLUSION" && diagnostic.preferenceReversalEvident
      ).length,
      utilityPreferenceReversal: observations.filter(({ diagnostic }) =>
        diagnostic.utilityPreferenceReversalEvident
      ).length,
      cooperationPreferenceReversal: observations.filter(({ diagnostic }) =>
        diagnostic.cooperationPreferenceReversalEvident
      ).length
    };

    console.log("[A1_2Y_CROSS_FUTURE_FRONTIER_ROBUSTNESS]", JSON.stringify({
      qEpsilon: Q_EPSILON,
      paceAuditResolutionMeters: PACE_RESOLUTION_METERS,
      horizons: HORIZONS,
      semantics: {
        h1: "OWNER_REQUEST_PRIMARY_COUNTERFACTUAL",
        h2: "BODY_RESPONSE_DIAGNOSTIC_COUNTERFACTUAL",
        h3: "TRANSITION_HOLD_DIAGNOSTIC_COUNTERFACTUAL",
        alternateFrontierExclusion: "DIAGNOSTIC_ONLY_NOT_VETO",
        weighting: "NONE",
        vote: "NONE",
        veto: "NONE",
        winner: "NONE",
        runtimeAuthority: "NONE"
      },
      counts,
      results
    }));

    expect(results).toHaveLength(30);
    expect(observations.length).toBeGreaterThan(0);
    expect(counts.support).toBeGreaterThan(0);
    expect(counts.unavailable).toBeGreaterThan(0);
    expect(results.every((state) => state.selectionClaim === "NONE_ROBUSTNESS_ATLAS_ONLY_A1_2Y")).toBe(true);
    expect(results.every((state) => state.runtimeAuthorityClaim === "NONE_A1_2Y")).toBe(true);

    const reversal = results.find((state) => state.stateId === "open-reversal-0.5");
    expect(reversal).toBeDefined();
    expect(reversal!.h1FrontierIds).toEqual(["a1-2o-command-1"]);
    expect(reversal!.survivors[0]!.diagnostics.every((diagnostic) =>
      diagnostic.status === "FRONTIER_SUPPORT"
    )).toBe(true);

    const initial = results.find((state) => state.stateId === "open-initial-forward-0.5");
    expect(initial).toBeDefined();
    expect(initial!.survivors.some((survivor) =>
      survivor.diagnostics.every((diagnostic) => diagnostic.status === "UNAVAILABLE")
    )).toBe(true);
  });
});
