import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { Vec2 } from "../world/types";
import { NaturalSpatialLocomotionBrain } from "./natural-spatial-locomotion";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function runTrial(scenario: "pillar" | "doorway", target: Vec2, maxTicks = 900) {
  const world = await LabWorld.create(scenario);
  const brain = new NaturalSpatialLocomotionBrain();
  let snapshot = world.snapshot();
  let reached = false;
  let maxRequestedDelta = 0;
  let previousRequested: Vec2 = { x: 0, y: 0 };
  let maximumVerticalDetour = 0;
  const staticContacts = new Set<string>();

  try {
    for (let tick = 0; tick < maxTicks; tick += 1) {
      const companion = snapshot.actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("missing companion");
      if (distance(companion.position, target) < 0.28) {
        reached = true;
        break;
      }

      const route = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });

      snapshot = world.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        intent
      ]);
      const after = snapshot.actors.find((actor) => actor.id === "companion");
      if (!after) throw new Error("missing companion after step");
      maxRequestedDelta = Math.max(
        maxRequestedDelta,
        distance(after.requestedVelocity, previousRequested)
      );
      previousRequested = { ...after.requestedVelocity };
      maximumVerticalDetour = Math.max(maximumVerticalDetour, Math.abs(after.position.y - 4));
      for (const contact of after.contacts) {
        if (contact.with !== "player") staticContacts.add(contact.with);
      }
    }

    return { reached, snapshot, maxRequestedDelta, maximumVerticalDetour, staticContacts };
  } finally {
    world.dispose();
  }
}

describe("S4 natural spatial locomotion integration", () => {
  it("keeps the S3 pillar competence while removing frame-scale velocity snaps", async () => {
    const result = await runTrial("pillar", { x: 4.2, y: 4 });
    expect(result.reached).toBe(true);
    expect(result.staticContacts.has("pillar.center")).toBe(false);
    expect(result.maximumVerticalDetour).toBeGreaterThan(1);
    expect(result.maxRequestedDelta).toBeLessThan(0.34);
  });

  it("keeps doorway traversal competence with bounded requested-velocity changes", async () => {
    const result = await runTrial("doorway", { x: 4.7, y: 4 });
    expect(result.reached).toBe(true);
    expect([...result.staticContacts].some((label) => label.startsWith("door.wall"))).toBe(false);
    expect(result.maxRequestedDelta).toBeLessThan(0.34);
    const companion = result.snapshot.actors.find((actor) => actor.id === "companion");
    expect(companion?.position.x ?? Number.POSITIVE_INFINITY).toBeLessThan(5.4);
  });
});
