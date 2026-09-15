import { describe, expect, it } from "vitest";
import { LabWorld } from "./world";
import { movementCapabilityFromScenario } from "./movement-capability";
import type { ScenarioSpec } from "./types";

function speed(value: { x: number; y: number }): number {
  return Math.hypot(value.x, value.y);
}

describe("Authority-A0 movement capability contract", () => {
  it("reads non-default capability directly from actor specification", () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "synthetic capability proof",
      width: 8,
      height: 8,
      actors: [
        { id: "player", position: { x: 2, y: 2 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 6, y: 6 }, radius: 0.42, speed: 5 }
      ],
      obstacles: []
    };

    expect(movementCapabilityFromScenario(spec, "companion")).toEqual({
      actorId: "companion",
      maxSpeed: 5,
      radius: 0.42,
      source: "actor-spec"
    });
  });

  it("matches the same speed scale World uses for submitted MotionIntent", async () => {
    const world = await LabWorld.create("open");
    try {
      const capability = world.actorMovementCapability("player");
      const after = world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        { actorId: "companion", move: { x: 0, y: 0 } }
      ]);
      const player = after.actors.find((actor) => actor.id === "player");
      if (!player) throw new Error("missing player");

      expect(capability.source).toBe("actor-spec");
      expect(capability.maxSpeed).toBe(3);
      expect(speed(player.requestedVelocity)).toBeCloseTo(capability.maxSpeed, 6);
    } finally {
      world.dispose();
    }
  });
});
