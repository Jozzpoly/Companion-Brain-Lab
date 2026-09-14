import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import type {
  StaticCircleOccupancyResult,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { R1HardComfortSpatialBrain } from "./r1-hard-comfort-spatial";
import { R1NaturalSpatialLocomotionBrain } from "./r1-natural-spatial-locomotion";
import {
  S3_EXPERIMENT_MAX_SPEED,
  S3_PLAYER_BUFFER,
  S3_PREDICTION_HORIZON_SECONDS
} from "./spatial-locomotion";

const RADIUS = 0.3;
const EPSILON = 1e-9;

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clearTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: Math.hypot(to.x - from.x, to.y - from.y),
    clear: true,
    blocker: null
  };
}

function clearOccupancy(center: Vec2, radius: number): StaticCircleOccupancyResult {
  return {
    center: { ...center },
    radius,
    clear: true,
    blockers: []
  };
}

function dynamicPlayerClearance(snapshot: WorldSnapshot, move: Vec2): number {
  const companion = snapshot.actors.find((actor) => actor.id === "companion");
  const player = snapshot.actors.find((actor) => actor.id === "player");
  if (!companion || !player) throw new Error("R1-5A fixture requires player and companion.");

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

function fixtureSnapshot(): WorldSnapshot {
  return {
    tick: 0,
    scenarioId: "open",
    width: 12,
    height: 8,
    obstacles: [],
    actors: [
      {
        id: "player",
        position: { x: 5, y: 4 },
        radius: RADIUS,
        requestedVelocity: { x: 0, y: 0 },
        actualVelocity: { x: 0, y: 0 },
        motionError: 0,
        contacts: []
      },
      {
        id: "companion",
        position: { x: 4, y: 4 },
        radius: RADIUS,
        // The body is still carrying previous rightward motion toward the
        // player while the newly requested relationship progress is upward.
        requestedVelocity: { x: S3_EXPERIMENT_MAX_SPEED, y: 0 },
        actualVelocity: { x: S3_EXPERIMENT_MAX_SPEED, y: 0 },
        motionError: 0,
        contacts: []
      }
    ]
  };
}

describe("R1-5A RED — final dynamic player-conflict authority", () => {
  it("does not let NATURAL turn a player-safe preferred decision into a player-conflicting final command", () => {
    const snapshot = fixtureSnapshot();
    const target = { x: 4, y: 6 };
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (!companion) throw new Error("R1-5A fixture missing companion.");

    const routePlan = planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target,
      radius: companion.radius,
      query: clearTraversal
    });
    expect(routePlan.status).toBe("direct");

    const input = {
      snapshot,
      relationshipTarget: target,
      routePlan,
      query: clearTraversal,
      occupancy: clearOccupancy
    };

    const directBrain = new R1HardComfortSpatialBrain();
    const directIntent = directBrain.intent(input);
    const directClearance = dynamicPlayerClearance(snapshot, directIntent.move);

    const naturalBrain = new R1NaturalSpatialLocomotionBrain();
    const naturalIntent = naturalBrain.intent(input);
    const naturalDebug = naturalBrain.debugState();
    const refinedMove = naturalDebug.refinement?.refinedMove ?? naturalDebug.preferred?.selectedMove;
    if (!refinedMove) throw new Error("R1-5A fixture produced no preferred/refined motion.");

    const refinedClearance = dynamicPlayerClearance(snapshot, refinedMove);
    const finalClearance = dynamicPlayerClearance(snapshot, naturalIntent.move);

    // Preconditions bind this to the current dynamic-player contract rather
    // than merely demonstrating that a moving body has inertia.
    expect(directClearance).toBeGreaterThanOrEqual(0);
    expect(refinedClearance).toBeGreaterThanOrEqual(0);
    expect(naturalDebug.finalConstraint?.constrained).toBe(false);
    expect(naturalDebug.finalConstraint?.source).toBe("continuity");

    // R1-5A invariant under test: if the spatial/refinement stages accepted a
    // player-safe command, temporal realization must not silently produce a
    // command that violates the same predicted player separation contract.
    // This assertion is expected to go RED if H1 is real.
    expect(finalClearance).toBeGreaterThanOrEqual(0);
  });
});
