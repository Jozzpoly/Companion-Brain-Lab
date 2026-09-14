import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2 } from "../world/types";
import { circleFitsStaticWorld } from "./static-body-geometry";

const fixture: ScenarioSpec = {
  id: "pillar",
  label: "static body geometry parity",
  width: 12,
  height: 8,
  actors: [],
  obstacles: [{ id: "pillar", x: 5.5, y: 2, width: 1, height: 4 }]
};

function helper(point: Vec2, radius = 0.3): boolean {
  return circleFitsStaticWorld(fixture, point, radius);
}

describe("foundation static placement parity with Rapier occupancy", () => {
  it("agrees that exact obstacle tangency is non-penetrating point occupancy", async () => {
    const physical = await RapierPhysicalWorld.create(fixture);
    try {
      const point = { x: 5.2, y: 2 };
      expect(physical.staticCircleOccupancy(point, 0.3).clear).toBe(true);
      expect(helper(point)).toBe(true);
    } finally {
      physical.dispose();
    }
  });

  it("agrees across materially outside and inside placements", async () => {
    const physical = await RapierPhysicalWorld.create(fixture);
    try {
      for (const [point, expected] of [
        [{ x: 5.199, y: 2 }, true],
        [{ x: 5.201, y: 2 }, false],
        [{ x: 5.25, y: 1.75 }, true],
        [{ x: 5.29, y: 1.79 }, false]
      ] as const) {
        expect(physical.staticCircleOccupancy(point, 0.3).clear).toBe(expected);
        expect(helper(point)).toBe(expected);
      }
    } finally {
      physical.dispose();
    }
  });

  it("agrees at the authored world boundary and after material penetration", async () => {
    const physical = await RapierPhysicalWorld.create(fixture);
    try {
      for (const [point, expected] of [
        [{ x: 0.3, y: 4 }, true],
        [{ x: 0.299, y: 4 }, false],
        [{ x: 0.301, y: 4 }, true]
      ] as const) {
        expect(physical.staticCircleOccupancy(point, 0.3).clear).toBe(expected);
        expect(helper(point)).toBe(expected);
      }
    } finally {
      physical.dispose();
    }
  });
});
