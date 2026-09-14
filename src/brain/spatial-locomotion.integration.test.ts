import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { Vec2, WorldSnapshot } from "../world/types";
import { SpatialLocomotionBrain, type SpatialMotionState } from "./spatial-locomotion";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function runToTarget(
  scenario: "pillar" | "doorway",
  target: Vec2,
  maxTicks = 720
): Promise<{
  reached: boolean;
  snapshot: WorldSnapshot;
  states: Set<SpatialMotionState>;
  staticContacts: string[];
}> {
  const world = await LabWorld.create(scenario);
  const brain = new SpatialLocomotionBrain();
  const states = new Set<SpatialMotionState>();
  const staticContacts: string[] = [];
  let snapshot = world.snapshot();

  try {
    for (let tick = 0; tick < maxTicks; tick += 1) {
      const companion = snapshot.actors.find((entry) => entry.id === "companion");
      if (!companion) throw new Error("missing companion");
      if (distance(companion.position, target) < 0.28) {
        return { reached: true, snapshot, states, staticContacts };
      }

      const plan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: plan,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      const decision = brain.debugState();
      if (decision) states.add(decision.state);

      snapshot = world.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        intent
      ]);
      const after = snapshot.actors.find((entry) => entry.id === "companion");
      if (!after) throw new Error("missing companion after step");
      for (const contact of after.contacts) {
        if (contact.with !== "player" && !staticContacts.includes(contact.with)) staticContacts.push(contact.with);
      }
    }

    return { reached: false, snapshot, states, staticContacts };
  } finally {
    world.dispose();
  }
}

describe("S3 spatial locomotion authority integration", () => {
  it("actually routes and moves around the pillar without a pillar contact", async () => {
    const result = await runToTarget("pillar", { x: 4.2, y: 4 });
    expect(result.reached).toBe(true);
    expect(result.staticContacts).not.toContain("pillar.center");
    expect(result.states.has("SIDESTEP") || result.states.has("BACKOFF")).toBe(true);
  });

  it("actually traverses the doorway opening instead of remaining blocked at the wall", async () => {
    const result = await runToTarget("doorway", { x: 4.7, y: 4 });
    expect(result.reached).toBe(true);
    expect(result.staticContacts.some((label) => label.startsWith("door.wall"))).toBe(false);
    const companion = result.snapshot.actors.find((entry) => entry.id === "companion");
    expect(companion?.position.x ?? Number.POSITIVE_INFINITY).toBeLessThan(5.4);
  });
});
