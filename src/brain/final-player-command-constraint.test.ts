import { describe, expect, it } from "vitest";
import type { StaticTraversalQuery } from "../navigation/static-router";
import type { StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import {
  constrainFinalPlayerCommand,
  finalPlayerPredictedPhysicalClearance,
  finalPlayerRequiredPhysicalClearance
} from "./final-player-command-constraint";

const RADIUS = 0.3;
const SPEED = 3;
const DT = 1 / 60;

function traversal(
  from: Vec2,
  to: Vec2,
  radius: number,
  clear: boolean,
  label = "fixture.blocker"
): StaticCircleTraversalResult {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance,
    clear,
    blocker: clear ? null : {
      label,
      distance,
      fraction: 1,
      hitCenter: { ...to },
      contactPoint: { ...to },
      normal: { x: 0, y: -1 }
    }
  };
}

const clearQuery: StaticTraversalQuery = (from, to, radius) => traversal(from, to, radius, true);

function snapshot(options: {
  companion: Vec2;
  player: Vec2;
  companionVelocity?: Vec2;
  playerVelocity?: Vec2;
}): WorldSnapshot {
  return {
    tick: 1,
    scenarioId: "open",
    width: 12,
    height: 8,
    obstacles: [],
    actors: [
      {
        id: "player",
        position: { ...options.player },
        radius: RADIUS,
        requestedVelocity: { ...(options.playerVelocity ?? { x: 0, y: 0 }) },
        actualVelocity: { ...(options.playerVelocity ?? { x: 0, y: 0 }) },
        motionError: 0,
        contacts: []
      },
      {
        id: "companion",
        position: { ...options.companion },
        radius: RADIUS,
        requestedVelocity: { ...(options.companionVelocity ?? { x: 0, y: 0 }) },
        actualVelocity: { ...(options.companionVelocity ?? { x: 0, y: 0 }) },
        motionError: 0,
        contacts: []
      }
    ]
  };
}

function commandClearance(world: WorldSnapshot, move: Vec2): number {
  return finalPlayerPredictedPhysicalClearance({
    snapshot: world,
    move,
    maxSpeed: SPEED,
    deltaSeconds: DT
  });
}

describe("R1-5A final player-command physical authority", () => {
  it("leaves a hard-safe final command untouched", () => {
    const world = snapshot({
      companion: { x: 3.2, y: 4 },
      player: { x: 6, y: 4 },
      companionVelocity: { x: 3, y: 0 },
      playerVelocity: { x: -1.35, y: 0 }
    });
    const commandedMove = { x: 0.95, y: 0.08 };

    const result = constrainFinalPlayerCommand({
      snapshot: world,
      commandedMove,
      preferredMoves: [{ x: 0.7, y: 0 }],
      maxSpeed: SPEED,
      deltaSeconds: DT,
      query: clearQuery
    });

    expect(result.constrained).toBe(false);
    expect(result.source).toBe("unchanged");
    expect(result.finalMove.x).toBeCloseTo(commandedMove.x, 9);
    expect(result.finalMove.y).toBeCloseTo(commandedMove.y, 9);
    expect(result.finalPredictedClearance).toBeGreaterThan(result.requiredPhysicalClearance);
  });

  it("projects a near-contact unsafe command toward the already-safe preferred motion", () => {
    const world = snapshot({
      companion: { x: 4.38, y: 4 },
      player: { x: 5, y: 4 },
      companionVelocity: { x: 3, y: 0 }
    });
    const commandedMove = { x: 1, y: 0 };
    const preferredMove = { x: 0, y: 0.7 };
    expect(commandClearance(world, commandedMove)).toBeLessThan(finalPlayerRequiredPhysicalClearance(world));
    expect(commandClearance(world, preferredMove)).toBeGreaterThan(finalPlayerRequiredPhysicalClearance(world));

    const result = constrainFinalPlayerCommand({
      snapshot: world,
      commandedMove,
      preferredMoves: [preferredMove],
      maxSpeed: SPEED,
      deltaSeconds: DT,
      query: clearQuery
    });

    expect(result.constrained).toBe(true);
    expect(result.source).toBe("projected-preferred");
    expect(result.fallbackIndex).toBe(0);
    expect(result.finalPredictedClearance).toBeGreaterThanOrEqual(result.requiredPhysicalClearance - 1e-6);
    expect(Math.hypot(result.finalMove.x - commandedMove.x, result.finalMove.y - commandedMove.y))
      .toBeLessThan(Math.hypot(preferredMove.x - commandedMove.x, preferredMove.y - commandedMove.y));
  });

  it("keeps egress admissible when the current frame is already inside the hard boundary", () => {
    const world = snapshot({
      companion: { x: 4.405, y: 4 },
      player: { x: 5, y: 4 }
    });
    expect(finalPlayerRequiredPhysicalClearance(world)).toBeLessThan(0);

    const result = constrainFinalPlayerCommand({
      snapshot: world,
      commandedMove: { x: 1, y: 0 },
      preferredMoves: [{ x: -0.7, y: 0 }],
      maxSpeed: SPEED,
      deltaSeconds: DT,
      query: clearQuery
    });

    expect(result.constrained).toBe(true);
    expect(result.finalPredictedClearance).toBeGreaterThanOrEqual(result.requiredPhysicalClearance - 1e-6);
    expect(result.finalMove.x).toBeLessThan(1);
  });

  it("never reintroduces a static blocker while repairing player authority", () => {
    const world = snapshot({
      companion: { x: 4.38, y: 4 },
      player: { x: 5, y: 4 }
    });
    const staticQuery: StaticTraversalQuery = (from, to, radius) => {
      // First preferred endpoint goes upward through an authored hard blocker;
      // downward motion remains statically free.
      const blocked = to.y > from.y + 1e-7;
      return traversal(from, to, radius, !blocked, "fixture.upper-wall");
    };

    const result = constrainFinalPlayerCommand({
      snapshot: world,
      commandedMove: { x: 1, y: 0 },
      preferredMoves: [
        { x: 0, y: 0.7 },
        { x: 0, y: -0.7 }
      ],
      maxSpeed: SPEED,
      deltaSeconds: DT,
      query: staticQuery
    });

    const companion = world.actors.find((entry) => entry.id === "companion");
    if (!companion) throw new Error("Fixture missing companion.");
    const end = {
      x: companion.position.x + result.finalMove.x * SPEED * DT,
      y: companion.position.y + result.finalMove.y * SPEED * DT
    };

    expect(result.constrained).toBe(true);
    expect(result.fallbackIndex).toBe(1);
    expect(staticQuery(companion.position, end, companion.radius).clear).toBe(true);
    expect(result.finalPredictedClearance).toBeGreaterThanOrEqual(result.requiredPhysicalClearance - 1e-6);
  });
});
