import { describe, expect, it } from "vitest";
import { S1_PREFERRED_RADIUS } from "../brain/relational-positioning";
import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import { planStaticShadowRoute } from "../navigation/static-router";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, ScenarioId, Vec2, WorldSnapshot } from "../world/types";

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: ActorId): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Radial geometry audit snapshot is missing ${id}.`);
  return value;
}

function snapshotAt(
  scenarioId: ScenarioId,
  playerPosition: Vec2,
  companionPosition: Vec2
): WorldSnapshot {
  const spec = scenario(scenarioId);
  const body = (id: ActorId, position: Vec2): ActorSnapshot => {
    const authored = spec.actors.find((candidate) => candidate.id === id);
    if (!authored) throw new Error(`Scenario ${scenarioId} is missing ${id}.`);
    return {
      id,
      position: { ...position },
      radius: authored.radius,
      requestedVelocity: { x: 0, y: 0 },
      actualVelocity: { x: 0, y: 0 },
      motionError: 0,
      contacts: []
    };
  };

  return {
    tick: 0,
    scenarioId,
    width: spec.width,
    height: spec.height,
    actors: [body("player", playerPosition), body("companion", companionPosition)],
    obstacles: spec.obstacles
  };
}

function naiveDirectionlessRadialTarget(snapshot: WorldSnapshot): Vec2 {
  const player = actor(snapshot, "player");
  const companion = actor(snapshot, "companion");
  const relative = {
    x: companion.position.x - player.position.x,
    y: companion.position.y - player.position.y
  };
  const length = magnitude(relative);
  if (length <= 1e-9) throw new Error("Naive radial target requires a nonzero current-relative bearing.");
  return {
    x: player.position.x + (relative.x / length) * S1_PREFERRED_RADIUS,
    y: player.position.y + (relative.y / length) * S1_PREFERRED_RADIUS
  };
}

function expectLegalSourceState(snapshot: WorldSnapshot): void {
  const player = actor(snapshot, "player");
  const companion = actor(snapshot, "companion");
  expect(circleFitsStaticWorld(snapshot, player.position, player.radius)).toBe(true);
  expect(circleFitsStaticWorld(snapshot, companion.position, companion.radius)).toBe(true);
  expect(distance(player.position, companion.position)).toBeGreaterThanOrEqual(
    player.radius + companion.radius
  );
}

function expectNaiveRadialTargetInvalid(snapshot: WorldSnapshot): void {
  expectLegalSourceState(snapshot);
  const companion = actor(snapshot, "companion");
  const target = naiveDirectionlessRadialTarget(snapshot);

  expect(circleFitsStaticWorld(snapshot, target, companion.radius)).toBe(false);

  const route = planStaticShadowRoute({
    snapshot,
    start: companion.position,
    target,
    radius: companion.radius,
    query: () => {
      throw new Error("Invalid radial targets must be rejected before traversal queries run.");
    }
  });
  expect(route.status).toBe("invalid-target");
  expect(route.cost).toBeNull();
}

describe("post-expiry naive directionless radial geometry audit", () => {
  it("keeps the open-field control target statically legal", () => {
    const snapshot = snapshotAt("open", { x: 3, y: 4 }, { x: 8, y: 4 });
    expectLegalSourceState(snapshot);

    const companion = actor(snapshot, "companion");
    const target = naiveDirectionlessRadialTarget(snapshot);
    expect(circleFitsStaticWorld(snapshot, target, companion.radius)).toBe(true);
  });

  it("falsifies naive radial as a general fallback beside the central pillar", () => {
    const snapshot = snapshotAt("pillar", { x: 3.8, y: 4 }, { x: 5.1, y: 4 });
    expectNaiveRadialTargetInvalid(snapshot);
  });

  it("falsifies naive radial as a general fallback beside doorway geometry", () => {
    const snapshot = snapshotAt("doorway", { x: 4.7, y: 4 }, { x: 5.4, y: 4.45 });
    expectNaiveRadialTargetInvalid(snapshot);
  });
});
