import { describe, expect, it } from "vitest";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function stationaryCompanion(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function buildAtCurrentWorldState(
  world: LabWorld,
  snapshot: ReturnType<LabWorld["snapshot"]>,
  intent: MotionIntent,
  previousWorldStep: ReturnType<LabWorld["latestAuthorityA0StepEvidence"]>
): A1Situation {
  return buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep
  });
}

function futures(world: LabWorld, situation: A1Situation, horizonSeconds = 0.5) {
  return buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
}

function byFamily(
  set: ReturnType<typeof buildA1PlayerFutureHypotheses>,
  family: ReturnType<typeof buildA1PlayerFutureHypotheses>["hypotheses"][number]["family"]
) {
  const result = set.hypotheses.find((candidate) => candidate.family === family);
  if (!result) throw new Error(`Missing ${family} future.`);
  return result;
}

describe("Authority-A1.2c provenance-preserving player futures", () => {
  it("keeps same-step Owner request and observed body response as separate hypotheses", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildAtCurrentWorldState(
        world,
        world.snapshot(),
        playerIntent(1, 0),
        null
      );
      const set = futures(world, situation);
      const owner = byFamily(set, "OWNER_REQUEST_CONTINUATION");
      const body = byFamily(set, "BODY_RESPONSE_CONTINUATION");

      expect(set.hypotheses).toHaveLength(2);
      expect(set.aggregationClaim).toBe("NO_AVERAGING_OR_CENTROID_A1_2C");
      expect(owner.nominalVelocity).toEqual({ x: 3, y: 0 });
      expect(owner.effectiveVelocity).toEqual({ x: 3, y: 0 });
      expect(body.nominalVelocity).toEqual({ x: 0, y: 0 });
      expect(owner.bodyMotionProvenance).toBeNull();
      expect(body.bodyMotionProvenance).toBe("STATIONARY");
      expect(owner.semanticOrientationAuthority).toBe("NONE_PHYSICAL_FUTURE_ONLY");
      expect(body.semanticOrientationAuthority).toBe("NONE_PHYSICAL_FUTURE_ONLY");
      expect(set.dynamicCooperationClaim).toBe("NONE_A1_2C");
    } finally {
      world.dispose();
    }
  });

  it("does not collapse materially equal Owner/body velocities into one magical future", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), stationaryCompanion()]);
      const situation = buildAtCurrentWorldState(
        world,
        after,
        playerIntent(1, 0),
        world.latestAuthorityA0StepEvidence()
      );
      const set = futures(world, situation, 0.25);
      const owner = byFamily(set, "OWNER_REQUEST_CONTINUATION");
      const body = byFamily(set, "BODY_RESPONSE_CONTINUATION");

      expect(set.hypotheses).toHaveLength(2);
      expect(owner.id).not.toBe(body.id);
      // Rapier body response is physical evidence, not a bit-identical copy of
      // the requested velocity. The invariant is material motion equivalence
      // while causal provenance remains distinct.
      expect(Math.abs(owner.nominalVelocity.x - body.nominalVelocity.x)).toBeLessThan(1e-3);
      expect(Math.abs(owner.nominalVelocity.y - body.nominalVelocity.y)).toBeLessThan(1e-3);
      expect(body.bodyMotionProvenance).toBe("OWNER_DIRECTED");
      expect(owner.bodyMotionProvenance).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("adds a bounded transition-hold branch when a live Owner request stops", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), stationaryCompanion()]);
      const situation = buildAtCurrentWorldState(
        world,
        after,
        playerIntent(0, 0),
        world.latestAuthorityA0StepEvidence()
      );
      const set = futures(world, situation);
      const owner = byFamily(set, "OWNER_REQUEST_CONTINUATION");
      const body = byFamily(set, "BODY_RESPONSE_CONTINUATION");
      const transition = byFamily(set, "TRANSITION_HOLD");

      expect(set.transitionReasons).toContain("OWNER_REQUEST_STOPPED");
      expect(owner.nominalVelocity).toEqual({ x: 0, y: 0 });
      expect(body.nominalVelocity.x).toBeGreaterThan(2.9);
      expect(transition.nominalVelocity).toEqual({ x: 0, y: 0 });
      expect(transition.transitionReasons).toContain("OWNER_REQUEST_STOPPED");
      expect(set.hypotheses).toHaveLength(3);
    } finally {
      world.dispose();
    }
  });

  it("preserves reversal ambiguity instead of replacing body evidence with the new request", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), stationaryCompanion()]);
      const situation = buildAtCurrentWorldState(
        world,
        after,
        playerIntent(-1, 0),
        world.latestAuthorityA0StepEvidence()
      );
      const set = futures(world, situation);
      const owner = byFamily(set, "OWNER_REQUEST_CONTINUATION");
      const body = byFamily(set, "BODY_RESPONSE_CONTINUATION");

      expect(set.transitionReasons).toContain("OWNER_REQUEST_REVERSED");
      expect(owner.nominalVelocity.x).toBeCloseTo(-3, 9);
      expect(body.nominalVelocity.x).toBeGreaterThan(2.9);
      expect(byFamily(set, "TRANSITION_HOLD").nominalVelocity).toEqual({ x: 0, y: 0 });
    } finally {
      world.dispose();
    }
  });

  it("clips an Owner future at hard static geometry instead of reserving phantom space through a pillar", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const situation = buildAtCurrentWorldState(
        world,
        world.snapshot(),
        playerIntent(1, 0),
        null
      );
      const set = futures(world, situation, 1);
      const owner = byFamily(set, "OWNER_REQUEST_CONTINUATION");

      expect(owner.staticFeasibility.radius).toBeCloseTo(0.3, 9);
      expect(owner.staticFeasibility.initialOverlapPolicy).toBe("allow-egress");
      expect(owner.staticFeasibility.intendedEndpoint).toEqual({ x: 6, y: 4 });
      expect(owner.staticFeasibility.clear).toBe(false);
      expect(owner.staticFeasibility.clipped).toBe(true);
      expect(owner.staticFeasibility.blockerLabel).toBe("pillar.center");
      expect(owner.staticFeasibility.feasibleEndpoint.x).toBeGreaterThan(3);
      expect(owner.staticFeasibility.feasibleEndpoint.x).toBeLessThan(5.5);
      expect(owner.staticFeasibility.feasibleFraction).toBeGreaterThan(0);
      expect(owner.staticFeasibility.feasibleFraction).toBeLessThan(1);
      expect(owner.effectiveVelocity.x).toBeGreaterThan(0);
      expect(owner.effectiveVelocity.x).toBeLessThan(3);
      expect(owner.worldLegalityClaim).toBe("STATIC_SWEEP_ONLY_A1_2C");
    } finally {
      world.dispose();
    }
  });

  it("uses allow-egress so exact boundary contact can move into the world but not through the wall", async () => {
    const world = await LabWorld.create("open");
    try {
      const outwardBase = buildAtCurrentWorldState(
        world,
        world.snapshot(),
        playerIntent(1, 0),
        null
      );
      const inwardBase = buildAtCurrentWorldState(
        world,
        world.snapshot(),
        playerIntent(-1, 0),
        null
      );
      const atBoundary = (base: A1Situation): A1Situation => ({
        ...base,
        situated: {
          ...base.situated,
          playerBody: {
            ...base.situated.playerBody,
            position: { x: 0.3, y: 4 }
          }
        }
      });

      const intoWorld = byFamily(futures(world, atBoundary(outwardBase), 0.25), "OWNER_REQUEST_CONTINUATION");
      const intoWall = byFamily(futures(world, atBoundary(inwardBase), 0.25), "OWNER_REQUEST_CONTINUATION");

      expect(intoWorld.staticFeasibility.clear).toBe(true);
      expect(intoWorld.staticFeasibility.clipped).toBe(false);
      expect(intoWall.staticFeasibility.clear).toBe(false);
      expect(intoWall.staticFeasibility.blockerLabel).toBe("boundary.left");
    } finally {
      world.dispose();
    }
  });

  it("rejects invalid horizon or mixed-tick evidence before publishing futures", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildAtCurrentWorldState(
        world,
        world.snapshot(),
        playerIntent(1, 0),
        null
      );
      expect(() => futures(world, situation, 0)).toThrow(/positive finite horizon/i);

      const stale: A1Situation = {
        ...situation,
        playerRequestedVelocity: {
          ...situation.playerRequestedVelocity,
          sourceTick: situation.tick + 1
        }
      };
      expect(() => futures(world, stale)).toThrow(/same-step Owner request.*align/i);
    } finally {
      world.dispose();
    }
  });
});
