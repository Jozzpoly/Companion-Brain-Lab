import { describe, expect, it } from "vitest";
import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import { planStaticShadowRoute } from "../navigation/static-router";
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
  throw new Error("failed to sample hard-valid audit position");
}

async function scanScenario(id: Extract<ScenarioId, "pillar" | "doorway">, seed: number) {
  const world = await LabWorld.create(id);
  const random = lcg(seed);
  try {
    const base = world.snapshot();
    const originalPlayer = actor(base, "player");
    const originalCompanion = actor(base, "companion");
    const query = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
      world.staticCircleTraversal(from, to, radius, options);

    let boundedFailures = 0;
    let exhaustiveFalseNegatives = 0;
    let exhaustiveChecks = 0;
    const examples: Array<{
      player: Vec2;
      companion: Vec2;
      heading: Vec2;
      boundedEvaluated: number;
      reachableOutsideShortlist: string[];
    }> = [];

    for (let caseIndex = 0; caseIndex < 160; caseIndex += 1) {
      const playerPosition = randomValidPosition(base, originalPlayer.radius, random);
      const companionPosition = randomValidPosition(base, originalCompanion.radius, random);
      const angle = random() * Math.PI * 2;
      const speed = random() < 0.2 ? 0 : 0.2 + random() * 2.8;
      const heading = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

      const state: WorldSnapshot = {
        ...base,
        tick: caseIndex,
        actors: base.actors.map((entry) => entry.id === "player"
          ? {
              ...entry,
              position: playerPosition,
              actualVelocity: heading,
              requestedVelocity: heading
            }
          : {
              ...entry,
              position: companionPosition,
              actualVelocity: { x: 0, y: 0 },
              requestedVelocity: { x: 0, y: 0 }
            })
      };

      const bounded = evaluateShadowRelationshipRegion({ snapshot: state, query });
      if (bounded.state !== "NO_REACHABLE_REGION" || bounded.noRegionReason !== "ROUTE_SHORTLIST_EXHAUSTED") {
        continue;
      }

      boundedFailures += 1;
      const outside = bounded.samples.filter((sample) => sample.hardValid && !sample.routeEvaluated);
      const reachableOutsideShortlist: string[] = [];
      for (const sample of outside) {
        exhaustiveChecks += 1;
        const route = planStaticShadowRoute({
          snapshot: state,
          start: companionPosition,
          target: sample.position,
          radius: originalCompanion.radius,
          query
        });
        if (route.status === "direct" || route.status === "routed") {
          reachableOutsideShortlist.push(sample.id);
        }
      }

      if (reachableOutsideShortlist.length > 0) {
        exhaustiveFalseNegatives += 1;
        if (examples.length < 8) {
          examples.push({
            player: playerPosition,
            companion: companionPosition,
            heading,
            boundedEvaluated: bounded.routeEvaluatedCount,
            reachableOutsideShortlist: reachableOutsideShortlist.slice(0, 12)
          });
        }
      }
    }

    return { id, cases: 160, boundedFailures, exhaustiveFalseNegatives, exhaustiveChecks, examples };
  } finally {
    world.dispose();
  }
}

describe("CCC-0 bounded shortlist exhaustive audit", () => {
  it("measures real pillar/doorway false negatives instead of treating shortlist exhaustion as global truth", async () => {
    const pillar = await scanScenario("pillar", 0x13579bdf);
    const doorway = await scanScenario("doorway", 0x2468ace0);

    expect(pillar.cases).toBe(160);
    expect(doorway.cases).toBe(160);
    expect(pillar.boundedFailures).toBeGreaterThanOrEqual(pillar.exhaustiveFalseNegatives);
    expect(doorway.boundedFailures).toBeGreaterThanOrEqual(doorway.exhaustiveFalseNegatives);

    console.info("[CCC0_AUDIT] exhaustive-shortlist", JSON.stringify({ pillar, doorway }));
  }, 30_000);
});
