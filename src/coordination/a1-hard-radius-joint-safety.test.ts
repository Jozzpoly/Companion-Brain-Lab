import { describe, expect, it } from "vitest";
import { realizeA1DirectCandidate } from "./a1-companion-candidates";
import {
  evaluateA1DirectPlayerHardRadiusSafety,
  evaluateA1HardRadiusPiecewiseSafety
} from "./a1-hard-radius-joint-safety";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { Vec2 } from "../world/types";

function rotate90(value: Vec2): Vec2 {
  return { x: -value.y, y: value.x };
}

function naiveClosestDistance(input: {
  playerOrigin: Vec2;
  playerAverageVelocity: Vec2;
  companionOrigin: Vec2;
  companionVelocity: Vec2;
  horizon: number;
}): number {
  const relativePosition = {
    x: input.companionOrigin.x - input.playerOrigin.x,
    y: input.companionOrigin.y - input.playerOrigin.y
  };
  const relativeVelocity = {
    x: input.companionVelocity.x - input.playerAverageVelocity.x,
    y: input.companionVelocity.y - input.playerAverageVelocity.y
  };
  const speedSquared = relativeVelocity.x ** 2 + relativeVelocity.y ** 2;
  const dot = relativePosition.x * relativeVelocity.x + relativePosition.y * relativeVelocity.y;
  const time = speedSquared > 1e-12
    ? Math.max(0, Math.min(input.horizon, -dot / speedSquared))
    : 0;
  const dx = relativePosition.x + relativeVelocity.x * time;
  const dy = relativePosition.y + relativeVelocity.y * time;
  return Math.hypot(dx, dy);
}

describe("Authority-A1.2e hard-radius piecewise safety primitive", () => {
  it("preserves separation for equal parallel motion without inventing a comfort conflict", () => {
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: { x: 2, y: 0 },
        velocity: { x: 1, y: 0 },
        radius: 0.3
      },
      player: {
        origin: { x: 0, y: 0 },
        velocity: { x: 1, y: 0 },
        radius: 0.3,
        movingUntilSeconds: 1
      }
    });

    expect(result.segments).toHaveLength(1);
    expect(result.closestCenterDistance).toBeCloseTo(2, 12);
    expect(result.hardClearance).toBeCloseTo(1.4, 12);
    expect(result.physicalState).toBe("CLEAR");
    expect(result.comfortEnvelopeClaim).toBe("NONE_A1_2E_HARD_RADII_ONLY");
  });

  it("detects hard-body overlap under head-on relative motion", () => {
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: { x: 2, y: 0 },
        velocity: { x: -1, y: 0 },
        radius: 0.3
      },
      player: {
        origin: { x: 0, y: 0 },
        velocity: { x: 1, y: 0 },
        radius: 0.3,
        movingUntilSeconds: 1
      }
    });

    expect(result.closestApproachTimeSeconds).toBeCloseTo(1, 12);
    expect(result.closestCenterDistance).toBeCloseTo(0, 12);
    expect(result.hardClearance).toBeCloseTo(-0.6, 12);
    expect(result.physicalState).toBe("OVERLAP_PREDICTED");
  });

  it("reports overlap already present at t=0 even when bodies immediately separate", () => {
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: { x: 0.4, y: 0 },
        velocity: { x: 4, y: 0 },
        radius: 0.3
      },
      player: {
        origin: { x: 0, y: 0 },
        velocity: { x: -4, y: 0 },
        radius: 0.3,
        movingUntilSeconds: 1
      }
    });

    expect(result.closestApproachTimeSeconds).toBeCloseTo(0, 12);
    expect(result.closestCenterDistance).toBeCloseTo(0.4, 12);
    expect(result.physicalState).toBe("OVERLAP_PREDICTED");
  });

  it("distinguishes exact hard-radius touch from penetration", () => {
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: { x: 1.6, y: 0 },
        velocity: { x: -1, y: 0 },
        radius: 0.3
      },
      player: {
        origin: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        radius: 0.3,
        movingUntilSeconds: 0
      }
    });

    expect(result.closestApproachTimeSeconds).toBeCloseTo(1, 12);
    expect(result.closestCenterDistance).toBeCloseTo(0.6, 12);
    expect(result.hardClearance).toBeCloseTo(0, 12);
    expect(result.physicalState).toBe("TOUCH_ONLY");
  });

  it("does not erase a sub-epsilon moving phase that contains the only overlap", () => {
    const movingUntilSeconds = 5e-9;
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        radius: 0.3
      },
      player: {
        origin: { x: -0.7, y: 0 },
        velocity: { x: 2.8e8, y: 0 },
        radius: 0.3,
        movingUntilSeconds
      }
    });

    expect(result.segments.map((segment) => segment.phase)).toEqual([
      "PLAYER_MOVING",
      "PLAYER_STOPPED_AFTER_STATIC_CLIP"
    ]);
    expect(result.closestPhase).toBe("PLAYER_MOVING");
    expect(result.closestApproachTimeSeconds).toBeGreaterThan(0);
    expect(result.closestApproachTimeSeconds).toBeLessThan(movingUntilSeconds);
    expect(result.physicalState).toBe("OVERLAP_PREDICTED");
  });

  it("does not erase a sub-epsilon stopped tail that contains the only overlap", () => {
    const horizonSeconds = 1e-6;
    const stoppedTailSeconds = 5e-9;
    const movingUntilSeconds = horizonSeconds - stoppedTailSeconds;
    const velocity = 4e7;
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds,
      companion: {
        origin: { x: 0, y: 0 },
        velocity: { x: velocity, y: 0 },
        radius: 0.3
      },
      player: {
        origin: { x: 0.7, y: 0 },
        velocity: { x: velocity, y: 0 },
        radius: 0.3,
        movingUntilSeconds
      }
    });

    expect(result.segments.map((segment) => segment.phase)).toEqual([
      "PLAYER_MOVING",
      "PLAYER_STOPPED_AFTER_STATIC_CLIP"
    ]);
    expect(result.closestPhase).toBe("PLAYER_STOPPED_AFTER_STATIC_CLIP");
    expect(result.closestApproachTimeSeconds).toBeGreaterThan(movingUntilSeconds);
    expect(result.physicalState).toBe("OVERLAP_PREDICTED");
  });

  it("catches a collision after static clipping that an average-velocity approximation would miss", () => {
    const playerOrigin = { x: 0, y: 0 };
    const playerVelocity = { x: 3, y: 0 };
    const movingUntilSeconds = 0.5;
    const companionOrigin = { x: 1.5, y: 2.75 };
    const companionVelocity = { x: 0, y: -5 };
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: companionOrigin,
        velocity: companionVelocity,
        radius: 0.32
      },
      player: {
        origin: playerOrigin,
        velocity: playerVelocity,
        radius: 0.3,
        movingUntilSeconds
      }
    });

    const averageVelocity = { x: 1.5, y: 0 };
    const naiveDistance = naiveClosestDistance({
      playerOrigin,
      playerAverageVelocity: averageVelocity,
      companionOrigin,
      companionVelocity,
      horizon: 1
    });

    expect(result.segments.map((segment) => segment.phase)).toEqual([
      "PLAYER_MOVING",
      "PLAYER_STOPPED_AFTER_STATIC_CLIP"
    ]);
    expect(result.closestPhase).toBe("PLAYER_STOPPED_AFTER_STATIC_CLIP");
    expect(result.closestApproachTimeSeconds).toBeCloseTo(0.55, 12);
    expect(result.closestCenterDistance).toBeCloseTo(0, 12);
    expect(result.physicalState).toBe("OVERLAP_PREDICTED");
    expect(naiveDistance).toBeGreaterThan(0.62);
  });

  it("is rotation-covariant for piecewise hard-radius geometry", () => {
    const baseInput = {
      sourceTick: 4,
      horizonSeconds: 0.8,
      companion: {
        origin: { x: 1.1, y: -0.3 },
        velocity: { x: -0.7, y: 0.4 },
        radius: 0.32
      },
      player: {
        origin: { x: -0.2, y: 0.5 },
        velocity: { x: 1.2, y: -0.1 },
        radius: 0.3,
        movingUntilSeconds: 0.37
      }
    };
    const base = evaluateA1HardRadiusPiecewiseSafety(baseInput);
    const rotated = evaluateA1HardRadiusPiecewiseSafety({
      ...baseInput,
      companion: {
        ...baseInput.companion,
        origin: rotate90(baseInput.companion.origin),
        velocity: rotate90(baseInput.companion.velocity)
      },
      player: {
        ...baseInput.player,
        origin: rotate90(baseInput.player.origin),
        velocity: rotate90(baseInput.player.velocity)
      }
    });

    expect(rotated.closestApproachTimeSeconds).toBeCloseTo(base.closestApproachTimeSeconds, 12);
    expect(rotated.closestCenterDistance).toBeCloseTo(base.closestCenterDistance, 12);
    expect(rotated.hardClearance).toBeCloseTo(base.hardClearance, 12);
    expect(rotated.physicalState).toBe(base.physicalState);
    expect(rotated.closestPhase).toBe(base.closestPhase);
  });

  it("adapts a real statically clipped A1.2c player future into move-then-stop timing", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const horizon = 1;
      const playerFutures = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: horizon,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const ownerFuture = playerFutures.hypotheses.find(
        (future) => future.family === "OWNER_REQUEST_CONTINUATION"
      );
      if (!ownerFuture) throw new Error("missing owner future");
      const realization = realizeA1DirectCandidate({
        candidate: {
          id: "a1-2e-hold",
          family: "HOLD",
          sourceTick: situation.tick,
          desiredVelocity: { x: 0, y: 0 },
          localBasisSource: "NONE"
        },
        capability: world.actorMovementCapability("companion"),
        horizonSeconds: horizon
      });
      const result = evaluateA1DirectPlayerHardRadiusSafety({
        situation,
        realization,
        playerFuture: ownerFuture
      });

      expect(ownerFuture.staticFeasibility.clipped).toBe(true);
      expect(result.playerStaticClipped).toBe(true);
      expect(result.playerStaticClipFraction).toBeGreaterThan(0);
      expect(result.playerStaticClipFraction).toBeLessThan(1);
      expect(result.playerMovingUntilSeconds).toBeCloseTo(
        horizon * ownerFuture.staticFeasibility.feasibleFraction,
        12
      );
      expect(result.segments.map((segment) => segment.phase)).toEqual([
        "PLAYER_MOVING",
        "PLAYER_STOPPED_AFTER_STATIC_CLIP"
      ]);
      expect(result.inputProvenance).toBe("QUALIFIED_A1_2B_DIRECT_PLUS_A1_2C_PLAYER_FUTURE");
      expect(result.gateAuthorityClaim).toBe("NONE_A1_2E_PRIMITIVE_ONLY");
    } finally {
      world.dispose();
    }
  });

  it("rejects forged A1.2b displacement before claiming qualified adapter provenance", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const horizon = 0.5;
      const playerFuture = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: horizon,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      }).hypotheses[0]!;
      const realization = realizeA1DirectCandidate({
        candidate: {
          id: "a1-2e-forged-direct",
          family: "HOLD",
          sourceTick: situation.tick,
          desiredVelocity: { x: 0, y: 0 },
          localBasisSource: "NONE"
        },
        capability: world.actorMovementCapability("companion"),
        horizonSeconds: horizon
      });
      const forged = {
        ...realization,
        predictedDisplacement: { x: 1, y: 0 }
      };

      expect(() => evaluateA1DirectPlayerHardRadiusSafety({
        situation,
        realization: forged,
        playerFuture
      })).toThrow(/predicted displacement.*inconsistent/i);
    } finally {
      world.dispose();
    }
  });

  it("rejects forged A1.2c hard-radius evidence before claiming qualified adapter provenance", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const horizon = 0.5;
      const playerFuture = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: horizon,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      }).hypotheses[0]!;
      const realization = realizeA1DirectCandidate({
        candidate: {
          id: "a1-2e-valid-direct",
          family: "HOLD",
          sourceTick: situation.tick,
          desiredVelocity: { x: 0, y: 0 },
          localBasisSource: "NONE"
        },
        capability: world.actorMovementCapability("companion"),
        horizonSeconds: horizon
      });
      const forgedFuture = {
        ...playerFuture,
        staticFeasibility: {
          ...playerFuture.staticFeasibility,
          radius: playerFuture.staticFeasibility.radius + 0.1
        }
      };

      expect(() => evaluateA1DirectPlayerHardRadiusSafety({
        situation,
        realization,
        playerFuture: forgedFuture
      })).toThrow(/static radius.*current player hard radius/i);
    } finally {
      world.dispose();
    }
  });

  it("rejects invalid time envelopes before publishing physical-safety evidence", () => {
    expect(() => evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: { x: 1, y: 0 },
        velocity: { x: 0, y: 0 },
        radius: 0.3
      },
      player: {
        origin: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        radius: 0.3,
        movingUntilSeconds: 1.1
      }
    })).toThrow(/movingUntilSeconds.*within the safety horizon/i);
  });
});
