import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1Situation } from "./a1-situation";
import { LabWorld, S0_STEP_SECONDS } from "../world/world";
import type { MotionIntent } from "../world/types";

const PLAYER_INPUT: MotionIntent = {
  actorId: "player",
  move: { x: 0.8, y: 0.4 }
};
const COMPANION_HOLD: MotionIntent = {
  actorId: "companion",
  move: { x: 0, y: 0 }
};

describe("Authority-A1.2f audit: clipped-stop player-future boundary", () => {
  it("demonstrates that real World contact can slide past the A1.2c first-contact endpoint", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const initial = world.snapshot();
      const situation = buildA1Situation({
        snapshot: initial,
        playerIntent: PLAYER_INPUT,
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const horizonSeconds = 1.5;
      const futures = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const ownerFuture = futures.hypotheses.find(
        (future) => future.family === "OWNER_REQUEST_CONTINUATION"
      );
      if (!ownerFuture) throw new Error("missing A1.2c Owner-request future");

      expect(ownerFuture.staticFeasibility.clipped).toBe(true);
      expect(ownerFuture.staticFeasibility.blockerLabel).toBe("pillar.center");

      const predictedContact = ownerFuture.staticFeasibility.feasibleEndpoint;
      const steps = Math.round(horizonSeconds / S0_STEP_SECONDS);
      let sawPillarContact = false;
      let firstContactY: number | null = null;
      let after = initial;

      for (let index = 0; index < steps; index += 1) {
        after = world.step([PLAYER_INPUT, COMPANION_HOLD]);
        const player = after.actors.find((actor) => actor.id === "player");
        if (!player) throw new Error("missing player after World step");
        if (player.contacts.some((contact) => contact.with === "pillar.center")) {
          sawPillarContact = true;
          firstContactY ??= player.position.y;
        }
      }

      const actualPlayer = after.actors.find((actor) => actor.id === "player");
      if (!actualPlayer) throw new Error("missing final player state");

      expect(sawPillarContact).toBe(true);
      expect(firstContactY).not.toBeNull();
      expect(actualPlayer.position.x).toBeCloseTo(predictedContact.x, 2);
      expect(actualPlayer.position.y).toBeGreaterThan(predictedContact.y + 0.35);
      expect(actualPlayer.position.y).toBeGreaterThan((firstContactY ?? actualPlayer.position.y) + 0.25);
    } finally {
      world.dispose();
    }
  });
});
