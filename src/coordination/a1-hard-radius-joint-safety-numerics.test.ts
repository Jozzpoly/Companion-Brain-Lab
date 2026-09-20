import { describe, expect, it } from "vitest";
import { evaluateA1HardRadiusPiecewiseSafety } from "./a1-hard-radius-joint-safety";

describe("Authority-A1.2e hard-radius numeric adversaries", () => {
  it("does not erase a small but non-zero relative velocity near hard contact", () => {
    const result = evaluateA1HardRadiusPiecewiseSafety({
      sourceTick: 0,
      horizonSeconds: 1,
      companion: {
        origin: { x: 0.60002, y: 0 },
        velocity: { x: -0.00005, y: 0 },
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
    expect(result.closestCenterDistance).toBeLessThan(0.6);
    expect(result.physicalState).toBe("OVERLAP_PREDICTED");
  });
});
