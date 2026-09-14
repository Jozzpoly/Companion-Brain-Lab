import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld, S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { constrainFinalCommand } from "./final-command-constraint";
import { R1HardComfortSpatialBrain } from "./r1-hard-comfort-spatial";
import { refinePreferredVelocity } from "./preferred-velocity-refinement";
import {
  S3_EXPERIMENT_MAX_SPEED,
  S3_PLAYER_BUFFER,
  S3_PREDICTION_HORIZON_SECONDS
} from "./spatial-locomotion";
import {
  S4_DEFAULT_MOTION_CONTINUITY,
  stepMotionContinuity
} from "./motion-continuity";

const RADIUS = 0.3;
const SPEED = 3;
const EPSILON = 1e-9;
const PROJECTION_CLEARANCE = 0.002;

type RepairStrategy = "fallback" | "project-to-safe-boundary";

interface RepairEvidence {
  strategy: RepairStrategy;
  constraintCount: number;
  minimumFinalPredictedClearance: number;
  minimumCenterDistance: number;
  contactFrames: number;
  maximumPlayerDisplacement: number;
  maximumCommandDelta: number;
  companionEnd: Vec2;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: Vec2, b: Vec2, alpha: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha
  };
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1-5A repair probe missing ${id}.`);
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

function dynamicPlayerClearance(snapshot: WorldSnapshot, move: Vec2): number {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  const candidateVelocity = {
    x: move.x * S3_EXPERIMENT_MAX_SPEED,
    y: move.y * S3_EXPERIMENT_MAX_SPEED
  };
  const playerVelocity = magnitude(player.actualVelocity) > 0.08
    ? player.actualVelocity
    : player.requestedVelocity;
  const relativePosition = {
    x: player.position.x - companion.position.x,
    y: player.position.y - companion.position.y
  };
  const relativeVelocity = {
    x: playerVelocity.x - candidateVelocity.x,
    y: playerVelocity.y - candidateVelocity.y
  };
  const speedSquared = dot(relativeVelocity, relativeVelocity);
  const closestTime = speedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / speedSquared, 0, S3_PREDICTION_HORIZON_SECONDS)
    : 0;
  const closest = {
    x: relativePosition.x + relativeVelocity.x * closestTime,
    y: relativePosition.y + relativeVelocity.y * closestTime
  };
  return magnitude(closest) - (companion.radius + player.radius + S3_PLAYER_BUFFER);
}

function currentOutsidePlayerBuffer(snapshot: WorldSnapshot): boolean {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  const currentDistance = distance(companion.position, player.position);
  return currentDistance > companion.radius + player.radius + S3_PLAYER_BUFFER;
}

function nearestSafeBlend(snapshot: WorldSnapshot, unsafe: Vec2, safe: Vec2): Vec2 {
  if (dynamicPlayerClearance(snapshot, unsafe) >= PROJECTION_CLEARANCE) return { ...unsafe };
  if (dynamicPlayerClearance(snapshot, safe) < PROJECTION_CLEARANCE) {
    throw new Error("R1-5A projection probe requires a safe upstream endpoint.");
  }

  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const middle = (low + high) / 2;
    const candidate = lerp(unsafe, safe, middle);
    if (dynamicPlayerClearance(snapshot, candidate) >= PROJECTION_CLEARANCE) high = middle;
    else low = middle;
  }
  return lerp(unsafe, safe, high);
}

async function runRepairTrial(strategy: RepairStrategy): Promise<RepairEvidence> {
  const spec: ScenarioSpec = {
    id: "open",
    label: `R1-5A test-only ${strategy}`,
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: { x: 5, y: 4 }, radius: RADIUS, speed: SPEED },
      { id: "companion", position: { x: 3.95, y: 4 }, radius: RADIUS, speed: SPEED }
    ],
    obstacles: []
  };
  const target = { x: 4, y: 6 };
  const physical = await RapierPhysicalWorld.create(spec);
  const spatial = new R1HardComfortSpatialBrain();
  let previousAcceleration: Vec2 = { x: 0, y: 0 };
  let tick = 0;
  let constraintCount = 0;
  let contactFrames = 0;
  let minimumCenterDistance = Number.POSITIVE_INFINITY;
  let maximumPlayerDisplacement = 0;
  let maximumCommandDelta = 0;
  let minimumFinalPredictedClearance = Number.POSITIVE_INFINITY;

  try {
    let actors = physical.step([
      { actorId: "player", move: { x: 0, y: 0 } },
      { actorId: "companion", move: { x: 1, y: 0 } }
    ]);
    tick += 1;
    let snapshot = snapshotFor(spec, tick, actors);

    for (let step = 0; step < 36; step += 1) {
      const companion = actor(snapshot, "companion");
      const routePlan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });
      expect(routePlan.status).toBe("direct");

      const preferredIntent = spatial.intent({
        snapshot,
        relationshipTarget: target,
        routePlan,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });
      const decision = spatial.debugState();
      if (!decision) throw new Error("R1-5A repair probe missing spatial decision.");
      const refinement = refinePreferredVelocity(
        decision,
        (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      );
      const refinedMove = refinement.refinedMove;

      const shaped = stepMotionContinuity({
        currentVelocity: companion.actualVelocity,
        preferredMove: refinedMove,
        previousAcceleration,
        deltaSeconds: S0_STEP_SECONDS,
        config: { ...S4_DEFAULT_MOTION_CONTINUITY, maxSpeed: S3_EXPERIMENT_MAX_SPEED }
      });
      const staticConstrained = constrainFinalCommand({
        position: companion.position,
        radius: companion.radius,
        commandedMove: shaped.commandedMove,
        preferredMoves: [refinedMove, preferredIntent.move],
        maxSpeed: S3_EXPERIMENT_MAX_SPEED,
        deltaSeconds: S0_STEP_SECONDS,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });

      let finalMove = { ...staticConstrained.finalMove };
      let dynamicallyConstrained = false;
      if (currentOutsidePlayerBuffer(snapshot) && dynamicPlayerClearance(snapshot, finalMove) < 0) {
        const upstreamFallbacks = [refinedMove, preferredIntent.move, { x: 0, y: 0 }];
        const safe = upstreamFallbacks.find((candidate) => dynamicPlayerClearance(snapshot, candidate) >= PROJECTION_CLEARANCE);
        if (!safe) throw new Error("R1-5A repair probe found no dynamically safe upstream fallback.");

        const repaired = strategy === "fallback"
          ? { ...safe }
          : nearestSafeBlend(snapshot, finalMove, safe);
        maximumCommandDelta = Math.max(maximumCommandDelta, distance(finalMove, repaired));
        finalMove = repaired;
        dynamicallyConstrained = true;
        constraintCount += 1;
      }

      minimumFinalPredictedClearance = Math.min(
        minimumFinalPredictedClearance,
        dynamicPlayerClearance(snapshot, finalMove)
      );
      previousAcceleration = staticConstrained.constrained || dynamicallyConstrained
        ? { x: 0, y: 0 }
        : { ...shaped.acceleration };

      actors = physical.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        { actorId: "companion", move: finalMove }
      ]);
      tick += 1;
      snapshot = snapshotFor(spec, tick, actors);

      const afterPlayer = actor(snapshot, "player");
      const afterCompanion = actor(snapshot, "companion");
      minimumCenterDistance = Math.min(
        minimumCenterDistance,
        distance(afterPlayer.position, afterCompanion.position)
      );
      if (afterCompanion.contacts.some((contact) => contact.with === "player")) contactFrames += 1;
      maximumPlayerDisplacement = Math.max(
        maximumPlayerDisplacement,
        distance(afterPlayer.position, { x: 5, y: 4 })
      );
    }

    return {
      strategy,
      constraintCount,
      minimumFinalPredictedClearance,
      minimumCenterDistance,
      contactFrames,
      maximumPlayerDisplacement,
      maximumCommandDelta,
      companionEnd: { ...actor(snapshot, "companion").position }
    };
  } finally {
    physical.dispose();
  }
}

describe("R1-5A test-only repair comparison", () => {
  it("compares full fallback against projection toward the safe upstream boundary", async () => {
    const fallback = await runRepairTrial("fallback");
    const projection = await runRepairTrial("project-to-safe-boundary");
    console.info(`R1-5A repair comparison ${JSON.stringify({ fallback, projection })}`);

    for (const evidence of [fallback, projection]) {
      expect(evidence.constraintCount).toBeGreaterThan(0);
      expect(evidence.minimumFinalPredictedClearance).toBeGreaterThanOrEqual(0);
      expect(evidence.contactFrames).toBe(0);
      expect(evidence.minimumCenterDistance).toBeGreaterThan(RADIUS * 2);
      expect(evidence.maximumPlayerDisplacement).toBeLessThan(0.01);
      expect(evidence.companionEnd.y).toBeGreaterThan(4.8);
    }

    expect(projection.maximumCommandDelta).toBeLessThan(fallback.maximumCommandDelta);
  });
});
