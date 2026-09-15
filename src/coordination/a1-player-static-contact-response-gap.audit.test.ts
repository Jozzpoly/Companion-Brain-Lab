import { describe, expect, it } from "vitest";
import { evaluateA1HardRadiusPiecewiseSafety } from "./a1-hard-radius-joint-safety";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { MotionIntent } from "../world/types";

const PLAYER_INPUT: MotionIntent = {
  actorId: "player",
  move: { x: 0.8, y: 0.4 }
};
const COMPANION_HOLD: MotionIntent = {
  actorId: "companion",
  move: { x: 0, y: 0 }
};
const HORIZON_SECONDS = 1.5;

function ownerFutureFor(world: LabWorld) {
  const initial = world.snapshot();
  const situation = buildA1Situation({
    snapshot: initial,
    playerIntent: PLAYER_INPUT,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: null
  });
  const futures = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds: HORIZON_SECONDS,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
  const ownerFuture = futures.hypotheses.find(
    (future) => future.family === "OWNER_REQUEST_CONTINUATION"
  );
  if (!ownerFuture) throw new Error("missing A1.2c Owner-request future");
  return { initial, situation, ownerFuture };
}

describe("Authority-A1.2f audit: clipped-stop player-future boundary", () => {
  it("demonstrates that real World contact can slide past the A1.2c first-contact endpoint", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const { initial, ownerFuture } = ownerFutureFor(world);
      expect(ownerFuture.staticFeasibility.clipped).toBe(true);
      expect(ownerFuture.staticFeasibility.blockerLabel).toBe("pillar.center");

      const predictedContact = ownerFuture.staticFeasibility.feasibleEndpoint;
      const steps = Math.round(HORIZON_SECONDS / S0_STEP_SECONDS);
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

  it("proves the clipped-stop approximation can report CLEAR while the real slide path enters hard overlap", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const { ownerFuture } = ownerFutureFor(world);
      expect(ownerFuture.staticFeasibility.clipped).toBe(true);

      const predictedContact = ownerFuture.staticFeasibility.feasibleEndpoint;
      const hypotheticalCompanion = {
        x: predictedContact.x - 0.5,
        y: predictedContact.y + 0.5
      };
      expect(world.staticCircleOccupancy(hypotheticalCompanion, 0.3).clear).toBe(true);

      const stopApproximation = evaluateA1HardRadiusPiecewiseSafety({
        sourceTick: 0,
        horizonSeconds: HORIZON_SECONDS,
        companion: {
          origin: hypotheticalCompanion,
          velocity: { x: 0, y: 0 },
          radius: 0.3
        },
        player: {
          origin: ownerFuture.origin,
          velocity: ownerFuture.nominalVelocity,
          radius: 0.3,
          movingUntilSeconds:
            HORIZON_SECONDS * ownerFuture.staticFeasibility.feasibleFraction
        }
      });

      expect(stopApproximation.physicalState).toBe("CLEAR");
      expect(stopApproximation.closestCenterDistance).toBeGreaterThan(0.6);

      const steps = Math.round(HORIZON_SECONDS / S0_STEP_SECONDS);
      let minimumActualDistance = Number.POSITIVE_INFINITY;
      let sawPillarContact = false;
      for (let index = 0; index < steps; index += 1) {
        const after = world.step([PLAYER_INPUT, COMPANION_HOLD]);
        const player = after.actors.find((actor) => actor.id === "player");
        if (!player) throw new Error("missing player after World step");
        if (player.contacts.some((contact) => contact.with === "pillar.center")) {
          sawPillarContact = true;
        }
        minimumActualDistance = Math.min(
          minimumActualDistance,
          Math.hypot(
            player.position.x - hypotheticalCompanion.x,
            player.position.y - hypotheticalCompanion.y
          )
        );
      }

      expect(sawPillarContact).toBe(true);
      expect(minimumActualDistance).toBeLessThan(0.6);
    } finally {
      world.dispose();
    }
  });
});
