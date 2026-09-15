import { describe, expect, it } from "vitest";
import {
  A1_H1_PRIMARY_SHADOW_HORIZONS,
  evaluateA1H1PrimaryLiveStateShadow
} from "./a1-h1-primary-shadow";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, WorldSnapshot } from "../world/types";

function player(move: { x: number; y: number }): MotionIntent {
  return { actorId: "player", move };
}

function companion(move: { x: number; y: number }): MotionIntent {
  return { actorId: "companion", move };
}

function buildSituation(world: LabWorld, snapshot: WorldSnapshot, playerIntent: MotionIntent) {
  return buildA1Situation({
    snapshot,
    playerIntent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: world.latestAuthorityA0StepEvidence()
  });
}

describe("Authority-A1.2z4c exact live-state H1 shadow", () => {
  it("preserves the qualified tick-0 Z4 frontier while explicitly retaining zero selection authority", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: player({ x: 1, y: 0 }),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const evaluation = evaluateA1H1PrimaryLiveStateShadow({ world, situation });

      expect(evaluation.sourceTick).toBe(0);
      expect(evaluation.horizons).toEqual(A1_H1_PRIMARY_SHADOW_HORIZONS);
      expect(evaluation.semantics.horizonPolicy).toBe("NONE_SCAN_ONLY");
      expect(evaluation.semantics.sidePreference).toBe("NONE");
      expect(evaluation.semantics.movementAuthority).toBe("NONE_SHADOW_ONLY");

      const oneSecond = evaluation.results.find((result) => result.horizonSeconds === 1)!;
      expect(oneSecond.shadowDecisionState).toBe("SINGLETON_H1_FRONTIER");
      expect(oneSecond.singletonShadowCandidate?.originFamilies).toContain("RELATIVE_TANGENT_NEGATIVE");
      expect(oneSecond.singletonShadowCandidate?.commandVelocity.x).toBeCloseTo(2.1213203435596424, 10);
      expect(oneSecond.singletonShadowCandidate?.commandVelocity.y).toBeCloseTo(-2.1213203435596424, 10);
    } finally {
      world.dispose();
    }
  });

  it("evaluates a nonzero exact live decision state without mutating the live World or its next outcome", async () => {
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

      const situation = buildSituation(observed, observedSnapshot, player({ x: 1, y: 0 }));
      const physicalBefore = observed.snapshot();
      const a0Before = observed.latestAuthorityA0StepEvidence();
      const evaluation = evaluateA1H1PrimaryLiveStateShadow({
        world: observed,
        situation,
        horizons: [1]
      });

      expect(evaluation.sourceTick).toBe(8);
      expect(evaluation.results).toHaveLength(1);
      expect(evaluation.semantics.liveWorldMutation).toBe("NONE_QUERY_ONLY_REHEARSALS");
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
