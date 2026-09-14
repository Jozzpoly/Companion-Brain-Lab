import { describe, expect, it } from "vitest";
import { S2C_ROUTE_CLEARANCE, planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";

const RADIUS = 0.3;
const SPEED = 3;
const WALL_LEFT_X = 5.5;
const HARD_MAX_X = WALL_LEFT_X - RADIUS;
const DESIRED_MAX_X = WALL_LEFT_X - RADIUS - S2C_ROUTE_CLEARANCE;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1 natural fixture missing ${id}.`);
  return value;
}

function snapshotFor(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return {
    tick,
    scenarioId: spec.id,
    width: spec.width,
    height: spec.height,
    actors,
    obstacles: spec.obstacles
  };
}

function wallFixture(x: number): ScenarioSpec {
  return {
    id: "pillar",
    label: "R1 natural final-command fixture",
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: { x: 2, y: 4 }, radius: RADIUS, speed: SPEED },
      { id: "companion", position: { x, y: 4 }, radius: RADIUS, speed: SPEED }
    ],
    obstacles: [{ id: "r1.wall", x: WALL_LEFT_X, y: 0, width: 0.5, height: 8 }]
  };
}

function withCompanionVelocity(snapshot: WorldSnapshot, velocity: Vec2): WorldSnapshot {
  return {
    ...snapshot,
    actors: snapshot.actors.map((entry) => entry.id === "companion"
      ? {
          ...entry,
          requestedVelocity: { ...velocity },
          actualVelocity: { ...velocity }
        }
      : {
          ...entry,
          requestedVelocity: { ...entry.requestedVelocity },
          actualVelocity: { ...entry.actualVelocity },
          position: { ...entry.position },
          contacts: [...entry.contacts]
        })
  };
}

function routeFor(
  physical: RapierPhysicalWorld,
  snapshot: WorldSnapshot,
  target: Vec2
) {
  const companion = actor(snapshot, "companion");
  return planStaticShadowRoute({
    snapshot,
    start: companion.position,
    target,
    radius: companion.radius,
    query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
  });
}

describe("R1-2B natural spatial locomotion with final hard gate", () => {
  it("constrains continuity carry at a true hard boundary and executes the safe preferred reversal", async () => {
    const startX = 5.18;
    const spec = wallFixture(startX);
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1NaturalSpatialLocomotionBrain();
    const target = { x: 3.5, y: 4 };

    try {
      const snapshot = withCompanionVelocity(snapshotFor(spec, 0, physical.snapshot()), { x: SPEED, y: 0 });
      const route = routeFor(physical, snapshot, target);
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const debug = brain.debugState();

      expect(debug.preferred?.selectedMove.x ?? 0).toBeLessThan(-0.05);
      expect(debug.continuity?.commandedMove.x ?? 0).toBeGreaterThan(0);
      expect(debug.finalConstraint?.constrained).toBe(true);
      expect(debug.finalConstraint?.source).toBe("preferred-fallback");
      expect(debug.finalConstraint?.blockedBy).toBe("r1.wall");
      expect(intent.move.x).toBeLessThan(-0.05);

      const companion = actor(snapshot, "companion");
      const endpoint = {
        x: companion.position.x + intent.move.x * SPEED / 60,
        y: companion.position.y + intent.move.y * SPEED / 60
      };
      expect(physical.staticCircleTraversal(companion.position, endpoint, companion.radius).clear).toBe(true);

      const after = physical.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        intent
      ]);
      const afterCompanion = after.find((entry) => entry.id === "companion");
      if (!afterCompanion) throw new Error("R1 natural hard-boundary fixture missing companion after step.");
      expect(afterCompanion.position.x).toBeLessThan(startX);
      expect(afterCompanion.position.x).toBeLessThanOrEqual(HARD_MAX_X);
      expect(afterCompanion.contacts.some((contact) => contact.with === "r1.wall")).toBe(false);
    } finally {
      physical.dispose();
    }
  });

  it("allows hard-safe continuity carry into the comfort band instead of recreating clearance prison", async () => {
    const startX = 5.1;
    const spec = wallFixture(startX);
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1NaturalSpatialLocomotionBrain();
    const target = { x: 3.5, y: 4 };

    try {
      const snapshot = withCompanionVelocity(snapshotFor(spec, 0, physical.snapshot()), { x: SPEED, y: 0 });
      const route = routeFor(physical, snapshot, target);
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const debug = brain.debugState();
      const endpoint = {
        x: startX + intent.move.x * SPEED / 60,
        y: 4 + intent.move.y * SPEED / 60
      };

      expect(debug.preferred?.selectedMove.x ?? 0).toBeLessThan(-0.05);
      expect(debug.continuity?.commandedMove.x ?? 0).toBeGreaterThan(0);
      expect(endpoint.x).toBeGreaterThan(DESIRED_MAX_X);
      expect(endpoint.x).toBeLessThan(HARD_MAX_X);
      expect(physical.staticCircleTraversal({ x: startX, y: 4 }, endpoint, RADIUS).clear).toBe(true);
      expect(physical.staticCircleOccupancy(endpoint, RADIUS + S2C_ROUTE_CLEARANCE).clear).toBe(false);
      expect(debug.finalConstraint?.constrained).toBe(false);
      expect(debug.finalConstraint?.source).toBe("continuity");
      expect(intent.move.x).toBeGreaterThan(0);
    } finally {
      physical.dispose();
    }
  });

  it("recovers under NATURAL after ordinary player push/release without brain reset", async () => {
    const wallRightX = 6.0;
    const desiredMinX = wallRightX + RADIUS + S2C_ROUTE_CLEARANCE;
    const hardMinX = wallRightX + RADIUS;
    const spec: ScenarioSpec = {
      id: "pillar",
      label: "R1 natural player push release",
      width: 12,
      height: 8,
      actors: [
        { id: "companion", position: { x: 6.75, y: 4 }, radius: RADIUS, speed: SPEED },
        { id: "player", position: { x: 7.55, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: [{ id: "r1.wall", x: 5.5, y: 0, width: 0.5, height: 8 }]
    };
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1NaturalSpatialLocomotionBrain();
    const target = { x: 9.2, y: 4 };
    let tick = 0;
    let snapshot = snapshotFor(spec, tick, physical.snapshot());
    let enteredViolation = false;

    try {
      for (let step = 0; step < 120; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: -1, y: 0 } },
          { actorId: "companion", move: { x: 0, y: 0 } }
        ]);
        tick += 1;
        snapshot = snapshotFor(spec, tick, actors);
        if (actor(snapshot, "companion").position.x < desiredMinX - 1e-4) {
          enteredViolation = true;
          break;
        }
      }
      expect(enteredViolation).toBe(true);
      expect(actor(snapshot, "companion").position.x).toBeGreaterThanOrEqual(hardMinX - 0.015);

      for (let step = 0; step < 36; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: 1, y: 0 } },
          { actorId: "companion", move: { x: 0, y: 0 } }
        ]);
        tick += 1;
        snapshot = snapshotFor(spec, tick, actors);
      }

      const releasedCompanion = actor(snapshot, "companion");
      const releasedPlayer = actor(snapshot, "player");
      expect(distance(releasedCompanion.position, releasedPlayer.position)).toBeGreaterThan(RADIUS * 2 + 0.25);
      expect(physical.staticCircleOccupancy(
        releasedCompanion.position,
        RADIUS + S2C_ROUTE_CLEARANCE
      ).clear).toBe(false);

      const startX = releasedCompanion.position.x;
      let maxX = startX;
      let comfortCleared = false;
      let movingSeen = false;
      let firstProgressTick: number | null = null;

      for (let step = 0; step < 120; step += 1) {
        const companion = actor(snapshot, "companion");
        const route = routeFor(physical, snapshot, target);
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: route,
          query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });
        const debug = brain.debugState();
        if (debug.preferred && debug.preferred.state !== "HOLD") movingSeen = true;

        const actors = physical.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          intent
        ]);
        tick += 1;
        snapshot = snapshotFor(spec, tick, actors);
        const current = actor(snapshot, "companion");
        maxX = Math.max(maxX, current.position.x);
        if (firstProgressTick === null && current.position.x > startX + 0.02) firstProgressTick = step + 1;
        if (physical.staticCircleOccupancy(current.position, RADIUS + S2C_ROUTE_CLEARANCE).clear) comfortCleared = true;
      }

      expect(movingSeen).toBe(true);
      expect(firstProgressTick).not.toBeNull();
      expect(firstProgressTick ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(12);
      expect(maxX - startX).toBeGreaterThan(0.2);
      expect(comfortCleared).toBe(true);
    } finally {
      physical.dispose();
    }
  });
});

async function runNominalTrial(scenario: "pillar" | "doorway", target: Vec2, maxTicks = 900) {
  const world = await LabWorld.create(scenario);
  const brain = new R1NaturalSpatialLocomotionBrain();
  let snapshot = world.snapshot();
  let reached = false;
  let maxRequestedDelta = 0;
  let previousRequested: Vec2 = { x: 0, y: 0 };
  let maximumVerticalDetour = 0;
  let constraintCount = 0;
  const staticContacts = new Set<string>();

  try {
    for (let tick = 0; tick < maxTicks; tick += 1) {
      const companion = actor(snapshot, "companion");
      if (distance(companion.position, target) < 0.28) {
        reached = true;
        break;
      }

      const route = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
      });
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
      });
      if (brain.debugState().finalConstraint?.constrained) constraintCount += 1;

      snapshot = world.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        intent
      ]);
      const after = actor(snapshot, "companion");
      maxRequestedDelta = Math.max(maxRequestedDelta, distance(after.requestedVelocity, previousRequested));
      previousRequested = { ...after.requestedVelocity };
      maximumVerticalDetour = Math.max(maximumVerticalDetour, Math.abs(after.position.y - 4));
      for (const contact of after.contacts) {
        if (contact.with !== "player") staticContacts.add(contact.with);
      }
    }

    return { reached, snapshot, maxRequestedDelta, maximumVerticalDetour, constraintCount, staticContacts };
  } finally {
    world.dispose();
  }
}

describe("R1-2B nominal NATURAL regressions", () => {
  it("preserves pillar routing competence and smooth requested motion", async () => {
    const result = await runNominalTrial("pillar", { x: 4.2, y: 4 });
    expect(result.reached).toBe(true);
    expect(result.staticContacts.has("pillar.center")).toBe(false);
    expect(result.maximumVerticalDetour).toBeGreaterThan(1);
    expect(result.maxRequestedDelta).toBeLessThan(0.5);
  });

  it("preserves doorway traversal without wall contact", async () => {
    const result = await runNominalTrial("doorway", { x: 4.7, y: 4 });
    expect(result.reached).toBe(true);
    expect([...result.staticContacts].some((label) => label.startsWith("door.wall"))).toBe(false);
    const companion = actor(result.snapshot, "companion");
    expect(companion.position.x).toBeLessThan(5.4);
    expect(result.maxRequestedDelta).toBeLessThan(0.5);
  });
});
