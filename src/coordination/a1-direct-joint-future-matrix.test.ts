import { describe, expect, it } from "vitest";
import {
  realizeA1DirectCandidate,
  type A1CompanionCandidateSeed
} from "./a1-companion-candidates";
import { evaluateA1DirectJointFutureMatrix } from "./a1-direct-joint-future-matrix";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import type { A1RelationshipObjectiveProfile } from "./a1-relationship-utility";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionIntent(x = 0, y = 0): MotionIntent {
  return { actorId: "companion", move: { x, y } };
}

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
    reason: "A1.2d radial-only test orientation"
  };
}

const RADIAL_FIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 5, sigma: 0.5, weight: 1 },
  directional: { kind: "NONE" }
};

function buildSituation(
  world: LabWorld,
  snapshot: ReturnType<LabWorld["snapshot"]>,
  intent: MotionIntent,
  previousWorldStep: ReturnType<LabWorld["latestAuthorityA0StepEvidence"]>
): A1Situation {
  return buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep
  });
}

function buildPlayerFutures(world: LabWorld, situation: A1Situation, horizonSeconds: number) {
  return buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
}

function directRealization(
  world: LabWorld,
  tick: number,
  horizonSeconds: number,
  velocity: Vec2,
  family: A1CompanionCandidateSeed["family"] = "PLAYER_FEED_FORWARD"
) {
  return realizeA1DirectCandidate({
    candidate: {
      id: `test-${family.toLowerCase()}`,
      family,
      sourceTick: tick,
      desiredVelocity: velocity,
      localBasisSource: "NONE"
    },
    capability: world.actorMovementCapability("companion"),
    horizonSeconds
  });
}

function matrix(
  world: LabWorld,
  situation: A1Situation,
  horizonSeconds: number,
  velocity: Vec2,
  objective: A1RelationshipObjectiveProfile = RADIAL_FIVE
) {
  return evaluateA1DirectJointFutureMatrix({
    situation,
    realization: directRealization(world, situation.tick, horizonSeconds, velocity),
    playerFutures: buildPlayerFutures(world, situation, horizonSeconds),
    orientation: noOrientation(situation.tick),
    objective,
    staticTraversal: (from, target, radius, options) =>
      world.staticCircleTraversal(from, target, radius, options)
  });
}

describe("Authority-A1.2d DIRECT joint-future G0-G2 matrix", () => {
  it("evaluates direct A1.1 utility separately for aligned H1 and H2 only after G2 passes", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildSituation(world, world.snapshot(), playerIntent(1, 0), null);
      const result = matrix(world, situation, 0.25, { x: 3, y: 0 });

      expect(result.g0.status).toBe("PASS");
      expect(result.g1.status).toBe("PASS_DIRECT_COMMAND_ADMISSIBLE");
      expect(result.g2.status).toBe("PASS_STATIC_HARD_LEGALITY");
      expect(result.selectionClaim).toBe("NONE_MATRIX_ONLY_A1_2D");
      expect(result.robustnessAggregationClaim).toBe("NONE_MATRIX_ONLY_A1_2D");
      expect(result.jointSafetyClaim).toBe("NONE_A1_2D");
      expect(result.rows).toHaveLength(2);

      const owner = result.rows.find((row) => row.playerFutureFamily === "OWNER_REQUEST_CONTINUATION");
      const body = result.rows.find((row) => row.playerFutureFamily === "BODY_RESPONSE_CONTINUATION");
      if (!owner || !body) throw new Error("missing A1.2d player-future rows");

      expect(owner.u1Status).toBe("EVALUATED_DIRECT_OBJECTIVE");
      expect(body.u1Status).toBe("EVALUATED_DIRECT_OBJECTIVE");
      expect(result.currentRelativeOffset).toEqual({ x: 5, y: 0 });
      expect(result.currentUtility?.totalUtility).toBeCloseTo(1, 12);
      expect(owner.futureRelativeOffset).toEqual({ x: 5, y: 0 });
      expect(owner.futureUtility?.totalUtility).toBeCloseTo(1, 12);
      expect(owner.utilityDelta).toBeCloseTo(0, 12);
      expect(body.futureRelativeOffset?.x).toBeCloseTo(5.75, 12);
      expect(body.futureUtility?.totalUtility).toBeLessThan(owner.futureUtility?.totalUtility ?? 0);
    } finally {
      world.dispose();
    }
  });

  it("preserves H1/H2/H3 as independent matrix rows instead of aggregating transition ambiguity", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionIntent()]);
      const situation = buildSituation(
        world,
        after,
        playerIntent(0, 0),
        world.latestAuthorityA0StepEvidence()
      );
      const result = matrix(world, situation, 0.25, { x: 0, y: 0 });

      expect(result.g2.status).toBe("PASS_STATIC_HARD_LEGALITY");
      expect(result.rows.map((row) => row.playerFutureFamily)).toEqual([
        "OWNER_REQUEST_CONTINUATION",
        "BODY_RESPONSE_CONTINUATION",
        "TRANSITION_HOLD"
      ]);
      expect(result.rows.every((row) => row.u1Status === "EVALUATED_DIRECT_OBJECTIVE")).toBe(true);
      expect(result.robustnessAggregationClaim).toBe("NONE_MATRIX_ONLY_A1_2D");
    } finally {
      world.dispose();
    }
  });

  it("fails G2 before U1 when the companion DIRECT sweep crosses hard static geometry", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const situation = buildSituation(world, world.snapshot(), playerIntent(0, 0), null);
      const result = matrix(world, situation, 1.5, { x: -3, y: 0 });

      expect(result.g0.status).toBe("PASS");
      expect(result.g1.status).toBe("PASS_DIRECT_COMMAND_ADMISSIBLE");
      expect(result.g2.status).toBe("FAIL_STATIC_HARD_LEGALITY");
      if (result.g2.status !== "FAIL_STATIC_HARD_LEGALITY") throw new Error("expected G2 fail");
      expect(result.g2.blockerLabel).toBe("pillar.center");
      expect(result.currentUtility).toBeNull();
      expect(result.currentRelativeOffset).toBeNull();
      expect(result.rows.length).toBeGreaterThan(0);
      for (const row of result.rows) {
        expect(row.u1Status).toBe("NOT_EVALUATED_G2_FAIL");
        expect(row.futureRelativeOffset).toBeNull();
        expect(row.futureUtility).toBeNull();
        expect(row.utilityDelta).toBeNull();
      }
    } finally {
      world.dispose();
    }
  });

  it("fails G0 without touching static geometry when tick or horizon evidence is misaligned", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildSituation(world, world.snapshot(), playerIntent(1, 0), null);
      const horizon = 0.25;
      const playerFutures = buildPlayerFutures(world, situation, horizon);
      let staticQueries = 0;
      const result = evaluateA1DirectJointFutureMatrix({
        situation,
        realization: directRealization(world, situation.tick, horizon, { x: 3, y: 0 }),
        playerFutures: { ...playerFutures, horizonSeconds: horizon + 0.1 },
        orientation: noOrientation(situation.tick),
        objective: RADIAL_FIVE,
        staticTraversal: (from, target, radius, options) => {
          staticQueries += 1;
          return world.staticCircleTraversal(from, target, radius, options);
        }
      });

      expect(result.g0.status).toBe("FAIL_EVIDENCE_ALIGNMENT");
      expect(result.g1.status).toBe("NOT_EVALUATED_G0_FAIL");
      expect(result.g2.status).toBe("NOT_EVALUATED_UPSTREAM_FAIL");
      expect(result.rows).toEqual([]);
      expect(staticQueries).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("fails G1 without querying geometry when DIRECT realization evidence contradicts its own command", async () => {
    const world = await LabWorld.create("open");
    try {
      const situation = buildSituation(world, world.snapshot(), playerIntent(1, 0), null);
      const horizon = 0.25;
      const realization = directRealization(world, situation.tick, horizon, { x: 3, y: 0 });
      let staticQueries = 0;
      const result = evaluateA1DirectJointFutureMatrix({
        situation,
        realization: {
          ...realization,
          predictedDisplacement: { x: realization.predictedDisplacement.x + 0.2, y: 0 }
        },
        playerFutures: buildPlayerFutures(world, situation, horizon),
        orientation: noOrientation(situation.tick),
        objective: RADIAL_FIVE,
        staticTraversal: (from, target, radius, options) => {
          staticQueries += 1;
          return world.staticCircleTraversal(from, target, radius, options);
        }
      });

      expect(result.g0.status).toBe("PASS");
      expect(result.g1.status).toBe("FAIL_DIRECT_REALIZATION");
      expect(result.g2.status).toBe("NOT_EVALUATED_UPSTREAM_FAIL");
      expect(result.rows).toEqual([]);
      expect(staticQueries).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("is query-only and does not mutate World while producing the matrix", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const situation = buildSituation(world, before, playerIntent(1, 0), null);
      const result = matrix(world, situation, 0.25, { x: 3, y: 0 });
      const after = world.snapshot();

      expect(result.g2.status).toBe("PASS_STATIC_HARD_LEGALITY");
      expect(after).toEqual(before);
      expect(result.runtimeAuthorityClaim).toBe("NONE_A1_2D");
      expect(result.temporalPathLegalityClaim).toBe("NONE_DIRECT_ONLY_A1_2D");
    } finally {
      world.dispose();
    }
  });
});
