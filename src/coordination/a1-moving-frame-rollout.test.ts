import { describe, expect, it } from "vitest";
import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";
import { evaluateA1MovingFrameRollout } from "./a1-moving-frame-rollout";

function semanticOrientation(direction: Vec2, tick = 0): A1RelationshipOrientationEvidence {
  const length = Math.hypot(direction.x, direction.y);
  const unit = { x: direction.x / length, y: direction.y / length };
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction: unit,
    sourceTick: tick,
    ageTicks: 0,
    strength: 1,
    samplingBasis: { ...unit },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { ...unit },
      sourceTick: tick,
      sourceStrength: 1
    },
    reason: "A1.2a test orientation"
  };
}

function rollout(options: {
  relative: Vec2;
  playerVelocity: Vec2;
  companionVelocity: Vec2;
  orientation?: A1RelationshipOrientationEvidence;
  objective?: A1RelationshipObjectiveProfile;
  horizon?: number;
  tick?: number;
}) {
  const tick = options.tick ?? 0;
  return evaluateA1MovingFrameRollout({
    tick,
    horizonSeconds: options.horizon ?? 0.5,
    currentRelativeOffset: options.relative,
    playerFuture: {
      id: "player-hypothesis",
      sourceTick: tick,
      velocity: options.playerVelocity
    },
    companionCandidate: {
      id: "companion-candidate",
      sourceTick: tick,
      velocity: options.companionVelocity
    },
    orientation: options.orientation ?? semanticOrientation({ x: 1, y: 0 }, tick),
    objective: options.objective
  });
}

function rotate90(value: Vec2): Vec2 {
  return { x: -value.y, y: value.x };
}

describe("Authority-A1.2a pure moving-frame rollout", () => {
  it("preserves a good relative state under equal-speed feed-forward", () => {
    const result = rollout({
      relative: { x: -1.45, y: 0 },
      playerVelocity: { x: 3, y: 0 },
      companionVelocity: { x: 3, y: 0 }
    });

    expect(result.relativeVelocity).toEqual({ x: 0, y: 0 });
    expect(result.futureRelativeOffset.x).toBeCloseTo(-1.45, 12);
    expect(result.futureRelativeOffset.y).toBeCloseTo(0, 12);
    expect(result.futureUtility.totalUtility).toBeCloseTo(result.currentUtility.totalUtility, 12);
    expect(result.utilityDelta).toBeCloseTo(0, 12);
  });

  it("does not pretend equal-speed matching can close an existing same-direction deficit", () => {
    const result = rollout({
      relative: { x: -3, y: 0 },
      playerVelocity: { x: 3, y: 0 },
      companionVelocity: { x: 3, y: 0 }
    });

    expect(result.futureRelativeOffset.x).toBeCloseTo(-3, 12);
    expect(result.futureUtility.totalUtility).toBeCloseTo(result.currentUtility.totalUtility, 12);
    expect(result.utilityDelta).toBeCloseTo(0, 12);
  });

  it("shows why blindly continuing old feed-forward after a player stop is wrong", () => {
    const hold = rollout({
      relative: { x: -1.45, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      companionVelocity: { x: 0, y: 0 }
    });
    const staleForward = rollout({
      relative: { x: -1.45, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      companionVelocity: { x: 3, y: 0 }
    });

    expect(hold.futureUtility.totalUtility).toBeCloseTo(hold.currentUtility.totalUtility, 12);
    expect(staleForward.futureRelativeOffset.x).toBeCloseTo(0.05, 12);
    expect(staleForward.futureUtility.totalUtility).toBeLessThan(hold.futureUtility.totalUtility);
  });

  it("responds to same-step reversal in the moving frame rather than stale previous direction", () => {
    const orientation = semanticOrientation({ x: -1, y: 0 });
    const followReversal = rollout({
      relative: { x: 1.45, y: 0 },
      playerVelocity: { x: -3, y: 0 },
      companionVelocity: { x: -3, y: 0 },
      orientation
    });
    const staleForward = rollout({
      relative: { x: 1.45, y: 0 },
      playerVelocity: { x: -3, y: 0 },
      companionVelocity: { x: 3, y: 0 },
      orientation
    });

    expect(followReversal.futureRelativeOffset.x).toBeCloseTo(1.45, 12);
    expect(followReversal.utilityDelta).toBeCloseTo(0, 12);
    expect(staleForward.futureRelativeOffset.x).toBeCloseTo(4.45, 12);
    expect(staleForward.futureUtility.totalUtility).toBeLessThan(followReversal.futureUtility.totalUtility);
  });

  it("lets a lateral objective prefer the corresponding future without role-name branches", () => {
    const lateral: A1RelationshipObjectiveProfile = {
      radial: { preferredRadius: 1.45, sigma: 0.45, weight: 1 },
      directional: {
        kind: "PREFER_BEARING",
        preferredBearingRadians: Math.PI / 2,
        sigmaRadians: Math.PI / 4,
        weight: 1
      }
    };
    const towardPreferredSide = rollout({
      relative: { x: 1.45, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      companionVelocity: { x: 0, y: 2 },
      objective: lateral
    });
    const awayFromPreferredSide = rollout({
      relative: { x: 1.45, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      companionVelocity: { x: 0, y: -2 },
      objective: lateral
    });

    expect(towardPreferredSide.futureUtility.totalUtility)
      .toBeGreaterThan(awayFromPreferredSide.futureUtility.totalUtility);
  });

  it("is rotation-covariant when relationship, velocities and semantic orientation rotate together", () => {
    const base = rollout({
      relative: { x: -1.2, y: 0.4 },
      playerVelocity: { x: 1.8, y: 0.3 },
      companionVelocity: { x: 2.2, y: -0.1 },
      orientation: semanticOrientation({ x: 1, y: 0 }),
      horizon: 0.37
    });
    const rotated = rollout({
      relative: rotate90({ x: -1.2, y: 0.4 }),
      playerVelocity: rotate90({ x: 1.8, y: 0.3 }),
      companionVelocity: rotate90({ x: 2.2, y: -0.1 }),
      orientation: semanticOrientation({ x: 0, y: 1 }),
      horizon: 0.37
    });

    expect(rotated.futureRelativeOffset.x).toBeCloseTo(-base.futureRelativeOffset.y, 12);
    expect(rotated.futureRelativeOffset.y).toBeCloseTo(base.futureRelativeOffset.x, 12);
    expect(rotated.currentUtility.totalUtility).toBeCloseTo(base.currentUtility.totalUtility, 12);
    expect(rotated.futureUtility.totalUtility).toBeCloseTo(base.futureUtility.totalUtility, 12);
    expect(rotated.utilityDelta).toBeCloseTo(base.utilityDelta, 12);
  });

  it("remains independent of the A1.1 observation mesh", () => {
    const orientation = semanticOrientation({ x: 1, y: 0 });
    const coarse: A1RelationshipSamplingConfig = {
      directions: 8,
      radii: [1.45],
      nearBestUtilityWindow: 0.2
    };
    const dense: A1RelationshipSamplingConfig = {
      directions: 64,
      radii: [0.9, 1.15, 1.45, 1.8, 2.1],
      nearBestUtilityWindow: 0.2
    };

    const beforeCoarse = sampleA1RelationshipSemanticField({ orientation, sampling: coarse });
    const result = rollout({
      relative: { x: -1.7, y: 0.35 },
      playerVelocity: { x: 1.2, y: 0 },
      companionVelocity: { x: 1.7, y: 0.2 },
      orientation
    });
    const afterDense = sampleA1RelationshipSemanticField({ orientation, sampling: dense });

    expect(beforeCoarse.samplingSignature).not.toBe(afterDense.samplingSignature);
    expect(result.kind).toBe("A1_MOVING_FRAME_ROLLOUT");
    expect(result.currentUtility.relativeOffset).toEqual({ x: -1.7, y: 0.35 });
    expect(result.futureUtility.relativeOffset).toEqual(result.futureRelativeOffset);
  });

  it("rejects mixed-tick player, companion or orientation evidence", () => {
    expect(() => evaluateA1MovingFrameRollout({
      tick: 8,
      horizonSeconds: 0.4,
      currentRelativeOffset: { x: -1.45, y: 0 },
      playerFuture: { id: "p", sourceTick: 7, velocity: { x: 1, y: 0 } },
      companionCandidate: { id: "c", sourceTick: 8, velocity: { x: 1, y: 0 } },
      orientation: semanticOrientation({ x: 1, y: 0 }, 8)
    })).toThrow(/player future source tick 7 does not match rollout tick 8/i);

    expect(() => evaluateA1MovingFrameRollout({
      tick: 8,
      horizonSeconds: 0.4,
      currentRelativeOffset: { x: -1.45, y: 0 },
      playerFuture: { id: "p", sourceTick: 8, velocity: { x: 1, y: 0 } },
      companionCandidate: { id: "c", sourceTick: 7, velocity: { x: 1, y: 0 } },
      orientation: semanticOrientation({ x: 1, y: 0 }, 8)
    })).toThrow(/companion candidate source tick 7 does not match rollout tick 8/i);

    expect(() => evaluateA1MovingFrameRollout({
      tick: 8,
      horizonSeconds: 0.4,
      currentRelativeOffset: { x: -1.45, y: 0 },
      playerFuture: { id: "p", sourceTick: 8, velocity: { x: 1, y: 0 } },
      companionCandidate: { id: "c", sourceTick: 8, velocity: { x: 1, y: 0 } },
      orientation: semanticOrientation({ x: 1, y: 0 }, 7)
    })).toThrow(/orientation tick 7 does not match rollout tick 8/i);
  });
});
