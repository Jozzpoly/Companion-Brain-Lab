import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import { buildA1Situation } from "./a1-situation";
import { evaluateA1RelationshipOrientation } from "./a1-relationship-orientation";

describe("Authority-A1.1a semantic input alignment", () => {
  it("rejects a requested-velocity channel whose source tick diverges from the A1 decision tick", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      situation.playerRequestedVelocity.sourceTick = 1;

      expect(() => evaluateA1RelationshipOrientation({ situation }))
        .toThrow(/same-tick Owner control and requested-velocity evidence/);
    } finally {
      world.dispose();
    }
  });
});
