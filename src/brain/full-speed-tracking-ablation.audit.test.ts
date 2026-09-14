import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { R1RecoveringDirectSpatialBrain } from "./r1-recovering-direct-spatial";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";

interface BrainLike {
  intent(input: Parameters<R1RecoveringDirectSpatialBrain["intent"]>[0]): ReturnType<R1RecoveringDirectSpatialBrain["intent"]>;
  observeOutcome(input: Parameters<R1RecoveringDirectSpatialBrain["observeOutcome"]>[0]): ReturnType<R1RecoveringDirectSpatialBrain["observeOutcome"]>;
}

interface TrackingMetrics {
  actuator: "DIRECT" | "NATURAL";
  targetCadenceTicks: number;
  finalCommandedTargetError: number;
  finalIdealRelationshipError: number;
  maximumIdealRelationshipError: number;
  meanCompanionRequestedSpeedLast120: number;
  retryActions: number;
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function runVariant(
  actuator: "DIRECT" | "NATURAL",
  targetCadenceTicks: number
): Promise<TrackingMetrics> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `forensics ${actuator} cadence ${targetCadenceTicks}`,
    width: 50,
    height: 10,
    actors: [
      { id: "player", position: { x: 5, y: 5 }, radius: 0.3, speed: 3 },
      { id: "companion", position: { x: 3.55, y: 5 }, radius: 0.3, speed: 3 }
    ],
    obstacles: []
  };
  const physical = await RapierPhysicalWorld.create(spec);
  const brain: BrainLike = actuator === "DIRECT"
    ? new R1RecoveringDirectSpatialBrain()
    : new R1RecoveringNaturalSpatialBrain();
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
  let maximumIdealRelationshipError = 0;
  let retryActions = 0;
  const requestedSpeeds: number[] = [];

  const query = (
    from: Vec2,
    to: Vec2,
    radius: number,
    options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]
  ) => physical.staticCircleTraversal(from, to, radius, options);

  try {
    for (let step = 0; step < 300; step += 1) {
      if (tick % targetCadenceTicks === 0) {
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
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: route,
        query,
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
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
      const idealTarget = { x: afterPlayer.position.x - 1.45, y: afterPlayer.position.y };
      maximumIdealRelationshipError = Math.max(
        maximumIdealRelationshipError,
        distance(afterCompanion.position, idealTarget)
      );
      requestedSpeeds.push(Math.hypot(
        afterCompanion.requestedVelocity.x,
        afterCompanion.requestedVelocity.y
      ));

      const postRoute = planStaticShadowRoute({
        snapshot,
        start: afterCompanion.position,
        target,
        radius: afterCompanion.radius,
        query
      });
      const progress = brain.observeOutcome({
        snapshot,
        objectiveKey: "back-slot-stable",
        target,
        routePlan: postRoute
      });
      if (progress.action === "RETRY_LOCAL") retryActions += 1;
    }

    const finalPlayer = actor(snapshot, "player");
    const finalCompanion = actor(snapshot, "companion");
    const finalIdealTarget = { x: finalPlayer.position.x - 1.45, y: finalPlayer.position.y };
    const last120 = requestedSpeeds.slice(-120);
    return {
      actuator,
      targetCadenceTicks,
      finalCommandedTargetError: distance(finalCompanion.position, target),
      finalIdealRelationshipError: distance(finalCompanion.position, finalIdealTarget),
      maximumIdealRelationshipError,
      meanCompanionRequestedSpeedLast120: last120.reduce((sum, value) => sum + value, 0) / last120.length,
      retryActions
    };
  } finally {
    physical.dispose();
  }
}

describe("behavior-forensics: full-speed tracking ablation", () => {
  it("separates target cadence from DIRECT/NATURAL realization", async () => {
    const results = [
      await runVariant("DIRECT", 1),
      await runVariant("DIRECT", 6),
      await runVariant("NATURAL", 1),
      await runVariant("NATURAL", 6)
    ];

    console.info("FULL_SPEED_TRACKING_ABLATION", JSON.stringify(results));

    for (const result of results) {
      expect(Number.isFinite(result.finalIdealRelationshipError)).toBe(true);
      expect(Number.isFinite(result.maximumIdealRelationshipError)).toBe(true);
      expect(Number.isFinite(result.meanCompanionRequestedSpeedLast120)).toBe(true);
      expect(result.maximumIdealRelationshipError).toBeGreaterThan(0);
    }

    const naturalSix = results.find((result) => result.actuator === "NATURAL" && result.targetCadenceTicks === 6);
    expect(naturalSix?.finalIdealRelationshipError ?? 0).toBeGreaterThan(2);
  });
});