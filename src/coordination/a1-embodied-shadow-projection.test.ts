import { describe, expect, it } from "vitest";
import {
  buildA1EmbodiedH1ShadowProjection
} from "./a1-embodied-shadow-projection";
import { evaluateA1H1PrimaryShadowHorizon } from "./a1-h1-primary-shadow";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, WorldSnapshot } from "../world/types";

function player(move: { x: number; y: number }): MotionIntent {
  return { actorId: "player", move };
}

function companion(move: { x: number; y: number }): MotionIntent {
  return { actorId: "companion", move };
}

function situation(world: LabWorld, snapshot: WorldSnapshot, playerIntent: MotionIntent) {
  return buildA1Situation({
    snapshot,
    playerIntent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: world.latestAuthorityA0StepEvidence()
  });
}

function finitePoint(value: { x: number; y: number }): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}

describe("Authority-A1.2 P1 embodied H1 shadow projection", () => {
  it("embodies the complete qualified H1 frontier at tick 0 without inventing selection or mutating the live World", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const current = world.snapshot();
      const decisionSituation = situation(world, current, player({ x: 1, y: 0 }));
      const physicalBefore = world.snapshot();
      const a0Before = world.latestAuthorityA0StepEvidence();
      const canonicalFrontier = evaluateA1H1PrimaryShadowHorizon({
        world,
        situation: decisionSituation,
        horizonSeconds: 1
      });

      const projection = buildA1EmbodiedH1ShadowProjection({
        world,
        situation: decisionSituation,
        horizonSeconds: 1
      });

      expect(projection.kind).toBe("A1_EMBODIED_H1_SHADOW_PROJECTION");
      expect(projection.sourceTick).toBe(0);
      expect(projection.horizonSeconds).toBe(1);
      expect(projection.frontierState).toBe(canonicalFrontier.shadowDecisionState);
      expect(projection.frontierProposalIds).toEqual(
        canonicalFrontier.frontierCandidates.map((candidate) => candidate.proposalId)
      );
      expect(projection.candidates.map((candidate) => candidate.proposalId)).toEqual(
        projection.frontierProposalIds
      );
      expect(projection.semantics.selection).toBe("NONE_SHOW_ALL_FRONTIER_MEMBERS_P1");
      expect(projection.semantics.tieBreak).toBe("NONE_P1");
      expect(projection.semantics.sidePreference).toBe("NONE_P1");
      expect(projection.semantics.liveWorldMutation).toBe("NONE_QUERY_ONLY_REHEARSALS_P1");
      expect(projection.semantics.movementAuthority).toBe("NONE_P1");

      expect(projection.frontierState).toBe("SINGLETON_H1_FRONTIER");
      expect(projection.candidates).toHaveLength(1);
      const candidate = projection.candidates[0]!;
      expect(candidate.originFamilies).toContain("RELATIVE_TANGENT_NEGATIVE");
      expect(candidate.frames).toHaveLength(candidate.worldStepCount);
      expect(candidate.worldStepCount).toBeGreaterThan(0);
      expect(candidate.physicalEvidenceClaim).toBe("SAME_PHYSICS_H1_GHOST_TRAJECTORY_P1");
      expect(candidate.selectionClaim).toBe("NONE_FRONTIER_MEMBER_ONLY_P1");
      expect(candidate.runtimeAuthorityClaim).toBe("NONE_P1");
      expect(candidate.playerStart).toEqual(decisionSituation.situated.playerBody.position);
      expect(candidate.companionStart).toEqual(decisionSituation.situated.companionBody.position);
      expect(candidate.frames.every((frame) =>
        finitePoint(frame.playerPosition) && finitePoint(frame.companionPosition)
      )).toBe(true);

      expect(world.snapshot()).toEqual(physicalBefore);
      expect(world.latestAuthorityA0StepEvidence()).toEqual(a0Before);
    } finally {
      world.dispose();
    }
  });

  it("projects a nonzero exact decision state without changing the live World's next physical outcome", async () => {
    const observed = await LabWorld.create("head-on");
    const control = await LabWorld.create("head-on");
    try {
      const approach = [player({ x: 1, y: 0 }), companion({ x: -1, y: 0 })];
      let observedSnapshot: WorldSnapshot = observed.snapshot();
      let controlSnapshot: WorldSnapshot = control.snapshot();
      for (let index = 0; index < 8; index += 1) {
        observedSnapshot = observed.step(approach);
        controlSnapshot = control.step(approach);
      }
      expect(observedSnapshot).toEqual(controlSnapshot);

      const decisionSituation = situation(observed, observedSnapshot, player({ x: 1, y: 0 }));
      const physicalBefore = observed.snapshot();
      const a0Before = observed.latestAuthorityA0StepEvidence();
      const projection = buildA1EmbodiedH1ShadowProjection({
        world: observed,
        situation: decisionSituation,
        horizonSeconds: 1
      });

      expect(projection.sourceTick).toBe(8);
      expect(projection.frontierProposalIds).toEqual(
        projection.candidates.map((candidate) => candidate.proposalId)
      );
      expect(projection.candidates.every((candidate) =>
        candidate.selectionClaim === "NONE_FRONTIER_MEMBER_ONLY_P1" &&
        candidate.runtimeAuthorityClaim === "NONE_P1"
      )).toBe(true);
      expect(observed.snapshot()).toEqual(physicalBefore);
      expect(observed.latestAuthorityA0StepEvidence()).toEqual(a0Before);

      const observedNext = observed.step(approach);
      const controlNext = control.step(approach);
      expect(observedNext).toEqual(controlNext);
    } finally {
      observed.dispose();
      control.dispose();
    }
  });
});
