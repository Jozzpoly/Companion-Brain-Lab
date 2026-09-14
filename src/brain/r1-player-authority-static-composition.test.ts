import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";
import type { FinalPlayerCommandConstraintSource } from "./final-player-command-constraint";
import type { ProgressRecoveryDecision } from "./progress-recovery";

const RADIUS = 0.3;
const SPEED = 3;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1-5A composition fixture missing ${id}.`);
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

function withCompanionVelocity(snapshot: WorldSnapshot, velocity: Vec2): WorldSnapshot {
  return {
    ...snapshot,
    actors: snapshot.actors.map((entry) => entry.id === "companion"
      ? {
          ...entry,
          position: { ...entry.position },
          requestedVelocity: { ...velocity },
          actualVelocity: { ...velocity },
          contacts: [...entry.contacts]
        }
      : {
          ...entry,
          position: { ...entry.position },
          requestedVelocity: { ...entry.requestedVelocity },
          actualVelocity: { ...entry.actualVelocity },
          contacts: [...entry.contacts]
        })
  };
}

function hasPersistentFailure(decisions: readonly ProgressRecoveryDecision[]): boolean {
  return decisions.some((decision) =>
    decision.state === "PERSISTENT_UNREACHABLE" || decision.action === "REPORT_UNREACHABLE"
  );
}

describe("R1-5A static/player authority composition", () => {
  it("lets a true static hard-boundary fallback remain authoritative when that upstream fallback is already player-safe", async () => {
    const spec: ScenarioSpec = {
      id: "pillar",
      label: "R1-5A static/player same-frame composition",
      width: 12,
      height: 8,
      actors: [
        // Player occupies the relationship direction so the upstream preferred
        // command must already account for dynamic comfort while the companion
        // is carrying stale velocity toward the hard wall on the other side.
        { id: "player", position: { x: 4.3, y: 4 }, radius: RADIUS, speed: SPEED },
        { id: "companion", position: { x: 5.18, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: [{ id: "r1.wall", x: 5.5, y: 0, width: 0.5, height: 8 }]
    };
    const target = { x: 3.5, y: 4 };
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1NaturalSpatialLocomotionBrain();

    try {
      const snapshot = withCompanionVelocity(snapshotFor(spec, 0, physical.snapshot()), { x: SPEED, y: 0 });
      const companion = actor(snapshot, "companion");
      const routePlan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });
      expect(routePlan.status).toBe("direct");

      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const debug = brain.debugState();
      const staticConstraint = debug.finalConstraint;
      const playerConstraint = debug.finalPlayerConstraint;
      if (!staticConstraint || !playerConstraint) throw new Error("R1-5A composition fixture missing final constraints.");

      expect(staticConstraint.constrained).toBe(true);
      expect(staticConstraint.blockedBy).toBe("r1.wall");
      expect(playerConstraint.constrained).toBe(false);
      expect(playerConstraint.source).toBe("unchanged");

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
      if (!afterCompanion) throw new Error("R1-5A composition fixture missing companion after World step.");
      expect(afterCompanion.contacts.some((contact) => contact.with === "r1.wall")).toBe(false);
    } finally {
      physical.dispose();
    }
  });

  it("keeps player-authority corrections statically admissible through repeated doorway contention and recovery", async () => {
    const world = await LabWorld.create("doorway");
    const brain = new R1RecoveringNaturalSpatialBrain();
    const target = { x: 4.9, y: 4 };
    let snapshot = world.snapshot();
    const decisions: ProgressRecoveryDecision[] = [];
    const playerSources: Partial<Record<FinalPlayerCommandConstraintSource, number>> = {};
    let staticConstraintCount = 0;
    let playerConstraintCount = 0;
    let simultaneousConstraintCount = 0;
    let staticallyUnsafePlayerCorrectionCount = 0;
    let doorwayContactFrames = 0;
    let maximumPlayerMotionError = 0;
    let minimumPlayerDistance = Number.POSITIVE_INFINITY;
    let reached = false;

    try {
      for (let step = 0; step < 900; step += 1) {
        const companion = actor(snapshot, "companion");
        const routePlan = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target,
          radius: companion.radius,
          query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
        });
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan,
          query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
          occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
        });
        const movement = brain.debugState().movement;
        const staticConstraint = movement.finalConstraint;
        const playerConstraint = movement.finalPlayerConstraint;
        if (!staticConstraint || !playerConstraint) {
          throw new Error("R1-5A doorway composition missing final constraint evidence.");
        }

        if (staticConstraint.constrained) staticConstraintCount += 1;
        playerSources[playerConstraint.source] = (playerSources[playerConstraint.source] ?? 0) + 1;
        if (playerConstraint.constrained) {
          playerConstraintCount += 1;
          if (staticConstraint.constrained) simultaneousConstraintCount += 1;
          const endpoint = {
            x: companion.position.x + intent.move.x * SPEED / 60,
            y: companion.position.y + intent.move.y * SPEED / 60
          };
          if (!world.staticCircleTraversal(companion.position, endpoint, companion.radius).clear) {
            staticallyUnsafePlayerCorrectionCount += 1;
          }
        }

        let playerMove: Vec2 = { x: 0, y: 0 };
        if (step < 240) {
          const phase = Math.floor(step / 60) % 2;
          playerMove = phase === 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
        }

        snapshot = world.step([
          { actorId: "player", move: playerMove },
          intent
        ]);
        const afterPlayer = actor(snapshot, "player");
        const afterCompanion = actor(snapshot, "companion");
        minimumPlayerDistance = Math.min(minimumPlayerDistance, distance(afterPlayer.position, afterCompanion.position));
        maximumPlayerMotionError = Math.max(maximumPlayerMotionError, afterPlayer.motionError);
        if (afterCompanion.contacts.some((contact) => contact.with.startsWith("door.wall"))) {
          doorwayContactFrames += 1;
        }

        const afterRoute = planStaticShadowRoute({
          snapshot,
          start: afterCompanion.position,
          target,
          radius: afterCompanion.radius,
          query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options)
        });
        decisions.push(brain.observeOutcome({
          snapshot,
          objectiveKey: "r1-5a-doorway-composition:rev-1",
          target,
          routePlan: afterRoute
        }));

        if (step >= 240 && distance(afterCompanion.position, target) <= 0.25) {
          reached = true;
          break;
        }
      }

      console.info(`R1-5A doorway authority composition ${JSON.stringify({
        staticConstraintCount,
        playerConstraintCount,
        simultaneousConstraintCount,
        staticallyUnsafePlayerCorrectionCount,
        doorwayContactFrames,
        maximumPlayerMotionError,
        minimumPlayerDistance,
        playerSources,
        appliedLocalRetries: brain.debugState().appliedLocalRetries,
        reached
      })}`);

      expect(minimumPlayerDistance).toBeLessThan(1.5);
      expect(staticallyUnsafePlayerCorrectionCount).toBe(0);
      expect(doorwayContactFrames).toBe(0);
      expect(reached).toBe(true);
      expect(hasPersistentFailure(decisions)).toBe(false);
      expect(brain.debugState().appliedLocalRetries).toBeLessThanOrEqual(2);
    } finally {
      world.dispose();
    }
  });
});
