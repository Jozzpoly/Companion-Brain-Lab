import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface RunResult {
  recovery: boolean;
  finalIdealRelationshipError: number;
  maxIdealRelationshipError: number;
  meanRequestedSpeedLast120: number;
  minRequestedSpeedLast120: number;
  retryTicks: number[];
  retryPostSpeedDips: Array<{ tick: number; before: number; after: number }>;
}

async function run(recoveryEnabled: boolean): Promise<RunResult> {
  const spec: ScenarioSpec = {
    id: "open",
    label: recoveryEnabled ? "recovery-on" : "recovery-off",
    width: 50,
    height: 10,
    actors: [
      { id: "player", position: { x: 5, y: 5 }, radius: 0.3, speed: 3 },
      { id: "companion", position: { x: 3.55, y: 5 }, radius: 0.3, speed: 3 }
    ],
    obstacles: []
  };
  const physical = await RapierPhysicalWorld.create(spec);
  const recoveryBrain = recoveryEnabled ? new R1RecoveringNaturalSpatialBrain() : null;
  const plainBrain = recoveryEnabled ? null : new R1NaturalSpatialLocomotionBrain();
  const query = (
    from: Vec2,
    to: Vec2,
    radius: number,
    options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]
  ) => physical.staticCircleTraversal(from, to, radius, options);

  let tick = 0;
  let snapshot: WorldSnapshot = {
    tick,
    scenarioId: "open",
    width: spec.width,
    height: spec.height,
    actors: physical.snapshot(),
    obstacles: []
  };
  let target = { x: 3.55, y: 5 };
  let maxIdealRelationshipError = 0;
  const requestedSpeeds: number[] = [];
  const retryTicks: number[] = [];
  const retryPostSpeedDips: Array<{ tick: number; before: number; after: number }> = [];

  try {
    for (let step = 0; step < 300; step += 1) {
      if (tick % 6 === 0) {
        const player = actor(snapshot, "player");
        target = { x: player.position.x - 1.45, y: player.position.y };
      }
      const companion = actor(snapshot, "companion");
      const route = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query
      });
      const input = {
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query,
        occupancy: (center: Vec2, radius: number) => physical.staticCircleOccupancy(center, radius)
      };
      const intent = recoveryBrain ? recoveryBrain.intent(input) : plainBrain!.intent(input);
      const actors = physical.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        intent
      ]);
      tick += 1;
      snapshot = {
        tick,
        scenarioId: "open",
        width: spec.width,
        height: spec.height,
        actors,
        obstacles: []
      };

      const afterPlayer = actor(snapshot, "player");
      const afterCompanion = actor(snapshot, "companion");
      const requestedSpeed = Math.hypot(
        afterCompanion.requestedVelocity.x,
        afterCompanion.requestedVelocity.y
      );
      requestedSpeeds.push(requestedSpeed);
      const idealTarget = { x: afterPlayer.position.x - 1.45, y: afterPlayer.position.y };
      maxIdealRelationshipError = Math.max(
        maxIdealRelationshipError,
        distance(afterCompanion.position, idealTarget)
      );

      if (recoveryBrain) {
        const postRoute = planStaticShadowRoute({
          snapshot,
          start: afterCompanion.position,
          target,
          radius: afterCompanion.radius,
          query
        });
        const decision = recoveryBrain.observeOutcome({
          snapshot,
          objectiveKey: "back-slot-stable",
          target,
          routePlan: postRoute
        });
        if (decision.action === "RETRY_LOCAL") {
          retryTicks.push(tick);
          retryPostSpeedDips.push({
            tick,
            before: requestedSpeeds.at(-1) ?? 0,
            after: Number.NaN
          });
        }
      }

      const pending = retryPostSpeedDips.at(-1);
      if (pending && Number.isNaN(pending.after) && pending.tick < tick) {
        pending.after = requestedSpeed;
      }
    }

    const finalPlayer = actor(snapshot, "player");
    const finalCompanion = actor(snapshot, "companion");
    const finalIdealTarget = { x: finalPlayer.position.x - 1.45, y: finalPlayer.position.y };
    const last120 = requestedSpeeds.slice(-120);
    return {
      recovery: recoveryEnabled,
      finalIdealRelationshipError: distance(finalCompanion.position, finalIdealTarget),
      maxIdealRelationshipError,
      meanRequestedSpeedLast120: last120.reduce((sum, value) => sum + value, 0) / last120.length,
      minRequestedSpeedLast120: Math.min(...last120),
      retryTicks,
      retryPostSpeedDips
    };
  } finally {
    physical.dispose();
  }
}

describe("behavior-forensics: local recovery effectiveness", () => {
  it("does not cure a structural full-speed pace deficit by resetting local movement state", async () => {
    const withRecovery = await run(true);
    const withoutRecovery = await run(false);

    console.info("RECOVERY_EFFECTIVENESS", JSON.stringify({ withRecovery, withoutRecovery }));

    expect(withRecovery.retryTicks.length).toBeGreaterThan(0);
    expect(withRecovery.finalIdealRelationshipError).toBeGreaterThan(4);
    expect(withoutRecovery.finalIdealRelationshipError).toBeGreaterThan(4);
    expect(Math.abs(withRecovery.meanRequestedSpeedLast120 - 2.1)).toBeLessThan(1e-6);
    expect(Math.abs(withoutRecovery.meanRequestedSpeedLast120 - 2.1)).toBeLessThan(1e-6);
    expect(Math.abs(
      withRecovery.finalIdealRelationshipError - withoutRecovery.finalIdealRelationshipError
    )).toBeLessThan(0.3);
  });
});