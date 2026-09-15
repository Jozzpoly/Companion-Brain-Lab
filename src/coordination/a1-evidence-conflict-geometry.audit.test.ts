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

type AxisPreference = "A" | "B" | "EQUAL" | "UNAVAILABLE";
type G4Relation = "A" | "B" | "NO_PREFERENCE" | "FORCED_CONTENTION" | "UNAVAILABLE";

interface PairObservation {
  proposalAId: string;
  proposalBId: string;
  q: AxisPreference;
  pace: AxisPreference;
  g4: G4Relation;
}

interface FutureSummary {
  futureFamily: A1PlayerFutureFamily;
  pairCount: number;
  qDiscriminatingPairs: number;
  paceDiscriminatingPairs: number;
  g4PreferencePairs: number;
  g4NoPreferencePairs: number;
  g4ForcedContentionPairs: number;
  qPaceAgreePairs: number;
  qPaceConflictPairs: number;
  qEqualPaceDifferentPairs: number;
  paceEqualQDifferentPairs: number;
  fullTriAxisPreferencePairs: number;
  allThreeAgreePairs: number;
  anyTriAxisConflictPairs: number;
  qG4ConflictPairs: number;
  paceG4ConflictPairs: number;
  unavailablePairs: number;
  conflictExamples: readonly PairObservation[];
}

interface StateSummary {
  stateId: string;
  scenario: "open" | "head-on" | "doorway" | "pillar";
  tick: number;
  horizonSeconds: number;
  proposalCount: number;
  transitionReasons: readonly string[];
  futures: readonly FutureSummary[];
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
  return { situation, proposalSet, certificates, transitionReasons: hypotheses.transitionReasons };
}

function future(
  certificate: A1CandidateEvidenceCertificate,
  family: A1PlayerFutureFamily
) {
  const matches = certificate.futures.filter((candidate) => candidate.futureFamily === family);
  if (matches.length !== 1) throw new Error(`A1.2w expected exactly one ${family} future for ${certificate.proposalId}.`);
  return matches[0]!;
}

function qPreference(
  a: ReturnType<typeof future>,
  b: ReturnType<typeof future>
): AxisPreference {
  const qA = a.relationship.relationshipUtility?.terminalUtility.totalUtility;
  const qB = b.relationship.relationshipUtility?.terminalUtility.totalUtility;
  if (qA === undefined || qB === undefined) return "UNAVAILABLE";
  if (qA > qB + Q_EPSILON) return "A";
  if (qB > qA + Q_EPSILON) return "B";
  return "EQUAL";
}

function pacePreference(
  a: ReturnType<typeof future>,
  b: ReturnType<typeof future>
): AxisPreference {
  const paceA = a.radialPace.radialPace?.absoluteRadialErrorDelta;
  const paceB = b.radialPace.radialPace?.absoluteRadialErrorDelta;
  if (paceA === undefined || paceB === undefined) return "UNAVAILABLE";
  if (paceA < paceB - PACE_RESOLUTION_METERS) return "A";
  if (paceB < paceA - PACE_RESOLUTION_METERS) return "B";
  return "EQUAL";
}

function g4Relation(
  a: ReturnType<typeof future>,
  proposalBId: string
): G4Relation {
  const source = a.robustness;
  if (source.preferredOverProposalIds.includes(proposalBId)) return "A";
  if (source.dominatedByProposalIds.includes(proposalBId)) return "B";
  if (source.noPreferenceWithProposalIds.includes(proposalBId)) return "NO_PREFERENCE";
  if (source.forcedContentionWithProposalIds.includes(proposalBId)) return "FORCED_CONTENTION";
  return "UNAVAILABLE";
}

function discriminating(value: AxisPreference | G4Relation): value is "A" | "B" {
  return value === "A" || value === "B";
}

function conflicts(a: AxisPreference | G4Relation, b: AxisPreference | G4Relation): boolean {
  return discriminating(a) && discriminating(b) && a !== b;
}

function summarizeFuture(
  certificates: A1CandidateEvidenceCertificateSet,
  family: A1PlayerFutureFamily
): FutureSummary {
  const pairs: PairObservation[] = [];
  for (let i = 0; i < certificates.certificates.length; i += 1) {
    const candidateA = certificates.certificates[i]!;
    for (let j = i + 1; j < certificates.certificates.length; j += 1) {
      const candidateB = certificates.certificates[j]!;
      const a = future(candidateA, family);
      const b = future(candidateB, family);
      pairs.push({
        proposalAId: candidateA.proposalId,
        proposalBId: candidateB.proposalId,
        q: qPreference(a, b),
        pace: pacePreference(a, b),
        g4: g4Relation(a, candidateB.proposalId)
      });
    }
  }

  const triPreference = pairs.filter((pair) =>
    discriminating(pair.q) && discriminating(pair.pace) && discriminating(pair.g4)
  );
  const conflictPairs = pairs.filter((pair) =>
    conflicts(pair.q, pair.pace) || conflicts(pair.q, pair.g4) || conflicts(pair.pace, pair.g4)
  );

  return {
    futureFamily: family,
    pairCount: pairs.length,
    qDiscriminatingPairs: pairs.filter((pair) => discriminating(pair.q)).length,
    paceDiscriminatingPairs: pairs.filter((pair) => discriminating(pair.pace)).length,
    g4PreferencePairs: pairs.filter((pair) => discriminating(pair.g4)).length,
    g4NoPreferencePairs: pairs.filter((pair) => pair.g4 === "NO_PREFERENCE").length,
    g4ForcedContentionPairs: pairs.filter((pair) => pair.g4 === "FORCED_CONTENTION").length,
    qPaceAgreePairs: pairs.filter((pair) => discriminating(pair.q) && pair.q === pair.pace).length,
    qPaceConflictPairs: pairs.filter((pair) => conflicts(pair.q, pair.pace)).length,
    qEqualPaceDifferentPairs: pairs.filter((pair) => pair.q === "EQUAL" && discriminating(pair.pace)).length,
    paceEqualQDifferentPairs: pairs.filter((pair) => pair.pace === "EQUAL" && discriminating(pair.q)).length,
    fullTriAxisPreferencePairs: triPreference.length,
    allThreeAgreePairs: triPreference.filter((pair) => pair.q === pair.pace && pair.pace === pair.g4).length,
    anyTriAxisConflictPairs: conflictPairs.length,
    qG4ConflictPairs: pairs.filter((pair) => conflicts(pair.q, pair.g4)).length,
    paceG4ConflictPairs: pairs.filter((pair) => conflicts(pair.pace, pair.g4)).length,
    unavailablePairs: pairs.filter((pair) =>
      pair.q === "UNAVAILABLE" || pair.pace === "UNAVAILABLE" || pair.g4 === "UNAVAILABLE"
    ).length,
    conflictExamples: conflictPairs.slice(0, 6)
  };
}

function summarizeState(input: {
  stateId: string;
  scenario: StateSummary["scenario"];
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

describe("Authority-A1.2w q / radial-PACE / G4 evidence-conflict geometry", () => {
  it("characterizes three evidence axes without manufacturing a combined preference", async () => {
    const results = await matrix();
    console.log("[A1_2W_EVIDENCE_CONFLICT_GEOMETRY]", JSON.stringify({
      qEpsilon: Q_EPSILON,
      paceAuditResolutionMeters: PACE_RESOLUTION_METERS,
      results
    }));

    const allFutures = results.flatMap((state) => state.futures);
    const qPaceConflictCount = allFutures.reduce((sum, value) => sum + value.qPaceConflictPairs, 0);
    const qTieResolvedByPaceCount = allFutures.reduce((sum, value) => sum + value.qEqualPaceDifferentPairs, 0);
    const g4PreferenceCount = allFutures.reduce((sum, value) => sum + value.g4PreferencePairs, 0);
    const fullTriAxisCount = allFutures.reduce((sum, value) => sum + value.fullTriAxisPreferencePairs, 0);

    expect(results).toHaveLength(6);
    expect(qPaceConflictCount).toBeGreaterThan(0);
    expect(qTieResolvedByPaceCount).toBeGreaterThan(0);
    expect(g4PreferenceCount).toBeGreaterThan(0);
    expect(fullTriAxisCount).toBeGreaterThan(0);

    const reversalH1 = results.find((state) => state.stateId === "open-reversal")!
      .futures.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION")!;
    expect(reversalH1.qDiscriminatingPairs).toBe(0);
    expect(reversalH1.paceDiscriminatingPairs).toBeGreaterThan(0);

    const headOnH1 = results.find((state) => state.stateId === "head-on-forward")!
      .futures.find((value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION")!;
    expect(headOnH1.g4PreferencePairs).toBeGreaterThan(0);
  });
});
