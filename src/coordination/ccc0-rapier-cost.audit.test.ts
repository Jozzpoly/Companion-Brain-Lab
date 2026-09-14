import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ObstacleSpec, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { evaluateShadowRelationshipRegion } from "./shadow-relationship-region";

function farObstacles(count: number): ObstacleSpec[] {
  const result: ObstacleSpec[] = [];
  for (let index = 0; index < count; index += 1) {
    const side = index % 4;
    const lane = Math.floor(index / 4);
    const offset = 3 + lane * 1.1;
    const position = side === 0
      ? { x: offset, y: 2 }
      : side === 1
        ? { x: 36, y: offset }
        : side === 2
          ? { x: 36 - offset, y: 36 }
          : { x: 2, y: 36 - offset };
    result.push({
      id: `far-${index.toString().padStart(2, "0")}`,
      x: position.x,
      y: position.y,
      width: 0.45,
      height: 0.45
    });
  }
  return result;
}

async function measure(count: number) {
  const obstacles = farObstacles(count);
  const spec: ScenarioSpec = {
    id: "open",
    label: `CCC-0 Rapier cost audit ${count}`,
    width: 40,
    height: 40,
    actors: [
      { id: "player", position: { x: 20, y: 20 }, radius: 0.3, speed: 3 },
      { id: "companion", position: { x: 18, y: 20 }, radius: 0.3, speed: 3 }
    ],
    obstacles
  };
  const physical = await RapierPhysicalWorld.create(spec);
  try {
    const snapshot: WorldSnapshot = {
      tick: 0,
      scenarioId: "open",
      width: spec.width,
      height: spec.height,
      actors: physical.snapshot().map((entry) => entry.id === "player"
        ? {
            ...entry,
            actualVelocity: { x: 1, y: 0 },
            requestedVelocity: { x: 1, y: 0 }
          }
        : entry),
      obstacles
    };
    const query = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
      physical.staticCircleTraversal(from, to, radius, options);

    const started = performance.now();
    const region = evaluateShadowRelationshipRegion({ snapshot, query });
    const elapsedMs = performance.now() - started;

    expect(region.state).toBe("REGION");
    expect(region.representativeAnchor).not.toBeNull();
    return {
      obstacles: count,
      queries: region.staticTraversalQueryCount,
      elapsedMs,
      bestSampleId: region.bestSampleId,
      anchor: region.representativeAnchor!
    };
  } finally {
    physical.dispose();
  }
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("CCC-0 real Rapier WHERE cost regression", () => {
  it("keeps directly reachable WHERE cost independent of distant semantically irrelevant obstacles", async () => {
    const observations = [];
    for (const count of [0, 4, 8, 12]) observations.push(await measure(count));

    const baseline = observations[0]!;
    expect(baseline.queries).toBe(26);
    for (const entry of observations.slice(1)) {
      expect(entry.bestSampleId).toBe(baseline.bestSampleId);
      expect(distance(entry.anchor, baseline.anchor)).toBeLessThan(1e-8);
      expect(entry.queries).toBe(baseline.queries);
    }

    // CI wall-clock time is intentionally diagnostic only; the hard contract is
    // query work + identical policy output. This still lets us observe gross stalls
    // without turning runner noise into a flaky correctness oracle.
    console.info("[CCC0_REPAIR] rapier-direct-cost", JSON.stringify(observations));
  }, 30_000);
});
