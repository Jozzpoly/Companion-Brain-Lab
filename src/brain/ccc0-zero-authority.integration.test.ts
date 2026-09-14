import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { R1RecoveringDirectSpatialBrain } from "./r1-recovering-direct-spatial";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";
import {
  CCC0_SHADOW_INTERVAL_TICKS,
  R1WorkbenchSpatialStack
} from "./r1-workbench-spatial-stack";

function companion(snapshot: WorldSnapshot) {
  const value = snapshot.actors.find((actor) => actor.id === "companion");
  if (!value) throw new Error("missing companion fixture");
  return value;
}

function playerIntent(step: number): MotionIntent {
  if (step < 30) return { actorId: "player", move: { x: 0.6, y: 0 } };
  if (step < 60) return { actorId: "player", move: { x: -0.6, y: 0 } };
  if (step < 90) return { actorId: "player", move: { x: 0, y: 0.55 } };
  return { actorId: "player", move: { x: 0, y: 0 } };
}

async function compareAuthoritativeIntent(natural: boolean): Promise<void> {
  const world = await LabWorld.create("open");
  const stack = new R1WorkbenchSpatialStack();
  const baseline = natural
    ? new R1RecoveringNaturalSpatialBrain()
    : new R1RecoveringDirectSpatialBrain();

  try {
    const snapshot = world.snapshot();
    const body = companion(snapshot);
    const target: Vec2 = { x: 5, y: 4 };
    const query = (from: Vec2, to: Vec2, radius: number) => world.staticCircleTraversal(from, to, radius);
    const routePlan = planStaticShadowRoute({
      snapshot,
      start: body.position,
      target,
      radius: body.radius,
      query
    });
    const input = {
      snapshot,
      relationshipTarget: target,
      routePlan,
      query,
      occupancy: (center: Vec2, radius: number) => world.staticCircleOccupancy(center, radius)
    };

    const baselineIntent = baseline.intent(input);
    const workbenchIntent = stack.intent(natural, input);
    const debug = stack.debugState(natural);

    expect(workbenchIntent).toEqual(baselineIntent);
    expect(debug.shadowCoordinationError).toBeNull();
    expect(debug.shadowCoordination).not.toBeNull();
    expect(debug.shadowCoordination?.legacy.relationshipTarget).toEqual(target);
    expect(debug.shadowCoordination?.tick).toBe(snapshot.tick);
  } finally {
    world.dispose();
  }
}

async function compareParallelWorlds(natural: boolean): Promise<void> {
  const baselineWorld = await LabWorld.create("open");
  const shadowWorld = await LabWorld.create("open");
  const baseline = natural
    ? new R1RecoveringNaturalSpatialBrain()
    : new R1RecoveringDirectSpatialBrain();
  const stack = new R1WorkbenchSpatialStack();
  const target: Vec2 = { x: 5, y: 4 };

  let baselineSnapshot = baselineWorld.snapshot();
  let shadowSnapshot = shadowWorld.snapshot();

  try {
    expect(shadowSnapshot).toEqual(baselineSnapshot);

    for (let step = 0; step < 120; step += 1) {
      const baselineBody = companion(baselineSnapshot);
      const shadowBody = companion(shadowSnapshot);
      const baselineQuery = (from: Vec2, to: Vec2, radius: number) =>
        baselineWorld.staticCircleTraversal(from, to, radius);
      const shadowQuery = (from: Vec2, to: Vec2, radius: number) =>
        shadowWorld.staticCircleTraversal(from, to, radius);
      const baselineRoute = planStaticShadowRoute({
        snapshot: baselineSnapshot,
        start: baselineBody.position,
        target,
        radius: baselineBody.radius,
        query: baselineQuery
      });
      const shadowRoute = planStaticShadowRoute({
        snapshot: shadowSnapshot,
        start: shadowBody.position,
        target,
        radius: shadowBody.radius,
        query: shadowQuery
      });

      const baselineIntent = baseline.intent({
        snapshot: baselineSnapshot,
        relationshipTarget: target,
        routePlan: baselineRoute,
        query: baselineQuery,
        occupancy: (center, radius) => baselineWorld.staticCircleOccupancy(center, radius)
      });
      const shadowIntent = stack.intent(natural, {
        snapshot: shadowSnapshot,
        relationshipTarget: target,
        routePlan: shadowRoute,
        query: shadowQuery,
        occupancy: (center, radius) => shadowWorld.staticCircleOccupancy(center, radius)
      });

      expect(shadowIntent).toEqual(baselineIntent);
      const scriptedPlayerIntent = playerIntent(step);
      baselineSnapshot = baselineWorld.step([scriptedPlayerIntent, baselineIntent]);
      shadowSnapshot = shadowWorld.step([scriptedPlayerIntent, shadowIntent]);
      expect(shadowSnapshot).toEqual(baselineSnapshot);

      const baselineAfterBody = companion(baselineSnapshot);
      const shadowAfterBody = companion(shadowSnapshot);
      const baselineAfterRoute = planStaticShadowRoute({
        snapshot: baselineSnapshot,
        start: baselineAfterBody.position,
        target,
        radius: baselineAfterBody.radius,
        query: baselineQuery
      });
      const shadowAfterRoute = planStaticShadowRoute({
        snapshot: shadowSnapshot,
        start: shadowAfterBody.position,
        target,
        radius: shadowAfterBody.radius,
        query: shadowQuery
      });

      const objectiveKey = "ccc0-zero-authority:fixed-target";
      const baselineProgress = baseline.observeOutcome({
        snapshot: baselineSnapshot,
        objectiveKey,
        target,
        routePlan: baselineAfterRoute
      });
      const shadowProgress = stack.observeOutcome(natural, {
        snapshot: shadowSnapshot,
        objectiveKey,
        target,
        routePlan: shadowAfterRoute
      });
      expect(shadowProgress).toEqual(baselineProgress);

      const debug = stack.debugState(natural);
      expect(debug.shadowCoordinationError).toBeNull();
      const expectedShadowTick = Math.floor(step / CCC0_SHADOW_INTERVAL_TICKS) * CCC0_SHADOW_INTERVAL_TICKS;
      expect(debug.shadowCoordination?.tick).toBe(expectedShadowTick);
      expect(debug.shadowNextEvaluationTick).toBe(expectedShadowTick + CCC0_SHADOW_INTERVAL_TICKS);
    }
  } finally {
    baselineWorld.dispose();
    shadowWorld.dispose();
  }
}

async function proveShadowFaultIsolation(natural: boolean): Promise<void> {
  const world = await LabWorld.create("open");
  const baseline = natural
    ? new R1RecoveringNaturalSpatialBrain()
    : new R1RecoveringDirectSpatialBrain();
  const stack = new R1WorkbenchSpatialStack(() => {
    throw new Error("synthetic CCC-0 research failure");
  });

  try {
    const snapshot = world.snapshot();
    const body = companion(snapshot);
    const target: Vec2 = { x: 5, y: 4 };
    const query = (from: Vec2, to: Vec2, radius: number) => world.staticCircleTraversal(from, to, radius);
    const routePlan = planStaticShadowRoute({
      snapshot,
      start: body.position,
      target,
      radius: body.radius,
      query
    });
    const input = {
      snapshot,
      relationshipTarget: target,
      routePlan,
      query,
      occupancy: (center: Vec2, radius: number) => world.staticCircleOccupancy(center, radius)
    };

    const baselineIntent = baseline.intent(input);
    const isolatedIntent = stack.intent(natural, input);
    expect(isolatedIntent).toEqual(baselineIntent);

    const debug = stack.debugState(natural);
    expect(debug.shadowCoordination).toBeNull();
    expect(debug.shadowCoordinationError).toBe("synthetic CCC-0 research failure");
    expect(debug.shadowNextEvaluationTick).toBe(snapshot.tick + CCC0_SHADOW_INTERVAL_TICKS);
  } finally {
    world.dispose();
  }
}

describe("CCC-0 zero-authority runtime contract", () => {
  it("leaves DIRECT MotionIntent byte-for-byte equivalent to the pre-shadow authoritative brain", async () => {
    await compareAuthoritativeIntent(false);
  });

  it("leaves NATURAL MotionIntent byte-for-byte equivalent to the pre-shadow authoritative brain", async () => {
    await compareAuthoritativeIntent(true);
  });

  it("keeps DIRECT commands, recovery and World outcomes identical for a 120-step moving-player run", async () => {
    await compareParallelWorlds(false);
  });

  it("keeps NATURAL commands, recovery and World outcomes identical for a 120-step moving-player run", async () => {
    await compareParallelWorlds(true);
  });

  it("contains a failing shadow evaluator after DIRECT authority has already selected the command", async () => {
    await proveShadowFaultIsolation(false);
  });

  it("contains a failing shadow evaluator after NATURAL authority has already selected the command", async () => {
    await proveShadowFaultIsolation(true);
  });
});