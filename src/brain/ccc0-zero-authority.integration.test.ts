import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import type { Vec2 } from "../world/types";
import { LabWorld } from "../world/world";
import { R1RecoveringDirectSpatialBrain } from "./r1-recovering-direct-spatial";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";
import { R1WorkbenchSpatialStack } from "./r1-workbench-spatial-stack";

async function compareAuthoritativeIntent(natural: boolean): Promise<void> {
  const world = await LabWorld.create("open");
  const stack = new R1WorkbenchSpatialStack();
  const baseline = natural
    ? new R1RecoveringNaturalSpatialBrain()
    : new R1RecoveringDirectSpatialBrain();

  try {
    const snapshot = world.snapshot();
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (!companion) throw new Error("missing companion fixture");
    const target: Vec2 = { x: 5, y: 4 };
    const query = (from: Vec2, to: Vec2, radius: number) => world.staticCircleTraversal(from, to, radius);
    const routePlan = planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target,
      radius: companion.radius,
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

describe("CCC-0 zero-authority runtime contract", () => {
  it("leaves DIRECT MotionIntent byte-for-byte equivalent to the pre-shadow authoritative brain", async () => {
    await compareAuthoritativeIntent(false);
  });

  it("leaves NATURAL MotionIntent byte-for-byte equivalent to the pre-shadow authoritative brain", async () => {
    await compareAuthoritativeIntent(true);
  });
});
