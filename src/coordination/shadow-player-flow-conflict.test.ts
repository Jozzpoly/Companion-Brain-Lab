import { describe, expect, it } from "vitest";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { evaluateShadowPlayerCorridor } from "./shadow-player-corridor";
import { evaluateShadowPlayerFlowConflict } from "./shadow-player-flow-conflict";

function actor(
  id: ActorSnapshot["id"],
  position: Vec2,
  velocity: Vec2 = { x: 0, y: 0 }
): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { ...velocity },
    actualVelocity: { ...velocity },
    motionError: 0,
    contacts: []
  };
}

function snapshot(options: {
  playerPosition?: Vec2;
  playerVelocity?: Vec2;
  companionPosition?: Vec2;
} = {}): WorldSnapshot {
  return {
    tick: 24,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [
      actor("companion", options.companionPosition ?? { x: 5, y: 4 }),
      actor("player", options.playerPosition ?? { x: 4, y: 4 }, options.playerVelocity ?? { x: 1, y: 0 })
    ],
    obstacles: []
  };
}

function evaluate(options: {
  state?: WorldSnapshot;
  companionVelocity?: Vec2 | null;
  previousDirection?: Vec2 | null;
} = {}) {
  const state = options.state ?? snapshot();
  const corridor = evaluateShadowPlayerCorridor({
    snapshot: state,
    previousDirection: options.previousDirection ?? null
  });
  return evaluateShadowPlayerFlowConflict({
    snapshot: state,
    corridor,
    legacyPreferredVelocity: options.companionVelocity === undefined
      ? { x: -1, y: 0 }
      : options.companionVelocity
  });
}

describe("CCC-0 shadow player-flow conflict", () => {
  it("makes no conflict claim when legacy preferred velocity is unavailable", () => {
    const result = evaluate({ companionVelocity: null });
    expect(result.state).toBe("UNAVAILABLE");
    expect(result.companionVelocity).toBeNull();
    expect(result.closestApproachTime).toBeNull();
  });

  it("keeps parallel same-speed motion clear", () => {
    const result = evaluate({
      state: snapshot({
        playerPosition: { x: 4, y: 4 },
        playerVelocity: { x: 1, y: 0 },
        companionPosition: { x: 4, y: 5.2 }
      }),
      companionVelocity: { x: 1, y: 0 }
    });
    expect(result.state).toBe("CLEAR");
    expect(result.closestApproachTime).toBe(0);
    expect(result.comfortClearance).toBeGreaterThan(0);
  });

  it("distinguishes comfort intrusion from physical overlap", () => {
    const result = evaluate({
      companionVelocity: { x: -0.25, y: 0 }
    });
    expect(result.state).toBe("COMFORT_CONFLICT");
    expect(result.physicalClearance).toBeGreaterThanOrEqual(0);
    expect(result.comfortClearance).toBeLessThan(0);
  });

  it("detects predicted head-on body conflict within the corridor horizon", () => {
    const result = evaluate({ companionVelocity: { x: -1, y: 0 } });
    expect(result.state).toBe("PHYSICAL_CONFLICT");
    expect(result.closestApproachTime).toBeGreaterThan(0);
    expect(result.physicalClearance).toBeLessThan(0);
  });

  it("detects cross-front conflict by closest approach instead of endpoint coincidence", () => {
    const state = snapshot({
      playerPosition: { x: 4, y: 4 },
      playerVelocity: { x: 2, y: 0 },
      companionPosition: { x: 4.4, y: 4.7 }
    });
    const result = evaluate({
      state,
      companionVelocity: { x: 0, y: -2 }
    });
    expect(result.state).not.toBe("CLEAR");
    expect(result.closestApproachTime).toBeGreaterThan(0);
    expect(result.closestApproachTime).toBeLessThanOrEqual(result.horizon);
  });

  it("still evaluates stationary-player blocking over a short interaction horizon", () => {
    const state = snapshot({
      playerPosition: { x: 4, y: 4 },
      playerVelocity: { x: 0, y: 0 },
      companionPosition: { x: 4.9, y: 4 }
    });
    const result = evaluate({
      state,
      companionVelocity: { x: -1, y: 0 }
    });
    expect(result.horizon).toBeGreaterThan(0);
    expect(result.state).toBe("PHYSICAL_CONFLICT");
  });

  it("is deterministic for identical same-tick evidence", () => {
    const state = snapshot();
    const first = evaluate({ state, companionVelocity: { x: -1, y: 0 } });
    const second = evaluate({ state, companionVelocity: { x: -1, y: 0 } });
    expect(second).toEqual(first);
  });
});
