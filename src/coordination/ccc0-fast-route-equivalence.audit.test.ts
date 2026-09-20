import { describe, expect, it } from "vitest";
import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import { planStaticShadowRoute, S2C_ROUTE_CLEARANCE } from "../navigation/static-router";
import type { ActorSnapshot, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { evaluateShadowRelationshipRegion } from "./shadow-relationship-region";

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function randomValidPosition(snapshot: WorldSnapshot, radius: number, random: () => number): Vec2 {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const point = {
      x: radius + 0.05 + random() * (snapshot.width - radius * 2 - 0.1),
      y: radius + 0.05 + random() * (snapshot.height - radius * 2 - 0.1)
    };
    if (circleFitsStaticWorld(snapshot, point, radius)) return point;
  }
  throw new Error("could not sample valid point");
}

async function verifyScenario(id: Extract<ScenarioId, "open" | "pillar" | "doorway">, seed: number): Promise<number> {
  const world = await LabWorld.create(id);
  const random = lcg(seed);
  let comparisons = 0;
  try {
    const base = world.snapshot();
    const playerFixture = actor(base, "player");
    const companionFixture = actor(base, "companion");
    const query = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
      world.staticCircleTraversal(from, to, radius, options);

    for (let caseIndex = 0; caseIndex < 80; caseIndex += 1) {
      const playerPosition = randomValidPosition(base, playerFixture.radius, random);
      const companionPosition = randomValidPosition(base, companionFixture.radius, random);
      const angle = random() * Math.PI * 2;
      const speed = random() * 3;
      const velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
      const state: WorldSnapshot = {
        ...base,
        tick: caseIndex,
        actors: base.actors.map((entry) => entry.id === "player"
          ? { ...entry, position: playerPosition, actualVelocity: velocity, requestedVelocity: velocity }
          : { ...entry, position: companionPosition, actualVelocity: { x: 0, y: 0 }, requestedVelocity: { x: 0, y: 0 } })
      };

      const region = evaluateShadowRelationshipRegion({ snapshot: state, query });
      for (const sample of region.samples.filter((entry) => entry.routeEvaluated)) {
        const full = planStaticShadowRoute({
          snapshot: state,
          start: companionPosition,
          target: sample.position,
          radius: companionFixture.radius,
          clearance: S2C_ROUTE_CLEARANCE,
          query
        });
        comparisons += 1;
        expect(sample.routeStatus).toBe(full.status);
        expect(sample.routeClearanceConstrained).toBe(full.clearanceConstrained);
        if (sample.routeCost === null || full.cost === null) {
          expect(sample.routeCost).toBe(full.cost);
        } else {
          expect(sample.routeCost).toBeCloseTo(full.cost, 10);
        }
      }

      if (region.representativeAnchor) {
        const full = planStaticShadowRoute({
          snapshot: state,
          start: companionPosition,
          target: region.representativeAnchor,
          radius: companionFixture.radius,
          clearance: S2C_ROUTE_CLEARANCE,
          query
        });
        comparisons += 1;
        expect(region.representativeRouteStatus).toBe(full.status);
      }
    }
  } finally {
    world.dispose();
  }
  return comparisons;
}

describe("CCC-0 direct route fast-path equivalence", () => {
  it("matches the full static router across randomized open/pillar/doorway samples", async () => {
    const open = await verifyScenario("open", 0x0110aa55);
    const pillar = await verifyScenario("pillar", 0x0220bb66);
    const doorway = await verifyScenario("doorway", 0x0330cc77);
    expect(open).toBeGreaterThan(500);
    expect(pillar).toBeGreaterThan(500);
    expect(doorway).toBeGreaterThan(500);
    console.info("[CCC0_AUDIT] fast-route-equivalence", JSON.stringify({ open, pillar, doorway }));
  }, 30_000);
});
