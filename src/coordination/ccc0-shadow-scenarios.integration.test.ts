import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import type { ActorSnapshot, ScenarioId, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import {
  CCC0_REGION_ROUTE_SHORTLIST,
  evaluateShadowRelationshipRegion
} from "./shadow-relationship-region";

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id} fixture`);
  return value;
}

async function inspectScenario(id: ScenarioId) {
  const world = await LabWorld.create(id);
  try {
    const snapshot = world.snapshot();
    const result = evaluateShadowRelationshipRegion({
      snapshot,
      query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
    });
    return { snapshot, result };
  } finally {
    world.dispose();
  }
}

describe("CCC-0 shadow geometry campaign", () => {
  for (const scenarioId of ["open", "pillar", "doorway", "head-on"] as const) {
    it(`${scenarioId} remains deterministic, bounded and physically revalidated`, async () => {
      const world = await LabWorld.create(scenarioId);
      try {
        const snapshot = world.snapshot();
        const query = (from: { x: number; y: number }, to: { x: number; y: number }, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
          world.staticCircleTraversal(from, to, radius, options);
        const first = evaluateShadowRelationshipRegion({ snapshot, query });
        const second = evaluateShadowRelationshipRegion({ snapshot, query });

        expect(second).toEqual(first);
        expect(first.routeEvaluatedCount).toBeLessThanOrEqual(CCC0_REGION_ROUTE_SHORTLIST);
        expect(first.samples.every((sample) => Number.isFinite(sample.score))).toBe(true);
        expect(first.samples.every((sample) => Number.isFinite(sample.position.x) && Number.isFinite(sample.position.y))).toBe(true);

        if (first.state === "REGION") {
          expect(first.representativeAnchor).not.toBeNull();
          expect(first.coherentSampleIds.length).toBeGreaterThan(0);
          const companion = actor(snapshot, "companion");
          const representativeRoute = planStaticShadowRoute({
            snapshot,
            start: companion.position,
            target: first.representativeAnchor!,
            radius: companion.radius,
            query
          });
          expect(["direct", "routed"]).toContain(representativeRoute.status);
          expect(first.samples.filter((sample) => sample.inCoherentRegion).every((sample) => sample.hardValid && sample.reachable)).toBe(true);
        } else {
          expect(first.representativeAnchor).toBeNull();
          expect(first.coherentSampleIds).toEqual([]);
        }
      } finally {
        world.dispose();
      }
    });
  }

  it("doorway does not collapse its representative into the player while route-qualifying across the passage", async () => {
    const { result } = await inspectScenario("doorway");
    expect(result.state).toBe("REGION");
    expect(result.representativeAnchor).not.toBeNull();
    const anchor = result.representativeAnchor!;
    expect(Math.hypot(anchor.x - result.playerPosition.x, anchor.y - result.playerPosition.y)).toBeGreaterThan(0.9);
    expect(result.samples.some((sample) => sample.routeEvaluated && sample.reachable)).toBe(true);
  });

  it("preserves coherent topology when the player-relative field is pushed against the pillar", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const source = world.snapshot();
      const shifted: WorldSnapshot = {
        ...source,
        actors: source.actors.map((entry) => {
          if (entry.id === "player") return { ...entry, position: { x: 4.65, y: 4 } };
          return { ...entry, position: { x: 3, y: 4 } };
        })
      };
      const result = evaluateShadowRelationshipRegion({
        snapshot: shifted,
        query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
      });

      expect(result.state).toBe("REGION");
      expect(result.coherentSampleIds.length).toBeGreaterThan(0);
      expect(result.representativeAnchor).not.toBeNull();
      const coherent = new Set(result.coherentSampleIds);
      const validCoherent = result.samples.filter((sample) => coherent.has(sample.id));
      expect(validCoherent.every((sample) => sample.hardValid && sample.reachable)).toBe(true);
      expect(Math.hypot(
        result.representativeAnchor!.x - result.playerPosition.x,
        result.representativeAnchor!.y - result.playerPosition.y
      )).toBeGreaterThan(0.8);
    } finally {
      world.dispose();
    }
  });
});
