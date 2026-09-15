import { describe, expect, it } from "vitest";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { LabWorld } from "../world/world";

function initialSituation(world: LabWorld): A1Situation {
  return buildA1Situation({
    snapshot: world.snapshot(),
    playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: null
  });
}

function byFamily(
  set: ReturnType<typeof buildA1PlayerFutureHypotheses>,
  family: ReturnType<typeof buildA1PlayerFutureHypotheses>["hypotheses"][number]["family"]
) {
  const result = set.hypotheses.find((candidate) => candidate.family === family);
  if (!result) throw new Error(`Missing ${family} future.`);
  return result;
}

describe("Authority-A1.2c prediction boundaries", () => {
  it("labels each future as prediction evidence rather than command or semantic-orientation authority", async () => {
    const world = await LabWorld.create("open");
    try {
      const set = buildA1PlayerFutureHypotheses({
        situation: initialSituation(world),
        horizonSeconds: 0.25,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const owner = byFamily(set, "OWNER_REQUEST_CONTINUATION");
      const body = byFamily(set, "BODY_RESPONSE_CONTINUATION");

      expect(owner.velocityEvidenceSource).toBe("SAME_STEP_OWNER_REQUEST");
      expect(body.velocityEvidenceSource).toBe("CURRENT_OBSERVED_BODY_RESPONSE");
      expect(owner.commandAuthorityClaim).toBe("NONE_A1_2C_PREDICTION_ONLY");
      expect(body.commandAuthorityClaim).toBe("NONE_A1_2C_PREDICTION_ONLY");
      expect(set.commandAuthorityClaim).toBe("NONE_A1_2C_PREDICTION_ONLY");
      expect(owner.semanticOrientationAuthority).toBe("NONE_PHYSICAL_FUTURE_ONLY");
      expect(body.semanticOrientationAuthority).toBe("NONE_PHYSICAL_FUTURE_ONLY");
    } finally {
      world.dispose();
    }
  });

  it("does not clamp external body-response evidence to Owner command capability", async () => {
    const world = await LabWorld.create("open");
    try {
      const base = initialSituation(world);
      const external: A1Situation = {
        ...base,
        situated: {
          ...base.situated,
          playerBody: {
            ...base.situated.playerBody,
            actualVelocity: { x: 10, y: 0 }
          },
          playerMotionProvenance: {
            ...base.situated.playerMotionProvenance,
            state: "EXTERNAL_MOTION_EVIDENT",
            reason: "synthetic A1.2c external-motion falsifier",
            actualSpeed: 10
          }
        }
      };
      const set = buildA1PlayerFutureHypotheses({
        situation: external,
        horizonSeconds: 0.1,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const body = byFamily(set, "BODY_RESPONSE_CONTINUATION");

      expect(external.situated.playerCapability.maxSpeed).toBe(3);
      expect(body.nominalVelocity).toEqual({ x: 10, y: 0 });
      expect(body.effectiveVelocity.x).toBeCloseTo(10, 9);
      expect(body.bodyMotionProvenance).toBe("EXTERNAL_MOTION_EVIDENT");
      expect(body.commandAuthorityClaim).toBe("NONE_A1_2C_PREDICTION_ONLY");
      expect(set.transitionReasons).toContain("BODY_CAUSALITY_UNCERTAIN");
      expect(byFamily(set, "TRANSITION_HOLD").velocityEvidenceSource)
        .toBe("A1_2C_TRANSITION_HOLD_CONTROL");
    } finally {
      world.dispose();
    }
  });

  it("rejects a miswired static-query result instead of attaching false legality evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = initialSituation(world);
      expect(() => buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: 0.25,
        staticTraversal: (from, target, radius, options) => {
          const result = world.staticCircleTraversal(from, target, radius, options);
          return {
            ...result,
            from: { x: result.from.x + 1, y: result.from.y }
          };
        }
      })).toThrow(/does not align with the requested player sweep/i);
    } finally {
      world.dispose();
    }
  });
});
