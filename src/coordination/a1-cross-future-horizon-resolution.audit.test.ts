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

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function buildResearch(world: LabWorld, snapshot: WorldSnapshot, horizonSeconds: number) {
  const situation = buildA1Situation({
    snapshot,
    playerIntent: playerIntent(-1, 0),
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
    buildA1FixedCommandCrossFutureProfile({
      world,
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
  const relationGraphs = buildA1G4CrossFutureRelationGraphs({ proposalSet, profiles: physicalProfiles });
  return buildA1CommandRobustnessResearchSet({
    proposalSet,
    physicalProfiles,
    utilityProfiles,
    relationGraphs
  });
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

describe("Authority-A1.2s1 reversal horizon decision-resolution audit", () => {
  it("characterizes H1 discrimination onset against physical evidence coverage", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.step([playerIntent(1, 0), companionHold()]);
      const horizons = [0.5, 0.75, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;
      const observations = horizons.map((horizonSeconds) => {
        const research = buildResearch(world, snapshot, horizonSeconds);
        const atlas = buildA1CrossFutureContradictionAtlas(research);
        const ownerUtilityDiscriminatingPairCount = atlas.pairs.filter((pair) =>
          pair.ownerUtilityOrder === "A_HIGHER" || pair.ownerUtilityOrder === "B_HIGHER"
        ).length;
        const ownerUtilityEqualPairCount = atlas.pairs.filter((pair) =>
          pair.ownerUtilityOrder === "EQUAL"
        ).length;
        const ownerUtilityUnavailablePairCount = atlas.pairs.filter((pair) =>
          pair.ownerUtilityOrder === "UNAVAILABLE"
        ).length;
        const alternateUtilityDiscriminatesWhenOwnerEqualPairCount = atlas.pairs.filter((pair) =>
          pair.ownerUtilityOrder === "EQUAL" && pair.observations.some((observation) =>
            observation.futureFamily !== "OWNER_REQUEST_CONTINUATION" &&
            (observation.utilityOrder === "A_HIGHER" || observation.utilityOrder === "B_HIGHER")
          )
        ).length;
        const h1NodeStatuses: Record<string, number> = {};
        for (const dossier of research.dossiers) {
          const h1 = dossier.futures.find((future) =>
            future.futureFamily === "OWNER_REQUEST_CONTINUATION"
          );
          if (!h1) throw new Error(`missing H1 observation for ${dossier.proposalId}`);
          increment(h1NodeStatuses, h1.physicalStatus);
        }
        return {
          horizonSeconds,
          proposalCount: research.dossiers.length,
          pairCount: atlas.pairCount,
          ownerUtilityDiscriminatingPairCount,
          ownerUtilityEqualPairCount,
          ownerUtilityUnavailablePairCount,
          alternateUtilityDiscriminatesWhenOwnerEqualPairCount,
          h1NodeStatuses
        };
      });

      console.log("[A1_2S1_HORIZON_AUDIT] reversal", JSON.stringify(observations));
      expect(observations).toHaveLength(horizons.length);
      expect(observations[0]!.ownerUtilityDiscriminatingPairCount).toBe(0);
      expect(observations[0]!.ownerUtilityUnavailablePairCount).toBe(0);
      expect(observations[0]!.ownerUtilityEqualPairCount).toBe(observations[0]!.pairCount);
      expect(observations[0]!.alternateUtilityDiscriminatesWhenOwnerEqualPairCount).toBeGreaterThan(0);
      expect(observations.some((entry) => entry.ownerUtilityDiscriminatingPairCount > 0)).toBe(true);
    } finally {
      world.dispose();
    }
  });
});
