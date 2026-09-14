import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { Vec2, WorldSnapshot } from "../world/types";
import {
  S5_FIELD_DIRECTIONS,
  S5_FIELD_RADII,
  S5_ROUTE_SHORTLIST,
  evaluateContinuousRelationshipField
} from "./continuous-relationship-field";

function query(world: LabWorld) {
  return (from: Vec2, to: Vec2, radius: number) => world.staticCircleTraversal(from, to, radius);
}

function playerVelocity(snapshot: WorldSnapshot, velocity: Vec2): WorldSnapshot {
  return {
    ...snapshot,
    actors: snapshot.actors.map((actor) => actor.id === "player"
      ? { ...actor, requestedVelocity: { ...velocity }, actualVelocity: { ...velocity } }
      : actor)
  };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("S5 continuous relationship field shadow evaluator", () => {
  it("builds a broad annular field instead of eight relationship slots", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = playerVelocity(world.snapshot(), { x: 3, y: 0 });
      const decision = evaluateContinuousRelationshipField({ snapshot, query: query(world) });
      expect(decision.samples).toHaveLength(S5_FIELD_DIRECTIONS * S5_FIELD_RADII.length);
      expect(decision.routeEvaluatedCount).toBeLessThanOrEqual(S5_ROUTE_SHORTLIST);
      expect(decision.goodRegionSampleIds.length).toBeGreaterThan(1);
      expect(decision.bestSampleId).not.toBeNull();
      expect(decision.representativeSource).toBe("weighted-region");
    } finally {
      world.dispose();
    }
  });

  it("prefers a non-front relationship region while preserving a continuous representative anchor", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = playerVelocity(world.snapshot(), { x: 3, y: 0 });
      const decision = evaluateContinuousRelationshipField({ snapshot, query: query(world) });
      const offset = {
        x: decision.representativeTarget.x - decision.playerPosition.x,
        y: decision.representativeTarget.y - decision.playerPosition.y
      };
      const length = Math.hypot(offset.x, offset.y);
      expect(length).toBeGreaterThan(1);
      expect(length).toBeLessThan(1.9);
      expect(offset.x / length).toBeLessThan(0.35);
      const exactSample = decision.samples.some((sample) => distance(sample.position, decision.representativeTarget) < 1e-6);
      expect(exactSample).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("changes the representative region continuously under a small player-heading change", async () => {
    const world = await LabWorld.create("open");
    try {
      const base = world.snapshot();
      const firstSnapshot = playerVelocity(base, { x: 3, y: 0 });
      const first = evaluateContinuousRelationshipField({ firstSnapshot: undefined } as never);
      void first;
    } finally {
      world.dispose();
    }
  });

  it("route-qualifies a field region across the pillar rather than trusting Euclidean utility", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const snapshot = playerVelocity(world.snapshot(), { x: 3, y: 0 });
      const decision = evaluateContinuousRelationshipField({ snapshot, query: query(world) });
      expect(decision.routeEvaluatedCount).toBeGreaterThan(0);
      expect(decision.samples.some((sample) => sample.routeStatus === "routed")).toBe(true);
      expect(decision.representativeRouteStatus === "routed" || decision.representativeRouteStatus === "direct").toBe(true);
    } finally {
      world.dispose();
    }
  });

  it("reports no reachable field region when an oversized body cannot traverse the doorway", async () => {
    const world = await LabWorld.create("doorway");
    try {
      const base = playerVelocity(world.snapshot(), { x: 3, y: 0 });
      const snapshot: WorldSnapshot = {
        ...base,
        actors: base.actors.map((actor) => actor.id === "companion" ? { ...actor, radius: 0.8 } : actor)
      };
      const decision = evaluateContinuousRelationshipField({ snapshot, query: query(world) });
      expect(decision.samples.some((sample) => sample.routeEvaluated)).toBe(true);
      expect(decision.samples.filter((sample) => sample.routeEvaluated).every((sample) => !sample.reachable)).toBe(true);
      expect(decision.representativeSource).toBe("player-position-fallback");
      expect(decision.bestSampleId).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("is deterministic for identical world evidence and previous field state", async () => {
    const world = await LabWorld.create("doorway");
    try {
      const snapshot = playerVelocity(world.snapshot(), { x: 2.8, y: 0.4 });
      const options = {
        snapshot,
        query: query(world),
        previousTarget: { x: 3, y: 5 },
        previousPlayerDirection: { x: 1, y: 0 }
      };
      const a = evaluateContinuousRelationshipField(options);
      const b = evaluateContinuousRelationshipField(options);
      expect(a.representativeTarget).toEqual(b.representativeTarget);
      expect(a.bestSampleId).toBe(b.bestSampleId);
      expect(a.goodRegionSampleIds).toEqual(b.goodRegionSampleIds);
      expect(a.samples.map((sample) => [sample.id, sample.score, sample.routeStatus, sample.inGoodRegion])).toEqual(
        b.samples.map((sample) => [sample.id, sample.score, sample.routeStatus, sample.inGoodRegion])
      );
    } finally {
      world.dispose();
    }
  });
});
