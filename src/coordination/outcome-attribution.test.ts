import { describe, expect, it } from "vitest";
import type { ActorSnapshot, Vec2 } from "../world/types";
import { evaluateOutcomeAttribution } from "./outcome-attribution";

function actor(input: {
  position: Vec2;
  requestedVelocity?: Vec2;
  actualVelocity?: Vec2;
  motionError?: number;
  contacts?: readonly string[];
}): ActorSnapshot {
  return {
    id: "companion",
    position: { ...input.position },
    radius: 0.3,
    requestedVelocity: { ...(input.requestedVelocity ?? { x: 0, y: 0 }) },
    actualVelocity: { ...(input.actualVelocity ?? { x: 0, y: 0 }) },
    motionError: input.motionError ?? 0,
    contacts: (input.contacts ?? []).map((withId) => ({ with: withId, contactCount: 1 }))
  };
}

describe("Authority-A0 outcome attribution", () => {
  it("supports attribution to a healthy unconstrained submitted action", () => {
    const result = evaluateOutcomeAttribution({
      before: actor({ position: { x: 2, y: 4 } }),
      after: actor({
        position: { x: 2.05, y: 4 },
        requestedVelocity: { x: 3, y: 0 },
        actualVelocity: { x: 2.99, y: 0 },
        motionError: 0.01
      }),
      commandedVelocity: { x: 3, y: 0 }
    });

    expect(result.state).toBe("SELF_ACTION_SUPPORTED");
    expect(result.commandActualAlignment).toBeCloseTo(1, 8);
    expect(result.commandDisplacementAlignment).toBeCloseTo(1, 8);
  });

  it("does not credit zero-command player-pushed displacement as self action", () => {
    const result = evaluateOutcomeAttribution({
      before: actor({ position: { x: 4.65, y: 4 } }),
      after: actor({
        position: { x: 4.724, y: 4 },
        requestedVelocity: { x: 0, y: 0 },
        actualVelocity: { x: 1.483, y: 0 },
        motionError: 1.483,
        contacts: ["player"]
      }),
      commandedVelocity: { x: 0, y: 0 }
    });

    expect(result.state).toBe("EXTERNAL_DISPLACEMENT_EVIDENT");
    expect(result.commandedSpeed).toBe(0);
    expect(result.displacement).toBeGreaterThan(0.07);
    expect(result.contacts).toEqual(["player"]);
  });

  it("classifies a materially suppressed commanded action with static contact as constrained", () => {
    const result = evaluateOutcomeAttribution({
      before: actor({ position: { x: 2, y: 4 } }),
      after: actor({
        position: { x: 2.001, y: 4 },
        requestedVelocity: { x: 3, y: 0 },
        actualVelocity: { x: 0.1, y: 0 },
        motionError: 2.9,
        contacts: ["wall"]
      }),
      commandedVelocity: { x: 3, y: 0 }
    });

    expect(result.state).toBe("SELF_ACTION_CONSTRAINED");
  });

  it("stays conservative under nonzero command plus player contact", () => {
    const result = evaluateOutcomeAttribution({
      before: actor({ position: { x: 4, y: 4 } }),
      after: actor({
        position: { x: 4.02, y: 4.015 },
        requestedVelocity: { x: 2, y: 0 },
        actualVelocity: { x: 0.8, y: 0.7 },
        motionError: 1.39,
        contacts: ["player"]
      }),
      commandedVelocity: { x: 2, y: 0 }
    });

    expect(result.state).toBe("MIXED_OR_AMBIGUOUS");
  });

  it("reports downstream final intervention as constrained rather than clean self action", () => {
    const result = evaluateOutcomeAttribution({
      before: actor({ position: { x: 2, y: 4 } }),
      after: actor({
        position: { x: 2.02, y: 4 },
        requestedVelocity: { x: 1.2, y: 0 },
        actualVelocity: { x: 1.19, y: 0 },
        motionError: 0.01
      }),
      commandedVelocity: { x: 2, y: 0 },
      finalConstraintIntervened: true
    });

    expect(result.state).toBe("SELF_ACTION_CONSTRAINED");
  });

  it("reports a stationary zero-command frame as no meaningful motion", () => {
    const result = evaluateOutcomeAttribution({
      before: actor({ position: { x: 2, y: 4 } }),
      after: actor({ position: { x: 2, y: 4 } }),
      commandedVelocity: { x: 0, y: 0 }
    });

    expect(result.state).toBe("NO_MEANINGFUL_MOTION");
  });
});
