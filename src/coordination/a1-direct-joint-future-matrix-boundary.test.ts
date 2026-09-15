import { describe, expect, it } from "vitest";
import { realizeA1DirectCandidate } from "./a1-companion-candidates";
import { evaluateA1DirectJointFutureMatrix } from "./a1-direct-joint-future-matrix";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";

function noOrientation(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "A1.2d boundary-test orientation"
  };
}

describe("Authority-A1.2d cross-stage evidence integrity", () => {
  it("fails G0 before geometry when an A1.2c feasible endpoint is internally forged", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const horizon = 0.25;
      const playerFutures = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: horizon,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const realization = realizeA1DirectCandidate({
        candidate: {
          id: "boundary-feed-forward",
          family: "PLAYER_FEED_FORWARD",
          sourceTick: situation.tick,
          desiredVelocity: { x: 3, y: 0 },
          localBasisSource: "NONE"
        },
        capability: world.actorMovementCapability("companion"),
        horizonSeconds: horizon
      });
      const forged = {
        ...playerFutures,
        hypotheses: playerFutures.hypotheses.map((future, index) => index === 0
          ? {
              ...future,
              staticFeasibility: {
                ...future.staticFeasibility,
                feasibleEndpoint: {
                  x: future.staticFeasibility.feasibleEndpoint.x + 10,
                  y: future.staticFeasibility.feasibleEndpoint.y
                }
              }
            }
          : future)
      };
      let staticQueries = 0;
      const result = evaluateA1DirectJointFutureMatrix({
        situation,
        realization,
        playerFutures: forged,
        orientation: noOrientation(situation.tick),
        staticTraversal: (from, target, radius, options) => {
          staticQueries += 1;
          return world.staticCircleTraversal(from, target, radius, options);
        }
      });

      expect(result.g0.status).toBe("FAIL_EVIDENCE_ALIGNMENT");
      if (result.g0.status !== "FAIL_EVIDENCE_ALIGNMENT") throw new Error("expected G0 fail");
      expect(result.g0.reasons.some((reason) => /effective velocity|feasible endpoint/i.test(reason))).toBe(true);
      expect(result.g1.status).toBe("NOT_EVALUATED_G0_FAIL");
      expect(staticQueries).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("fails G0 when the qualified A1.2c mandatory H1/H2 hypothesis structure is incomplete", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildA1Situation({
        snapshot: world.snapshot(),
        playerIntent: { actorId: "player", move: { x: 0, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const horizon = 0.25;
      const playerFutures = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: horizon,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      });
      const realization = realizeA1DirectCandidate({
        candidate: {
          id: "boundary-hold",
          family: "HOLD",
          sourceTick: situation.tick,
          desiredVelocity: { x: 0, y: 0 },
          localBasisSource: "NONE"
        },
        capability: world.actorMovementCapability("companion"),
        horizonSeconds: horizon
      });
      const missingBody = {
        ...playerFutures,
        hypotheses: playerFutures.hypotheses.filter(
          (future) => future.family !== "BODY_RESPONSE_CONTINUATION"
        )
      };
      let staticQueries = 0;
      const result = evaluateA1DirectJointFutureMatrix({
        situation,
        realization,
        playerFutures: missingBody,
        orientation: noOrientation(situation.tick),
        staticTraversal: (from, target, radius, options) => {
          staticQueries += 1;
          return world.staticCircleTraversal(from, target, radius, options);
        }
      });

      expect(result.g0.status).toBe("FAIL_EVIDENCE_ALIGNMENT");
      if (result.g0.status !== "FAIL_EVIDENCE_ALIGNMENT") throw new Error("expected G0 fail");
      expect(result.g0.reasons.some((reason) => /mandatory H1\/H2/i.test(reason))).toBe(true);
      expect(staticQueries).toBe(0);
    } finally {
      world.dispose();
    }
  });
});
