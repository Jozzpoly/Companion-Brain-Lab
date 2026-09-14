import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { Vec2, WorldSnapshot } from "../world/types";
import {
  S3_CANDIDATE_DIRECTIONS,
  S3_SENSOR_DIRECTIONS,
  S3_SPEED_LEVELS,
  buildSpatialVelocityCandidates,
  evaluateSpatialLocomotion,
  observeSpatialEnvironment
} from "./spatial-locomotion";

function route(world: LabWorld, snapshot: WorldSnapshot, target: Vec2) {
  const companion = snapshot.actors.find((entry) => entry.id === "companion");
  if (!companion) throw new Error("missing companion");
  return planStaticShadowRoute({
    snapshot,
    start: companion.position,
    target,
    radius: companion.radius,
    query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
  });
}

function input(world: LabWorld, snapshot: WorldSnapshot, target: Vec2) {
  return {
    snapshot,
    relationshipTarget: target,
    routePlan: route(world, snapshot, target),
    query: (from: Vec2, to: Vec2, radius: number) => world.staticCircleTraversal(from, to, radius)
  };
}

describe("S3 spatial locomotion core", () => {
  it("observes a full deterministic 360-degree clearance ring", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.snapshot();
      const observation = observeSpatialEnvironment(input(world, snapshot, { x: 4, y: 4 }));
      expect(observation.rays).toHaveLength(S3_SENSOR_DIRECTIONS);
      expect(observation.rays.map((ray) => ray.index)).toEqual(
        Array.from({ length: S3_SENSOR_DIRECTIONS }, (_, index) => index)
      );
      expect(observation.rays.some((ray) => ray.direction.x > 0.99)).toBe(true);
      expect(observation.rays.some((ray) => ray.direction.x < -0.99)).toBe(true);
      expect(observation.rays.some((ray) => ray.direction.y > 0.99)).toBe(true);
      expect(observation.rays.some((ray) => ray.direction.y < -0.99)).toBe(true);
    } finally {
      world.dispose();
    }
  });

  it("makes static obstruction visible in the local spatial ring", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const snapshot = world.snapshot();
      const observation = observeSpatialEnvironment(input(world, snapshot, { x: 3, y: 4 }));
      expect(observation.rays.some((ray) => ray.blockedBy === "pillar.center")).toBe(true);
      expect(observation.rays.some((ray) => ray.blockedBy === null)).toBe(true);
    } finally {
      world.dispose();
    }
  });

  it("generates a true omnidirectional velocity lattice rather than one target vector", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.snapshot();
      const observation = observeSpatialEnvironment(input(world, snapshot, { x: 4, y: 4 }));
      const candidates = buildSpatialVelocityCandidates({
        observation,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      expect(candidates).toHaveLength(1 + S3_CANDIDATE_DIRECTIONS * S3_SPEED_LEVELS.length);
      expect(candidates.some((candidate) => candidate.move.x > 0.9)).toBe(true);
      expect(candidates.some((candidate) => candidate.move.x < -0.9)).toBe(true);
      expect(candidates.some((candidate) => candidate.move.y > 0.9)).toBe(true);
      expect(candidates.some((candidate) => candidate.move.y < -0.9)).toBe(true);
      expect(candidates.some((candidate) => candidate.speedFraction === 0)).toBe(true);
    } finally {
      world.dispose();
    }
  });

  it("advances toward a clear route in open space", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.snapshot();
      const decision = evaluateSpatialLocomotion(input(world, snapshot, { x: 4.2, y: 4 }));
      expect(decision.acceptedCount).toBeGreaterThan(0);
      expect(decision.selectedMove.x).toBeLessThan(-0.2);
      expect(Math.abs(decision.selectedMove.y)).toBeLessThan(0.5);
      expect(decision.state).toBe("ADVANCE");
    } finally {
      world.dispose();
    }
  });

  it("uses routed lookahead around the pillar instead of selecting the locally-safe direct vector", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const snapshot = world.snapshot();
      const decision = evaluateSpatialLocomotion(input(world, snapshot, { x: 3, y: 4 }));
      expect(decision.observation.routeStatus).toBe("routed");
      expect(Math.abs(decision.selectedMove.y)).toBeGreaterThan(0.15);
      const directWest = decision.candidates.find((candidate) => candidate.id === "d12.s1.00");
      const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
      expect(directWest?.hardRejected).toBe(false);
      expect(selected?.id).not.toBe(directWest?.id);
      expect(selected?.score ?? Number.POSITIVE_INFINITY).toBeLessThan(directWest?.score ?? Number.NEGATIVE_INFINITY);
    } finally {
      world.dispose();
    }
  });

  it("rejects an otherwise attractive velocity when predicted player motion makes it collide", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const base = world.snapshot();
      const snapshot: WorldSnapshot = {
        ...base,
        actors: base.actors.map((entry) =>
          entry.id === "player"
            ? { ...entry, requestedVelocity: { x: 3, y: 0 }, actualVelocity: { x: 3, y: 0 } }
            : entry
        )
      };
      const decision = evaluateSpatialLocomotion(input(world, snapshot, { x: 4, y: 4 }));
      const directWest = decision.candidates.find((candidate) => candidate.id === "d12.s1.00");
      expect(directWest?.hardRejected).toBe(true);
      expect(directWest?.rejectionReason).toBe("player-predicted-collision");
      const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
      expect(selected?.hardRejected).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("is deterministic for the same world observation and previous move", async () => {
    const world = await LabWorld.create("doorway");
    try {
      const snapshot = world.snapshot();
      const options = { ...input(world, snapshot, { x: 3.8, y: 4 }), previousMove: { x: 0.3, y: -0.2 } };
      const first = evaluateSpatialLocomotion(options);
      const second = evaluateSpatialLocomotion(options);
      expect(first.selectedCandidateId).toBe(second.selectedCandidateId);
      expect(first.selectedMove).toEqual(second.selectedMove);
      expect(first.candidates.map((candidate) => [candidate.id, candidate.score, candidate.rejectionReason])).toEqual(
        second.candidates.map((candidate) => [candidate.id, candidate.score, candidate.rejectionReason])
      );
    } finally {
      world.dispose();
    }
  });
});
