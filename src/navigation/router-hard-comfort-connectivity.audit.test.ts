import { describe, expect, it } from "vitest";
import { planStaticShadowRoute, S2C_ROUTE_CLEARANCE } from "./static-router";
import { LabWorld } from "../world/world";
import type { ScenarioId, Vec2 } from "../world/types";

function reachable(status: ReturnType<typeof planStaticShadowRoute>["status"]): boolean {
  return status === "direct" || status === "routed";
}

async function findDivergences(scenarioId: ScenarioId): Promise<Array<{ target: Vec2; hard: string; comfort: string }>> {
  const world = await LabWorld.create(scenarioId);
  try {
    const snapshot = world.snapshot();
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (!companion) throw new Error("missing companion");
    const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<LabWorld["staticCircleTraversal"]>[3]) =>
      world.staticCircleTraversal(from, to, radius, options);
    const divergences: Array<{ target: Vec2; hard: string; comfort: string }> = [];

    for (let x = 0.5; x <= snapshot.width - 0.5; x += 0.5) {
      for (let y = 0.5; y <= snapshot.height - 0.5; y += 0.5) {
        const target = { x, y };
        const hard = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target,
          radius: companion.radius,
          clearance: 0,
          query
        });
        if (!reachable(hard.status)) continue;
        const comfort = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target,
          radius: companion.radius,
          clearance: S2C_ROUTE_CLEARANCE,
          query
        });
        if (!reachable(comfort.status)) {
          divergences.push({ target, hard: hard.status, comfort: comfort.status });
          if (divergences.length >= 8) return divergences;
        }
      }
    }
    return divergences;
  } finally {
    world.dispose();
  }
}

function routeFor(world: LabWorld, target: Vec2) {
  const snapshot = world.snapshot();
  const companion = snapshot.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("missing companion");
  return planStaticShadowRoute({
    snapshot,
    start: companion.position,
    target,
    radius: companion.radius,
    query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
  });
}

describe("behavior-forensics: hard-vs-comfort route connectivity", () => {
  for (const scenarioId of ["pillar", "doorway"] as const) {
    it(`${scenarioId}: desired clearance does not erase a hard-feasible sampled target route`, async () => {
      expect(await findDivergences(scenarioId)).toEqual([]);
    });
  }

  it("pillar: a tiny target perturbation across symmetry flips the chosen route side", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const upper = routeFor(world, { x: 3, y: 3.99 });
      const center = routeFor(world, { x: 3, y: 4.00 });
      const lower = routeFor(world, { x: 3, y: 4.01 });

      expect(upper.status).toBe("routed");
      expect(center.status).toBe("routed");
      expect(lower.status).toBe("routed");
      expect(upper.routeNodeIds).toContain("pillar.center.ne");
      expect(upper.routeNodeIds).toContain("pillar.center.nw");
      expect(center.routeNodeIds).toContain("pillar.center.ne");
      expect(center.routeNodeIds).toContain("pillar.center.nw");
      expect(lower.routeNodeIds).toContain("pillar.center.se");
      expect(lower.routeNodeIds).toContain("pillar.center.sw");
      expect(lower.routeNodeIds).not.toEqual(upper.routeNodeIds);
    } finally {
      world.dispose();
    }
  });
});
