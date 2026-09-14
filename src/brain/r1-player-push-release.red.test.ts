import { describe, expect, it } from "vitest";
import { S2C_ROUTE_CLEARANCE, planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { SpatialLocomotionBrain } from "./spatial-locomotion";

const RADIUS = 0.3;
const SPEED = 3;
const WALL_RIGHT_X = 6.0;
const DESIRED_MIN_X = WALL_RIGHT_X + RADIUS + S2C_ROUTE_CLEARANCE;
const HARD_MIN_X = WALL_RIGHT_X + RADIUS;

const fixture: ScenarioSpec = {
  id: "pillar",
  label: "R1 player-push release red fixture",
  width: 12,
  height: 8,
  actors: [
    { id: "companion", position: { x: 6.75, y: 4 }, radius: RADIUS, speed: SPEED },
    { id: "player", position: { x: 7.55, y: 4 }, radius: RADIUS, speed: SPEED }
  ],
  obstacles: [
    { id: "r1.wall", x: 5.5, y: 0, width: 0.5, height: 8 }
  ]
};

function worldSnapshot(tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return {
    tick,
    scenarioId: fixture.id,
    width: fixture.width,
    height: fixture.height,
    actors,
    obstacles: fixture.obstacles
  };
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1 push fixture missing ${id}.`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("R1-0 dynamic player push/release red reproduction", () => {
  it("resumes autonomy after the player pushes the companion into desired-clearance violation and leaves", async () => {
    const physical = await RapierPhysicalWorld.create(fixture);
    const brain = new SpatialLocomotionBrain();
    const target = { x: 9.2, y: 4 };
    let tick = 0;
    let snapshot = worldSnapshot(tick, physical.snapshot());
    let enteredDesiredViolation = false;
    let playerContactSeen = false;
    let minimumCompanionX = Number.POSITIVE_INFINITY;

    try {
      // Phase 1: the player pushes a passive companion toward the wall.
      // This deliberately isolates whether ordinary dynamic contact can create
      // a World state that is hard-legal but invalid under desired clearance.
      for (let step = 0; step < 120; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: -1, y: 0 } },
          { actorId: "companion", move: { x: 0, y: 0 } }
        ]);
        tick += 1;
        snapshot = worldSnapshot(tick, actors);
        const companion = actor(snapshot, "companion");
        minimumCompanionX = Math.min(minimumCompanionX, companion.position.x);
        if (companion.contacts.some((contact) => contact.with === "player")) playerContactSeen = true;
        if (companion.position.x < DESIRED_MIN_X - 1e-4) {
          enteredDesiredViolation = true;
          break;
        }
      }

      expect(playerContactSeen).toBe(true);
      expect(enteredDesiredViolation).toBe(true);
      const pinned = actor(snapshot, "companion");
      // The physical body remains legal: it must not cross the hard wall limit.
      expect(pinned.position.x).toBeGreaterThanOrEqual(HARD_MIN_X - 0.015);
      expect(pinned.position.x).toBeLessThan(DESIRED_MIN_X - 1e-4);

      // Phase 2: move the player clearly away while leaving the companion passive.
      // The conflict is gone before autonomous recovery is evaluated.
      for (let step = 0; step < 36; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: 1, y: 0 } },
          { actorId: "companion", move: { x: 0, y: 0 } }
        ]);
        tick += 1;
        snapshot = worldSnapshot(tick, actors);
      }

      const releasedCompanion = actor(snapshot, "companion");
      const releasedPlayer = actor(snapshot, "player");
      expect(distance(releasedCompanion.position, releasedPlayer.position)).toBeGreaterThan(RADIUS * 2 + 0.25);
      expect(releasedCompanion.contacts.some((contact) => contact.with === "player")).toBe(false);
      expect(releasedCompanion.position.x).toBeLessThan(DESIRED_MIN_X);

      const desiredAtRelease = physical.staticCircleTraversal(
        releasedCompanion.position,
        target,
        RADIUS + S2C_ROUTE_CLEARANCE
      );
      const hardAtRelease = physical.staticCircleTraversal(
        releasedCompanion.position,
        target,
        RADIUS
      );
      expect(hardAtRelease.clear).toBe(true);
      expect(desiredAtRelease.clear).toBe(false);
      expect(desiredAtRelease.blocker?.label).toBe("r1.wall");
      expect(desiredAtRelease.blocker?.distance ?? Number.POSITIVE_INFINITY).toBeLessThan(1e-5);

      // Phase 3: ordinary autonomous SPATIAL movement gets a clean objective
      // directly away from the wall. The player remains far and stationary.
      const autonomyStartX = releasedCompanion.position.x;
      let firstRouteStatus = "none";
      let firstState = "none";
      let firstCandidate = "none";
      let maxProgressX = autonomyStartX;
      let movingDecisionSeen = false;

      for (let step = 0; step < 90; step += 1) {
        const companion = actor(snapshot, "companion");
        const route = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target,
          radius: companion.radius,
          query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        });
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: route,
          query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
        });
        const decision = brain.debugState();
        if (step === 0) {
          firstRouteStatus = route.status;
          firstState = decision?.state ?? "none";
          firstCandidate = decision?.selectedCandidateId ?? "none";
        }
        if (decision && decision.state !== "HOLD") movingDecisionSeen = true;

        const actors = physical.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          intent
        ]);
        tick += 1;
        snapshot = worldSnapshot(tick, actors);
        maxProgressX = Math.max(maxProgressX, actor(snapshot, "companion").position.x);
      }

      const finalCompanion = actor(snapshot, "companion");
      const progress = maxProgressX - autonomyStartX;
      const diagnostic = JSON.stringify({
        minimumCompanionX,
        hardMinimumX: HARD_MIN_X,
        desiredMinimumX: DESIRED_MIN_X,
        release: {
          companionX: autonomyStartX,
          playerX: releasedPlayer.position.x,
          hardClear: hardAtRelease.clear,
          desiredClear: desiredAtRelease.clear,
          desiredBlocker: desiredAtRelease.blocker?.label ?? null,
          desiredHitDistance: desiredAtRelease.blocker?.distance ?? null
        },
        autonomy: {
          firstRouteStatus,
          firstState,
          firstCandidate,
          movingDecisionSeen,
          progress,
          finalX: finalCompanion.position.x,
          targetX: target.x
        }
      }, null, 2);

      // R1 invariant: once the player conflict has ended, a physically legal
      // egress and an objective directly away from the wall must not require reset.
      if (!movingDecisionSeen || progress < 0.2) {
        throw new Error(
          `R1-0 RED REPRODUCTION: player push created a persistent autonomous clearance lock after release.\n${diagnostic}`
        );
      }
    } finally {
      physical.dispose();
    }
  });
});
