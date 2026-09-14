import { describe, expect, it } from "vitest";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import {
  CCC0_CORRIDOR_MAX_HORIZON,
  evaluateShadowPlayerCorridor
} from "./shadow-player-corridor";

function actor(
  id: ActorSnapshot["id"],
  position: Vec2,
  requestedVelocity: Vec2 = { x: 0, y: 0 },
  actualVelocity: Vec2 = requestedVelocity
): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { ...requestedVelocity },
    actualVelocity: { ...actualVelocity },
    motionError: 0,
    contacts: []
  };
}

function snapshot(player: ActorSnapshot): WorldSnapshot {
  return {
    tick: 12,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [actor("companion", { x: 3, y: 4 }), player],
    obstacles: []
  };
}

describe("CCC-0 shadow player corridor", () => {
  it("does not fabricate a movement corridor for a stationary player", () => {
    const result = evaluateShadowPlayerCorridor({
      snapshot: snapshot(actor("player", { x: 6, y: 4 }))
    });
    expect(result.state).toBe("STATIONARY");
    expect(result.confidence).toBe(0);
    expect(result.horizon).toBe(0);
    expect(result.endpoint).toEqual(result.origin);
  });

  it("treats low-speed directional jitter as stationary instead of directional intent", () => {
    for (const velocity of [
      { x: 0.10, y: 0 },
      { x: -0.12, y: 0.03 },
      { x: 0.04, y: -0.09 },
      { x: -0.02, y: 0.14 }
    ]) {
      const result = evaluateShadowPlayerCorridor({
        snapshot: snapshot(actor("player", { x: 6, y: 4 }, velocity))
      });
      expect(result.state).toBe("STATIONARY");
      expect(result.horizon).toBe(0);
      expect(result.confidence).toBe(0);
    }
  });

  it("uses meaningful actual velocity before requested velocity", () => {
    const result = evaluateShadowPlayerCorridor({
      snapshot: snapshot(actor("player", { x: 6, y: 4 }, { x: 2, y: 0 }, { x: 0, y: 2 }))
    });
    expect(result.velocitySource).toBe("actual");
    expect(result.direction.x).toBeCloseTo(0);
    expect(result.direction.y).toBeCloseTo(1);
  });

  it("falls back to requested velocity when actual velocity is not meaningful", () => {
    const result = evaluateShadowPlayerCorridor({
      snapshot: snapshot(actor("player", { x: 6, y: 4 }, { x: 2, y: 0 }, { x: 0.02, y: 0 }))
    });
    expect(result.velocitySource).toBe("requested");
    expect(result.direction.x).toBeCloseTo(1);
  });

  it("reduces confidence and horizon after an abrupt reversal", () => {
    const steady = evaluateShadowPlayerCorridor({
      snapshot: snapshot(actor("player", { x: 6, y: 4 }, { x: 2.5, y: 0 })),
      previousDirection: { x: 1, y: 0 }
    });
    const reversed = evaluateShadowPlayerCorridor({
      snapshot: snapshot(actor("player", { x: 6, y: 4 }, { x: -2.5, y: 0 })),
      previousDirection: { x: 1, y: 0 }
    });

    expect(steady.state).toBe("MOVING");
    expect(reversed.state).toBe("REVERSAL_UNCERTAIN");
    expect(reversed.confidence).toBeLessThan(steady.confidence);
    expect(reversed.horizon).toBeLessThan(steady.horizon);
  });

  it("keeps repeated left-right reversals uncertain instead of immediately trusting each new heading", () => {
    let previousDirection: Vec2 | null = { x: 1, y: 0 };
    for (const velocity of [
      { x: -2.5, y: 0 },
      { x: 2.5, y: 0 },
      { x: -2.5, y: 0 },
      { x: 2.5, y: 0 }
    ]) {
      const result = evaluateShadowPlayerCorridor({
        snapshot: snapshot(actor("player", { x: 6, y: 4 }, velocity)),
        previousDirection
      });
      expect(result.state).toBe("REVERSAL_UNCERTAIN");
      expect(result.confidence).toBeLessThan(0.5);
      previousDirection = result.direction;
    }
  });

  it("keeps the prediction horizon short and bounded", () => {
    const result = evaluateShadowPlayerCorridor({
      snapshot: snapshot(actor("player", { x: 6, y: 4 }, { x: 20, y: 0 }))
    });
    expect(result.horizon).toBeLessThanOrEqual(CCC0_CORRIDOR_MAX_HORIZON);
    expect(Number.isFinite(result.endpoint.x)).toBe(true);
    expect(Number.isFinite(result.endpoint.y)).toBe(true);
  });
});
