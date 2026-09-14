import { describe, expect, it } from "vitest";
import { circleFitsStaticWorld } from "./static-body-geometry";

const snapshot = {
  width: 12,
  height: 8,
  obstacles: [{ id: "pillar", x: 5.5, y: 2, width: 1, height: 4 }]
};

describe("shared static body point validity", () => {
  it("accepts a circle that clears an obstacle corner even though it lies inside the square-expanded AABB", () => {
    expect(circleFitsStaticWorld(snapshot, { x: 5.25, y: 1.75 }, 0.3)).toBe(true);
  });

  it("rejects a circle whose body actually intersects the same corner", () => {
    expect(circleFitsStaticWorld(snapshot, { x: 5.29, y: 1.79 }, 0.3)).toBe(false);
  });

  it("keeps tangent contact and world-boundary fit deterministic", () => {
    expect(circleFitsStaticWorld(snapshot, { x: 5.2, y: 2 }, 0.3)).toBe(true);
    expect(circleFitsStaticWorld(snapshot, { x: 0.3, y: 0.3 }, 0.3)).toBe(true);
    expect(circleFitsStaticWorld(snapshot, { x: 0.299, y: 0.3 }, 0.3)).toBe(false);
  });
});
