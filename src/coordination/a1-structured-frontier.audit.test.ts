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
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

const Q_EPSILON = 1e-9;
const PACE_RESOLUTION_METERS = 1e-3;
const FUTURES: readonly A1PlayerFutureFamily[] = [
  "OWNER_REQUEST_CONTINUATION",
  "BODY_RESPONSE_CONTINUATION",
  "TRANSITION_HOLD"
];

type Scenario = "open" | "head-on" | "doorway" | "pillar";

interface FrontierRow {
  proposalId: string;
  q: number;
  paceDelta: number;
  dominatedByProposalIds: readonly string[];
  forcedContentionWithProposalIds: readonly string[];
}

interface FutureFrontierSummary {
  futureFamily: A1PlayerFutureFamily;
  comparableProposalIds: readonly string[];
  g4DominatedProposalIds: readonly string[];
  g4FrontierIds: readonly string[];
  qPaceParetoAllIds: readonly string[];
  g4ThenQPaceIds: readonly string[];
  qPaceThenG4Ids: readonly string[];
  qPaceRemovedAfterG4Ids: readonly string[];
  qPaceRemovedBeforeG4Ids: readonly string[];
  forcedContentionProposalIds: readonly string[];
  compositionOrderDiffers: boolean;
}

interface StateSummary {
  stateId: string;
  scenario: Scenario;
  tick: number;
  horizonSeconds: number;
  proposalCount: number;
  transitionReasons: readonly string[];
  futures: readonly FutureFrontierSummary[];
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

  return {
    situation,
    proposalSet,
    certificates,
    transitionReasons: hypotheses.transitionReasons
  };
}

function future(
  certificate: A1CandidateEvidenceCertificate,
  family: A1PlayerFutureFamily
) {
  const matches = certificate.futures.filter((candidate) => candidate.futureFamily === family);
  if (matches.length !== 1) {
    throw new Error(`A1.2x expected exactly one ${family} future for ${certificate.proposalId}.`);
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
      throw new Error(`A1.2x comparable ${certificate.proposalId}/${family} requires aligned q and PACE evidence.`);
    }

    rows.push({
      proposalId: certificate.proposalId,
      q,
      paceDelta,
      dominatedByProposalIds: evidence.robustness.dominatedByProposalIds,
      forcedContentionWithProposalIds: evidence.robustness.forcedContentionWithProposalIds
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

function ids(rows: readonly FrontierRow[]): string[] {
  return rows.map((row) => row.proposalId).sort();
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function summarizeFuture(
  certificates: A1CandidateEvidenceCertificateSet,
  family: A1PlayerFutureFamily
): FutureFrontierSummary {
  const comparable = comparableRows(certificates, family);
  const g4 = g4Frontier(comparable);
  const qPaceAll = qPaceParetoFrontier(comparable);
  const g4ThenQPace = qPaceParetoFrontier(g4);
  const qPaceThenG4 = g4Frontier(qPaceAll);
  const comparableIds = ids(comparable);
  const g4Ids = ids(g4);
  const qPaceAllIds = ids(qPaceAll);
  const g4ThenQPaceIds = ids(g4ThenQPace);
  const qPaceThenG4Ids = ids(qPaceThenG4);
  const forcedContentionProposalIds = ids(comparable.filter((row) =>
    row.forcedContentionWithProposalIds.some((proposalId) => comparableIds.includes(proposalId))
  ));

  return {
    futureFamily: family,
    comparableProposalIds: comparableIds,
    g4DominatedProposalIds: comparableIds.filter((proposalId) => !g4Ids.includes(proposalId)),
    g4FrontierIds: g4Ids,
    qPaceParetoAllIds,
    g4ThenQPaceIds,
    qPaceThenG4Ids,
    qPaceRemovedAfterG4Ids: g4Ids.filter((proposalId) => !g4ThenQPaceIds.includes(proposalId)),
    qPaceRemovedBeforeG4Ids: comparableIds.filter((proposalId) => !qPaceAllIds.includes(proposalId)),
    forcedContentionProposalIds,
    compositionOrderDiffers: !sameIds(g4ThenQPaceIds, qPaceThenG4Ids)
  };
}

function summarizeState(input: {
  stateId: string;
  scenario: Scenario;
  result: ReturnType<typeof decision>;
}): StateSummary {
  return {
    stateId: input.stateId,
    scenario: input.scenario,
    tick: input.result.situation.tick,
    horizonSeconds: input.result.proposalSet.horizonSeconds,
    proposalCount: input.result.proposalSet.proposalCount,
    transitionReasons: input.result.transitionReasons,
    futures: FUTURES.map((family) => summarizeFuture(input.result.certificates, family))
  };
}

async function matrix(): Promise<StateSummary[]> {
  const results: StateSummary[] = [];

  const initial = await LabWorld.create("open");
  try {
    results.push(summarizeState({
      stateId: "open-initial-forward",
      scenario: "open",
      result: decision({ world: initial, playerMove: { x: 1, y: 0 }, horizonSeconds: 0.5 })
    }));
  } finally {
    initial.dispose();
  }

  const established = await LabWorld.create("open");
  try {
    const after = established.step([player(1), companionHold()]);
    results.push(summarizeState({
      stateId: "open-established-forward",
      scenario: "open",
      result: decision({
        world: established,
        snapshot: after,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 0.5
      })
    }));
    results.push(summarizeState({
      stateId: "open-reversal",
      scenario: "open",
      result: decision({
        world: established,
        snapshot: after,
        playerMove: { x: -1, y: 0 },
        horizonSeconds: 0.5
      })
    }));
  } finally {
    established.dispose();
  }

  const headOn = await LabWorld.create("head-on");
  try {
    results.push(summarizeState({
      stateId: "head-on-forward",
      scenario: "head-on",
      result: decision({
        world: headOn,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        localAlternativeDeltaSpeed: 3
      })
    }));
  } finally {
    headOn.dispose();
  }

  const doorway = await LabWorld.create("doorway");
  try {
    results.push(summarizeState({
      stateId: "doorway-forward",
      scenario: "doorway",
      result: decision({ world: doorway, playerMove: { x: 1, y: 0 }, horizonSeconds: 0.5 })
    }));
  } finally {
    doorway.dispose();
  }

  const pillar = await LabWorld.create("pillar");
  try {
    results.push(summarizeState({
      stateId: "pillar-forward",
      scenario: "pillar",
      result: decision({ world: pillar, playerMove: { x: 1, y: 0 }, horizonSeconds: 0.5 })
    }));
  } finally {
    pillar.dispose();
  }

  return results;
}

function stateFuture(
  results: readonly StateSummary[],
  stateId: string,
  family: A1PlayerFutureFamily
): FutureFrontierSummary {
  const state = results.find((candidate) => candidate.stateId === stateId);
  if (!state) throw new Error(`A1.2x missing state ${stateId}.`);
  const future = state.futures.find((candidate) => candidate.futureFamily === family);
  if (!future) throw new Error(`A1.2x missing ${stateId}/${family}.`);
  return future;
}

describe("Authority-A1.2x structured frontier research", () => {
  it("characterizes G4 and q/PACE frontier composition without manufacturing a winner", async () => {
    const results = await matrix();
    console.log("[A1_2X_STRUCTURED_FRONTIERS]", JSON.stringify({
      qEpsilon: Q_EPSILON,
      paceAuditResolutionMeters: PACE_RESOLUTION_METERS,
      semantics: {
        g4: "pairwise-undominated-frontier-only",
        qPace: "two-axis-pareto-frontier-only",
        weighting: "NONE",
        winner: "NONE",
        runtimeAuthority: "NONE"
      },
      results
    }));

    expect(results).toHaveLength(6);
    for (const future of results.flatMap((state) => state.futures)) {
      if (future.comparableProposalIds.length === 0) continue;
      expect(future.g4FrontierIds.length).toBeGreaterThan(0);
      expect(future.qPaceParetoAllIds.length).toBeGreaterThan(0);
      expect(future.g4ThenQPaceIds.length).toBeGreaterThan(0);
      expect(future.qPaceThenG4Ids.length).toBeGreaterThan(0);
    }

    const reversalH1 = stateFuture(results, "open-reversal", "OWNER_REQUEST_CONTINUATION");
    expect(reversalH1.g4DominatedProposalIds).toHaveLength(0);
    expect(reversalH1.qPaceRemovedBeforeG4Ids.length).toBeGreaterThan(0);

    const headOnH1 = stateFuture(results, "head-on-forward", "OWNER_REQUEST_CONTINUATION");
    expect(headOnH1.g4DominatedProposalIds.length).toBeGreaterThan(0);
    expect(headOnH1.g4FrontierIds.length).toBeLessThan(headOnH1.comparableProposalIds.length);
  });
});
