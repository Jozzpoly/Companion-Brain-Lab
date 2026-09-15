import { describe, expect, it } from "vitest";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1CrossFutureContradictionAtlas } from "./a1-cross-future-contradiction-atlas";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent, ScenarioId, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function buildResearch(input: {
  world: LabWorld;
  snapshot: WorldSnapshot;
  playerMove: Vec2;
  horizonSeconds: number;
}) {
  const situation = buildA1Situation({
    snapshot: input.snapshot,
    playerIntent: playerIntent(input.playerMove.x, input.playerMove.y),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: input.snapshot.tick === 0 ? null : input.world.latestAuthorityA0StepEvidence()
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
    localAlternativeDeltaSpeed: 1
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
  const utilityProfiles = physicalProfiles.map((profile) =>
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
  return buildA1CommandRobustnessResearchSet({
    proposalSet,
    physicalProfiles,
    utilityProfiles,
    relationGraphs
  });
}

function characterize(research: ReturnType<typeof buildResearch>) {
  const atlas = buildA1CrossFutureContradictionAtlas(research);
  const h1Statuses: Record<string, number> = {};
  for (const dossier of research.dossiers) {
    const h1 = dossier.futures.find((entry) => entry.futureFamily === "OWNER_REQUEST_CONTINUATION");
    if (!h1) throw new Error(`A1.2t missing H1 for ${dossier.proposalId}`);
    increment(h1Statuses, h1.physicalStatus);
  }
  const h1Observations = atlas.pairs.map((pair) =>
    pair.observations.find((entry) => entry.futureFamily === "OWNER_REQUEST_CONTINUATION")!
  );
  return {
    proposalCount: research.dossiers.length,
    pairCount: atlas.pairCount,
    utilityDiscriminatingPairs: atlas.pairs.filter((pair) =>
      pair.ownerUtilityOrder === "A_HIGHER" || pair.ownerUtilityOrder === "B_HIGHER"
    ).length,
    utilityEqualPairs: atlas.pairs.filter((pair) => pair.ownerUtilityOrder === "EQUAL").length,
    utilityUnavailablePairs: atlas.pairs.filter((pair) => pair.ownerUtilityOrder === "UNAVAILABLE").length,
    cooperationPreferencePairs: h1Observations.filter((entry) =>
      entry.cooperationRelation === "A_PREFERRED" || entry.cooperationRelation === "B_PREFERRED"
    ).length,
    cooperationForcedPairs: h1Observations.filter((entry) =>
      entry.cooperationRelation === "FORCED_CONTENTION"
    ).length,
    cooperationNoPreferencePairs: h1Observations.filter((entry) =>
      entry.cooperationRelation === "NO_PREFERENCE"
    ).length,
    h1Statuses
  };
}

interface StateCase {
  id: string;
  scenario: ScenarioId;
  prepare: (world: LabWorld) => WorldSnapshot;
  playerMove: Vec2;
}

const STATES: readonly StateCase[] = [
  {
    id: "open-initial-forward",
    scenario: "open",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "open-established-forward",
    scenario: "open",
    prepare: (world) => world.step([playerIntent(1, 0), companionHold()]),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "open-reversal",
    scenario: "open",
    prepare: (world) => world.step([playerIntent(1, 0), companionHold()]),
    playerMove: { x: -1, y: 0 }
  },
  {
    id: "head-on-forward",
    scenario: "head-on",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "doorway-forward",
    scenario: "doorway",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  },
  {
    id: "pillar-forward",
    scenario: "pillar",
    prepare: (world) => world.snapshot(),
    playerMove: { x: 1, y: 0 }
  }
];

const HORIZONS = [0.5, 0.75, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;

describe("Authority-A1.2t multi-state H1 decision-horizon frontier", () => {
  it("characterizes whether one fixed bounded horizon preserves coverage and useful decision information across representative states", async () => {
    const results: Array<Record<string, unknown>> = [];

    for (const state of STATES) {
      const world = await LabWorld.create(state.scenario);
      try {
        const snapshot = state.prepare(world);
        const stateResults = HORIZONS.map((horizonSeconds) => ({
          horizonSeconds,
          ...characterize(buildResearch({
            world,
            snapshot,
            playerMove: state.playerMove,
            horizonSeconds
          }))
        }));
        const fullCoverageInformative = stateResults.filter((entry) =>
          entry.utilityUnavailablePairs === 0 && entry.utilityDiscriminatingPairs > 0
        );
        results.push({
          stateId: state.id,
          scenario: state.scenario,
          firstFullCoverageInformativeHorizon:
            fullCoverageInformative[0]?.horizonSeconds ?? null,
          observations: stateResults
        });
      } finally {
        world.dispose();
      }
    }

    console.log("[A1_2T_HORIZON_FRONTIER]", JSON.stringify(results));

    expect(results).toHaveLength(STATES.length);
    expect(results.every((entry) => Array.isArray(entry.observations))).toBe(true);
    const reversal = results.find((entry) => entry.stateId === "open-reversal")!;
    expect(reversal.firstFullCoverageInformativeHorizon).toBe(1.2);
    expect(results.some((entry) => entry.firstFullCoverageInformativeHorizon !== 1.2)).toBe(true);
  });
});
