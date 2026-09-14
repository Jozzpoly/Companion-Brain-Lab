import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld, S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { constrainFinalCommand } from "./final-command-constraint";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";
import { S3_EXPERIMENT_MAX_SPEED } from "./spatial-locomotion";

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function speed(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

describe("behavior-forensics: movement speed capability contract", () => {
  it("shows that a faster physical actor executes a different velocity than NATURAL reasons about", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "speed capability mismatch",
      width: 20,
      height: 10,
      actors: [
        { id: "player", position: { x: 3, y: 5 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 10, y: 5 }, radius: 0.3, speed: 5 }
      ],
      obstacles: []
    };
    const physical = await RapierPhysicalWorld.create(spec);
    try {
      let snapshot: WorldSnapshot = {
        tick: 0,
        scenarioId: "open",
        width: spec.width,
        height: spec.height,
        actors: physical.snapshot(),
        obstacles: []
      };
      const companion = actor(snapshot, "companion");
      const target = { x: 3, y: 5 };
      const query = (
        from: Vec2,
        to: Vec2,
        radius: number,
        options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]
      ) => physical.staticCircleTraversal(from, to, radius, options);
      const route = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query
      });
      const brain = new R1NaturalSpatialLocomotionBrain();
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query,
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const debug = brain.debugState();
      const reasonedVelocity = debug.finalConstraint
        ? {
            x: debug.finalConstraint.finalMove.x * S3_EXPERIMENT_MAX_SPEED,
            y: debug.finalConstraint.finalMove.y * S3_EXPERIMENT_MAX_SPEED
          }
        : null;
      expect(reasonedVelocity).not.toBeNull();

      const actors = physical.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        intent
      ]);
      snapshot = { ...snapshot, tick: 1, actors };
      const afterCompanion = actor(snapshot, "companion");
      const worldRequestedSpeed = speed(afterCompanion.requestedVelocity);
      const brainReasonedSpeed = speed(reasonedVelocity!);

      console.info("SPEED_CAPABILITY_MISMATCH", JSON.stringify({
        moveMagnitude: speed(intent.move),
        brainMaxSpeed: S3_EXPERIMENT_MAX_SPEED,
        actorSpeed: 5,
        brainReasonedSpeed,
        worldRequestedSpeed,
        ratio: worldRequestedSpeed / Math.max(brainReasonedSpeed, 1e-9)
      }));

      expect(worldRequestedSpeed).toBeGreaterThan(brainReasonedSpeed + 0.01);
      expect(worldRequestedSpeed / brainReasonedSpeed).toBeCloseTo(5 / 3, 5);
    } finally {
      physical.dispose();
    }
  });

  it("shows that a 3 m/s final static proof can be clear while the same move at 5 m/s is blocked", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "final constraint speed mismatch",
      width: 6,
      height: 4,
      actors: [
        { id: "player", position: { x: 4.5, y: 3 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 1, y: 1 }, radius: 0.3, speed: 5 }
      ],
      obstacles: [
        { id: "near.wall", x: 1.36, y: 0.2, width: 0.2, height: 1.6 }
      ]
    };
    const physical = await RapierPhysicalWorld.create(spec);
    try {
      const query = (
        from: Vec2,
        to: Vec2,
        radius: number,
        options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]
      ) => physical.staticCircleTraversal(from, to, radius, options);
      const snapshot: WorldSnapshot = {
        tick: 0,
        scenarioId: "open",
        width: spec.width,
        height: spec.height,
        actors: physical.snapshot(),
        obstacles: spec.obstacles
      };
      const companion = actor(snapshot, "companion");
      const move = { x: 1, y: 0 };
      const constrained = constrainFinalCommand({
        position: companion.position,
        radius: companion.radius,
        commandedMove: move,
        preferredMoves: [move],
        maxSpeed: S3_EXPERIMENT_MAX_SPEED,
        deltaSeconds: S0_STEP_SECONDS,
        query
      });
      const brainEndpoint = {
        x: companion.position.x + constrained.finalMove.x * S3_EXPERIMENT_MAX_SPEED * S0_STEP_SECONDS,
        y: companion.position.y + constrained.finalMove.y * S3_EXPERIMENT_MAX_SPEED * S0_STEP_SECONDS
      };
      const worldEndpoint = {
        x: companion.position.x + constrained.finalMove.x * 5 * S0_STEP_SECONDS,
        y: companion.position.y + constrained.finalMove.y * 5 * S0_STEP_SECONDS
      };
      const brainTraversal = query(companion.position, brainEndpoint, companion.radius);
      const actualSpeedTraversal = query(companion.position, worldEndpoint, companion.radius);

      expect(constrained.constrained).toBe(false);
      expect(brainTraversal.clear).toBe(true);
      expect(actualSpeedTraversal.clear).toBe(false);
      expect(actualSpeedTraversal.blocker?.label).toBe("near.wall");

      const actors = physical.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        { actorId: "companion", move: constrained.finalMove }
      ]);
      const after = actors.find((entry) => entry.id === "companion");
      if (!after) throw new Error("missing companion after step");

      console.info("FINAL_CONSTRAINT_SPEED_MISMATCH", JSON.stringify({
        constrained: constrained.constrained,
        brainEndpoint,
        worldEndpoint,
        brainClear: brainTraversal.clear,
        worldSpeedClear: actualSpeedTraversal.clear,
        blocker: actualSpeedTraversal.blocker?.label ?? null,
        actualPosition: after.position,
        worldRequestedVelocity: after.requestedVelocity,
        worldActualVelocity: after.actualVelocity,
        motionError: after.motionError,
        contacts: after.contacts
      }));

      expect(speed(after.requestedVelocity)).toBeCloseTo(5, 6);
      expect(after.position.x).toBeGreaterThan(brainEndpoint.x + 0.02);
    } finally {
      physical.dispose();
    }
  });
});