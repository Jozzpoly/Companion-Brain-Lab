import { describe, expect, it } from "vitest";
import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { a1RelationshipObjectiveSignature, A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { evaluateA1MovingFrameRollout } from "./a1-moving-frame-rollout";

function orientation(tick = 3): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction: { x: 1, y: 0 },
    sourceTick: tick,
    ageTicks: 0,
    strength: 1,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { x: 1, y: 0 },
      sourceTick: tick,
      sourceStrength: 1
    },
    reason: "A1.2a boundary test"
  };
}

function relative(companion: Vec2, player: Vec2): Vec2 {
  return {
    x: companion.x - player.x,
    y: companion.y - player.y
  };
}

describe("Authority-A1.2a rollout boundary and provenance", () => {
  it("publishes explicit semantic-only non-claims instead of pretending arbitrary velocities are reachable", () => {
    const result = evaluateA1MovingFrameRollout({
      tick: 3,
      horizonSeconds: 0.25,
      currentRelativeOffset: { x: -1.45, y: 0 },
      playerFuture: { id: "synthetic-player", sourceTick: 3, velocity: { x: 50, y: 0 } },
      companionCandidate: { id: "synthetic-companion", sourceTick: 3, velocity: { x: 50, y: 0 } },
      orientation: orientation()
    });

    expect(result.reachabilityClaim).toBe("NONE_A1_2A_PURE_SEMANTICS");
    expect(result.worldLegalityClaim).toBe("NONE_A1_2A_PURE_SEMANTICS");
    expect(result.futureRelativeOffset).toEqual({ x: -1.45, y: 0 });
  });

  it("carries the objective/orientation approximation provenance needed to interpret its utility evidence", () => {
    const semanticOrientation = orientation();
    const result = evaluateA1MovingFrameRollout({
      tick: 3,
      horizonSeconds: 0.4,
      currentRelativeOffset: { x: -1.45, y: 0 },
      playerFuture: { id: "owner-request", sourceTick: 3, velocity: { x: 2, y: 0 } },
      companionCandidate: { id: "feed-forward", sourceTick: 3, velocity: { x: 2, y: 0 } },
      orientation: semanticOrientation
    });

    expect(result.orientationHeldConstantOverHorizon).toBe(true);
    expect(result.orientationSource).toBe(semanticOrientation.source);
    expect(result.orientationSourceTick).toBe(semanticOrientation.sourceTick);
    expect(result.orientationAgeTicks).toBe(semanticOrientation.ageTicks);
    expect(result.orientationStrength).toBe(semanticOrientation.strength);
    expect(result.objectiveSignature).toBe(a1RelationshipObjectiveSignature(A1_DEFAULT_RELATIONSHIP_OBJECTIVE));
  });

  it("is structurally translation-invariant because absolute World positions never enter the rollout", () => {
    const playerA = { x: 4, y: 7 };
    const companionA = { x: 2.55, y: 7 };
    const translation = { x: 123.75, y: -88.5 };
    const playerB = { x: playerA.x + translation.x, y: playerA.y + translation.y };
    const companionB = { x: companionA.x + translation.x, y: companionA.y + translation.y };

    const a = evaluateA1MovingFrameRollout({
      tick: 3,
      horizonSeconds: 0.5,
      currentRelativeOffset: relative(companionA, playerA),
      playerFuture: { id: "p", sourceTick: 3, velocity: { x: 2.4, y: 0.2 } },
      companionCandidate: { id: "c", sourceTick: 3, velocity: { x: 2.1, y: 0.4 } },
      orientation: orientation()
    });
    const b = evaluateA1MovingFrameRollout({
      tick: 3,
      horizonSeconds: 0.5,
      currentRelativeOffset: relative(companionB, playerB),
      playerFuture: { id: "p", sourceTick: 3, velocity: { x: 2.4, y: 0.2 } },
      companionCandidate: { id: "c", sourceTick: 3, velocity: { x: 2.1, y: 0.4 } },
      orientation: orientation()
    });

    expect(b.currentRelativeOffset.x).toBeCloseTo(a.currentRelativeOffset.x, 12);
    expect(b.currentRelativeOffset.y).toBeCloseTo(a.currentRelativeOffset.y, 12);
    expect(b.futureRelativeOffset.x).toBeCloseTo(a.futureRelativeOffset.x, 12);
    expect(b.futureRelativeOffset.y).toBeCloseTo(a.futureRelativeOffset.y, 12);
    expect(b.currentUtility.totalUtility).toBeCloseTo(a.currentUtility.totalUtility, 12);
    expect(b.futureUtility.totalUtility).toBeCloseTo(a.futureUtility.totalUtility, 12);
  });

  it("rejects invalid horizons and non-finite velocity hypotheses instead of producing meaningless evidence", () => {
    const base = {
      tick: 3,
      currentRelativeOffset: { x: -1.45, y: 0 },
      playerFuture: { id: "p", sourceTick: 3, velocity: { x: 1, y: 0 } },
      companionCandidate: { id: "c", sourceTick: 3, velocity: { x: 1, y: 0 } },
      orientation: orientation()
    } as const;

    expect(() => evaluateA1MovingFrameRollout({ ...base, horizonSeconds: 0 }))
      .toThrow(/positive finite horizonSeconds/i);
    expect(() => evaluateA1MovingFrameRollout({ ...base, horizonSeconds: Number.POSITIVE_INFINITY }))
      .toThrow(/positive finite horizonSeconds/i);
    expect(() => evaluateA1MovingFrameRollout({
      ...base,
      horizonSeconds: 0.4,
      companionCandidate: { id: "bad", sourceTick: 3, velocity: { x: Number.NaN, y: 0 } }
    })).toThrow(/finite x\/y components/i);
  });
});
