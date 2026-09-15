import { describe, expect, it } from "vitest";
import { realizeA1DirectCandidate } from "./a1-companion-candidates";
import {
  evaluateA1DirectPlayerG3EgressPolicy,
  evaluateA1G3EgressPolicy
} from "./a1-g3-egress-policy";
import { evaluateA1HardRadiusPiecewiseSafety } from "./a1-hard-radius-joint-safety";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";

function classify(input: {
  horizonSeconds: number;
  companionOrigin: { x: number; y: number };
  companionVelocity: { x: number; y: number };
  playerOrigin: { x: number; y: number };
  playerVelocity: { x: number; y: number };
  playerMovingUntilSeconds: number;
}) {
  const threshold = 0.6;
  const physicalEvidence = evaluateA1HardRadiusPiecewiseSafety({
    sourceTick: 0,
    horizonSeconds: input.horizonSeconds,
    companion: {
      origin: input.companionOrigin,
      velocity: input.companionVelocity,
      radius: 0.3
    },
    player: {
      origin: input.playerOrigin,
      velocity: input.playerVelocity,
      radius: 0.3,
      movingUntilSeconds: input.playerMovingUntilSeconds
    }
  });
  const initialDistance = Math.hypot(
    input.companionOrigin.x - input.playerOrigin.x,
    input.companionOrigin.y - input.playerOrigin.y
  );
  const playerMoveTime = Math.min(input.horizonSeconds, input.playerMovingUntilSeconds);
  const playerEndpoint = {
    x: input.playerOrigin.x + input.playerVelocity.x * playerMoveTime,
    y: input.playerOrigin.y + input.playerVelocity.y * playerMoveTime
  };
  const companionEndpoint = {
    x: input.companionOrigin.x + input.companionVelocity.x * input.horizonSeconds,
    y: input.companionOrigin.y + input.companionVelocity.y * input.horizonSeconds
  };
  const terminalDistance = Math.hypot(
    companionEndpoint.x - playerEndpoint.x,
    companionEndpoint.y - playerEndpoint.y
  );

  return evaluateA1G3EgressPolicy({
    physicalEvidence,
    initialHardClearance: initialDistance - threshold,
    terminalHardClearance: terminalDistance - threshold
  });
}

describe("Authority-A1.2f egress-aware G3 policy", () => {
  it("passes a trajectory that remains strictly clear", () => {
    const result = classify({
      horizonSeconds: 1,
      companionOrigin: { x: 2, y: 0 },
      companionVelocity: { x: 1, y: 0 },
      playerOrigin: { x: 0, y: 0 },
      playerVelocity: { x: 1, y: 0 },
      playerMovingUntilSeconds: 1
    });

    expect(result.status).toBe("PASS_CLEAR");
    expect(result.decision).toBe("PASS");
    expect(result.monotonicEgressEvidence).toBe(false);
  });

  it("fails a new hard-body overlap from an initially clear state", () => {
    const result = classify({
      horizonSeconds: 1,
      companionOrigin: { x: 2, y: 0 },
      companionVelocity: { x: -1, y: 0 },
      playerOrigin: { x: 0, y: 0 },
      playerVelocity: { x: 1, y: 0 },
      playerMovingUntilSeconds: 1
    });

    expect(result.status).toBe("FAIL_NEW_OVERLAP");
    expect(result.decision).toBe("FAIL");
  });

  it("holds predicted touch instead of silently treating contact as ordinary PASS", () => {
    const result = classify({
      horizonSeconds: 1,
      companionOrigin: { x: 1.6, y: 0 },
      companionVelocity: { x: -1, y: 0 },
      playerOrigin: { x: 0, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      playerMovingUntilSeconds: 0
    });

    expect(result.status).toBe("HOLD_PREDICTED_TOUCH");
    expect(result.decision).toBe("HOLD");
    expect(result.touchPolicyClaim).toBe("PREDICTED_TOUCH_HOLDS_A1_2F");
  });

  it("passes monotonic partial egress from pre-existing overlap without demanding instant full separation", () => {
    const result = classify({
      horizonSeconds: 0.1,
      companionOrigin: { x: 0.4, y: 0 },
      companionVelocity: { x: 0.5, y: 0 },
      playerOrigin: { x: 0, y: 0 },
      playerVelocity: { x: -0.5, y: 0 },
      playerMovingUntilSeconds: 0.1
    });

    expect(result.startsInHardOverlap).toBe(true);
    expect(result.endsInHardOverlap).toBe(true);
    expect(result.terminalHardClearance).toBeGreaterThan(result.initialHardClearance);
    expect(result.status).toBe("PASS_MONOTONIC_EGRESS");
    expect(result.decision).toBe("PASS");
    expect(result.monotonicEgressEvidence).toBe(true);
  });

  it("holds pre-existing overlap that merely persists without recovery", () => {
    const result = classify({
      horizonSeconds: 1,
      companionOrigin: { x: 0.4, y: 0 },
      companionVelocity: { x: 0, y: 0 },
      playerOrigin: { x: 0, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      playerMovingUntilSeconds: 0
    });

    expect(result.status).toBe("HOLD_PREEXISTING_CONTACT_NOT_EGRESSING");
    expect(result.decision).toBe("HOLD");
    expect(result.monotonicEgressEvidence).toBe(false);
  });

  it("fails a trajectory that ends better but first deepens pre-existing overlap", () => {
    const result = classify({
      horizonSeconds: 1,
      companionOrigin: { x: 0.4, y: 0 },
      companionVelocity: { x: 1, y: 0 },
      playerOrigin: { x: 0, y: 0 },
      playerVelocity: { x: 2, y: 0 },
      playerMovingUntilSeconds: 0.3
    });

    expect(result.terminalHardClearance).toBeGreaterThan(result.initialHardClearance);
    expect(result.minimumHardClearance).toBeLessThan(result.initialHardClearance);
    expect(result.status).toBe("FAIL_WORSENING_PREEXISTING_OVERLAP");
    expect(result.decision).toBe("FAIL");
  });

  it("allows exact pre-existing touch only when it monotonically separates", () => {
    const result = classify({
      horizonSeconds: 0.5,
      companionOrigin: { x: 0.6, y: 0 },
      companionVelocity: { x: 0.5, y: 0 },
      playerOrigin: { x: 0, y: 0 },
      playerVelocity: { x: -0.5, y: 0 },
      playerMovingUntilSeconds: 0.5
    });

    expect(result.startsAtHardTouch).toBe(true);
    expect(result.status).toBe("PASS_MONOTONIC_EGRESS");
    expect(result.decision).toBe("PASS");
  });

  it("adapts qualified A1.2e evidence without gaining cooperation or selection authority", async () => {
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
      const playerFuture = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: horizon,
        staticTraversal: (from, target, radius, options) =>
          world.staticCircleTraversal(from, target, radius, options)
      }).hypotheses[0]!;
      const realization = realizeA1DirectCandidate({
        candidate: {
          id: "a1-2f-hold",
          family: "HOLD",
          sourceTick: situation.tick,
          desiredVelocity: { x: 0, y: 0 },
          localBasisSource: "NONE"
        },
        capability: world.actorMovementCapability("companion"),
        horizonSeconds: horizon
      });
      const result = evaluateA1DirectPlayerG3EgressPolicy({
        situation,
        realization,
        playerFuture
      });

      expect(result.inputProvenance).toBe("QUALIFIED_A1_2E_DIRECT_HARD_RADIUS_EVIDENCE");
      expect(result.hardSafetyScopeClaim).toBe("PLAYER_COMPANION_HARD_RADII_ONLY_A1_2F");
      expect(result.cooperationClaim).toBe("NONE_A1_2F");
      expect(result.selectionClaim).toBe("NONE_A1_2F_POLICY_ONLY");
      expect(result.runtimeAuthorityClaim).toBe("NONE_A1_2F");
    } finally {
      world.dispose();
    }
  });
});
