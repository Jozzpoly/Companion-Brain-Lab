import { describe, expect, it } from "vitest";
import { S2C_ROUTE_CLEARANCE, planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import {
  R1HardComfortSpatialBrain,
  evaluateR1SpatialLocomotion
} from "./r1-hard-comfort-spatial";

const RADIUS = 0.3;
const SPEED = 3;

function worldSnapshot(spec: ScenarioSpec, tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return {
    tick,
    scenarioId: spec.id,
    width: spec.width,
    height: spec.height,
    actors,
    obstacles: spec.obstacles
  };
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1-2A fixture missing ${id}.`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("R1-2A hard-vs-comfort spatial authority", () => {
  it("turns the exact static clearance-prison fixture into a hard-safe comfort egress", async () => {
    const fixture: ScenarioSpec = {
      id: "pillar",
      label: "R1-2A static clearance egress",
      width: 12,
      height: 8,
      actors: [
        { id: "player", position: { x: 2, y: 4 }, radius: RADIUS, speed: SPEED },
        { id: "companion", position: { x: 5.16, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: [{ id: "r1.wall", x: 5.5, y: 0, width: 0.5, height: 8 }]
    };
    const physical = await RapierPhysicalWorld.create(fixture);
    const target = { x: 3.5, y: 4 };

    try {
      const snapshot = worldSnapshot(fixture, 0, physical.snapshot());
      const companion = actor(snapshot, "companion");
      const route = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });
      const evaluation = evaluateR1SpatialLocomotion({
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const selected = evaluation.decision.candidates.find(
        (candidate) => candidate.id === evaluation.decision.selectedCandidateId
      );
      if (!selected) throw new Error("R1-2A selected candidate missing from debug evidence.");

      const hardSelected = physical.staticCircleTraversal(
        companion.position,
        selected.predictedPosition,
        companion.radius
      );
      const comfortSelectedEnd = physical.staticCircleOccupancy(
        selected.predictedPosition,
        companion.radius + S2C_ROUTE_CLEARANCE
      );

      expect(route.status).not.toBe("unreachable");
      expect(route.status).toBe("direct");
      expect(evaluation.repair.comfortStartViolated).toBe(true);
      expect(evaluation.repair.comfortStartBlockers).toEqual(["r1.wall"]);
      expect(evaluation.repair.rehabilitatedCandidateIds.length).toBeGreaterThan(0);
      expect(evaluation.repair.comfortExitCandidateIds.length).toBeGreaterThan(0);
      expect(evaluation.decision.state).not.toBe("HOLD");
      expect(evaluation.decision.selectedCandidateId).not.toBe("stop");
      expect(hardSelected.clear).toBe(true);
      expect(comfortSelectedEnd.clear).toBe(true);
      expect(evaluation.decision.selectedMove.x).toBeLessThan(-0.05);
    } finally {
      physical.dispose();
    }
  });

  it("resumes after the exact dynamic player push/release class without resetting the brain", async () => {
    const wallRightX = 6.0;
    const desiredMinX = wallRightX + RADIUS + S2C_ROUTE_CLEARANCE;
    const hardMinX = wallRightX + RADIUS;
    const fixture: ScenarioSpec = {
      id: "pillar",
      label: "R1-2A dynamic player push release",
      width: 12,
      height: 8,
      actors: [
        { id: "companion", position: { x: 6.75, y: 4 }, radius: RADIUS, speed: SPEED },
        { id: "player", position: { x: 7.55, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: [{ id: "r1.wall", x: 5.5, y: 0, width: 0.5, height: 8 }]
    };
    const physical = await RapierPhysicalWorld.create(fixture);
    const brain = new R1HardComfortSpatialBrain();
    const target = { x: 9.2, y: 4 };
    let tick = 0;
    let snapshot = worldSnapshot(fixture, tick, physical.snapshot());
    let playerContactSeen = false;
    let enteredDesiredViolation = false;

    try {
      for (let step = 0; step < 120; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: -1, y: 0 } },
          { actorId: "companion", move: { x: 0, y: 0 } }
        ]);
        tick += 1;
        snapshot = worldSnapshot(fixture, tick, actors);
        const companion = actor(snapshot, "companion");
        if (companion.contacts.some((contact) => contact.with === "player")) playerContactSeen = true;
        if (companion.position.x < desiredMinX - 1e-4) {
          enteredDesiredViolation = true;
          break;
        }
      }

      expect(playerContactSeen).toBe(true);
      expect(enteredDesiredViolation).toBe(true);
      const pinned = actor(snapshot, "companion");
      expect(pinned.position.x).toBeGreaterThanOrEqual(hardMinX - 0.015);
      expect(pinned.position.x).toBeLessThan(desiredMinX - 1e-4);

      for (let step = 0; step < 36; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: 1, y: 0 } },
          { actorId: "companion", move: { x: 0, y: 0 } }
        ]);
        tick += 1;
        snapshot = worldSnapshot(fixture, tick, actors);
      }

      const releasedCompanion = actor(snapshot, "companion");
      const releasedPlayer = actor(snapshot, "player");
      expect(distance(releasedCompanion.position, releasedPlayer.position)).toBeGreaterThan(RADIUS * 2 + 0.25);
      expect(releasedCompanion.contacts.some((contact) => contact.with === "player")).toBe(false);
      expect(releasedCompanion.position.x).toBeLessThan(desiredMinX);
      expect(physical.staticCircleOccupancy(releasedCompanion.position, RADIUS).clear).toBe(true);
      expect(physical.staticCircleOccupancy(
        releasedCompanion.position,
        RADIUS + S2C_ROUTE_CLEARANCE
      ).clear).toBe(false);

      const autonomyStartX = releasedCompanion.position.x;
      let maxProgressX = autonomyStartX;
      let firstRouteStatus = "none";
      let firstState = "none";
      let firstComfortViolation = false;
      let movingDecisionSeen = false;
      let comfortCleared = false;
      let firstProgressTick: number | null = null;

      for (let step = 0; step < 90; step += 1) {
        const companion = actor(snapshot, "companion");
        const route = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target,
          radius: companion.radius,
          query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
        });
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: route,
          query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });
        const decision = brain.debugState();
        const repair = brain.repairEvidence();
        if (step === 0) {
          firstRouteStatus = route.status;
          firstState = decision?.state ?? "none";
          firstComfortViolation = repair?.comfortStartViolated ?? false;
        }
        if (decision && decision.state !== "HOLD") movingDecisionSeen = true;

        const actors = physical.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          intent
        ]);
        tick += 1;
        snapshot = worldSnapshot(fixture, tick, actors);
        const current = actor(snapshot, "companion");
        maxProgressX = Math.max(maxProgressX, current.position.x);
        if (firstProgressTick === null && current.position.x > autonomyStartX + 0.02) firstProgressTick = step + 1;
        if (physical.staticCircleOccupancy(current.position, RADIUS + S2C_ROUTE_CLEARANCE).clear) {
          comfortCleared = true;
        }
      }

      const progress = maxProgressX - autonomyStartX;
      const diagnostic = JSON.stringify({
        firstRouteStatus,
        firstState,
        firstComfortViolation,
        movingDecisionSeen,
        firstProgressTick,
        comfortCleared,
        progress,
        startX: autonomyStartX,
        finalX: actor(snapshot, "companion").position.x
      }, null, 2);

      if (!movingDecisionSeen || progress < 0.2 || !comfortCleared || firstProgressTick === null) {
        throw new Error(`R1-2A failed dynamic push/release recovery.\n${diagnostic}`);
      }
      expect(firstRouteStatus).not.toBe("unreachable");
      expect(firstState).not.toBe("HOLD");
      expect(firstComfortViolation).toBe(true);
      expect(firstProgressTick).toBeLessThanOrEqual(12);
    } finally {
      physical.dispose();
    }
  });
});
