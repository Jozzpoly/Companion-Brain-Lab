import { describe, expect, it } from "vitest";
import {
  READINESS_FORWARD_OFFSET,
  READINESS_LATERAL_OFFSET,
  evaluateSharedDangerReadiness
} from "./shared-danger-readiness";
import type { S2SituatedResponsibilityDecision } from "./situated-responsibility";
import { initialSharedDangerSnapshot, type SharedDangerSnapshot } from "../world/shared-danger-contract";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";

function actor(id: ActorSnapshot["id"], x: number, y = 0): ActorSnapshot {
  return {
    id,
    position: { x, y },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(input: {
  playerX?: number;
  playerY?: number;
  companionX: number;
  companionY?: number;
  hostileX: number;
  hostileY?: number;
}): WorldSnapshot {
  return {
    tick: 5,
    scenarioId: "shared-danger",
    width: 12,
    height: 8,
    actors: [
      actor("player", input.playerX ?? 0, input.playerY ?? 0),
      actor("companion", input.companionX, input.companionY ?? 0),
      actor("hostile", input.hostileX, input.hostileY ?? 0)
    ],
    obstacles: []
  };
}

function trackedNone(): S2SituatedResponsibilityDecision {
  return {
    kind: "S2_SITUATED_RESPONSIBILITY",
    tick: 5,
    focusId: "hostile",
    attention: "TRACKING",
    responsibility: "NONE",
    reasonCode: "APPROACHING_MONITOR_ONLY",
    reason: "fixture",
    evidence: {
      phase: "APPROACHING",
      playerToHostileDistance: 5,
      companionToHostileDistance: 3,
      playerAtMaterialRisk: false,
      straightLineTicksToInterventionRange: null,
      consequenceTicksRemaining: null,
      interventionRange: 0.9,
      attackRange: 0.78
    }
  };
}

function danger(phase: SharedDangerSnapshot["phase"]): SharedDangerSnapshot {
  return {
    ...initialSharedDangerSnapshot(),
    phase,
    phaseTicksRemaining: phase === "WINDUP" ? 20 : phase === "RECOVERING" ? 10 : 0
  };
}

describe("shared-danger pre-contact readiness", () => {
  it("moves toward a player-local off-axis intercept flank while merely tracking APPROACHING", () => {
    const result = evaluateSharedDangerReadiness({
      snapshot: snapshot({ companionX: 2.4, hostileX: 5 }),
      danger: danger("APPROACHING"),
      responsibility: trackedNone()
    });

    expect(result.state).toBe("GUARDING");
    expect(result.target?.x).toBeCloseTo(READINESS_FORWARD_OFFSET, 8);
    expect(Math.abs(result.target?.y ?? 0)).toBeCloseTo(READINESS_LATERAL_OFFSET, 8);
    expect(result.target?.y).not.toBeCloseTo(0, 8);
    expect(result.motionIntent.move.x).toBeLessThan(0);
    expect(result.reasonCode).toBe("INTERCEPT_FLANK_AVAILABLE");
  });

  it("anchors the intercept flank to the player rather than chasing a farther hostile", () => {
    const near = evaluateSharedDangerReadiness({
      snapshot: snapshot({ playerX: 1, companionX: 3, hostileX: 6 }),
      danger: danger("APPROACHING"),
      responsibility: trackedNone()
    });
    const far = evaluateSharedDangerReadiness({
      snapshot: snapshot({ playerX: 1, companionX: 3, hostileX: 10 }),
      danger: danger("APPROACHING"),
      responsibility: trackedNone()
    });

    expect(near.target?.x).toBeCloseTo(1 + READINESS_FORWARD_OFFSET, 8);
    expect(far.target?.x).toBeCloseTo(1 + READINESS_FORWARD_OFFSET, 8);
    expect(near.target?.y).toBeCloseTo(far.target?.y ?? 0, 8);
  });

  it("holds when the player-local intercept flank has been reached", () => {
    const targetX = READINESS_FORWARD_OFFSET;
    const targetY = -READINESS_LATERAL_OFFSET;
    const result = evaluateSharedDangerReadiness({
      snapshot: snapshot({
        companionX: targetX,
        companionY: targetY,
        hostileX: 5
      }),
      danger: danger("APPROACHING"),
      responsibility: trackedNone()
    });

    expect(result.state).toBe("HOLDING_READY");
    expect(result.motionIntent.move).toEqual({ x: 0, y: 0 });
    expect(result.target?.x).toBeCloseTo(targetX, 8);
    expect(result.target?.y).toBeCloseTo(targetY, 8);
    expect(result.reasonCode).toBe("INTERCEPT_FLANK_REACHED");
  });

  it("places the flank within later intervention range when hostile reaches the player attack envelope", () => {
    const result = evaluateSharedDangerReadiness({
      snapshot: snapshot({
        companionX: READINESS_FORWARD_OFFSET,
        companionY: -READINESS_LATERAL_OFFSET,
        hostileX: 0.78
      }),
      danger: danger("APPROACHING"),
      responsibility: trackedNone()
    });
    const target = result.target!;
    const distanceAtCommitment = Math.hypot(target.x - 0.78, target.y);

    expect(distanceAtCommitment).toBeLessThanOrEqual(0.9);
    expect(distanceAtCommitment).toBeGreaterThan(0.3);
  });

  it("stops readiness as soon as the hostile commits to WINDUP", () => {
    const result = evaluateSharedDangerReadiness({
      snapshot: snapshot({ companionX: 1, companionY: -0.6, hostileX: 0.7 }),
      danger: danger("WINDUP"),
      responsibility: trackedNone()
    });

    expect(result.state).toBe("NONE");
    expect(result.motionIntent.move).toEqual({ x: 0, y: 0 });
  });

  it("does not prepare when no situated attention exists", () => {
    const result = evaluateSharedDangerReadiness({
      snapshot: snapshot({ companionX: 2, hostileX: 5 }),
      danger: danger("APPROACHING"),
      responsibility: null
    });

    expect(result.state).toBe("NONE");
  });
});
