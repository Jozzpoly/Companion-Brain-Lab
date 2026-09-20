import { describe, expect, it } from "vitest";
import type { MovementCapability } from "../world/movement-capability";
import type { MotionIntent } from "../world/types";
import {
  motionIntentFromVelocityCommand,
  motionIntentRoundTripError,
  velocityCommandFromMotionIntent
} from "./velocity-command";

function capability(actorId: "player" | "companion", maxSpeed: number): MovementCapability {
  return { actorId, maxSpeed, radius: 0.3, source: "actor-spec" };
}

describe("Authority-A0 world-unit velocity command", () => {
  it("derives world velocity from the authoritative actor capability", () => {
    const command = velocityCommandFromMotionIntent({
      intent: { actorId: "companion", move: { x: 0.6, y: -0.2 } },
      capability: capability("companion", 5),
      sourceTick: 12
    });

    expect(command.velocity.x).toBeCloseTo(3, 12);
    expect(command.velocity.y).toBeCloseTo(-1, 12);
    expect(command.capabilityMaxSpeed).toBe(5);
    expect(command.sourceTick).toBe(12);
  });

  it("round-trips representative legacy intents with only floating-point reconstruction error", () => {
    const samples: MotionIntent[] = [
      { actorId: "companion", move: { x: 0, y: 0 } },
      { actorId: "companion", move: { x: 1, y: 0 } },
      { actorId: "companion", move: { x: 0.7, y: 0 } },
      { actorId: "companion", move: { x: Math.SQRT1_2, y: -Math.SQRT1_2 } },
      { actorId: "companion", move: { x: 0.123456789, y: -0.333333333 } }
    ];

    for (const intent of samples) {
      expect(motionIntentRoundTripError(intent, capability("companion", 3), 7)).toBeLessThan(1e-15);
    }
  });

  it("preserves a non-default capability through the command adapter", () => {
    const source: MotionIntent = { actorId: "companion", move: { x: 0.7, y: 0.1 } };
    const cap = capability("companion", 5);
    const command = velocityCommandFromMotionIntent({ intent: source, capability: cap, sourceTick: 4 });
    const reconstructed = motionIntentFromVelocityCommand(command);

    expect(command.velocity.x).toBeCloseTo(3.5, 12);
    expect(command.velocity.y).toBeCloseTo(0.5, 12);
    expect(reconstructed.move.x).toBeCloseTo(source.move.x, 15);
    expect(reconstructed.move.y).toBeCloseTo(source.move.y, 15);
  });

  it("rejects actor/capability mismatches instead of silently rescaling another actor", () => {
    expect(() => velocityCommandFromMotionIntent({
      intent: { actorId: "player", move: { x: 1, y: 0 } },
      capability: capability("companion", 3),
      sourceTick: 0
    })).toThrow(/does not match/);
  });
});
