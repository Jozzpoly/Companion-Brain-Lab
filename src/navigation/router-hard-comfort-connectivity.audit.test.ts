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

describe("behavior-forensics: hard-vs-comfort route connectivity", () => {
  for (const scenarioId of ["pillar", "doorway"] as const) {
    it(`${scenarioId}: desired clearance does not erase a hard-feasible sampled target route`, async () => {
      expect(await findDivergences(scenarioId)).toEqual([]);
    });
  }
});
