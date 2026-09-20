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
import type { MotionIntent, WorldSnapshot } from "../world/types";

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
  const utilityProfiles = physicalProfiles.map((profile) =>
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
    utilityProfiles,
    relationGraphs
  });
  const atlas = buildA1CrossFutureContradictionAtlas(research);
  const h1 = hypotheses.hypotheses.find((future) => future.family === "OWNER_REQUEST_CONTINUATION")!;
  const discriminating = atlas.pairs.filter((pair) =>
    pair.ownerUtilityOrder === "A_HIGHER" || pair.ownerUtilityOrder === "B_HIGHER"
  ).length;
  const unavailable = atlas.pairs.filter((pair) => pair.ownerUtilityOrder === "UNAVAILABLE").length;
  return {
    horizonSeconds,
    playerX: snapshot.actors.find((actor) => actor.id === "player")!.position.x,
    companionX: snapshot.actors.find((actor) => actor.id === "companion")!.position.x,
    relativeX: snapshot.actors.find((actor) => actor.id === "companion")!.position.x -
      snapshot.actors.find((actor) => actor.id === "player")!.position.x,
    h1IntendedEndpointX: h1.staticFeasibility.intendedEndpoint.x,
    h1FeasibleEndpointX: h1.staticFeasibility.feasibleEndpoint.x,
    h1FeasibleFraction: h1.staticFeasibility.feasibleFraction,
    h1NominalVelocityX: h1.nominalVelocity.x,
    h1EffectiveVelocityX: h1.effectiveVelocity.x,
    proposalCount: proposalSet.proposalCount,
    pairCount: atlas.pairCount,
    discriminatingPairs: discriminating,
    unavailablePairs: unavailable
  };
}

const HORIZONS = [0.75, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8] as const;

describe("Authority-A1.2t reversal horizon translation confound", () => {
  it("tests whether reversal information onset follows world-boundary clipping when relative state is translated intact", async () => {
    const translations = [0, 20, 40] as const;
    const results: Array<Record<string, unknown>> = [];

    for (const translationSteps of translations) {
      const { world, snapshot } = await translatedReversalSnapshot(translationSteps);
      try {
        const observations = HORIZONS.map((horizonSeconds) => evaluate(world, snapshot, horizonSeconds));
        const firstInformativeFullCoverage = observations.find((entry) =>
          entry.discriminatingPairs > 0 && entry.unavailablePairs === 0
        )?.horizonSeconds ?? null;
        const firstClipped = observations.find((entry) => entry.h1FeasibleFraction < 0.999999)
          ?.horizonSeconds ?? null;
        results.push({
          translationSteps,
          translationMeters: translationSteps * 0.05,
          firstClippedHorizon: firstClipped,
          firstInformativeFullCoverageHorizon: firstInformativeFullCoverage,
          observations
        });
      } finally {
        world.dispose();
      }
    }

    console.log("[A1_2T_REVERSAL_TRANSLATION]", JSON.stringify(results));

    expect(results).toHaveLength(3);
    expect(results[0]!.firstInformativeFullCoverageHorizon).toBe(1.2);
    expect(results.some((entry, index) =>
      index > 0 && entry.firstInformativeFullCoverageHorizon !== 1.2
    )).toBe(true);
  });
});
