import { describe, expect, it } from "vitest";
import { buildA1CommandRobustnessResearchSet } from "./a1-command-robustness-research-dossier";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1CrossFutureContradictionAtlas } from "./a1-cross-future-contradiction-atlas";
import {
  buildA1FixedCommandCrossFutureProfile,
  type A1FixedCommandCrossFutureProfile
} from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { buildA1TerminalRelationshipUtilityProfile } from "./a1-terminal-relationship-utility";
import { LabWorld } from "../world/world";
import type { MotionIntent, WorldSnapshot } from "../world/types";

function intent(actorId: "player" | "companion", x: number): MotionIntent {
  return { actorId, move: { x, y: 0 } };
}

async function reversalAtTranslation(translationSteps: number): Promise<{
  world: LabWorld;
  snapshot: WorldSnapshot;
}> {
  const world = await LabWorld.create("open");
  const direction = Math.sign(translationSteps);
  for (let index = 0; index < Math.abs(translationSteps); index += 1) {
    world.step([intent("player", direction), intent("companion", direction)]);
  }
  const snapshot = world.step([intent("player", 1), intent("companion", 0)]);
  return { world, snapshot };
}

function analyze(world: LabWorld, snapshot: WorldSnapshot, horizonSeconds: number) {
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
  const physicalProfiles: A1FixedCommandCrossFutureProfile[] = proposalSet.proposals.map((proposal) =>
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
  const rejectionByProposal = physicalProfiles.flatMap((profile) => {
    const h1Entry = profile.entries.find((entry) => entry.futureFamily === "OWNER_REQUEST_CONTINUATION")!;
    if (h1Entry.status !== "UPSTREAM_REJECTED") return [];
    return [{
      proposalId: profile.proposalId,
      commandVelocity: profile.commandVelocity,
      reason: h1Entry.reason,
      g0: h1Entry.qualification.g0.status,
      g1: h1Entry.qualification.g1.status,
      g2: h1Entry.qualification.g2.status,
      blockerLabel: h1Entry.qualification.g2.blockerLabel
    }];
  });
  const discriminatingPairs = atlas.pairs.filter((pair) =>
    pair.ownerUtilityOrder === "A_HIGHER" || pair.ownerUtilityOrder === "B_HIGHER"
  ).length;
  const unavailablePairs = atlas.pairs.filter((pair) => pair.ownerUtilityOrder === "UNAVAILABLE").length;
  const player = snapshot.actors.find((actor) => actor.id === "player")!;
  const companion = snapshot.actors.find((actor) => actor.id === "companion")!;
  return {
    horizonSeconds,
    playerX: player.position.x,
    companionX: companion.position.x,
    relativeX: companion.position.x - player.position.x,
    transitionReasons: hypotheses.transitionReasons,
    h1FeasibleFraction: h1.staticFeasibility.feasibleFraction,
    h1Clipped: h1.staticFeasibility.clipped,
    h1EffectiveVelocityX: h1.effectiveVelocity.x,
    proposalCount: proposalSet.proposalCount,
    pairCount: atlas.pairCount,
    discriminatingPairs,
    unavailablePairs,
    upstreamRejectedProposalCount: rejectionByProposal.length,
    rejectionByProposal
  };
}

const TRANSLATIONS = [
  { label: "minus-1m", steps: -20, expectedMeters: -1 },
  { label: "minus-0.5m", steps: -10, expectedMeters: -0.5 },
  { label: "origin", steps: 0, expectedMeters: 0 },
  { label: "plus-0.25m", steps: 5, expectedMeters: 0.25 }
] as const;

const HORIZONS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.2, 1.3] as const;

describe("Authority-A1.2t local reversal translation invariance audit", () => {
  it("separates H1 boundary clipping from companion G2 proposal rejection", async () => {
    const results: Array<Record<string, unknown>> = [];

    for (const translation of TRANSLATIONS) {
      const { world, snapshot } = await reversalAtTranslation(translation.steps);
      try {
        const observations = HORIZONS.map((horizonSeconds) => analyze(world, snapshot, horizonSeconds));
        const firstPlayerClip = observations.find((entry) => entry.h1Clipped)?.horizonSeconds ?? null;
        const firstDiscrimination = observations.find((entry) => entry.discriminatingPairs > 0)
          ?.horizonSeconds ?? null;
        const firstCompanionG2Reject = observations.find((entry) =>
          entry.rejectionByProposal.some((rejection) => rejection.g2 === "FAIL_STATIC_HARD_LEGALITY")
        )?.horizonSeconds ?? null;
        results.push({
          translation: translation.label,
          expectedMeters: translation.expectedMeters,
          firstPlayerClip,
          firstDiscrimination,
          firstCompanionG2Reject,
          observations
        });
      } finally {
        world.dispose();
      }
    }

    console.log("[A1_2T_LOCAL_INVARIANCE]", JSON.stringify(results));

    expect(results).toHaveLength(TRANSLATIONS.length);
    const origin = results.find((entry) => entry.translation === "origin")!;
    expect(origin.firstPlayerClip).toBe(1);
    expect(origin.firstDiscrimination).toBe(1.2);

    const minusOne = results.find((entry) => entry.translation === "minus-1m")!;
    expect(minusOne.firstPlayerClip).not.toBe(origin.firstPlayerClip);

    const locallySafe = results.filter((entry) => {
      const clip = entry.firstPlayerClip as number | null;
      const reject = entry.firstCompanionG2Reject as number | null;
      return clip !== null && (reject === null || clip < reject);
    });
    expect(locallySafe.length).toBeGreaterThanOrEqual(2);
  });
});
